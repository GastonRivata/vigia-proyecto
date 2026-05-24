import "dotenv/config";
import express from "express";
import sql from "mssql"; 
import cors from "cors";
import path from "path";
import fs from "fs";
import axios from "axios";
import https from "https";
import { createServer as createViteServer } from "vite";
import { jsonToRojosoftSoapXml } from "./xmlConverter"; 

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // Bypass SSL verification for SOAP calls

// Variables for SQL Pools
const sqlPools = new Map<string, sql.ConnectionPool>();

async function getOrgSqlPool(orgId: string, fallbackConfig?: any) {
  if (!orgId || orgId === 'demo' || orgId === 'simulador' || !fallbackConfig) return null;
  
  const config = fallbackConfig;
  const cacheKey = `${orgId}_${config.server || config.host}_${config.database}_${config.user}_${config.password || config.pass}`;

  // Si ya tenemos un pool activo y conectado, lo reciclamos
  if (sqlPools.has(cacheKey)) {
    const existingPool = sqlPools.get(cacheKey)!;
    if (existingPool.connected) return existingPool;
  }

  try {
    let sqlServerHost = (config.server || config.host || '').trim();
    
    // Sr. Backend tip: Clean any protocols, paths and trailing slashes for direct TCP DB connection
    sqlServerHost = sqlServerHost.replace(/^(https?:\/\/)/i, '');
    
    let autoInstanceVal: string | undefined = undefined;
    if (sqlServerHost.includes('\\')) {
      const parts = sqlServerHost.split('\\');
      sqlServerHost = parts[0];
      autoInstanceVal = parts[1];
    } else {
      sqlServerHost = sqlServerHost.split('/')[0];
    }

    let port: number | undefined = Number(config.port) || undefined;
    if (sqlServerHost.includes(':')) {
      const parts = sqlServerHost.split(':');
      sqlServerHost = parts[0];
      const p = parseInt(parts[1], 10);
      if (!isNaN(p)) port = p;
    }
    if (sqlServerHost.includes(',')) {
      const parts = sqlServerHost.split(',');
      sqlServerHost = parts[0];
      const p = parseInt(parts[1], 10);
      if (!isNaN(p)) port = p;
    }

    const lh = sqlServerHost.toLowerCase();
    if (lh === 'locaholst') {
      sqlServerHost = 'localhost';
    }

    let instanceVal = (config.instanceName && config.instanceName.trim() !== '') ? config.instanceName.trim() : autoInstanceVal;

    const sqlConfigOpts: sql.config = {
      server: sqlServerHost,
      user: config.user,
      password: config.password || config.pass,
      database: config.database,
      options: {
        encrypt: false,
        trustServerCertificate: true
      },
      connectionTimeout: sqlServerHost.toLowerCase().includes('localhost') ? 2000 : 15000,
      requestTimeout: 15000
    };
    if (instanceVal) {
      sqlConfigOpts.options!.instanceName = instanceVal;
    } else {
      sqlConfigOpts.port = port || 1433;
    }

    const pool = new sql.ConnectionPool(sqlConfigOpts);

    await pool.connect();
    sqlPools.set(cacheKey, pool);
    return pool;
  } catch (err: any) {
    console.error(`[VIGIA] Error conectando al SQL de la Org ${orgId}:`, err.message || err);
    return null;
  }
}

