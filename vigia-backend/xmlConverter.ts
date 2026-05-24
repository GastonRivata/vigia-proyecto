import { js2xml } from 'xml-js';

export interface RojosoftConfig {
  planta: string;
  cliente: string;
  clienteIVA?: string;
  clienteRetencion?: string;
  comprobante: string;
  puntoVenta: string;
  nroComprobante: string;
  ordenCompra: string; // Integration Key
  facturaAfe: string; // ID de vinculacion
  facturaCuerpoAfe: string; // ID de vinculacion cuerpo
  tipoComprobanteCAI: number;
  idTablaWS: string;
  centroCosto1: string;
  centroCosto2: string;
  porcentaje1: number;
  porcentaje2: number;
  moneda: string;
  condicionPago: string;
  cotizacion?: number;
  flow: 'A' | 'B' | 'C';
  alicuotaRetencion?: number;
  importeBaseRetencion?: number;
  provinciaRetencion?: string;
}

// Helper to format dates for Rojosoft (YYYY-MM-DDTHH:MM:SS)
const formatDate = (dateStr: string) => {
  if (!dateStr) return new Date().toISOString().split('T')[0] + 'T00:00:00';
  // Attempt to isolate YYYY-MM-DD if ISO string with time was passed
  const baseDate = dateStr.split('T')[0];
  return `${baseDate}T00:00:00`;
};

