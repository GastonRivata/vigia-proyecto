import { GoogleGenAI, Type } from "@google/genai";

const apiKey = typeof process !== 'undefined' && process.env.GEMINI_API_KEY 
  ? process.env.GEMINI_API_KEY 
  : import.meta.env.VITE_GEMINI_API_KEY;

const ai = new GoogleGenAI({ apiKey });

const EXTRACTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    cabecera: {
      type: Type.OBJECT,
      properties: {
        tipo: { type: Type.STRING, description: "Tipo de comprobante (e.g. Factura A, Retención)" },
        punto_venta: { type: Type.STRING, description: "Punto de venta (4 dígitos)" },
        numero: { type: Type.STRING, description: "Número de comprobante (8 dígitos)" },
        tipo_comprobante_cai: { type: Type.INTEGER, description: "Código TipoComprobanteCAI" },
        fecha: { type: Type.STRING, description: "ISO 8601 YYYY-MM-DD" },
        cuit_emisor: { type: Type.STRING },
        razon_social_emisor: { type: Type.STRING },
        cuit_receptor: { type: Type.STRING, description: "CUIT of the receiving entity (Villa María)" },
        moneda: { type: Type.STRING, description: "Standard currency code (e.g. ARS, USD)" }
      },
      required: ["tipo", "fecha", "cuit_emisor", "razon_social_emisor"]
    },
    detalle: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          codigo_articulo: { type: Type.STRING, description: "Código de artículo si existe" },
          descripcion: { type: Type.STRING },
          cantidad: { type: Type.NUMBER },
          precio: { type: Type.NUMBER },
          alicuota_iva: { type: Type.NUMBER, description: "Alicuota de IVA aplicada a este ítem, Ej: 21.0 or 10.5" },
          total: { type: Type.NUMBER }
        }
      }
    },
    totales: {
      type: Type.OBJECT,
      properties: {
        neto_gravado: { type: Type.NUMBER },
        iva_21: { type: Type.NUMBER },
        iva_105: { type: Type.NUMBER },
        percepciones: { type: Type.NUMBER },
        total: { type: Type.NUMBER },
        impuestos_provinciales: { 
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              provincia: { type: Type.STRING, description: "Provincia (e.g. B, S, C)" },
              importe_base: { type: Type.NUMBER },
              alicuota: { type: Type.NUMBER },
              importe: { type: Type.NUMBER }
            }
          }
        }
      }
    },
    cae_cai: { type: Type.STRING },
    vencimiento_cae: { type: Type.STRING }
  }
};

const CHECK_EXTRACTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    cuit_librador: { type: Type.STRING, description: "CUIT del emisor/firmante/librador del cheque (11 dígitos, ej: 20-12345678-9 o número continuo)." },
    razon_social_librador: { type: Type.STRING, description: "Razón social o nombre completo del firmante/titular de la cuenta." },
    banco: { type: Type.STRING, description: "Nombre de la entidad bancaria emisor (ej: Banco Galicia, Banco Nación, Santander, etc.)." },
    numero_cheque: { type: Type.STRING, description: "Número de cheque de 8 dígitos u ocasional de 9." },
    fecha_emision: { type: Type.STRING, description: "Fecha de emisión del cheque formatted as ISO YYYY-MM-DD" },
    fecha_pago: { type: Type.STRING, description: "Fecha de pago o cobro diferido formatted as ISO YYYY-MM-DD. Si es electrónico de pago inmediato, igual a fecha_emision." },
    importe: { type: Type.NUMBER, description: "Monto total del cheque en números decimales." },
    sucursal: { type: Type.STRING, description: "Sucursal o número de la sucursal bancaria." }
  },
  required: ["cuit_librador", "banco", "importe"]
};

