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
        clasificacion_factura: { type: Type.STRING, description: "Debe ser 'Factura de Compras' o 'Factura de Servicios' según el contenido" },
        referencia_remito: { type: Type.STRING, description: "Número de remito si se menciona explícitamente, de lo contrario vacío" },
        conclusion_plan_cuenta: { type: Type.STRING, description: "Conclusión de una o dos palabras de la cuenta contable (Ej: Honorarios, Computación, Insumos) según el detalle" },
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
    vencimiento_cae: { type: Type.STRING },
    carta_porte: {
      type: Type.OBJECT,
      properties: {
        CarPorte: { type: Type.STRING },
        Cosecha: { type: Type.STRING },
        Chofer: { type: Type.STRING },
        NroRegistroChofer: { type: Type.STRING },
        PatenteChasis: { type: Type.STRING },
        PatenteAcoplado: { type: Type.STRING },
        KilometrosAsfalto: { type: Type.STRING },
        TarifaAsfalto: { type: Type.STRING },
        FechaCarPorte: { type: Type.STRING },
        FechaVtoCarPorte: { type: Type.STRING },
        FechaIngreso: { type: Type.STRING },
        FechaSalida: { type: Type.STRING },
        FechaDescarga: { type: Type.STRING },
        KgsBruto: { type: Type.STRING },
        KgsTara: { type: Type.STRING },
        KgsNeto: { type: Type.STRING },
        KgsBrutoDescarga: { type: Type.STRING },
        KgsTaraDescarga: { type: Type.STRING },
        KgsNetoDescarga: { type: Type.STRING },
        CUIT_Titular: { type: Type.STRING },
        CUIT_Remitente_Comercial: { type: Type.STRING },
        CUIT_Destinatario: { type: Type.STRING }
      }
    }
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

    let text = response.text;
    if (!text) {
      throw new Error("No se pudo extraer información del cheque.");
    }
    
    // Sanitize basic markdown formatting
    let cleanText = text.trim();
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```/, '').replace(/```$/, '').trim();
    }

    // Defensive handling for trailing commas or truncated JSON (simple fix for cut off)
    let parsedData;
    try {
      parsedData = JSON.parse(cleanText);
    } catch (parseError) {
      console.warn("JSON syntax error, attempting manual cleanup...", parseError);
      cleanText = cleanText.replace(/,\s*([}\]])/g, '$1');
      try {
        parsedData = JSON.parse(cleanText);
      } catch (secondError: any) {
        throw new Error(`Error en el formato de respuesta de IA: ${secondError.message}. Verifica que el documento sea legible.`);
      }
    }

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
  - Cartas de Porte Electrónicas (Logística/Agro) - CRÍTICO: Identificar si es Carta de Porte.

  REGLAS DE ORO DE EXTRACCIÓN:
  1. Identificar tipo de comprobante, punto de venta (4 dígitos), número (8 dígitos) y letra (A, B, C, M, X).
  2. Extraer CUIT emisor, razón social emisor, y CUIT del receptor.
  3. Para Facturas: Desglosar Neto Gravado, No Gravado, IVA (alícuotas 21%, 10.5%), Percepciones (IIBB, IVA, Ganancias) y Total. 
     - Clasificación Crítica: Establecer 'clasificacion_factura' como 'Factura de Compras' (bienes/mercadería) o 'Factura de Servicios'.
     - Remito vs Orden: Si el documento menciona explícitamente relación con un remito (ej: "REMITO: 4503123"), extraer este valor en 'referencia_remito' para forzar match con Remito.
     - Plan de Cuentas: Analizar el detalle de ítems, sacar conclusión sobre a qué cuenta contable corresponde el gasto/compra y dejar 1-2 palabras sugeridas en 'conclusion_plan_cuenta' (Ej: "Papelería", "Licencias", etc).
     Si existen percepciones provinciales (ej. Ingresos Brutos), detállalas en 'impuestos_provinciales', indicando provincia, base_imponible, alícuota e importe.
  4. Para Retenciones (CERTI-RET): 
     - El 'total' del documento es el MONTO RETENIDO (Importe Neto de la retención).
     - Identificar obligatoriamente la 'Base Imponible' (Monto sobre el cual se aplicó la retención).
     - Identificar la Jurisdicción/Provincia (Ej: Santa Fe -> S, Buenos Aires -> B, CABA -> C) y el porcentaje (%) de alícuota aplicado.
     - En 'detalle', crear una línea técnica resumiendo la retención.
  5. Extraer ítems de detalle: descripción, cantidad, precio unitario y total.
  6. Devolver la fecha en formato ISO 8601 (YYYY-MM-DD).
  7. El campo 'tipo' DEBE contener explícitamente la palabra 'RETENCION' si es un certificado de retención, o 'CARTA DE PORTE' si es Carta de Porte.
  8. PARA CARTA DE PORTE ELECTRÓNICA, rellena únicamente el objeto 'carta_porte' con estas reglas estrictas:
      - 'CarPorte': Extrae el 'CTG'.
      - 'Cosecha': Extrae la 'Campaña' (ej. 2526).
      - Identifica el 'Chofer'. Extrae CUIT numérico para 'NroRegistroChofer' y Apellido/Nombre para 'Chofer'.
      - Identifica 'Dominios'. La primera es 'PatenteChasis', la segunda 'PatenteAcoplado'.
      - 'KilometrosAsfalto': Extrae kms a recorrer. 'TarifaAsfalto': Extrae tarifa.
      - Fechas (ISO 8601 T): 'FechaCarPorte' (Emisión), 'FechaVtoCarPorte' (Vencimiento). En sección Descarga: 'FechaIngreso' (Fecha Arribo), 'FechaSalida' y 'FechaDescarga' (Descarga: Fecha).
      - Pesos Origen: 'KgsBruto', 'KgsTara', 'KgsNeto' (de la sección principal).
      - Pesos Descarga: 'KgsBrutoDescarga', 'KgsTaraDescarga', 'KgsNetoDescarga' (de la sección G-DESCARGA).
      - Clientes: 'CUIT_Titular' (Titular Carta de Porte), 'CUIT_Remitente_Comercial' (Remitente Comercial Profesional/Productor), 'CUIT_Destinatario' (Destinatario). Sólo Extrae CUITs (números).`;

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

    let text = response.text;
    if (!text) {
      throw new Error("No data extracted from document.");
    }
    
    // Sanitize basic markdown formatting
    let cleanText = text.trim();
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```/, '').replace(/```$/, '').trim();
    }

    // Defensive handling for trailing commas or truncated JSON (simple fix for cut off)
    let parsedData;
    try {
      parsedData = JSON.parse(cleanText);
    } catch (parseError) {
      console.warn("JSON syntax error, attempting manual cleanup...", parseError);
      // Remove trailing commas before closing braces/brackets
      cleanText = cleanText.replace(/,\s*([}\]])/g, '$1');
      try {
        parsedData = JSON.parse(cleanText);
      } catch (secondError: any) {
        throw new Error(`Error en el formato de respuesta de IA: ${secondError.message}. Verifica que el documento sea legible.`);
      }
    }

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