export function jsonToRojosoftSoapXml(jsonData: any, config: RojosoftConfig) {
  const letra = jsonData.cabecera?.tipo?.includes('A') ? 'A' : (jsonData.cabecera?.tipo?.includes('B') ? 'B' : 'C');
  const fecha = formatDate(jsonData.cabecera?.fecha);
  const cotizacion = parseFloat(config.cotizacion as any) || 1;
  const moneda = config.moneda || 'PE';

  if (config.flow === 'C') {
    // Attempt to compute the retention either from details sum, or from general total.
    const sumDetail = jsonData.detalle?.reduce((acc: number, item: any) => acc + (parseFloat(item.importe) || 0), 0) || 0;
    const rawTotal = jsonData.totales?.total || 0;
    const importeRetencion = sumDetail > 0 ? sumDetail : parseFloat(rawTotal) || 0;
    const alicuotaRet = parseFloat(config.alicuotaRetencion as any) || 0.6;
    let baseCalculada = importeRetencion / (alicuotaRet / 100);
    const importeBaseRet = parseFloat(config.importeBaseRetencion as any) || (isFinite(baseCalculada) ? baseCalculada : 0);
    const provinciaRet = config.provinciaRetencion || 'S';
    
    // Safely format numbers
    const safe2 = (n: number) => (isNaN(n) || !isFinite(n) ? 0 : n).toFixed(2);
    const safe6 = (n: number) => (isNaN(n) || !isFinite(n) ? 0 : n).toFixed(6);

    const nroComp = (String(config.puntoVenta || '').replace(/\D/g, '') + String(config.nroComprobante || '').replace(/\D/g, '')) || '0';
    const cuit = jsonData.cabecera?.cuit_emisor?.replace(/\D/g, '') || '';
    
    const xmlStr = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Header>
    <AuthenticationHeader xmlns="http://www.rojosoft.com/webservice/serviceCuentaCorriente/">
      <Username>theeye</Username>
      <Password>theeye</Password>
    </AuthenticationHeader>
  </soap:Header>

  <soap:Body>
    <Insertar xmlns="http://www.rojosoft.com/webservice/serviceCuentaCorriente/">
      <recCuentaCorriente>

        <IDTabla>0</IDTabla>
        <IDTablaOrigen>0</IDTablaOrigen>
        <CuentaCorriente>0</CuentaCorriente>

        <Cliente>${config.cliente || '00152'}</Cliente>
        <ClienteIVA>${config.clienteIVA || '02100'}</ClienteIVA>
        <CondicionIVAClienteIVA>cRespInscripto</CondicionIVAClienteIVA>
        <ClienteRetencion>${config.clienteRetencion || '02100'}</ClienteRetencion>
        <ActualizaClienteRetencion>Unchecked</ActualizaClienteRetencion>

        <Comprobante>${config.comprobante || 'RTB'}</Comprobante>
        <Planta>${config.planta || 'PB'}</Planta>
        <NroComprobante>${nroComp}</NroComprobante>
        <Detalle>${(jsonData.detalle?.[0]?.descripcion || 'RETENCION IMPOSITIVA').substring(0, 40)}</Detalle>
        <Estado>FI</Estado>
 
        <CalculaRetencionIngrBrutos>Checked</CalculaRetencionIngrBrutos>
        <FechaOrigen>${fecha}</FechaOrigen>
        <Fecha>${fecha}</Fecha>
        <FechaContable>${fecha}</FechaContable>

        <Moneda>${moneda}</Moneda>
        <CotizacionMoneda>${safe6(cotizacion)}</CotizacionMoneda>

        <ImporteGravado>0.00</ImporteGravado>
        <ImporteNoGravado>0.00</ImporteNoGravado>
        <ImporteIVA>0.00</ImporteIVA>
        <AlicuotaIVA>0</AlicuotaIVA>
       
        <!-- TOTAL RETENCION -->
        <ImporteRetencionIngrBrutos>${safe2(importeRetencion)}</ImporteRetencionIngrBrutos>
        <AlicuotaRetencionIngrBrutos>${safe2(alicuotaRet)}</AlicuotaRetencionIngrBrutos>
        <ImporteNeto>${safe2(importeRetencion)}</ImporteNeto>
        <ImportePendAfectar>${safe2(importeRetencion)}</ImportePendAfectar>

        <!-- CUERPO -->
        <CuentaCorrienteCuerpos>
            <typCuentaCorrienteCuerpo>
                <IDTabla>0</IDTabla>
                <CuentaCorriente>0</CuentaCorriente>
                <Descripcion>${(jsonData.detalle?.[0]?.descripcion || 'RETENCION IMPOSITIVA').substring(0, 40)}</Descripcion>

                <Moneda>${moneda}</Moneda>
                <CotizacionMoneda>${safe6(cotizacion)}</CotizacionMoneda>

                <ImporteGravado>0.00</ImporteGravado>
                <ImporteNoGravado>0.00</ImporteNoGravado>
                <ImporteIVA>0.00</ImporteIVA>
                <AlicuotaIVA>0</AlicuotaIVA>
                
                <ImporteRetencionIngrBrutos>${safe2(importeRetencion)}</ImporteRetencionIngrBrutos>
                <AlicuotaRetencionIngrBrutos>${safe2(alicuotaRet)}</AlicuotaRetencionIngrBrutos>
                <ImporteNeto>${safe2(importeRetencion)}</ImporteNeto>

            </typCuentaCorrienteCuerpo>
        </CuentaCorrienteCuerpos>

        <CuentaCorrienteImpuestos>
            <typCuentaCorrienteImpuesto>
                <IDTabla>0</IDTabla>
                <CuentaCorriente>0</CuentaCorriente>
                <Provincia>${provinciaRet}</Provincia>
                <ImporteRetencion>${safe2(importeRetencion)}</ImporteRetencion>
                <AlicuotaRetencion>${safe2(alicuotaRet)}</AlicuotaRetencion>
                <ImporteBase>${safe2(importeBaseRet)}</ImporteBase>
                <DescProvincia>Retencion Ingresada por WS</DescProvincia>
            </typCuentaCorrienteImpuesto>
        </CuentaCorrienteImpuestos>
        
        <!-- AFECTACION -->
        <ImportePendAfectar>${safe2(importeRetencion)}</ImportePendAfectar>
        <DC>2</DC>
        <Concilia>Checked</Concilia>
        <AfectaCajaDirecto>0</AfectaCajaDirecto>
        <IVALibro>eilNinguno</IVALibro>
        <ClienteTDocSicore>dsCUIT</ClienteTDocSicore>
        <ClienteCuit>${cuit}</ClienteCuit>
        <Observacion>Retención practicada desde WS</Observacion>

      </recCuentaCorriente>

      <IDTablaWS>${config.idTablaWS || '1'}</IDTablaWS>
      <CopiaClienteDestino>false</CopiaClienteDestino>
      <LeeNegocioOrigen>Unchecked</LeeNegocioOrigen>
      <BuscaCotizacionMoneda>Unchecked</BuscaCotizacionMoneda>

    </Insertar>
  </soap:Body>
</soap:Envelope>`;

    return xmlStr;
  } else if (config.flow === 'A') {
    // serviceCuentaCorriente (Factura de Servicios)
    const xmlObj = {
      'soap:Envelope': {
        '_attributes': { 'xmlns:soap': 'http://schemas.xmlsoap.org/soap/envelope/' },
        'soap:Header': {
          'AuthenticationHeader': {
            '_attributes': { 'xmlns': 'http://www.rojosoft.com/webservice/serviceCuentaCorriente/' },
            'Username': 'theeye',
            'Password': 'theeye'
          }
        },
        'soap:Body': {
          'Insertar': {
            '_attributes': { 'xmlns': 'http://www.rojosoft.com/webservice/serviceCuentaCorriente/' },
            'recCuentaCorriente': {
              IDTabla: '0',
              IDTablaOrigen: '0',
              ExportacionContrato: '0',
              CuentaCorriente: '0',
              Planta: config.planta,
              Cliente: config.cliente,
              ClienteIVA: config.cliente,
              Comprobante: config.comprobante,
              NroComprobante: String(config.puntoVenta || '') + String(config.nroComprobante || ''),
              TipoComprobanteCAI: config.tipoComprobanteCAI || 1,
              Letra: letra,
              NroInterno: '0',
              Detalle: `FACTURA SERVICIO ${jsonData.cabecera?.razon_social_emisor || ''}`.substring(0, 100),
              FechaOrigen: fecha,
              Fecha: fecha,
              FechaContable: fecha,
              Moneda: moneda,
              CotizacionMoneda: Number(cotizacion).toFixed(6),
              ImporteGravado: Number(jsonData.totales?.neto_gravado || 0).toFixed(2),
              ImporteNoGravado: Number(jsonData.totales?.no_gravado || 0).toFixed(2),
              ImporteIVA: Number((jsonData.totales?.iva_21 || 0) + (jsonData.totales?.iva_105 || 0)).toFixed(2),
              ImportePercepcion: Number(jsonData.totales?.percepciones || 0).toFixed(2),
              ImporteNeto: Number(jsonData.totales?.total || 0).toFixed(2),
              Afecta: 'eaCCNoAfecta',
              DC: '1',
              Modulo: 'mCtaCte',
              Estado: 'FI',
              CuentaCorrienteCuerpos: {
                typCuentaCorrienteCuerpo: {
                  Descripcion: (jsonData.cabecera?.observaciones || jsonData.detalle?.[0]?.descripcion || 'SERVICIO').substring(0, 40),
                  Moneda: moneda,
                  CotizacionMoneda: Number(cotizacion).toFixed(6),
                  ImporteGravado: Number(jsonData.totales?.neto_gravado || 0).toFixed(2),
                  ImporteNoGravado: Number(jsonData.totales?.no_gravado || 0).toFixed(2),
                  ImporteIVA: Number((jsonData.totales?.iva_21 || 0) + (jsonData.totales?.iva_105 || 0)).toFixed(2),
                  AlicuotaIVA: Number(jsonData.detalle?.[0]?.alicuota_iva || 21.00).toFixed(2),
                  ImportePercepcion: Number(jsonData.totales?.percepciones || 0).toFixed(2),
                  AlicuotaPercepcion: Number(3.00).toFixed(2),
                  ImporteNeto: Number(jsonData.totales?.total || 0).toFixed(2)
                }
              },
              CuentaCorrienteCentroCostos: {
                typCuentaCorrienteCentroCosto: [
                  {
                    CuentaCorriente: '0',
                    CentroCosto: config.centroCosto1,
                    Porcentaje: Number(config.porcentaje1).toFixed(2)
                  },
                  ...(config.porcentaje2 > 0 ? [{
                    CuentaCorriente: '0',
                    CentroCosto: config.centroCosto2,
                    Porcentaje: Number(config.porcentaje2).toFixed(2)
                  }] : [])
                ]
              }
            },
            IDTablaWS: config.idTablaWS,
            CopiaClienteDestino: false
          }
        }
      }
    };
    return js2xml(xmlObj, { compact: true, spaces: 2 });
  } else {
    // servicefactura (Factura de Compra / Artículos)
    
    // Calculate totals exactly from bodies first to ensure perfect match with cabecera
    let sumGravadoCuerpos = 0;
    let sumIvaCuerpos = 0;
    let sumPercCuerpos = 0;

    const cabeceraPerc = jsonData.totales?.percepciones || 0;
    const inferredTotalGravado = jsonData.detalle?.reduce((acc: number, item: any) => acc + (item.total || 0), 0) || (jsonData.totales?.neto_gravado || 0);
    const inferredAlicuotaDGR = (inferredTotalGravado > 0 && cabeceraPerc > 0) ? (cabeceraPerc / inferredTotalGravado) * 100 : 0;

    const cuerpos = jsonData.detalle?.map((item: any, i: number) => {
      const gravado = item.total || 0;
      const alicuotaIva = item.alicuota_iva !== undefined ? item.alicuota_iva : 21.0;
      const iva = parseFloat((gravado * alicuotaIva / 100).toFixed(2));
      const alicuotaDgr = item.alicuota_percepcion_dgr !== undefined ? Number(item.alicuota_percepcion_dgr) : inferredAlicuotaDGR;
      const percDgr = parseFloat((gravado * alicuotaDgr / 100).toFixed(2));
      const neto = parseFloat((gravado + iva + percDgr).toFixed(2));

      sumGravadoCuerpos += gravado;
      sumIvaCuerpos += iva;
      sumPercCuerpos += percDgr;

      return {
        Articulo: item.codigo_articulo || '0001',
        ArticuloPrecio: item.articulo_precio || '117862',
        Cantidad: Number(item.cantidad || 1).toFixed(2),
        Precio: Number(item.precio || 0).toFixed(2),
        Costo: Number(item.precio || 0).toFixed(2),
        Moneda: moneda,
        CotizacionMoneda: Number(cotizacion).toFixed(6),
        ImporteGravado: Number(gravado).toFixed(2),
        AlicuotaIVA: Number(alicuotaIva).toFixed(2),
        ImporteIVA: Number(iva).toFixed(2),
        AlicuotaPercepcionDGR: Number(alicuotaDgr).toFixed(2),
        ImportePercepcionDGR: Number(percDgr).toFixed(2),
        ImporteNeto: Number(neto).toFixed(2),
        FacturaAfe: String(item.id_cuerpo_facafe || config.facturaAfe || 0),
        FacturaCuerpoAfe: String(item.id_cuerpo_afe || config.facturaCuerpoAfe || 0),
        CantidadAfectar: (config.facturaAfe && (item.id_cuerpo_afe || config.facturaCuerpoAfe)) ? Number(item.cantidad || 1).toFixed(2) : '0.00',
        ActualizaCtaCte: '1',
        Orden: String(i + 1)
      };
    }) || [];

    const cabeceraGravado = sumGravadoCuerpos > 0 ? Number(sumGravadoCuerpos.toFixed(2)) : (jsonData.totales?.neto_gravado || 0);
    const cabeceraIva = sumIvaCuerpos > 0 ? Number(sumIvaCuerpos.toFixed(2)) : ((jsonData.totales?.iva_21 || 0) + (jsonData.totales?.iva_105 || 0));
    // Use sum of bodies for true match if available
    const finalCabeceraPerc = sumPercCuerpos > 0 ? Number(sumPercCuerpos.toFixed(2)) : cabeceraPerc;
    const cabeceraNoGravado = jsonData.totales?.no_gravado || 0;
    const cabeceraNeto = Number((cabeceraGravado + cabeceraIva + finalCabeceraPerc + cabeceraNoGravado).toFixed(2));

    const xmlObj = {
      'soap:Envelope': {
        '_attributes': { 'xmlns:soap': 'http://schemas.xmlsoap.org/soap/envelope/' },
        'soap:Header': {
          'AuthenticationHeader': {
            '_attributes': { 'xmlns': 'http://www.rojosoft.com/webservice/servicefactura/' },
            'Username': 'theeye',
            'Password': 'theeye'
          }
        },
        'soap:Body': {
          'Insertar': {
            '_attributes': { 'xmlns': 'http://www.rojosoft.com/webservice/servicefactura/' },
            'recFactura': {
              Letra: letra,
              Comprobante: config.comprobante,
              NegocioTipo: 'COF',
              Planta: config.planta,
              Cliente: config.cliente,
              CondicionPago: config.condicionPago || '0001',
              NumeroComprobante: String(config.puntoVenta || '') + String(config.nroComprobante || ''),
              ListaPrecio: '0001',
              Moneda: moneda,
              CotizacionMoneda: Number(cotizacion).toFixed(6),
              DiasVencimiento: '30',
              FechaOrigen: fecha,
              FechaVencimiento: fecha,
              FechaContable: fecha,
              Estado: 'FI',
              NumeradorPreimpreso: 'FCOM',
              ImporteGravado: Number(cabeceraGravado).toFixed(2),
              ImporteNoGravado: Number(cabeceraNoGravado).toFixed(2),
              ImporteIVA: Number(cabeceraIva).toFixed(2),
              ImportePercepcionDGR: Number(finalCabeceraPerc).toFixed(2),
              ImporteNeto: Number(cabeceraNeto).toFixed(2),
              TipoTrans: 'CA',
              Zona: '0001',
              TipoComprobanteCAI: config.tipoComprobanteCAI || 1,
              CotizacionMonedaCC: Number(cotizacion).toFixed(6),
              FacturaCuerpos: {
                typFacturaCuerpo: cuerpos
              },
              FacturaCentroCostos: {
                typFacturaCentroCosto: {
                  CentroCosto: config.centroCosto1,
                  Porcentaje: Number(config.porcentaje1).toFixed(2),
                  Importe: Number((cabeceraGravado * config.porcentaje1 / 100).toFixed(2)).toFixed(2)
                }
              },
              FacturaImpuestos: {
                typFacturaImpuesto: (jsonData.totales?.impuestos_provinciales && Array.isArray(jsonData.totales.impuestos_provinciales) && jsonData.totales.impuestos_provinciales.length > 0)
                  ? jsonData.totales.impuestos_provinciales.map((imp: any) => ({
                      Provincia: imp.provincia || imp.Provincia || 'B',
                      ImporteBase: Number(imp.importe_base || imp.ImporteBase || cabeceraGravado).toFixed(2),
                      AlicuotaPercepcion: Number(imp.alicuota || imp.AlicuotaRetencion || imp.AlicuotaPercepcion || 0).toFixed(2),
                      ImportePercepcion: Number(imp.importe || imp.ImportePercepcion || 0).toFixed(2)
                    }))
                  : [
                      {
                        Provincia: 'B',
                        ImporteBase: Number(cabeceraGravado).toFixed(2),
                        AlicuotaPercepcion: '0.00',
                        ImportePercepcion: '0.00'
                      }
                    ]
              },
              FacturaCondicionPagos: {
                typFacturaCondicionPago: {
                  IDTabla: '0',
                  Factura: '0',
                  Porcentaje: '100.00',
                  Importe: Number(cabeceraNeto).toFixed(2),
                  Fecha: fecha
                }
              }
            },
            IDTablaWS: config.idTablaWS
          }
        }
      }
    };
    return js2xml(xmlObj, { compact: true, spaces: 2 });
  }
}