export async function extractCheckData(base64Data: string, mimeType: string) {
  const prompt = `Actuá como un Ingeniero de Integraciones Senior y analista financiero experto en cheques de la República Argentina (cheques físicos, eCheques).
  Tu único objetivo es identificar y extraer la información legal, bancaria e impositiva del cheque escaneado o fotografiado con la mayor exactitud posible.
  
  PAUTAS CRÍTICAS DE EXTRACCIÓN:
  1. Identificar el CUIT del librador/firmante (dueño de la cuenta corriente que emite el cheque). Es un CUIT de 11 dígitos. Suele figurar cerca de la firma, en leyendas legales del sector inferior, o impreso como C.U.I.T. del emisor. Es clave para evaluar su estado crediticio.
  2. Extraer el nombre del Banco (por ejemplo BANCO GALICIA, BANCO NACION, SANTANDER RIO, etc.).
  3. Extraer el 'numero_cheque' identificador del documento.
  4. Extraer el importe total expresado en números o en texto traducido a números.
  5. Extraer la razón social / nombre del titular de la cuenta corriente (librador).
  6. Extraer las fechas de emisión y de pago diferido (si es cheque diferido de cobro futuro) en formato ISO YYYY-MM-DD.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview", 
      contents: [
        {
          parts: [
            { text: prompt },
            { inlineData: { data: base64Data, mimeType } }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: CHECK_EXTRACTION_SCHEMA as any
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No se pudo extraer información del cheque.");
    }
    
    const parsedData = JSON.parse(text);

    // Asegurar formato CUIT con guiones
    if (parsedData.cuit_librador && !parsedData.cuit_librador.includes('-')) {
      const c = parsedData.cuit_librador.replace(/\D/g, '');
      if (c.length === 11) {
        parsedData.cuit_librador = `${c.slice(0, 2)}-${c.slice(2, 10)}-${c.slice(10, 11)}`;
      }
    }
    
    return parsedData;
  } catch (error: any) {
    console.error("Gemini Check Extraction Error:", error);
    
    const errorString = typeof error === 'string' ? error : JSON.stringify(error) + (error.message ? error.message : "");
    if (errorString.includes("429") || errorString.includes("RESOURCE_EXHAUSTED") || errorString.includes("exceeded your current quota")) {
      throw new Error("Has excedido la cuota de uso de la API de Gemini. Espera un momento e inténtalo nuevamente.");
    }
    
    throw new Error(error.message || "Error procesando el cheque con Inteligencia Artificial.");
  }
}

export async function extractDocumentData(base64Data: string, mimeType: string) {
  const prompt = `Actuá como un Ingeniero de Integraciones Senior experto en sistemas ERP y consultoría contable. 
  Tu objetivo es extraer con máxima precisión los datos de comprobantes de terceros para mapearlos a una estructura de inserción corporativa (Rojosoft).
  
  MODO DE EXTRACCIÓN: NATIVO, NEURAL Y ESTRUCTURADO.
  
  TIPOS DE COMPROBANTES SOPORTADOS:
  - Facturas de Compra (Artículos/Stock)
  - Facturas de Servicios (Gastos)
  - Certificados de Retención (IIBB, Ganancias, SUSS, etc.) - CRÍTICO: Identificar claramente si es una Retención.

  REGLAS DE ORO DE EXTRACCIÓN:
  1. Identificar tipo de comprobante, punto de venta (4 dígitos), número (8 dígitos) y letra (A, B, C, M, X).
  2. Extraer CUIT emisor, razón social emisor, y CUIT del receptor.
  3. Para Facturas: Desglosar Neto Gravado, No Gravado, IVA (alícuotas 21%, 10.5%), Percepciones (IIBB, IVA, Ganancias) y Total. Si existen percepciones provinciales (ej. Ingresos Brutos), detállalas en 'impuestos_provinciales', indicando provincia, base_imponible, alícuota e importe.
  4. Para Retenciones (CERTI-RET): 
     - El 'total' del documento es el MONTO RETENIDO (Importe Neto de la retención).
     - Identificar obligatoriamente la 'Base Imponible' (Monto sobre el cual se aplicó la retención).
     - Identificar la Jurisdicción/Provincia (Ej: Santa Fe -> S, Buenos Aires -> B, CABA -> C) y el porcentaje (%) de alícuota aplicado.
     - En 'detalle', crear una línea técnica resumiendo la retención.
  5. Extraer ítems de detalle: descripción, cantidad, precio unitario y total.
  6. Devolver la fecha en formato ISO 8601 (YYYY-MM-DD).
  7. El campo 'tipo' DEBE contener explícitamente la palabra 'RETENCION' si es un certificado de retención.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview", 
      contents: [
        {
          parts: [
            { text: prompt },
            { inlineData: { data: base64Data, mimeType } }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: EXTRACTION_SCHEMA as any
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No data extracted from document.");
    }
    
    const parsedData = JSON.parse(text);

    // Asegurar CUIT con guiones (XX-XXXXXXXX-X)
    if (parsedData.cabecera?.cuit_emisor && !parsedData.cabecera.cuit_emisor.includes('-')) {
      const c = parsedData.cabecera.cuit_emisor.replace(/\D/g, '');
      if (c.length === 11) {
        parsedData.cabecera.cuit_emisor = `${c.slice(0, 2)}-${c.slice(2, 10)}-${c.slice(10, 11)}`;
      }
    }
    
    return parsedData;
  } catch (error: any) {
    console.error("Gemini Extraction Error:", error);
    
    const errorString = typeof error === 'string' ? error : JSON.stringify(error) + (error.message ? error.message : "");
    if (errorString.includes("429") || errorString.includes("RESOURCE_EXHAUSTED") || errorString.includes("exceeded your current quota")) {
      throw new Error("Has excedido la cuota de uso de la API de Gemini. Espera un momento e inténtalo nuevamente, o verifica tu plan.");
    }
    if (errorString.includes("503") || errorString.includes("UNAVAILABLE") || errorString.includes("high demand") || errorString.includes("Spikes in demand")) {
      throw new Error("Los servidores de IA están experimentando alta demanda momentánea. Por favor, vuelve a intentarlo en unos instantes.");
    }
    
    throw new Error(error.message || "Error procesando el documento con IA.");
  }
}