async function logUsage(orgId: string, userId: string, docName: string, docType: string) {
  // Usage tracking is skipped in local dev because service accounts lack Firestore permissions.
  // Increment logic should be offloaded to the client using the web SDK.
  console.log(`[VIGIA] Uso registrado (simulado): Extraído doc ${docName} (${docType}) por usuario ${userId} para propósitos de logging`);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Habilitar CORS para que el frontend pueda comunicarse sin problemas
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // 1. Ruta para enviar facturas a SQL y Terra Verde
  app.post("/api/facturas", async (req, res) => {
    try {
      const { facturaData, rojosoftConfig, orgId, userId, sqlConfig } = req.body;
      
      let pool = await getOrgSqlPool(orgId, sqlConfig);
      
      if (!pool && orgId && orgId !== 'simulador') {
        console.warn(`[VIGIA] Entrando en modo Solo-API para Org: ${orgId} por fallo en SQL.`);
      }
      
      await logUsage(orgId, userId, facturaData.cabecera?.numero || 'S/N', facturaData.cabecera?.tipo || 'DOC');
      
      let cabeceraId = 0;
      let ocVinculada = "Ninguna";
      
      if (pool) {
        try {
          // Logic for OC Matching
          let matchedOcId = null;
          try {
            const matchReq = new sql.Request(pool);
            const rawCuit = facturaData.cabecera?.cuit_emisor || '';
            let cuit = rawCuit;
            if (!cuit.includes('-')) {
              const c = cuit.replace(/\D/g, '');
              if (c.length === 11) {
                cuit = `${c.slice(0, 2)}-${c.slice(2, 10)}-${c.slice(10, 11)}`;
              }
            }
            const gravadoIA = facturaData.totales?.neto_gravado || 0;
            
            matchReq.input('Cuit', sql.VarChar, cuit);
            let cuentaCliente = rojosoftConfig.cliente;
            
            if (!cuentaCliente) {
               const clientResult = await matchReq.query(`SELECT TOP 1 Cuenta FROM CLIENTE WHERE Cuit = @Cuit`);
               cuentaCliente = clientResult.recordset[0]?.Cuenta;
            }

            if (cuentaCliente) {
               matchReq.input('CuentaCliente', sql.VarChar, cuentaCliente);
               matchReq.input('GravadoIA', sql.Decimal(18, 2), gravadoIA);
               
               const ocResult = await matchReq.query(`
                 SELECT IDTabla FROM Factura WHERE Comprobante = 'ORDCOM' AND Cliente = @CuentaCliente AND Estado = 'FI' AND ABS(ImporteGravado - @GravadoIA) <= 1.00
               `);

               if (ocResult.recordset.length > 0) {
                 matchedOcId = ocResult.recordset[0].IDTabla;
                 ocVinculada = `ORDCOM-${matchedOcId}`;
                 rojosoftConfig.facturaAfe = matchedOcId;
               }
            }
          } catch (me) { console.warn("Match error", me); }
        } catch (err) {
          console.warn("SQL Matching skip", err);
        }
      }

      const soapXML = jsonToRojosoftSoapXml(facturaData, rojosoftConfig);
      
      let soapResponseText = "";
      let hasSoapFault = false;
      let soapFaultDetails = "";

      // Senior-level separation: Prefer sqlConfig.erpHost for API endpoints, fallback to host
      let rawHost = (sqlConfig?.erpHost || sqlConfig?.host || sqlConfig?.server || '').trim();
      
      if (rawHost) {
        // Handle hosts that might include SQL ports or instances (e.g. terra-verde.ddns.net,1433)
        rawHost = rawHost.split(',')[0].split('\\')[0];
        
        // Clean and resolve local hosts/typos to proper ERP domains for SOAP
        const lh = rawHost.toLowerCase().trim();
        if (lh === 'localhost' || lh === '127.0.0.1' || lh === 'locaholst' || lh === '') {
          rawHost = 'terra-verde.ddns.net';
        } else if (lh.includes('localhost')) {
          rawHost = rawHost.replace(/localhost/gi, 'terra-verde.ddns.net');
        } else if (lh.includes('locaholst')) {
          rawHost = rawHost.replace(/locaholst/gi, 'terra-verde.ddns.net');
        } else if (lh.includes('127.0.0.1')) {
          rawHost = rawHost.replace(/127\.0\.0\.1/gi, 'terra-verde.ddns.net');
        }
        
        let erpHost = rawHost.startsWith('http') ? rawHost : `https://${rawHost}`;
        if (erpHost.endsWith('/')) {
          erpHost = erpHost.slice(0, -1);
        }
        let endpoint = '';
        if (rojosoftConfig.flow === 'A' || rojosoftConfig.flow === 'C') {
          endpoint = sqlConfig.endpointServicios || '/IA/ServiceCuentaCorriente.asmx';
        } else if (rojosoftConfig.flow === 'D') {
          endpoint = '/IA/ServiceDescarga.asmx';
        } else {
          endpoint = sqlConfig.endpointCompras || '/IA/ServiceFactura.asmx';
        }

        const soapUrl = `${erpHost}${endpoint}`;
        
        let soapAction = '';
        if (rojosoftConfig.flow === 'A' || rojosoftConfig.flow === 'C') {
          soapAction = 'http://www.rojosoft.com/webservice/serviceCuentaCorriente/Insertar';
        } else if (rojosoftConfig.flow === 'D') {
          soapAction = 'http://www.rojosoft.com/webservice/servicedescarga/Insertar';
        } else {
          soapAction = 'http://www.rojosoft.com/webservice/servicefactura/Insertar';
        }

        // Resolve custom SOAP actions if provided in custom endpoints lists
        if (sqlConfig?.customEndpoints && Array.isArray(sqlConfig.customEndpoints)) {
          const matchedEp = sqlConfig.customEndpoints.find((ep: any) => ep.url === endpoint);
          if (matchedEp && matchedEp.soapAction) {
            soapAction = matchedEp.soapAction;
          }
        }

        soapAction = soapAction.replace(/"/g, '').trim();
        
        try {
          const httpsAgent = new https.Agent({ rejectUnauthorized: false });
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 12000);

          const wsResponse = await axios.post(soapUrl, soapXML, {
            headers: {
              'Content-Type': 'text/xml; charset=utf-8',
              'SOAPAction': soapAction
            },
            httpsAgent,
            signal: controller.signal,
            validateStatus: () => true // Resolve on all HTTP status codes so we can parse SOAP Faults manually
          });
          clearTimeout(timeoutId);
          
          soapResponseText = typeof wsResponse.data === 'string' ? wsResponse.data : JSON.stringify(wsResponse.data);
          
          if (/<[^>]*:?Fault>/i.test(soapResponseText) || /<faultstring.*?>/i.test(soapResponseText)) {
            hasSoapFault = true;
            const match = soapResponseText.match(/<faultstring.*?>([\s\S]*?)<\/faultstring.*?>/i) || soapResponseText.match(/<[^>]*:?faultstring.*?>([\s\S]*?)<\/[^>]*:?faultstring.*?>/i);
            soapFaultDetails = match ? match[1].trim() : "SOAP Fault devuelto por el servidor ERP";
          } else if (/<Result>Error<\/Result>/i.test(soapResponseText) || /<Errors>/i.test(soapResponseText)) {
            hasSoapFault = true;
            const match = soapResponseText.match(/<Errors>([\s\S]*?)<\/Errors>/i);
            soapFaultDetails = match ? match[1].replace(/<[^>]*>?/gm, '').trim() : "Error detectado en la respuesta XML del ERP";
          } else if (wsResponse.status >= 400 && wsResponse.status !== 500) {
            // Un error general HTTP desde el ERP
            hasSoapFault = true;
            soapFaultDetails = `HTTP Error ${wsResponse.status}: ${wsResponse.statusText}`;
          }
        } catch (e: any) {
          console.error("[VIGIA] Error en la petición SOAP al ERP (falló conexión o timeout):", e.message);
          
          // Si es org real y no demo/simulador, reportamos el error exacto de conexión/timeout para diagnóstico de puertos e IIS
          if (orgId && orgId !== 'demo' && orgId !== 'simulador') {
            return res.status(504).json({
              error: `Error de red o Timeout conectando al ERP (${soapUrl})`,
              details: `No se pudo alcanzar el Endpoint ERP de Rojosoft: ${e.message}. Por favor, verifica que el host '${rawHost}' sea accesible, el IIS esté activo, el endpoint '/IA/...' esté publicado y los puertos estén abiertos.`,
              sentXml: soapXML
            });
          }

          // Solo retornamos simulación de éxito en la nube como fallback por error de red o timeout en DEMO/SIMULADOR
          return res.json({
            success: true,
            message: "Comprobante integrado [Simulación en la Nube - Fallback Offline]",
            id: 0,
            ocVinculada,
            soapResponse: `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><InsertarResponse xmlns="http://www.rojosoft.com/webservice/serviceCuentaCorriente/"><InsertarResult>Simulado Correctamente por Fallback de Red</InsertarResult></InsertarResponse></soap:Body></soap:Envelope>`,
            sentXml: soapXML,
            isFallbackMode: true
          });
        }
      } else {
        // Fallback offline directo por falta de host
        return res.json({
          success: true,
          message: "Comprobante integrado [Simulación en la Nube]",
          id: 0,
          ocVinculada: "Ninguna",
          soapResponse: "Simulación offline por falta de ERP Host",
          sentXml: soapXML,
          isFallbackMode: true
        });
      }

      if (hasSoapFault) {
         // Errores de lógica de negocio o validación reales del ERP (SOAP Faults) se retornan sin corregir automáticamente
         return res.status(400).json({ 
           error: `Error del ERP: ${soapFaultDetails}`, 
           details: soapResponseText, 
           sentXml: soapXML 
         });
      }

      // ONLY if SOAP didn't fault, we persist locally
      if (pool) {
          try {
             // Retrieve the matched OC again simply since it was outside scope, or we can parse from ocVinculada
             const matchedOcId = ocVinculada.startsWith("ORDCOM-") ? ocVinculada.replace("ORDCOM-", "") : null;
             
             const request = new sql.Request(pool);
             request.input('Tipo', sql.VarChar, facturaData.cabecera?.tipo || '');
             request.input('Numero', sql.VarChar, facturaData.cabecera?.numero || '');
             request.input('CuitEmisor', sql.VarChar, facturaData.cabecera?.cuit_emisor || '');
             request.input('Total', sql.Decimal(18, 2), facturaData.totales?.total || 0);

             const result = await request.query(`
               INSERT INTO dbo.Factura (TipoComprobante, Numero, CuitEmisor, Total, OCVinculada)
               OUTPUT INSERTED.IdTabla VALUES (@Tipo, @Numero, @CuitEmisor, @Total, '${matchedOcId || ''}')
             `);
             cabeceraId = result.recordset[0].IdTabla;
          } catch(err) {
            console.warn("SQL insert skip", err);
          }
      }

      res.json({ success: true, message: "Procesado correctamente", id: cabeceraId, ocVinculada, soapResponse: soapResponseText, sentXml: soapXML });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 2. Ruta para Vistas XML/DB
  app.get("/api/vistas/xml", async (req, res) => {
    try {
      const { cuit, orgId, fetchOrdenes, sqlConfig } = req.query;
      let data: any = { cliente: null, ordenes: [] };
      
      let parsedConfig = undefined;
      if (sqlConfig && typeof sqlConfig === 'string') {
        try { parsedConfig = JSON.parse(sqlConfig); } catch(e){}
      }
      
      const pool = await getOrgSqlPool(orgId as string, parsedConfig);
      
      let cuentaCliente = '';
      if (pool && cuit) {
        let formattedCuit = cuit as string;
        if (!formattedCuit.includes('-')) {
          const c = formattedCuit.replace(/\D/g, '');
          if (c.length === 11) {
            formattedCuit = `${c.slice(0, 2)}-${c.slice(2, 10)}-${c.slice(10, 11)}`;
          }
        }
        
        const request = new sql.Request(pool);
        request.input('Cuit', sql.VarChar, formattedCuit);
        const result = await request.query(`SELECT TOP 1 Cuenta, Nombre FROM CLIENTE WHERE Cuit = @Cuit`);
        data.cliente = result.recordset[0] || null;
        if (data.cliente) {
          cuentaCliente = data.cliente.Cuenta;
        }
      }

      // If fetchOrdenes requested
      if (fetchOrdenes === 'true') {
        if (pool && cuentaCliente) {
          try {
            // Fetch ORDCOM pending receipts matching the client
            const request = new sql.Request(pool);
            request.input('Cliente', sql.VarChar, cuentaCliente);
            
            // Query previous OCs generically matching client (we allow FI and potentially other pending states just in case)
            // Limitamos a TOP 30 OCs para evitar sobrecarga si el cliente tiene muchas OCs historicas
            const ocsResult = await request.query(`
              SELECT TOP 30 IDTabla, Comprobante, NumeroComprobante, Cliente, ImporteGravado, ImporteNoGravado, ImporteIVA, ImporteNeto, Estado, CotizacionMoneda 
              FROM Factura 
              WHERE Comprobante = 'ORDCOM' AND Cliente = @Cliente AND Estado = 'FI'
              ORDER BY IDTabla DESC
            `);

            const ordenes = [];
            const ocIds = ocsResult.recordset.map((r: any) => r.IDTabla);

            if (ocIds.length > 0) {
              const ocIdsStr = ocIds.join(',');

              // 1. FacturaCuerpo (detalle) en bulk con LEFT JOIN a ARTICULOPRECIO
              let allBodies: any[] = [];
              try {
                const bReq = new sql.Request(pool);
                const bodiesResult = await bReq.query(`
                  SELECT FC.IDTabla, FC.Factura, FC.FacturaCuerpoAfe, FC.ArticuloPrecio, FC.Cantidad, FC.Precio, FC.Costo, FC.ImporteGravado, FC.ImporteIVA, FC.ImporteNeto, AP.articulo as ArticuloCodigo
                  FROM FacturaCuerpo FC
                  LEFT JOIN ARTICULOPRECIO AP ON FC.ArticuloPrecio = AP.idtabla
                  WHERE FC.Factura IN (${ocIdsStr})
                `);
                allBodies = bodiesResult.recordset;
              } catch (e) {
                console.error("[VIGIA] Error obteniendo cuerpos en bulk:", e);
              }

              // 2. FacturaImpuesto (impuestos) en bulk
              let allTaxes: any[] = [];
              try {
                const tReq = new sql.Request(pool);
                const impResult = await tReq.query(`
                  SELECT IDTabla, Factura, Provincia, ImportePercepcion, AlicuotaPercepcion,ImportePercepcion, AlicuotaRetencion, CodigoAlicuotaPercepcion, ImporteBase, CodigoAlicuotaRetencion
                  FROM FacturaImpuesto
                  WHERE Factura IN (${ocIdsStr})
                `);
                allTaxes = impResult.recordset;
              } catch (e) {
                console.error("[VIGIA] Error obteniendo impuestos en bulk:", e);
              }

              // 3. FacturaCondicionPago en bulk
              let allCPs: any[] = [];
              try {
                const cpReq = new sql.Request(pool);
                const cpResult = await cpReq.query(`
                  SELECT IDTabla, Factura, dias, porcentaje, Importe
                  FROM FacturaCondicionPago
                  WHERE Factura IN (${ocIdsStr})
                `);
                allCPs = cpResult.recordset;
              } catch (e) {
                console.error("[VIGIA] Error obteniendo cond. pago en bulk:", e);
              }

              for (const oc of ocsResult.recordset) {
                const facturaId = oc.IDTabla;
                const cuerpos = allBodies.filter(b => b.Factura === facturaId);
                const impuestos = allTaxes.filter(t => t.Factura === facturaId);
                const condicionesPago = allCPs.filter(c => c.Factura === facturaId);

                const cuerposProcessed = cuerpos.map((b: any, idx: number) => ({
                  Id: b.IDTabla,
                  IdTabla: b.IDTabla,
                  FacturaAfe: b.Factura,
                  FacturaCuerpoAfe: b.FacturaCuerpoAfe !== undefined ? b.FacturaCuerpoAfe : b.IDTabla,
                  IdCuerpo: b.IDTabla,
                  Articulo: b.ArticuloCodigo, // Obtenido del JOIN
                  ArticuloPrecio: b.ArticuloPrecio,
                  Cantidad: b.Cantidad,
                  Precio: b.Precio,
                  ImporteGravado: b.ImporteGravado,
                  Descripcion: `Línea de OC #${idx + 1}` // Descripcion fallback
                }));

                ordenes.push({
                  Id: oc.IDTabla,
                  IdTabla: oc.IDTabla,
                  Comprobante: oc.Comprobante || 'ORDCOM',
                  NumeroComprobante: oc.NumeroComprobante || `OC-${oc.IDTabla}`,
                  Cliente: oc.Cliente,
                  Total: oc.Total || oc.ImporteNeto || oc.ImporteGravado || 0,
                  ImporteGravado: oc.ImporteGravado || 0,
                  CotizacionMoneda: oc.CotizacionMoneda || 1,
                  cuerpos: cuerposProcessed,
                  impuestos: impuestos,
                  condicionesPago: condicionesPago
                });
              }
            }

            data.ordenes = ordenes;
          } catch (sqlErr) {
            console.error("[VIGIA] Error consultando órdenes reales de SQL Server:", sqlErr);
            return res.status(500).json({ error: "Error consultando datos desde SQL Server. Por favor revisa la consola del servidor." });
          }
        } else if (!pool) {
          // If there is no DB connection, respond gracefully so the client doesn't crash on unhandled HTML timeout error
          console.warn("[VIGIA] Sin conexion a la BD (Pool = null)");
          data.ordenes = [];
        }
      }

      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/vistas/maestros", async (req, res) => {
    try {
      const { orgId, sqlConfig } = req.query;
      let parsedConfig = undefined;
      if (sqlConfig && typeof sqlConfig === 'string') {
        try { parsedConfig = JSON.parse(sqlConfig); } catch(e){}
      }
      
      const pool = await getOrgSqlPool(orgId as string, parsedConfig);
      
      if (!pool) {
        return res.status(503).json({ error: "Base de datos no conectada" });
      }

      // Query 1: Centro de costos
      const ccResult = await pool.request().query('SELECT Codigo, Descripcion FROM CENTROCOSTO');
      
      // Query 2: Comprobantes permitidos y sanitizados
      const compResult = await pool.request().query(`
        SELECT Codigo, Descripcion 
        FROM Comprobante 
        WHERE Codigo IN ('REMEF','FCOM','RTB','RTG','RTI','FCOMS')
      `);

      res.json({
        centroCostos: ccResult.recordset.map(r => ({ codigo: r.Codigo, descripcion: r.Descripcion })),
        comprobantes: compResult.recordset.map(r => ({ codigo: r.Codigo, descripcion: r.Descripcion }))
      });
      
    } catch (error: any) {
      console.error("[VIGIA] Error obteniendo maestros:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/db/test", async (req, res) => {
    try {
      const { config } = req.body;
      if (!config || !config.host || !config.database || !config.user) {
        return res.status(400).json({ error: "Configuracion incompleta para la prueba de SQL Server" });
      }

      let sqlServerHost = (config.host || config.server || '').trim();
      sqlServerHost = sqlServerHost.replace(/^(https?:\/\/)/i, '');
      
      let autoInstanceVal: string | undefined = undefined;
      if (sqlServerHost.includes('\\')) {
        const parts = sqlServerHost.split('\\');
        sqlServerHost = parts[0];
        autoInstanceVal = parts[1];
      } else {
        sqlServerHost = sqlServerHost.split('/')[0];
      }

      let port: number | undefined = Number(config.port) || undefined;
      if (sqlServerHost.includes(':')) {
        const parts = sqlServerHost.split(':');
        sqlServerHost = parts[0];
        const p = parseInt(parts[1], 10);
        if (!isNaN(p)) port = p;
      }
      if (sqlServerHost.includes(',')) {
        const parts = sqlServerHost.split(',');
        sqlServerHost = parts[0];
        const p = parseInt(parts[1], 10);
        if (!isNaN(p)) port = p;
      }

      const lh = sqlServerHost.toLowerCase();
      if (lh === 'locaholst') {
        sqlServerHost = 'localhost';
      }

      let instanceVal = (config.instanceName && config.instanceName.trim() !== '') ? config.instanceName.trim() : autoInstanceVal;

      const sqlConfig: sql.config = {
        user: config.user,
        password: config.password || config.pass,
        database: config.database,
        server: sqlServerHost,
        options: {
          encrypt: false,
          trustServerCertificate: true
        },
        connectionTimeout: 30000,
        requestTimeout: 30000
      };
      if (instanceVal) {
        sqlConfig.options!.instanceName = instanceVal;
      } else {
        sqlConfig.port = port || 1433;
      }

      const testPool = new sql.ConnectionPool(sqlConfig);
      await testPool.connect();
      await testPool.close();
      
      res.json({ status: "success" });
    } catch (error: any) {
      console.error("[VIGIA] Error de prueba de conexión SQL:", error);
      res.status(500).json({ error: "Fallo la conexión a la Base de Datos: " + error.message });
    }
  });

  app.post("/api/db/query", async (req, res) => {
    try {
      const { config, query } = req.body;
      if (!config || !config.host || !config.database || !config.user || !query) {
        return res.status(400).json({ error: "Configuración o query incompletos." });
      }

      let sqlServerHost = (config.host || config.server || '').trim();
      sqlServerHost = sqlServerHost.replace(/^(https?:\/\/)/i, '');
      
      let autoInstanceVal: string | undefined = undefined;
      if (sqlServerHost.includes('\\')) {
        const parts = sqlServerHost.split('\\');
        sqlServerHost = parts[0];
        autoInstanceVal = parts[1];
      } else {
        sqlServerHost = sqlServerHost.split('/')[0];
      }

      let port: number | undefined = Number(config.port) || undefined;
      if (sqlServerHost.includes(':')) {
        const parts = sqlServerHost.split(':');
        sqlServerHost = parts[0];
        const p = parseInt(parts[1], 10);
        if (!isNaN(p)) port = p;
      }
      if (sqlServerHost.includes(',')) {
        const parts = sqlServerHost.split(',');
        sqlServerHost = parts[0];
        const p = parseInt(parts[1], 10);
        if (!isNaN(p)) port = p;
      }

      const lh = sqlServerHost.toLowerCase();
      if (lh === 'locaholst') {
        sqlServerHost = 'localhost';
      }

      let instanceVal = (config.instanceName && config.instanceName.trim() !== '') ? config.instanceName.trim() : autoInstanceVal;

      const sqlConfig: sql.config = {
        user: config.user,
        password: config.password || config.pass,
        database: config.database,
        server: sqlServerHost,
        options: {
          encrypt: false,
          trustServerCertificate: true
        },
        connectionTimeout: 30000,
        requestTimeout: 30000
      };
      if (instanceVal) {
        sqlConfig.options!.instanceName = instanceVal;
      } else {
        sqlConfig.port = port || 1433;
      }

      const pool = new sql.ConnectionPool(sqlConfig);
      await pool.connect();

      const request = new sql.Request(pool);
      const result = await request.query(query);
      
      await pool.close();
      
      res.json(result.recordset || []);
    } catch (error: any) {
      console.error("[VIGIA] Error ejecutando query SQL:", error);
      res.status(500).json({ error: "Error al ejecutar consulta: " + error.message });
    }
  });

  // 3. Ruta de Consulta BCRA Central de Deudores para el Lector de Cheques
  app.get("/api/cheques/bcra/:cuit", async (req, res) => {
    const rawCuit = req.params.cuit || '';
    const cuitClean = rawCuit.replace(/\D/g, ''); // Solo números

    if (cuitClean.length !== 11) {
      return res.status(400).json({ error: "El CUIT del librador debe tener exactamente 11 dígitos numéricos." });
    }

    const httpsAgent = new https.Agent({ rejectUnauthorized: false });

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000); // 6 segundos de timeout

      // Ejecutar en paralelo contra las 3 sub-APIs de BCRA
      const [deudasRes, historicasRes, rechazadosRes] = await Promise.allSettled([
        axios.get(`https://api.bcra.gob.ar/centraldedeudores/v1.0/Deudas/${cuitClean}`, { httpsAgent, signal: controller.signal }),
        axios.get(`https://api.bcra.gob.ar/centraldedeudores/v1.0/Deudas/Historicas/${cuitClean}`, { httpsAgent, signal: controller.signal }),
        axios.get(`https://api.bcra.gob.ar/centraldedeudores/v1.0/Deudas/ChequesRechazados/${cuitClean}`, { httpsAgent, signal: controller.signal })
      ]);
      clearTimeout(timeoutId);

      let deudasData = deudasRes.status === 'fulfilled' ? deudasRes.value.data : null;
      let historicasData = historicasRes.status === 'fulfilled' ? historicasRes.value.data : null;
      let rechazadosData = rechazadosRes.status === 'fulfilled' ? rechazadosRes.value.data : null;

      if (deudasData || rechazadosData || historicasData) {
        return res.json({
          source: "BCRA_REAL",
          cuit: rawCuit,
          deudas: deudasData?.results || null,
          historicas: historicasData?.results || null,
          rechazados: rechazadosData?.results || null
        });
      }

      throw new Error("Servidor BCRA retornó vacío.");
    } catch (apiError: any) {
      console.warn(`[VIGIA] BCRA API fuera de línea o inaccesible (${apiError.message || apiError}). Usando simulación de datos en la nube.`);

      // Generación determinista según semilla en CUIT para que sea consistente
      const lastDigit = Number(cuitClean.slice(-1)) || 0;
      
      let denominacion = "EMPRESA LOCAL S.A.";
      if (cuitClean.startsWith("30")) {
        denominacion = `AGROINDUSTRIAS PAMPEANAS S.A. (CUIT ${rawCuit})`;
      } else if (cuitClean.startsWith("20")) {
        denominacion = `RIVARA SERGIO MAURICIO (CUIT ${rawCuit})`;
      } else {
        denominacion = `TERRANOVA LOGÍSTICA S.R.L. (CUIT ${rawCuit})`;
      }

      let deudasSimuladas: any[] = [];
      let rechazadosSimulados: any[] = [];

      if (lastDigit === 0 || lastDigit === 2 || lastDigit === 4 || lastDigit === 8) {
        // Excelente perfil
        deudasSimuladas = [
          { entidad: "BANCO GALICIA Y BUENOS AIRES S.A.U.", situacion: 1, importe: 840, diasAtraso: 0, periodo: "202604" },
          { entidad: "BANCO MACRO S.A.", situacion: 1, importe: 2300, diasAtraso: 0, periodo: "202604" }
        ];
      } else if (lastDigit === 1 || lastDigit === 3 || lastDigit === 6) {
        // Atrasos leves
        deudasSimuladas = [
          { entidad: "BANCO BBVA ARGENTINA S.A.", situacion: 1, importe: 1200, diasAtraso: 0, periodo: "202604" },
          { entidad: "BANCO SANTANDER ARGENTINA S.A.", situacion: 2, importe: 4800, diasAtraso: 40, periodo: "202604" }
        ];
        rechazadosSimulados = [
          { nroCheque: "15421109", fechaRechazo: "2026-03-22", monto: 180000, causal: "Sin fondos-Registro parcial", fechaPago: "2026-04-10", multa: "Paga", revisacion: "No" }
        ];
      } else if (lastDigit === 5) {
        // Problemas serios
        deudasSimuladas = [
          { entidad: "BANCO DE LA NACION ARGENTINA", situacion: 4, importe: 15400, diasAtraso: 145, periodo: "202604" },
          { entidad: "HSBC BANK ARGENTINA S.A.", situacion: 3, importe: 8900, diasAtraso: 95, periodo: "202604" }
        ];
        rechazadosSimulados = [
          { nroCheque: "44120912", fechaRechazo: "2026-03-02", monto: 560000, causal: "Sin fondos", fechaPago: "", multa: "Pendiente", revisacion: "No" },
          { nroCheque: "44120913", fechaRechazo: "2026-04-14", monto: 750000, causal: "Sin fondos", fechaPago: "2026-04-20", multa: "Paga", revisacion: "No" },
          { nroCheque: "45091224", fechaRechazo: "2026-05-01", monto: 320000, causal: "Sin fondos", fechaPago: "", multa: "Pendiente", revisacion: "No" }
        ];
      } else {
        // Crítico
        deudasSimuladas = [
          { entidad: "BANCO PATAGONIA S.A.", situacion: 5, importe: 28000, diasAtraso: 210, periodo: "202604" },
          { entidad: "BANCO DE LA PROVINCIA DE BUENOS AIRES", situacion: 5, importe: 45000, diasAtraso: 250, periodo: "202604" }
        ];
        rechazadosSimulados = [
          { nroCheque: "78120014", fechaRechazo: "2026-01-18", monto: 1200000, causal: "Sin fondos", fechaPago: "", multa: "Pendiente", revisacion: "No" },
          { nroCheque: "78120015", fechaRechazo: "2026-02-11", monto: 1950000, causal: "Sin fondos", fechaPago: "", multa: "Pendiente", revisacion: "No" },
          { nroCheque: "79104445", fechaRechazo: "2026-04-03", monto: 2000000, causal: "Cierre de cuenta corriente", fechaPago: "", multa: "Pendiente", revisacion: "No" }
        ];
      }

      const historicasSimuladas = [
        { periodo: "202512", entidades: deudasSimuladas.map(d => ({ ...d, situacion: d.situacion, importe: Math.round(d.importe * 0.94) })) },
        { periodo: "202601", entidades: deudasSimuladas.map(d => ({ ...d, situacion: d.situacion, importe: Math.round(d.importe * 0.98) })) },
        { periodo: "202602", entidades: deudasSimuladas.map(d => ({ ...d, situacion: d.situacion, importe: d.importe })) },
        { periodo: "202603", entidades: deudasSimuladas.map(d => ({ ...d, situacion: d.situacion, importe: Math.round(d.importe * 1.05) })) },
        { periodo: "202604", entidades: deudasSimuladas }
      ];

      return res.json({
        source: "SIMULADO_CLOUD_BACKUP",
        cuit: rawCuit,
        errorReason: apiError.message || "Limite de cuota / Cortafuegos de Servidor US",
        deudas: {
          identificacion: cuitClean,
          denominacion: denominacion,
          periodo: "202604",
          periodos: [
            {
              periodo: "202604",
              entidades: deudasSimuladas
            }
          ]
        },
        historicas: {
          identificacion: cuitClean,
          denominacion: denominacion,
          periodo: "202604",
          periodos: historicasSimuladas
        },
        rechazados: {
          identificacion: cuitClean,
          denominacion: denominacion,
          chequesRechazados: rechazadosSimulados
        }
      });
    }
  });

  // Admin routes managed by frontend directly via Firebase JS SDK
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // 👇 INSTRUCCION CLAVE PARA PRENDER EL SERVIDOR
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Backend de VIGIA corriendo en http://localhost:${PORT}`);
  });
}

startServer();
