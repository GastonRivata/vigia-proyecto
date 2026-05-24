import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileJson, 
  Code2, 
  Copy, 
  Check, 
  ArrowRight,
  Zap,
  Edit3,
  Save,
  Image as ImageIcon,
  Database,
  HelpCircle,
  Table,
  AlertCircle,
  Loader2,
  BrainCircuit,
  Search,
  History as HistoryIcon,
  ShoppingBag,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Download,
  FileSearch,
  Eye
} from 'lucide-react';
import { PdfViewer } from '@/src/components/PdfViewer';
import { 
  jsonToRojosoftSoapXml, 
  RojosoftConfig 
} from '@/src/lib/xmlConverter';
import { formatISOToReadable, cn, generateIDTablaWS, parseComprobanteNumber } from '@/src/lib/utils';
import { patternService } from '@/src/lib/patternService';
import { useTenant } from '@/src/lib/TenantContext';
import { auth } from '@/src/lib/firebase';
import { Conciliador } from './Conciliador';

// Formato numérico estricto a 2 decimales con punto
const formatExactDecimal = (num: number | string | undefined, currency?: string) => {
  const val = typeof num === 'string' ? parseFloat(num) : Number(num || 0);
  const safeVal = isNaN(val) ? 0 : val;
  const formatted = safeVal.toFixed(2); // strictly uses dot
  const c = currency && currency.toUpperCase().includes('US') ? 'U$S' : '$';
  return currency ? `${c} ${formatted}` : formatted;
};

// Limpia y decodifica el mensaje de error de Rojosoft o del ERP
const cleanErrorMessage = (msg: string) => {
  if (!msg) return '';
  let decoded = msg
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/Error del ERP:\s*/gi, '');

  if (decoded.includes('--->')) {
    const parts = decoded.split('--->');
    const lastPart = parts[parts.length - 1].trim();
    if (lastPart) return lastPart;
  } else if (decoded.includes('-->')) {
    const parts = decoded.split('-->');
    const lastPart = parts[parts.length - 1].trim();
    if (lastPart) return lastPart;
  }
  return decoded;
};

// Configuración visual según flujo
const getFlowConfig = (flow: string) => {
  switch (flow) {
    case 'B': return { 
      wrapper: 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50',
      headerClass: 'bg-blue-100/50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-900/50',
      text: 'text-blue-700 dark:text-blue-400',
      iconText: 'text-blue-600 dark:text-blue-400',
      label: 'Facturación Compras',
      icon: ShoppingBag,
    };
    case 'C': return { 
      wrapper: 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50',
      headerClass: 'bg-amber-100/50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-900/50',
      text: 'text-amber-700 dark:text-amber-400',
      iconText: 'text-amber-600 dark:text-amber-400',
      label: 'Retenciones',
      icon: Database,
    };
    default: return { 
      wrapper: 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50',
      headerClass: 'bg-emerald-100/50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-900/50',
      text: 'text-emerald-700 dark:text-emerald-400',
      iconText: 'text-emerald-600 dark:text-emerald-400',
      label: 'Cuenta Corriente',
      icon: Briefcase,
    };
  }
};

// Helper function to dynamically enrich document data with auto-detected provincial perceptions (taxes)
const enrichDataWithPerceptions = (rawDoc: any) => {
  if (!rawDoc) return rawDoc;
  try {
    const doc = JSON.parse(JSON.stringify(rawDoc)); // Deep copy to avoid mutating props
    if (!doc.totales) doc.totales = {};
    if (!doc.totales.impuestos_provinciales) {
      doc.totales.impuestos_provinciales = [];
    }

    const percValue = parseFloat(doc.totales.percepciones) || 0;
    // Auto-detect check: if overall percepciones amount is positive, but impuestos_provinciales list is empty
    if (percValue > 0 && doc.totales.impuestos_provinciales.length === 0) {
      let inferredProv = 'B'; // Default to Bs. As. (B)
      const textToSearch = `${doc.cabecera?.razon_social_emisor || ''} ${doc.cabecera?.tipo || ''} ${doc.detalle?.map((i: any) => i.descripcion || '').join(' ') || ''}`.toLowerCase();
      
      if (textToSearch.includes('santa fe') || textToSearch.includes('rosario') || textToSearch.includes(' sf') || textToSearch.includes(' s.f.')) {
        inferredProv = 'S';
      } else if (textToSearch.includes('caba') || textToSearch.includes('buenos aires') || textToSearch.includes('capital federal') || textToSearch.includes('distrito federal')) {
        inferredProv = 'C';
      } else if (textToSearch.includes('cordoba') || textToSearch.includes('córdoba')) {
        inferredProv = 'X';
      } else if (textToSearch.includes('mendoza') || textToSearch.includes('mza')) {
        inferredProv = 'M';
      } else if (textToSearch.includes('entre rios') || textToSearch.includes('entre ríos') || textToSearch.includes('e.r.')) {
        inferredProv = 'E';
      }
      
      const base = parseFloat(doc.totales.neto_gravado) || 0;
      const alicuota = base > 0 ? parseFloat(((percValue / base) * 100).toFixed(3)) : 1.5;
      
      doc.totales.impuestos_provinciales.push({
        provincia: inferredProv,
        importe_base: base,
        alicuota: alicuota,
        importe: percValue
      });
    }
    return doc;
  } catch (error) {
    console.error('Error enriching data with perceptions:', error);
    return rawDoc;
  }
};

interface ResultsDisplayProps {
  data: any;
  fileUrl: string | null;
  fileType?: string | null;
  onUpdateData?: (newData: any) => void;
}

export function ResultsDisplay({ data, fileUrl, fileType: initialFileType, onUpdateData }: ResultsDisplayProps) {
  const { activeTenant, incrementTenantUsage } = useTenant();
  const [activeTab, setActiveTab] = useState<'json' | 'xml' | 'sql' | 'patterns'>('xml');
  const [fileType, setFileType] = useState(initialFileType);
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(true);
  const [localData, setLocalData] = useState(() => enrichDataWithPerceptions(data));
  const [isInserting, setIsInserting] = useState(false);
  const [integrationStatus, setIntegrationStatus] = useState<{ success?: boolean; message?: string; fault?: string; details?: string; sentXml?: string } | null>(null);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false); // Nuevo estado
  const [maestros, setMaestros] = useState<{centroCostos: any[], comprobantes: any[]}>({centroCostos: [], comprobantes: []});

  // Sync state when data prop changes
  useEffect(() => {
    if (data) {
      setLocalData(enrichDataWithPerceptions(data));
    }
  }, [data]);

  // Rojosoft Integration State
  const [rojosoftConfig, setRojosoftConfig] = useState<RojosoftConfig>(() => {
    // Auto-detect flow based on details
    const typeStr = (data?.cabecera?.tipo || '').toLowerCase();
    const detailDescs = (data?.detalle || []).map((i: any) => i.descripcion || '').join(' ').toLowerCase();
    
    // Improved detection for Retentions
    const isRetencion = 
      typeStr.includes('retencion') || 
      typeStr.includes('retención') || 
      typeStr.includes('certificado de ret') ||
      detailDescs.includes('retencion') || 
      detailDescs.includes('retención') || 
      detailDescs.includes('ret. iibb') ||
      detailDescs.includes('imp. ret.');

    // Items usually identify 'B' if they have codes or quantities > 1, but Retentions often do not have this structure.
    const hasItems = !isRetencion && data?.detalle && data.detalle.length > 0 && data.detalle.some((i: any) => i.codigo_articulo || (Number(i.cantidad) > 1));
    const isUSD = data?.cabecera?.moneda?.includes('US') || data?.cabecera?.moneda?.includes('$');
    const { pos, num } = parseComprobanteNumber(data?.cabecera?.numero || '');
    
    let initialFlow: 'A' | 'B' | 'C' = 'A';
    let initialComprobante = hasItems ? 'REMEF' : 'FCOMS';
    let initialAlicuota = 0.6;

    if (isRetencion) {
      initialFlow = 'C';
      const textToSearch = `${typeStr} ${detailDescs}`.toLowerCase();
      if (textToSearch.includes('ganancia') || textToSearch.includes('ganancias') || textToSearch.includes('gans') || textToSearch.includes('rtg') || textToSearch.includes('imp.gan.')) {
        initialComprobante = 'RTG';
        initialAlicuota = 2.0; // Default common for ganancias
      } else if (textToSearch.includes('iva') || textToSearch.includes('rti') || textToSearch.includes('i.v.a.')) {
        initialComprobante = 'RTI';
        initialAlicuota = 3.0;
      } else {
        initialComprobante = 'RTB'; // Default to Ingresos Brutos
        // Try to find an alicuota in the text
        const matchAli = detailDescs.match(/(\d+[.,]\d+)\s*%/);
        if (matchAli) {
           initialAlicuota = parseFloat(matchAli[1].replace(',', '.'));
        }
      }
    } else if (hasItems) {
      initialFlow = 'B';
    }
    
    return {
      planta: 'PB',
      cliente: '00118',
      comprobante: initialComprobante,
      puntoVenta: data?.cabecera?.punto_venta || pos,
      nroComprobante: data?.cabecera?.numero || num,
      ordenCompra: '', // Manual integration key
      facturaAfe: '', 
      facturaCuerpoAfe: '',
      tipoComprobanteCAI: data?.cabecera?.tipo_comprobante_cai || 1,
      idTablaWS: generateIDTablaWS(),
      centroCosto1: '1.1.2.1.4',
      centroCosto2: '1.1.2.2.2',
      porcentaje1: 50,
      porcentaje2: 50,
      moneda: isUSD ? 'DO' : 'PE',
      condicionPago: '0001',
      cotizacion: isUSD ? 1000 : 1,
      flow: initialFlow,
      alicuotaRetencion: initialAlicuota,
      provinciaRetencion: 'S',
    };
  });

  const getSqlConfigParams = () => {
    const config = activeTenant?.sqlConfig || {} as any;
    return {
      ...config,
      server: config.server || '',
      host: config.server || '',
      database: config.database || '',
      user: config.user || '',
      password: config.password || '',
      pass: config.password || '',
      endpointCompras: config.endpointCompras || '/IA/ServiceFactura.asmx',
      endpointServicios: config.endpointServicios || '/IA/ServiceCuentaCorriente.asmx',
      customEndpoints: config.customEndpoints || []
    };
  };

  // Adaptive Intelligence: Load suggestions & SQL Vistas
  useEffect(() => {
    setFileType(initialFileType);
  }, [initialFileType]);

  useEffect(() => {
    const fetchMaestros = async () => {
      if (!activeTenant) return;
      try {
        const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
        let url = `${backendUrl}/api/vistas/maestros?orgId=${activeTenant.id}`;
        const finalConfig = getSqlConfigParams();
        if (finalConfig) {
          url += `&sqlConfig=${encodeURIComponent(JSON.stringify(finalConfig))}`;
        }
        const res = await fetch(url);
        if (res.ok) {
          const mData = await res.json();
          setMaestros(mData);
        }
      } catch (err) {
        console.warn("No se pudo obtener la lista de maestros de SQL", err);
      }
    };
    fetchMaestros();
  }, [activeTenant]);

  useEffect(() => {
    const emisor = localData.cabecera?.razon_social_emisor;
    if (emisor) {
      const suggestion = patternService.suggest(emisor);
      if (suggestion) {
    setRojosoftConfig((prev: RojosoftConfig) => ({
      ...prev,
      centroCosto1: suggestion.centroCosto,
      porcentaje1: suggestion.distribucion.cc1,
      porcentaje2: suggestion.distribucion.cc2
    }));
      }
    }
    
    const fetchDbData = async () => {
      const cuit = localData.cabecera?.cuit_emisor;
      if (!cuit || !activeTenant) return;
      try {
        const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
        
        let url = `${backendUrl}/api/vistas/xml?cuit=${cuit}&orgId=${activeTenant.id}`;
        const finalConfig = getSqlConfigParams();
        if (finalConfig) {
          url += `&sqlConfig=${encodeURIComponent(JSON.stringify(finalConfig))}`;
        }
        
        const res = await fetch(url);
        if (res.ok) {
          const dbData = await res.json();
          if (dbData.cliente && dbData.cliente.Cuenta) {
            setRojosoftConfig((prev: RojosoftConfig) => ({
              ...prev,
              cliente: dbData.cliente.Cuenta
            }));
          } else {
             console.warn("El backend no encontró cuenta para el CUIT:", cuit);
          }
        }
      } catch (err) {
        console.warn("No se pudo obtener la cuenta del cliente de SQL", err);
      }
    };

    fetchDbData();
  }, [localData.cabecera?.razon_social_emisor, localData.cabecera?.cuit_emisor]);

  const testSqlVistas = async () => {
    const cuit = localData.cabecera?.cuit_emisor;
    if (!cuit) {
      alert("Primero debe procesar un comprobante que contenga un CUIT.");
      return;
    }
    
    if (!activeTenant) {
      alert("No hay un cliente/organización activa seleccionada.");
      return;
    }
    
    setIsQuerying(true);
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
      
      let url = `${backendUrl}/api/vistas/xml?cuit=${cuit}&orgId=${activeTenant.id}`;
      const finalConfig = getSqlConfigParams();
      if (finalConfig) {
        url += `&sqlConfig=${encodeURIComponent(JSON.stringify(finalConfig))}`;
      }
      
      const res = await fetch(url);
      if (res.ok) {
        const dbData = await res.json();
        alert(dbData.cliente ? `✅ Cliente hallado: ${dbData.cliente.Nombre}` : '⚠️ Sin coincidencias en BD para el CUIT.');
        if (dbData.cliente && dbData.cliente.Cuenta) {
          setRojosoftConfig((prev: RojosoftConfig) => ({
            ...prev,
            cliente: dbData.cliente.Cuenta
          }));
        }
      } else {
        alert(`❌ Error Vistas: Código ${res.status} al consultar DB.`);
      }
    } catch (err: any) {
      console.warn(`[VIGIA] Error de red en vistas: ${err.message}`);
      alert('❌ Error de Red SQL: No se pudo contactar al backend.');
    } finally {
      setIsQuerying(false);
    }
  };

  const [expandedSections, setExpandedSections] = useState({
    cabecera: true,
    maestro: true,
    detalle: false,
    impuestos: false,
    totales: true
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const [isQuerying, setIsQuerying] = useState(false);
  const [queryResults, setQueryResults] = useState<any[] | null>(null);

  const [verifiedFields, setVerifiedFields] = useState<Record<string, boolean>>({});

  const handleFieldVerify = (field: string) => {
    setVerifiedFields(prev => ({ ...prev, [field]: true }));
  };
  
  const isMatchAprobado = Boolean(rojosoftConfig.ordenCompra && localData.detalle?.length > 0 && localData.detalle.every((item: any) => item.id_cuerpo_afe));

  const getInputClasses = (fieldName: string, isEditingMode: boolean, extraClasses: string = "") => {
    const base = cn("w-full text-sm pb-1 outline-none bg-transparent border-b transition-all", extraClasses);
    if (!isEditingMode) {
      return cn(base, "border-transparent text-slate-900 dark:text-slate-200");
    }
    if (verifiedFields[fieldName]) {
      return cn(base, "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10 text-emerald-900 dark:text-emerald-100 shadow-[0_1px_0_0_#10b981]");
    }
    return cn(base, "border-blue-400 dark:border-blue-600 bg-blue-50/50 dark:bg-blue-900/20 dark:text-white hover:bg-blue-100/50 focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500");
  };

  const getMaestroInputClasses = (fieldName: string, isMono: boolean = true) => cn(
    "w-full bg-white dark:bg-slate-900 border rounded px-2.5 py-1.5 text-xs outline-none transition-all duration-300",
    isMono ? "font-mono font-semibold" : "font-bold",
    verifiedFields[fieldName] 
      ? "border-emerald-400 dark:border-emerald-600 bg-emerald-50/50 dark:bg-emerald-900/10 text-emerald-900 dark:text-emerald-100 ring-1 ring-emerald-500/10 shadow-sm" 
      : "border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 text-slate-700 dark:text-slate-200"
  );

  // Match Modal states
  const [isMatchModalOpen, setIsMatchModalOpen] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [matchData, setMatchData] = useState<{ cliente: any, ordenes: any[] } | null>(null);

  const openMatchModal = async () => {
    const cuit = localData.cabecera?.cuit_emisor;
    if (!cuit || !activeTenant) {
      alert("No hay CUIT detectado o Cliente seleccionado.");
      return;
    }
    
    setIsMatchModalOpen(true);
    setIsMatching(true);
    setMatchData(null);
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
      
      let url = `${backendUrl}/api/vistas/xml?cuit=${cuit}&fetchOrdenes=true&orgId=${activeTenant.id}`;
      const finalConfig = getSqlConfigParams();
      if (finalConfig) {
        url += `&sqlConfig=${encodeURIComponent(JSON.stringify(finalConfig))}`;
      }
      
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        setMatchData({ cliente: data.cliente, ordenes: data.ordenes || [] });
        if (data.cliente?.Cuenta) {
          setRojosoftConfig((prev: RojosoftConfig) => ({ ...prev, cliente: data.cliente.Cuenta }));
        }
      } else {
        alert("Error de matching: Falló la petición");
        setIsMatchModalOpen(false);
      }
    } catch (e: any) {
      alert("Error de red: " + e.message);
      setIsMatchModalOpen(false);
    } finally {
      setIsMatching(false);
    }
  };

  const selectOcForMatch = (oc: any, cuerpoRow?: any) => {
    // Vincular OC
    const firstCuerpo = oc.cuerpos?.[0] || {};
    const refCuerpo = cuerpoRow || firstCuerpo;

    setRojosoftConfig((prev: RojosoftConfig) => ({
      ...prev,
      ordenCompra: String(oc.NumeroComprobante || oc.IdTabla || oc.FacturaID || oc.Id || ''),
      facturaAfe: String(refCuerpo.FacturaAfe || refCuerpo.Factura || oc.IdTabla || oc.FacturaID || oc.Id || ''),
      facturaCuerpoAfe: String(refCuerpo.FacturaCuerpoAfe || refCuerpo.IdTabla || refCuerpo.IdCuerpo || refCuerpo.IDCuerpo || refCuerpo.Id || '')
    }));

    // Auto-map bodies to detail items
    if (!cuerpoRow && oc.cuerpos && oc.cuerpos.length > 0) {
      setLocalData((prev: any) => {
        if (!prev.detalle || !Array.isArray(prev.detalle)) return prev;
        const newDetalle = prev.detalle.map((item: any, idx: number) => {
          const match = oc.cuerpos[idx] || oc.cuerpos[0];
          if (!match) return item;
          return {
            ...item,
            id_cuerpo_afe: match.FacturaCuerpoAfe || match.IDTabla || match.IdCuerpo || match.Id,
            articulo_precio: match.ArticuloPrecio || item.articulo_precio,
            codigo_articulo: match.Articulo || match.CodigoArticulo || item.codigo_articulo
          };
        });

        let newImpuestos = prev.totales?.impuestos_provinciales || [];
        if (oc.impuestos && oc.impuestos.length > 0) {
           newImpuestos = oc.impuestos.map((imp: any) => ({
             provincia: imp.Provincia || 'B',
             importe_base: imp.BaseImponible || imp.ImporteBase || prev.totales?.neto_gravado || 0,
             alicuota: imp.Porcentaje || imp.AlicuotaPercepcion || imp.AlicuotaRetencion || 0,
             importe: imp.Importe || imp.ImportePercepcion || 0
           }));
        }

        return { 
          ...prev, 
          detalle: newDetalle,
          totales: {
            ...(prev.totales || {}),
            impuestos_provinciales: newImpuestos.length > 0 ? newImpuestos : prev.totales?.impuestos_provinciales
          }
        };
      });
    } else if (cuerpoRow) {
      // If a specific row is linked
      setLocalData((prev: any) => {
         if (!prev.detalle || !Array.isArray(prev.detalle)) return prev;
         const newDetalle = [...prev.detalle];
         if (newDetalle.length > 0) {
            newDetalle[0] = {
              ...newDetalle[0],
              id_cuerpo_afe: cuerpoRow.FacturaCuerpoAfe || cuerpoRow.IDTabla || cuerpoRow.IdCuerpo || cuerpoRow.Id,
              id_cuerpo_facafe: cuerpoRow.FacturaAfe || cuerpoRow.IDTabla || cuerpoRow.IdCuerpo || cuerpoRow.Id,
              articulo_precio: cuerpoRow.ArticuloPrecio || newDetalle[0].articulo_precio,
              codigo_articulo: cuerpoRow.Articulo || cuerpoRow.CodigoArticulo || newDetalle[0].codigo_articulo
            };
         }

         let newImpuestos = prev.totales?.impuestos_provinciales || [];
         if (oc.impuestos && oc.impuestos.length > 0) {
           newImpuestos = oc.impuestos.map((imp: any) => ({
             provincia: imp.Provincia || 'B',
             importe_base: imp.BaseImponible || imp.ImporteBase || prev.totales?.neto_gravado || 0,
             alicuota: imp.Porcentaje || imp.AlicuotaPercepcion || imp.AlicuotaRetencion || 0,
             importe: imp.Importe || imp.ImportePercepcion || 0
           }));
         }

         return { 
           ...prev, 
           detalle: newDetalle,
           totales: {
             ...(prev.totales || {}),
             impuestos_provinciales: newImpuestos.length > 0 ? newImpuestos : prev.totales?.impuestos_provinciales
           }
         };
      });
    }

    alert(`✅ Comprobante vinculado correctamente con la OC: ${oc.NumeroComprobante || oc.IdTabla || oc.FacturaID || oc.Id}`);
    setIsMatchModalOpen(false);
  };

  const simulateSqlQuery = async () => {
    if (!rojosoftConfig.ordenCompra) return;
    
    setIsQuerying(true);
    setQueryResults(null);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1200));
    
    // Mock response based on the OC provided
    const mockResults = [
      { 
        IDTabla: '76892', 
        IDTablaCuerpo: '12', 
        CodigoArticulo: 'ART-00234', 
        Descripcion: data.detalle?.[0]?.descripcion || 'Servicio de Mantenimiento',
        Cantidad: data.detalle?.[0]?.cantidad || 1,
        Precio: 125000 
      },
      { 
        IDTabla: '76892', 
        IDTablaCuerpo: '13', 
        CodigoArticulo: 'ART-00235', 
        Descripcion: 'Insumos Varios',
        Cantidad: 5,
        Precio: 4500 
      }
    ];
    
    setQueryResults(mockResults);
    setIsQuerying(false);
    setActiveTab('sql');
  };

  const handleSelectSqlRow = (row: any) => {
    setRojosoftConfig((prev: RojosoftConfig) => ({
      ...prev,
      facturaAfe: String(row.IDTabla),
      facturaCuerpoAfe: String(row.IDTablaCuerpo)
    }));
    
    // If the detail matches partially, we can even auto-fill the item code
    if (localData.detalle && localData.detalle.length > 0) {
      const newDetalle = [...localData.detalle];
      newDetalle[0].codigo_articulo = row.CodigoArticulo;
      setLocalData({ ...localData, detalle: newDetalle });
    }
  };

  const xmlOutput = jsonToRojosoftSoapXml(localData, rojosoftConfig);

  const handleInsert = async () => {
    if (!activeTenant) {
      alert("Debe seleccionar un cliente activo para procesar la inserción.");
      return;
    }
    
    setIsInserting(true);
    setIntegrationStatus(null);
    
    // Refresh IDTabla WS for this unique attempt
    const currentIdWS = generateIDTablaWS();
    const updatedConfig = { ...rojosoftConfig, idTablaWS: currentIdWS };
    setRojosoftConfig(updatedConfig);

    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
      const response = await fetch(`${backendUrl}/api/facturas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          facturaData: localData, 
          rojosoftConfig: updatedConfig,
          orgId: activeTenant.id,
          userId: auth.currentUser?.uid,
          sqlConfig: getSqlConfigParams()
        })
      });

      const resultText = await response.text();
      let responseJson: any = {};
      try { responseJson = JSON.parse(resultText); } catch(e){}
      
      if (response.ok) {
        setIntegrationStatus({ 
          success: true, 
          message: responseJson.message || 'Comprobante insertado correctamente.',
          details: responseJson.soapResponse
        });
        
        // Increment usage statistics
        if (activeTenant?.id) {
          try {
            await incrementTenantUsage(activeTenant.id);
          } catch (incErr) {
            console.warn("[VIGIA] Error incrementing tenant usage state:", incErr);
          }
        }
        
        // Learning from success
        if (localData.cabecera.razon_social_emisor) {
          patternService.savePattern(localData.cabecera.razon_social_emisor, {
            centroCosto: rojosoftConfig.centroCosto1,
            cliente: rojosoftConfig.cliente,
            distribucion: { cc1: rojosoftConfig.porcentaje1, cc2: rojosoftConfig.porcentaje2 }
          });
        }
      } else {
        if (responseJson.sentXml) {
          console.error("----- SENT XML -----\n", responseJson.sentXml, "\n--------------------");
        }
        setIntegrationStatus({ 
          success: false, 
          fault: responseJson.error || 'Error desconocido en el servidor.',
          details: responseJson.details,
          sentXml: responseJson.sentXml
        });
      }
    } catch (err: any) {
      setIntegrationStatus({ success: false, message: err.message || 'Error de conexión con el servidor VIGIA.' });
    } finally {
      setIsInserting(false);
    }
  };

  const copyToClipboard = async () => {
    let textToCopy = '';
    if (activeTab === 'json') textToCopy = JSON.stringify(localData, null, 2);
    else if (activeTab === 'xml') textToCopy = xmlOutput;
    else textToCopy = sqlHelperText;
    
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleFieldChange = (field: string, value: string) => {
    setLocalData((prev: any) => ({
      ...prev,
      cabecera: {
        ...prev.cabecera,
        [field]: value
      }
    }));
  };

  const handleConfigChange = (field: keyof RojosoftConfig, value: string | number) => {
    setRojosoftConfig((prev: RojosoftConfig) => ({ ...prev, [field]: value as any }));
  };

  const handleAddImpuestoProvincial = () => {
    setLocalData((prev: any) => {
      const currentImpuestos = prev.totales?.impuestos_provinciales || [];
      const nuevoImpuesto = {
        provincia: 'B',
        importe_base: prev.totales?.neto_gravado || 0,
        alicuota: 1.5,
        importe: parseFloat(((prev.totales?.neto_gravado || 0) * 0.015).toFixed(2))
      };
      
      const newImpuestos = [...currentImpuestos, nuevoImpuesto];
      const sumPercepciones = newImpuestos.reduce((acc: number, item: any) => acc + (parseFloat(item.importe) || 0), 0);
      
      return {
        ...prev,
        totales: {
          ...(prev.totales || {}),
          percepciones: parseFloat(sumPercepciones.toFixed(2)),
          impuestos_provinciales: newImpuestos,
          total: parseFloat(((prev.totales?.neto_gravado || 0) + (prev.totales?.iva_21 || 0) + (prev.totales?.iva_105 || 0) + sumPercepciones + (prev.totales?.no_gravado || 0)).toFixed(2))
        }
      };
    });
  };

  const handleEditImpuestoProvincial = (index: number, field: string, value: any) => {
    setLocalData((prev: any) => {
      const currentImpuestos = [...(prev.totales?.impuestos_provinciales || [])];
      if (!currentImpuestos[index]) return prev;
      
      const updated = { ...currentImpuestos[index], [field]: value };
      
      if (field === 'alicuota' || field === 'importe_base') {
        const base = parseFloat(updated.importe_base) || 0;
        const ali = parseFloat(updated.alicuota) || 0;
        updated.importe = parseFloat(((base * ali) / 100).toFixed(2));
      }
      
      currentImpuestos[index] = updated;
      const sumPercepciones = currentImpuestos.reduce((acc: number, item: any) => acc + (parseFloat(item.importe) || 0), 0);
      
      return {
        ...prev,
        totales: {
          ...(prev.totales || {}),
          percepciones: parseFloat(sumPercepciones.toFixed(2)),
          impuestos_provinciales: currentImpuestos,
          total: parseFloat(((prev.totales?.neto_gravado || 0) + (prev.totales?.iva_21 || 0) + (prev.totales?.iva_105 || 0) + sumPercepciones + (prev.totales?.no_gravado || 0)).toFixed(2))
        }
      };
    });
  };

  const handleDeleteImpuestoProvincial = (index: number) => {
    setLocalData((prev: any) => {
      const currentImpuestos = [...(prev.totales?.impuestos_provinciales || [])];
      currentImpuestos.splice(index, 1);
      
      const sumPercepciones = currentImpuestos.reduce((acc: number, item: any) => acc + (parseFloat(item.importe) || 0), 0);
      
      return {
        ...prev,
        totales: {
          ...(prev.totales || {}),
          percepciones: parseFloat(sumPercepciones.toFixed(2)),
          impuestos_provinciales: currentImpuestos,
          total: parseFloat(((prev.totales?.neto_gravado || 0) + (prev.totales?.iva_21 || 0) + (prev.totales?.iva_105 || 0) + sumPercepciones + (prev.totales?.no_gravado || 0)).toFixed(2))
        }
      };
    });
  };

  const toggleEdit = () => {
    if (isEditing && onUpdateData) {
      onUpdateData(localData);
    }
    setIsEditing(!isEditing);
  };

  const sqlHelperText = `
-- CONSULTAS DE INTEGRACIÓN VIGIA

-- 1. LLAVE DE INTEGRACIÓN (Orden de Compra / Remito Interno)
-- Usada para obtener los IDs de Afectación (Vinculación)
SELECT 
    FC.Id as FacturaAfe, 
    FD.Id as FacturaCuerpoAfe,
    FD.CodigoArticulo,
    FD.Cantidad
FROM FacturaCuerpo FC
JOIN FacturasDetalle FD ON FC.Id = FD.CabeceraId
WHERE FC.OCVinculada = '${rojosoftConfig.ordenCompra || 'OC-XXXXXX'}';

-- 2. VALIDACIÓN DE ARTÍCULOS
SELECT Codigo, Descripcion 
FROM Articulo 
WHERE Descripcion LIKE '%${localData.detalle?.[0]?.descripcion || ''}%';

-- 3. CLIENTES
SELECT Cuenta, Nombre FROM CLIENTE;
  `.trim();

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 w-full max-w-none pb-10">
      
      {/* Left Panel: Original Document Preview */}
      <div className="xl:col-span-5 h-[800px] bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden flex flex-col shadow-xl">
        <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-300">
            <ImageIcon className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-widest">Documento Original</span>
          </div>
        </div>
        <div className="flex-1 bg-slate-800 overflow-hidden flex items-center justify-center relative">
          {fileUrl ? (
            fileType === 'application/pdf' || fileType?.includes('pdf') || (fileUrl.includes('blob:') && fileType?.includes('pdf')) ? (
               <div className="w-full h-full">
                 <PdfViewer url={fileUrl} className="h-full" />
               </div>
            ) : (
               <div className="w-full h-full overflow-auto custom-scrollbar flex items-center justify-center p-4">
                 <img 
                   src={fileUrl} 
                   alt="Comprobante Original" 
                   className="max-w-full h-auto rounded shadow-lg" 
                   referrerPolicy="no-referrer" 
                   onError={() => {
                      if (fileType !== 'application/pdf') setFileType('application/pdf');
                   }}
                 />
               </div>
            )
          ) : (
            <div className="text-slate-500 text-sm font-mono text-center flex flex-col items-center gap-4">
              <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center shadow-inner border border-slate-700">
                <FileSearch className="w-8 h-8 opacity-20" />
              </div>
              <p className="uppercase tracking-[0.2em] font-black text-[10px] opacity-40">Sin Visualización Activa</p>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel: Extracted Data & Rojosoft Actions */}
      <div className="xl:col-span-7 space-y-6 h-[800px] overflow-auto custom-scrollbar pr-2">
        
        {/* Superior Flow Selector */}
        <div className="bg-slate-900 border border-slate-800 p-2 rounded-xl flex shadow-lg">
          <button 
            onClick={() => handleConfigChange('flow', 'A')}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-lg text-[10px] font-black uppercase transition-all duration-300",
              rojosoftConfig.flow === 'A' ? "bg-blue-600 text-white shadow-md ring-1 ring-blue-500/50" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
            )}
          >
            <Briefcase className={cn("w-4 h-4 mb-1", rojosoftConfig.flow === 'A' ? "animate-pulse" : "")} /> 
            Cuenta Corriente
            <span className="text-[8px] opacity-70 mt-0.5 tracking-tight font-medium">Servicios o Varios</span>
          </button>
          <button 
            onClick={() => handleConfigChange('flow', 'B')}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-lg text-[10px] font-black uppercase transition-all duration-300 mx-1",
              rojosoftConfig.flow === 'B' ? "bg-indigo-600 text-white shadow-md ring-1 ring-indigo-500/50" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
            )}
          >
            <ShoppingBag className={cn("w-4 h-4 mb-1", rojosoftConfig.flow === 'B' ? "animate-pulse" : "")} /> 
            Compras
            <span className="text-[8px] opacity-70 mt-0.5 tracking-tight font-medium">Insumos y Bienes</span>
          </button>
          <button 
            onClick={() => handleConfigChange('flow', 'C')}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-lg text-[10px] font-black uppercase transition-all duration-300",
              rojosoftConfig.flow === 'C' ? "bg-emerald-600 text-white shadow-md ring-1 ring-emerald-500/50" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
            )}
          >
            <Database className={cn("w-4 h-4 mb-1", rojosoftConfig.flow === 'C' ? "animate-pulse" : "")} /> 
            Retenciones
            <span className="text-[8px] opacity-70 mt-0.5 tracking-tight font-medium">IIBB / Ganancias / IVA</span>
          </button>
        </div>

        {/* Cabecera & Data */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm transition-colors duration-200"
        >
          <div className="px-5 py-3 bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center transition-colors duration-200 cursor-pointer" onClick={() => toggleSection('cabecera')}>
            <div className="flex items-center gap-2">
              {expandedSections.cabecera ? <ChevronUp className="w-3 h-3 text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-loose">Cabecera de Comprobante</span>
            </div>
          </div>

          <AnimatePresence>
            {expandedSections.cabecera && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-6 gap-x-8">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Tipo</label>
                    <input 
                      type="text" 
                      value={localData.cabecera.tipo} 
                      readOnly={!isEditing}
                      onChange={(e) => handleFieldChange('tipo', e.target.value)}
                      onBlur={() => handleFieldVerify('tipo')}
                      className={getInputClasses('tipo', isEditing, "font-semibold uppercase")}
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">PV - Número</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="text" 
                        value={rojosoftConfig.puntoVenta} 
                        readOnly={!isEditing}
                        onChange={(e) => handleConfigChange('puntoVenta', e.target.value)}
                        onBlur={() => handleFieldVerify('puntoVenta')}
                        className={getInputClasses('puntoVenta', isEditing, "w-12 font-mono font-bold text-center")}
                      />
                      <span className="text-slate-300">-</span>
                      <input 
                        type="text" 
                        value={rojosoftConfig.nroComprobante} 
                        readOnly={!isEditing}
                        onChange={(e) => handleConfigChange('nroComprobante', e.target.value)}
                        onBlur={() => handleFieldVerify('nroComprobante')}
                        className={getInputClasses('nroComprobante', isEditing, "font-mono font-bold")}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Fecha</label>
                    <input 
                      type="text" 
                      value={localData.cabecera.fecha} 
                      readOnly={!isEditing}
                      onChange={(e) => handleFieldChange('fecha', e.target.value)}
                      onBlur={() => handleFieldVerify('fecha')}
                      className={getInputClasses('fecha', isEditing, "font-semibold")}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Emisor</label>
                    <input 
                      type="text" 
                      value={localData.cabecera.razon_social_emisor || ''} 
                      readOnly={!isEditing}
                      onChange={(e) => handleFieldChange('razon_social_emisor', e.target.value)}
                      onBlur={() => handleFieldVerify('razon_social_emisor')}
                      className={getInputClasses('razon_social_emisor', isEditing, "font-semibold uppercase")}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">CUIT</label>
                    <input 
                      type="text" 
                      value={localData.cabecera.cuit_emisor} 
                      readOnly={!isEditing}
                      onChange={(e) => handleFieldChange('cuit_emisor', e.target.value)}
                      onBlur={() => handleFieldVerify('cuit_emisor')}
                      className={getInputClasses('cuit_emisor', isEditing, "font-mono font-medium tracking-wider")}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">CAI/CAE</label>
                    <input 
                      type="text" 
                      value={localData.cae_cai || '-'} 
                      readOnly={!isEditing}
                      onChange={(e) => handleFieldChange('cae_cai', e.target.value)}
                      onBlur={() => handleFieldVerify('cae_cai')}
                      className={getInputClasses('cae_cai', isEditing, "font-mono font-medium tracking-wider")}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Rojosoft Integration Fields */}
        <section className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm transition-all relative">
          <div className="absolute top-0 right-0 p-2 opacity-5 pointer-events-none">
            <Database className="w-24 h-24" />
          </div>
          
          <div className="px-5 py-3 bg-white/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center relative z-10 cursor-pointer" onClick={() => toggleSection('maestro')}>
            <div className="flex items-center gap-2">
              {expandedSections.maestro ? <ChevronUp className="w-3 h-3 text-red-400" /> : <ChevronDown className="w-3 h-3 text-red-400" />}
              <h3 className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase tracking-widest flex items-center gap-2">
                <Zap className="w-4 h-4 fill-current" /> Direccionamiento de Integración ERP
              </h3>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-[9px] font-mono text-slate-400 bg-slate-200/50 dark:bg-white/5 px-2 py-1 rounded">
                ID: {rojosoftConfig.idTablaWS}
              </span>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  testSqlVistas();
                }}
                className="text-[9px] font-bold text-slate-400 hover:text-emerald-500 uppercase flex items-center gap-1 transition-colors group"
                title="Probar conexión de Vistas Cliente/Artículo con este CUIT"
              >
                <Database className="w-3 h-3 group-hover:scale-110" /> PROBAR VISTAS
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveTab('sql');
                }}
                className="text-[9px] font-bold text-slate-400 hover:text-slate-600 uppercase flex items-center gap-1 transition-colors group"
              >
                <HelpCircle className="w-3 h-3 group-hover:scale-110" /> Ayuda
              </button>
            </div>
          </div>
          
          <AnimatePresence>
            {expandedSections.maestro && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-6 space-y-6">
                  {/* LLAVE DE INTEGRACIÓN Y CONCILIADOR */}
                  {rojosoftConfig.flow === 'B' && (
                  <div className="bg-red-600/5 dark:bg-red-600/10 p-5 rounded-2xl border border-red-200/50 dark:border-red-900/30">
                    <div className="flex flex-col md:flex-row gap-6 items-center">
                      <div className="flex-1 space-y-2">
                        <label className="text-[10px] text-red-600 dark:text-red-400 uppercase font-black tracking-widest flex items-center gap-1.5">
                          <ShoppingBag className="w-4 h-4 text-red-500" /> Registro de Conciliación de Compra
                        </label>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                          La vinculación y el cuadre de cantidades, precios y códigos se realiza exclusivamente a través del Conciliador de Comprobantes Interactivos.
                        </p>
                        
                        <div className="pt-2 flex flex-col sm:flex-row gap-3">
                          <div className="flex-1 space-y-1">
                            <span className="text-[9px] text-slate-400 uppercase font-bold tracking-tight">Orden de Compra / Remito Vinculado</span>
                            <div className="px-3.5 py-2 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-mono font-bold text-slate-800 dark:text-white flex items-center justify-between">
                              <span>{rojosoftConfig.ordenCompra || <span className="text-slate-400 dark:text-slate-500 italic font-sans font-normal">Sin Orden Vinculada</span>}</span>
                              {rojosoftConfig.ordenCompra && (
                                <span className="flex h-2 w-2 relative">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex-1 sm:flex-none flex items-end">
                            <button 
                              type="button"
                              onClick={openMatchModal}
                              className="w-full sm:w-auto px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2"
                            >
                              <Zap className="w-3.5 h-3.5 fill-current text-white animate-pulse" /> Abrir Conciliador
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 w-full md:w-[35%] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl">
                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-400 uppercase font-bold tracking-tight">FacturaAfe (ID)</label>
                          <input 
                            type="text" 
                            value={rojosoftConfig.facturaAfe}
                            onChange={(e) => handleConfigChange('facturaAfe', e.target.value)}
                            onBlur={() => handleFieldVerify('facturaAfe')}
                            placeholder="IDTabla"
                            className={getMaestroInputClasses('facturaAfe')}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-400 uppercase font-bold tracking-tight">CuerpoAfe (ID)</label>
                          <input 
                            type="text" 
                            value={rojosoftConfig.facturaCuerpoAfe}
                            onChange={(e) => handleConfigChange('facturaCuerpoAfe', e.target.value)}
                            onBlur={() => handleFieldVerify('facturaCuerpoAfe')}
                            placeholder="IDCuerpo"
                            className={getMaestroInputClasses('facturaCuerpoAfe')}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-400 uppercase font-bold tracking-tight">Planta</label>
                      <select 
                        value={rojosoftConfig.planta}
                        onChange={(e) => {
                          handleConfigChange('planta', e.target.value);
                          handleFieldVerify('planta');
                        }}
                        onBlur={() => handleFieldVerify('planta')}
                        className={getMaestroInputClasses('planta', false)}
                      >
                        <option value="PB">PB</option>
                        <option value="SL">SL</option>
                        <option value="BA">BA</option>
                      </select>
                    </div>
                    
                    <div className="space-y-1 block max-md:col-span-2">
                      <label className="text-[9px] text-slate-400 uppercase font-bold tracking-tight">Cliente</label>
                      <input 
                        type="text" 
                        value={rojosoftConfig.cliente}
                        onChange={(e) => handleConfigChange('cliente', e.target.value)}
                        onBlur={() => handleFieldVerify('cliente')}
                        className={getMaestroInputClasses('cliente')}
                      />
                    </div>

                    {rojosoftConfig.flow === 'C' && (
                      <>
                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-400 uppercase font-bold tracking-tight">Cliente IVA</label>
                          <input 
                            type="text" 
                            value={rojosoftConfig.clienteIVA || ''}
                            onChange={(e) => handleConfigChange('clienteIVA', e.target.value)}
                            onBlur={() => handleFieldVerify('clienteIVA')}
                            className={getMaestroInputClasses('clienteIVA')}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-400 uppercase font-bold tracking-tight">C. Retención</label>
                          <input 
                            type="text" 
                            value={rojosoftConfig.clienteRetencion || ''}
                            onChange={(e) => handleConfigChange('clienteRetencion', e.target.value)}
                            onBlur={() => handleFieldVerify('clienteRetencion')}
                            className={getMaestroInputClasses('clienteRetencion')}
                          />
                        </div>
                      </>
                    )}

                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-400 uppercase font-bold tracking-tight">Comprobante</label>
                      {maestros.comprobantes.length > 0 ? (
                        <select 
                          value={rojosoftConfig.comprobante}
                          onChange={(e) => {
                            handleConfigChange('comprobante', e.target.value);
                            handleFieldVerify('comprobante');
                          }}
                          onBlur={() => handleFieldVerify('comprobante')}
                          className={getMaestroInputClasses('comprobante', false)}
                        >
                          {maestros.comprobantes.map((c: any) => (
                            <option key={c.codigo} value={c.codigo}>{c.descripcion}</option>
                          ))}
                        </select>
                      ) : (
                        <input 
                          type="text" 
                          value={rojosoftConfig.comprobante}
                          onChange={(e) => handleConfigChange('comprobante', e.target.value)}
                          onBlur={() => handleFieldVerify('comprobante')}
                          className={getMaestroInputClasses('comprobante', false)}
                        />
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-400 uppercase font-bold tracking-tight">Tipo CAI</label>
                      <input 
                        type="number" 
                        value={rojosoftConfig.tipoComprobanteCAI}
                        onChange={(e) => handleConfigChange('tipoComprobanteCAI', parseInt(e.target.value) || 1)}
                        onBlur={() => handleFieldVerify('tipoComprobanteCAI')}
                        className={getMaestroInputClasses('tipoComprobanteCAI')}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-400 uppercase font-bold tracking-tight">Moneda</label>
                      <input 
                        type="text" 
                        value={rojosoftConfig.moneda}
                        onChange={(e) => handleConfigChange('moneda', e.target.value)}
                        onBlur={() => handleFieldVerify('moneda')}
                        className={getMaestroInputClasses('moneda')}
                      />
                    </div>
                  </div>

                  {rojosoftConfig.flow === 'B' && (
                  <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <h4 className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Centro de Costo 1</h4>
                        <div className="flex gap-4">
                          <div className="flex-1 space-y-1">
                            <label className="text-[9px] text-slate-400">Código</label>
                            {maestros.centroCostos.length > 0 ? (
                              <select 
                                value={rojosoftConfig.centroCosto1}
                                onChange={(e) => handleConfigChange('centroCosto1', e.target.value)}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5 text-xs font-mono text-slate-700 dark:text-slate-300 outline-none"
                              >
                                {maestros.centroCostos.map((cc: any) => (
                                  <option key={cc.codigo} value={cc.codigo}>{cc.descripcion}</option>
                                ))}
                              </select>
                            ) : (
                              <input 
                                type="text" 
                                value={rojosoftConfig.centroCosto1}
                                onChange={(e) => handleConfigChange('centroCosto1', e.target.value)}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5 text-xs font-mono text-slate-700 dark:text-slate-300"
                              />
                            )}
                          </div>
                          <div className="w-20 space-y-1">
                            <label className="text-[9px] text-slate-400">%</label>
                            <input 
                              type="number" 
                              value={rojosoftConfig.porcentaje1}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                handleConfigChange('porcentaje1', val);
                                handleConfigChange('porcentaje2', 100 - val);
                              }}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5 text-xs text-center font-bold text-red-600 dark:text-red-400"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <h4 className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Centro de Costo 2</h4>
                        <div className="flex gap-4">
                          <div className="flex-1 space-y-1">
                            <label className="text-[9px] text-slate-400">Código</label>
                            {maestros.centroCostos.length > 0 ? (
                              <select 
                                value={rojosoftConfig.centroCosto2}
                                onChange={(e) => handleConfigChange('centroCosto2', e.target.value)}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5 text-xs font-mono text-slate-700 dark:text-slate-300 outline-none"
                              >
                                {maestros.centroCostos.map((cc: any) => (
                                  <option key={cc.codigo} value={cc.codigo}>{cc.descripcion}</option>
                                ))}
                              </select>
                            ) : (
                              <input 
                                type="text" 
                                value={rojosoftConfig.centroCosto2}
                                onChange={(e) => handleConfigChange('centroCosto2', e.target.value)}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5 text-xs font-mono text-slate-700 dark:text-slate-300"
                              />
                            )}
                          </div>
                          <div className="w-20 space-y-1">
                            <label className="text-[9px] text-slate-400">%</label>
                            <input 
                              type="number" 
                              value={rojosoftConfig.porcentaje2}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                handleConfigChange('porcentaje2', val);
                                handleConfigChange('porcentaje1', 100 - val);
                              }}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5 text-xs text-center font-bold text-red-600 dark:text-red-400"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    {rojosoftConfig.porcentaje1 + rojosoftConfig.porcentaje2 !== 100 && (
                      <p className="text-[9px] text-rose-500 mt-2 font-bold uppercase tracking-widest text-center animate-pulse">
                        Error: La sumatoria de porcentajes debe ser 100%
                      </p>
                    )}
                  </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Detailed Items Table */}
        <section className={cn("bg-white dark:bg-slate-900 border rounded-xl overflow-hidden shadow-sm transition-colors duration-200", isMatchAprobado ? "border-emerald-200 dark:border-emerald-900/50" : "border-slate-200 dark:border-slate-800")}>
          <div className={cn("px-4 py-2 border-b flex items-center justify-between cursor-pointer", isMatchAprobado ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-900/50" : "bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800")} onClick={() => toggleSection('detalle')}>
            <div className="flex items-center gap-2">
              {expandedSections.detalle ? <ChevronUp className={cn("w-3 h-3", isMatchAprobado ? "text-emerald-500" : "text-slate-400")} /> : <ChevronDown className={cn("w-3 h-3", isMatchAprobado ? "text-emerald-500" : "text-slate-400")} />}
              <span className={cn("text-[10px] font-black uppercase tracking-widest leading-loose", isMatchAprobado ? "text-emerald-700 dark:text-emerald-400" : "text-slate-500")}>Detalle de Ítems</span>
              {isMatchAprobado && (
                <span className="ml-2 bg-emerald-100 dark:bg-emerald-800/50 text-emerald-700 dark:text-emerald-300 text-[9px] px-2 py-0.5 rounded-full flex items-center gap-1 font-bold shadow-sm">
                  <Check className="w-3 h-3" /> CONCILIADO
                </span>
              )}
            </div>
          </div>
          <AnimatePresence>
            {expandedSections.detalle && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead className="bg-slate-50/30 dark:bg-slate-900/50 text-[10px] font-bold text-slate-400 uppercase border-b border-slate-100 dark:border-slate-800">
                      <tr>
                        {rojosoftConfig.flow === 'C' ? (
                          <>
                            <th className="px-5 py-3 font-bold tracking-wider">Detalle</th>
                            <th className="px-5 py-3 font-bold tracking-wider text-center">Fecha</th>
                            <th className="px-5 py-3 font-bold tracking-wider text-center">Moneda</th>
                            <th className="px-5 py-3 text-right font-bold tracking-wider">Importe Neto</th>
                          </>
                        ) : (
                          <>
                            {rojosoftConfig.flow === 'B' && <th className="px-5 py-3 font-bold tracking-wider">Código</th>}
                            <th className="px-5 py-3 font-bold tracking-wider">Descripción</th>
                            <th className="px-5 py-3 text-right font-bold tracking-wider">Cant.</th>
                            <th className="px-5 py-3 text-right font-bold tracking-wider">Precio</th>
                            <th className="px-5 py-3 text-right font-bold tracking-wider">IVA</th>
                            <th className="px-5 py-3 text-right font-bold tracking-wider">Total</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="text-xs text-slate-700 dark:text-slate-300 transition-all duration-300">
                      {localData.detalle?.map((item: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-50 dark:border-slate-800/50">
                          {rojosoftConfig.flow === 'C' ? (
                           <>
                             <td className="px-5 py-3 font-medium truncate max-w-[150px]" title={item.descripcion}>
                               {isEditing ? (
                                 <input 
                                    type="text"
                                    value={item.descripcion}
                                    onChange={(e) => {
                                      const newDetalle = [...localData.detalle];
                                      newDetalle[idx].descripcion = e.target.value;
                                      setLocalData({...localData, detalle: newDetalle});
                                    }}
                                    className="w-full bg-blue-50 dark:bg-blue-900/20 border-b border-blue-400 outline-none px-1"
                                 />
                               ) : (
                                 item.descripcion?.length > 40 ? item.descripcion.substring(0, 40) + '...' : item.descripcion
                               )}
                             </td>
                             <td className="px-5 py-3 text-center font-mono text-slate-500">
                               {localData.cabecera.fecha || new Date().toISOString().split('T')[0]}
                             </td>
                             <td className="px-5 py-3 text-center font-mono font-bold uppercase text-slate-500">
                               {localData.cabecera.moneda || 'PE'}
                             </td>
                             <td className="px-5 py-3 text-right font-bold text-slate-900 dark:text-white font-mono tracking-tighter">
                               {isEditing ? (
                                 <input 
                                    type="number"
                                    value={item.total}
                                    onChange={(e) => {
                                      const newDetalle = [...localData.detalle];
                                      newDetalle[idx].total = parseFloat(e.target.value) || 0;
                                      let neto_gravado = 0;
                                      newDetalle.forEach(d => { neto_gravado += d.total; });
                                      const newTotales = { ...localData.totales, total: neto_gravado };
                                      setLocalData({...localData, detalle: newDetalle, totales: newTotales});
                                    }}
                                    className="w-20 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-400 outline-none text-right px-1"
                                 />
                               ) : (
                                 formatExactDecimal(item.total, localData.cabecera.moneda)
                               )}
                             </td>
                           </>
                          ) : (
                           <>
                            {rojosoftConfig.flow === 'B' && (
                            <td className="px-5 py-3 font-mono text-blue-500">
                              <div className="flex flex-col gap-1">
                                {isEditing ? (
                                  <input 
                                 type="text"
                                 value={item.codigo_articulo || ''}
                                 placeholder="ART-000"
                                 onChange={(e) => {
                                   const newDetalle = [...localData.detalle];
                                   newDetalle[idx].codigo_articulo = e.target.value;
                                   setLocalData({...localData, detalle: newDetalle});
                                 }}
                                 className="w-20 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-400 outline-none px-1"
                               />
                             ) : (
                               item.codigo_articulo || '---'
                             )}
                             {!item.codigo_articulo && (
                               <span className="text-[8px] font-black text-amber-500 flex items-center gap-1 animate-pulse">
                                 <Database className="w-2 h-2" /> REQUERIDO
                               </span>
                             )}
                           </div>
                         </td>
                         )}
                       <td className="px-5 py-3 font-medium truncate max-w-[150px]" title={item.descripcion}>
                         {isEditing ? (
                           <input 
                              type="text"
                              value={item.descripcion}
                              onChange={(e) => {
                                const newDetalle = [...localData.detalle];
                                newDetalle[idx].descripcion = e.target.value;
                                setLocalData({...localData, detalle: newDetalle});
                              }}
                              className="w-full bg-blue-50 dark:bg-blue-900/20 border-b border-blue-400 outline-none px-1"
                           />
                         ) : (
                           item.descripcion?.length > 40 ? item.descripcion.substring(0, 40) + '...' : item.descripcion
                         )}
                       </td>
                       <td className="px-5 py-3 text-right font-mono">
                         {isEditing ? (
                           <input 
                              type="number"
                              value={item.cantidad}
                              onChange={(e) => {
                                const newDetalle = [...localData.detalle];
                                newDetalle[idx].cantidad = parseFloat(e.target.value) || 0;
                                newDetalle[idx].total = newDetalle[idx].cantidad * newDetalle[idx].precio;
                                
                                let neto_gravado = 0;
                                let iva_21 = 0;
                                let iva_105 = 0;
                                newDetalle.forEach(d => {
                                  neto_gravado += d.total;
                                  if (d.alicuota_iva === 10.5) {
                                    iva_105 += d.total * 0.105;
                                  } else {
                                    iva_21 += d.total * 0.21;
                                  }
                                });
                                const percepciones = localData.totales?.percepciones || 0;
                                const newTotales = { ...localData.totales, neto_gravado, iva_105, iva_21, total: neto_gravado + iva_105 + iva_21 + percepciones };

                                setLocalData({...localData, detalle: newDetalle, totales: newTotales});
                              }}
                              className="w-12 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-400 outline-none text-right px-1"
                           />
                         ) : (
                           item.cantidad?.toFixed(2)
                         )}
                       </td>
                       <td className="px-5 py-3 text-right font-mono">
                         {isEditing ? (
                           <input 
                              type="number"
                              value={item.precio}
                              onChange={(e) => {
                                const newDetalle = [...localData.detalle];
                                newDetalle[idx].precio = parseFloat(e.target.value) || 0;
                                newDetalle[idx].total = newDetalle[idx].cantidad * newDetalle[idx].precio;
                                
                                let neto_gravado = 0;
                                let iva_21 = 0;
                                let iva_105 = 0;
                                newDetalle.forEach(d => {
                                  neto_gravado += d.total;
                                  if (d.alicuota_iva === 10.5) {
                                    iva_105 += d.total * 0.105;
                                  } else {
                                    iva_21 += d.total * 0.21;
                                  }
                                });
                                const percepciones = localData.totales?.percepciones || 0;
                                const newTotales = { ...localData.totales, neto_gravado, iva_105, iva_21, total: neto_gravado + iva_105 + iva_21 + percepciones };

                                setLocalData({...localData, detalle: newDetalle, totales: newTotales});
                              }}
                              className="w-16 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-400 outline-none text-right px-1"
                           />
                         ) : (
                           formatExactDecimal(item.precio, localData.cabecera.moneda)
                         )}
                       </td>
                       <td className="px-5 py-3 text-right font-mono">
                           {isEditing ? (
                             <select
                               value={item.alicuota_iva || 21}
                               onChange={(e) => {
                                 const newDetalle = [...localData.detalle];
                                 newDetalle[idx].alicuota_iva = parseFloat(e.target.value);
                                 
                                 let neto_gravado = 0;
                                 let iva_21 = 0;
                                 let iva_105 = 0;
                                 newDetalle.forEach(d => {
                                   neto_gravado += d.total;
                                   if (d.alicuota_iva === 10.5) {
                                     iva_105 += d.total * 0.105;
                                   } else {
                                     iva_21 += d.total * 0.21;
                                   }
                                 });
                                 const percepciones = localData.totales?.percepciones || 0;
                                 const newTotales = { ...localData.totales, neto_gravado, iva_105, iva_21, total: neto_gravado + iva_105 + iva_21 + percepciones };
  
                                 setLocalData({...localData, detalle: newDetalle, totales: newTotales});
                               }}
                               className="w-16 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-400 outline-none text-right px-1"
                             >
                               <option value="21">21%</option>
                               <option value="10.5">10.5%</option>
                             </select>
                           ) : (
                             `${item.alicuota_iva || 21}%`
                           )}
                       </td>
                       <td className="px-5 py-3 text-right font-bold text-slate-900 dark:text-white font-mono tracking-tighter">
                         {formatExactDecimal(item.total, localData.cabecera.moneda)}
                       </td>
                       </>
                      )}
                     </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Impuestos Section */}
        {rojosoftConfig.flow !== 'C' && (
          <section className="border rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm transition-all duration-300 mb-6">
            <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center cursor-pointer bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors" onClick={() => toggleSection('impuestos')}>
              <div className="flex items-center gap-2">
                {expandedSections.impuestos ? <ChevronUp className="w-3 h-3 text-slate-500" /> : <ChevronDown className="w-3 h-3 text-slate-500" />}
                <span className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                  Impuestos ({localData.totales?.impuestos_provinciales?.length || 0})
                </span>
              </div>
            </div>
            
            <AnimatePresence>
              {expandedSections.impuestos && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-5">
                    <div className="flex justify-end mb-3">
                      <button
                        type="button"
                        onClick={handleAddImpuestoProvincial}
                        className="text-[10px] uppercase font-black tracking-widest text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-colors"
                      >
                        + AGREGAR IMPUESTO
                      </button>
                    </div>
                    {localData.totales?.impuestos_provinciales && localData.totales.impuestos_provinciales.length > 0 ? (
                      <div className="space-y-2 max-h-[220px] overflow-y-auto custom-scrollbar pr-1 mt-2.5">
                        {localData.totales.impuestos_provinciales.map((imp: any, idx: number) => (
                          <div 
                            key={idx} 
                            className="p-3 rounded-xl bg-slate-100/50 dark:bg-white/5 border border-slate-200/80 dark:border-slate-800 flex flex-col md:flex-row gap-3 items-end text-xs text-slate-705 dark:text-slate-300 relative group transition-all duration-300 hover:border-slate-300 dark:hover:border-slate-700/80 hover:bg-slate-200/30 dark:hover:bg-white/10"
                          >
                            <div className="flex-1 min-w-[100px] w-full">
                              <label className="text-[8px] text-slate-400 dark:text-slate-500 uppercase font-black block mb-1">Provincia</label>
                              <select
                                value={imp.provincia || imp.Provincia || 'B'}
                                onChange={(e) => handleEditImpuestoProvincial(idx, 'provincia', e.target.value)}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-700 dark:text-slate-250 outline-none"
                              >
                                <option value="B">Bs. As (B)</option>
                                <option value="S">Santa Fe (S)</option>
                                <option value="C">CABA (C)</option>
                                <option value="X">Córdoba (X)</option>
                                <option value="M">Mendoza (M)</option>
                                <option value="E">Entre Ríos (E)</option>
                              </select>
                            </div>

                            <div className="w-[70px] max-md:w-full">
                              <label className="text-[8px] text-slate-400 dark:text-slate-500 uppercase font-black block mb-1">Alíc. %</label>
                              <input
                                type="number"
                                step="0.01"
                                value={imp.alicuota || 0}
                                onChange={(e) => handleEditImpuestoProvincial(idx, 'alicuota', parseFloat(e.target.value) || 0)}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-750 dark:text-slate-200 outline-none"
                              />
                            </div>

                            <div className="flex-1 w-full">
                              <label className="text-[8px] text-slate-400 dark:text-slate-500 uppercase font-black block mb-1">Base ($)</label>
                              <input
                                type="number"
                                step="0.01"
                                value={imp.importe_base || 0}
                                onChange={(e) => handleEditImpuestoProvincial(idx, 'importe_base', parseFloat(e.target.value) || 0)}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-750 dark:text-slate-200 outline-none"
                              />
                            </div>

                            <div className="flex-1 w-full">
                              <label className="text-[8px] text-slate-400 dark:text-slate-500 uppercase font-black block mb-1">Importe ($)</label>
                              <input
                                type="number"
                                step="0.01"
                                value={imp.importe || 0}
                                onChange={(e) => handleEditImpuestoProvincial(idx, 'importe', parseFloat(e.target.value) || 0)}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-750 dark:text-slate-200 outline-none"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => handleDeleteImpuestoProvincial(idx)}
                              className="shrink-0 max-md:w-full p-1.5 px-3 bg-red-500/10 hover:bg-red-500 hover:text-white dark:hover:bg-red-500 text-red-500 dark:text-red-400 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border border-red-500/10 hover:border-transparent cursor-pointer"
                              title="Eliminar Impuesto"
                            >
                              Eliminar
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-2 text-center py-4 bg-slate-50 dark:bg-white/5 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                        <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 dark:text-slate-500">Sin Percepciones Provinciales</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        )}

        {/* Totals & Export Actions Container */}
        <div className="flex flex-col gap-6 pb-12">
          {(() => {
            const flowConfig = getFlowConfig(rojosoftConfig.flow);
            return (
            <section className={`border rounded-xl overflow-hidden shadow-sm transition-all duration-300 flex flex-col ${flowConfig.wrapper}`}>
            <div className={`px-5 py-4 flex justify-between items-center ${flowConfig.headerClass}`}>
              <div className="flex items-center gap-2">
                <flowConfig.icon className={`w-4 h-4 ${flowConfig.iconText}`} />
                <div className={`text-xs font-black uppercase tracking-widest ${flowConfig.text}`}>{flowConfig.label}: Resumen de Totales</div>
              </div>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                      {rojosoftConfig.flow === 'C' ? (
                        <>
                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Detalle de Retención Aplicada</div>
                          
                          <div className="space-y-4">
                            <div className="p-4 bg-white/10 rounded-2xl border border-slate-200 dark:border-white/20 space-y-3">
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-600 dark:text-slate-400 font-medium tracking-tight">Comprobante</span>
                                <span className="font-mono font-bold text-slate-900 dark:text-white uppercase">{rojosoftConfig.comprobante}</span>
                              </div>
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-600 dark:text-slate-400 font-medium tracking-tight">Pto. Venta / Nro</span>
                                <span className="font-mono font-bold text-slate-900 dark:text-white">{rojosoftConfig.puntoVenta}-{rojosoftConfig.nroComprobante}</span>
                              </div>
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-600 dark:text-slate-400 font-medium tracking-tight">Jurisdicción</span>
                                <select 
                                  value={rojosoftConfig.provinciaRetencion || 'S'} 
                                  onChange={(e) => handleConfigChange('provinciaRetencion', e.target.value)}
                                  className="bg-white dark:bg-black/20 border border-slate-200 dark:border-slate-800 rounded px-2 py-1 text-xs text-slate-900 dark:text-white font-bold outline-none focus:border-emerald-500 shadow-sm"
                                >
                                  <option value="S">Santa Fe</option>
                                  <option value="B">Buenos Aires</option>
                                  <option value="C">CABA</option>
                                  <option value="X">Córdoba</option>
                                  <option value="M">Mendoza</option>
                                  <option value="E">Entre Ríos</option>
                                </select>
                              </div>
                            </div>

                            {(() => {
                              const importeRetenido = localData.detalle?.reduce((acc: number, item: any) => acc + (parseFloat(item.importe) || 0), 0) || localData.totales?.total || 0;
                              const baseImponibleAuto = rojosoftConfig.importeBaseRetencion !== undefined 
                                ? Number(rojosoftConfig.importeBaseRetencion) 
                                : ((localData.detalle && localData.detalle.length > 0 && parseFloat(localData.detalle[0].importe_base)) 
                                  ? parseFloat(localData.detalle[0].importe_base)
                                  : Number(importeRetenido / ((rojosoftConfig.alicuotaRetencion || 0.6) / 100)));

                               return (
                                <>
                                  <div className="grid grid-cols-2 gap-3">
                                      <div className="p-3 bg-white/50 dark:bg-black/20 rounded-xl border border-slate-200 dark:border-slate-800">
                                        <label className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1">Alícuota (%)</label>
                                        <input 
                                          type="number" 
                                          value={rojosoftConfig.alicuotaRetencion} 
                                          onChange={(e) => handleConfigChange('alicuotaRetencion', parseFloat(e.target.value) || 0)}
                                          className="w-full bg-transparent border-none text-sm font-mono font-black text-slate-900 dark:text-white outline-none"
                                        />
                                      </div>
                                      <div className="p-3 bg-white/50 dark:bg-black/20 rounded-xl border border-slate-200 dark:border-slate-800">
                                        <label className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1">Moneda</label>
                                        <span className="text-sm font-black text-slate-900 dark:text-white uppercase">{rojosoftConfig.moneda}</span>
                                      </div>
                                  </div>

                                  <div className="p-3 bg-white/50 dark:bg-black/20 rounded-xl border border-slate-200 dark:border-slate-800">
                                      <label className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1">Base Imponible ($)</label>
                                      <input 
                                        type="number" 
                                        step="0.01"
                                        value={baseImponibleAuto.toFixed(2)} 
                                        onChange={(e) => handleConfigChange('importeBaseRetencion', parseFloat(parseFloat(e.target.value).toFixed(2)) || 0)}
                                        className="w-full bg-transparent border-none text-sm font-mono font-black text-slate-900 dark:text-white outline-none"
                                      />
                                  </div>
                                  
                                  <div className="pt-4 mt-2 border-t border-slate-200 dark:border-slate-800">
                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1">Total Importe Retenido</span>
                                    <div className="flex items-baseline gap-2">
                                      <span className="text-3xl font-black text-slate-900 dark:text-white font-mono tracking-tighter">
                                        {formatExactDecimal(importeRetenido, localData.cabecera?.moneda)}
                                      </span>
                                    </div>
                                  </div>
                                </>
                               );
                            })()}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4">
                            {rojosoftConfig.flow === 'A' ? 'Desglose Servicio / CC' : 'Desglose de Compra'}
                          </div>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-600 dark:text-slate-400 font-medium">Gastos / Neto Gravado</span>
                              <span className="font-mono tracking-wider text-slate-900 dark:text-white">{formatExactDecimal(localData.totales?.neto_gravado || 0, localData.cabecera?.moneda)}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-600 dark:text-slate-400 font-medium">IVA Total Facturado</span>
                              <span className="font-mono tracking-wider text-slate-900 dark:text-white">{formatExactDecimal((localData.totales?.iva_21 || 0) + (localData.totales?.iva_105 || 0), localData.cabecera?.moneda)}</span>
                            </div>
                            {(localData.totales?.percepciones || 0) > 0 && (
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-600 dark:text-slate-400 font-medium">Otras Percepciones</span>
                              <span className="font-mono tracking-wider text-slate-900 dark:text-white opacity-90">{formatExactDecimal(localData.totales?.percepciones || 0, localData.cabecera?.moneda)}</span>
                            </div>
                            )}

                            <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
                              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">A Pagar / Total</span>
                              <span className="text-xl font-bold text-slate-900 dark:text-white font-mono tracking-tighter">
                                {formatExactDecimal(localData.totales?.total || 0, localData.cabecera?.moneda)}
                              </span>
                            </div>

                            {rojosoftConfig.moneda === 'DO' && (
                              <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                                <label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-black tracking-tight">Valor de Cotización (U$S)</label>
                                <input 
                                  type="number"
                                  value={rojosoftConfig.cotizacion}
                                  onChange={(e) => handleConfigChange('cotizacion', parseFloat(e.target.value))}
                                  className="w-full bg-white/50 dark:bg-black/20 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500 transition-colors"
                                  placeholder="Ingrese cotización..."
                                />
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
            </section>
            );
          })()}

          <section className="bg-slate-50 border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col justify-between transition-colors duration-200 relative overflow-hidden">
            <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-5 pointer-events-none">
                <Database className="w-64 h-64 -mr-16" />
            </div>
            <div className="space-y-3 relative z-10 mb-6">
              <h3 className="text-[14px] font-black text-slate-800 dark:text-white tracking-widest flex items-center gap-2 uppercase">
                <Zap className="w-5 h-5 text-emerald-500 fill-current" /> Finalizar e Insertar Comprobante
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium pb-4 border-b border-slate-200 dark:border-slate-800 tracking-wide uppercase">
                Al confirmar, este comprobante se registrará mediante interfaz SOAP en su sistema ERP. Verifique los datos obligatorios previamente.
              </p>
            </div>
            
            <div className="relative z-10">
              <AnimatePresence>
                {integrationStatus && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }} 
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={cn(
                      "p-4 rounded-xl flex flex-col gap-3 text-xs uppercase tracking-widest mb-6",
                      integrationStatus.success ? "bg-emerald-50 dark:bg-emerald-500/10 border-2 border-emerald-200 dark:border-emerald-500/30" : "bg-rose-50 dark:bg-rose-500/10 border-2 border-rose-200 dark:border-rose-500/30"
                    )}
                  >
                    <div className={cn("flex gap-4 items-center font-black", integrationStatus.success ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400")}>
                      <div className={cn("p-2 rounded-full", integrationStatus.success ? "bg-emerald-100 dark:bg-emerald-900/50" : "bg-rose-100 dark:bg-rose-900/50")}>
                         {integrationStatus.success ? <Check className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                      </div>
                      <div>
                        <p className="text-sm">{integrationStatus.success ? 'Proceso Finalizado Exitosamente' : 'Error en la Integración'}</p>
                        <p className="text-[11px] mt-1 opacity-80 normal-case font-bold leading-relaxed">
                          {integrationStatus.success 
                            ? (integrationStatus.message || 'El comprobante ha sido insertado correctamente en el ERP.') 
                            : cleanErrorMessage(integrationStatus.message || integrationStatus.fault || '')
                          }
                        </p>
                      </div>
                    </div>
                    {showTechnicalDetails && integrationStatus.details && (
                      <div className={cn(
                        "mt-3 w-full overflow-hidden rounded-lg border",
                        integrationStatus.success 
                          ? "border-emerald-200 dark:border-emerald-500/30 bg-white/50 dark:bg-emerald-950/20"
                          : "border-rose-200 dark:border-rose-500/30 bg-white/50 dark:bg-rose-950/20"
                      )}>
                        <div className={cn(
                          "px-3 py-2 text-[9px] font-black flex justify-between items-center",
                          integrationStatus.success
                            ? "bg-emerald-100/50 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300"
                            : "bg-rose-100/50 dark:bg-rose-900/50 text-rose-800 dark:text-rose-300"
                        )}>
                          <span>RESPUESTA SERVIDOR</span>
                        </div>
                        <pre className={cn(
                          "p-3 text-[10px] font-mono overflow-auto max-h-48 normal-case whitespace-pre-wrap",
                          integrationStatus.success
                            ? "text-emerald-900 dark:text-emerald-200"
                            : "text-rose-900 dark:text-rose-200"
                        )}>
                          {integrationStatus.details}
                        </pre>
                      </div>
                    )}
                    {showTechnicalDetails && integrationStatus.sentXml && (
                      <div className={cn(
                        "mt-3 w-full overflow-hidden rounded-lg border",
                        integrationStatus.success 
                          ? "border-emerald-200 dark:border-emerald-500/30 bg-white/50 dark:bg-emerald-950/20"
                          : "border-rose-200 dark:border-rose-500/30 bg-white/50 dark:bg-rose-950/20"
                      )}>
                        <div className={cn(
                          "px-3 py-2 text-[9px] font-black flex justify-between items-center",
                          integrationStatus.success
                            ? "bg-emerald-100/50 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300"
                            : "bg-rose-100/50 dark:bg-rose-900/50 text-rose-800 dark:text-rose-300"
                        )}>
                          <span>PAYLOAD ENVIADO (SOAP)</span>
                        </div>
                        <pre className={cn(
                          "p-3 text-[10px] font-mono overflow-auto max-h-48 normal-case whitespace-pre-wrap",
                          integrationStatus.success
                            ? "text-emerald-900 dark:text-emerald-200"
                            : "text-rose-900 dark:text-rose-200"
                        )}>
                          {integrationStatus.sentXml}
                        </pre>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence mode="wait">
                {isEditing ? (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                    <button 
                      onClick={() => setIsEditing(false)}
                      className="w-full h-14 flex items-center justify-center gap-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition-all shadow-[0_0_25px_rgba(5,150,105,0.3)] active:scale-[0.98] tracking-[0.2em] uppercase group"
                    >
                      <Save className="w-5 h-5 group-hover:scale-110 transition-transform" /> APROBAR PARA INSERCIÓN
                    </button>
                  </motion.div>
                ) : (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col sm:flex-row gap-4">
                    <button 
                      onClick={() => setIsEditing(true)}
                      className="flex-1 h-14 flex items-center justify-center gap-2 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-black transition-all active:scale-[0.98] tracking-[0.1em] uppercase border-2 border-slate-200 dark:border-slate-700 shadow-sm"
                    >
                      <Edit3 className="w-4 h-4 opacity-70" /> VOLVER A EDITAR
                    </button>
                    <button 
                      onClick={handleInsert}
                      disabled={isInserting || (rojosoftConfig.flow === 'B' && rojosoftConfig.porcentaje1 + rojosoftConfig.porcentaje2 !== 100)} 
                      className="flex-[2] h-14 flex items-center justify-center gap-3 bg-slate-900 dark:bg-slate-100 hover:bg-black dark:hover:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-black transition-all shadow-[0_10px_30px_rgba(0,0,0,0.15)] active:scale-[0.98] tracking-[0.1em] uppercase disabled:bg-slate-300 disabled:dark:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed group border-2 border-transparent"
                    >
                      {isInserting ? 'PROCESANDO INSERCIÓN...' : 'CONFIRMAR E INSERTAR EN ERP'}
                      {isInserting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5 fill-current group-hover:scale-110 transition-transform text-white dark:text-slate-900" />}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>
        </div>

        {/* Technical Details Toggle */}
        <div className="flex justify-center my-4">
          <button 
            onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full text-xs font-bold uppercase tracking-widest transition-all shadow-sm"
          >
            {showTechnicalDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {showTechnicalDetails ? 'Ocultar Detalles Técnicos' : 'Ver Detalles Técnicos'}
          </button>
        </div>

        {/* Code Viewer (JSON/XML/SQL) - Now inside AnimatePresence based on showTechnicalDetails */}
        <AnimatePresence>
          {showTechnicalDetails && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm dark:shadow-none transition-colors mb-10">
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 transition-colors">
                  <div className="flex gap-4">
                    <button
                      onClick={() => setActiveTab('patterns')}
                      className={cn(
                        "text-[10px] font-bold tracking-widest transition-all uppercase",
                        activeTab === 'patterns' ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                      )}
                    >
                      PATRONES
                    </button>
                    <button
                      onClick={() => setActiveTab('xml')}
                      className={cn(
                        "text-[10px] font-bold tracking-widest transition-all uppercase",
                        activeTab === 'xml' ? "text-red-600 dark:text-red-400" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                      )}
                    >
                      SOAP ROJOSOFT
                    </button>
                    <button
                      onClick={() => setActiveTab('sql')}
                      className={cn(
                        "text-[10px] font-bold tracking-widest transition-all uppercase",
                        activeTab === 'sql' ? "text-amber-600 dark:text-amber-400" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                      )}
                    >
                      AYUDA SQL
                    </button>
                    <button
                      onClick={() => setActiveTab('json')}
                      className={cn(
                        "text-[10px] font-bold tracking-widest transition-all uppercase",
                        activeTab === 'json' ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                      )}
                    >
                      JSON RAW
                    </button>
                  </div>
                  <button
                    onClick={copyToClipboard}
                    className="text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all flex items-center gap-2"
                  >
                    <span className="text-[10px] font-bold tracking-widest uppercase">{copied ? 'Copiado' : 'Copiar'}</span>
                    {copied ? <Check className="w-3 h-3 text-emerald-500 dark:text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
                <div className="p-4 font-mono text-[11px] leading-relaxed max-h-[350px] overflow-auto custom-scrollbar text-slate-700 dark:text-slate-400">
                  {activeTab === 'xml' ? (
                    <pre className="whitespace-pre-wrap">
                      <code className="text-red-700 dark:text-red-400/80">{xmlOutput}</code>
                    </pre>
                  ) : activeTab === 'json' ? (
                    <pre className="text-emerald-700 dark:text-emerald-400/90 whitespace-pre-wrap">
                      <code>{JSON.stringify(localData, null, 2)}</code>
                    </pre>
                  ) : activeTab === 'sql' ? (
                    <pre className="text-amber-700 dark:text-amber-400/90 whitespace-pre-wrap">
                      <code>{sqlHelperText}</code>
                    </pre>
                  ) : (
                    <div className="space-y-4 font-sans">
                      <div className="flex items-center gap-3 text-indigo-400 mb-6">
                        <BrainCircuit className="w-5 h-5" />
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest leading-none">Inteligencia Adaptativa VIGIA</p>
                          <p className="text-[9px] font-medium opacity-60 normal-case mt-1">Registros de comportamiento y sugerencias aprendidas.</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {patternService.getLog().length === 0 ? (
                          <p className="text-center py-10 opacity-30 italic">No hay patrones registrados todavía.</p>
                        ) : (
                          patternService.getLog().map((p, i) => (
                            <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5 group border border-slate-200 dark:border-slate-800">
                              <div className="flex items-center gap-4">
                                <HistoryIcon className="w-4 h-4 opacity-40 text-slate-500 dark:text-slate-400" />
                                <div>
                                  <p className="text-[10px] font-black text-slate-800 dark:text-white uppercase">{p.provider}</p>
                                  <p className="text-[9px] text-slate-500 dark:text-slate-400 font-medium">CC: {p.centroCosto} ({p.distribucion.cc1}/{p.distribucion.cc2})</p>
                                </div>
                              </div>
                              <button 
                                onClick={() => {
                                  setRojosoftConfig((prev: RojosoftConfig) => ({
                                    ...prev,
                                    centroCosto1: p.centroCosto,
                                    cliente: p.cliente,
                                    porcentaje1: p.distribucion.cc1,
                                    porcentaje2: p.distribucion.cc2
                                  }));
                                }}
                                className="text-[9px] font-black text-indigo-500 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 rounded"
                              >
                                USAR
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Match Modal */}
      <AnimatePresence>
        {isMatchModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-white dark:bg-slate-900 max-w-6xl w-full h-[85vh] flex flex-col rounded-3xl shadow-2xl overflow-hidden border border-red-500/20"
            >
              <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-between items-center shrink-0">
                <div>
                  <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase flex items-center gap-2">
                    <Zap className="w-5 h-5 text-red-500" /> Módulo Conciliador de Comprobantes (ERP)
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Operando en tiempo real contra Rojosoft. CUIT Emisor: <span className="font-mono text-slate-705 dark:text-slate-300 font-bold">{localData.cabecera?.cuit_emisor}</span>
                  </p>
                </div>
                <button 
                  onClick={() => setIsMatchModalOpen(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-xs font-bold transition-all text-slate-700 dark:text-slate-300"
                >
                  CERRAR
                </button>
              </div>
              
              <div className="flex-1 overflow-auto bg-slate-100 dark:bg-slate-900 custom-scrollbar flex flex-col">
                {isMatching ? (
                  <div className="h-full flex-1 flex flex-col items-center justify-center gap-4 text-slate-500 py-12">
                    <Loader2 className="w-10 h-10 animate-spin text-red-500" />
                    <p className="text-sm font-bold animate-pulse uppercase tracking-widest">Ejecutando consultas SQL...</p>
                  </div>
                ) : matchData ? (
                  <Conciliador 
                    invoiceItems={localData.detalle || []}
                    ocOrders={matchData.ordenes || []}
                    currency={localData.cabecera?.moneda || 'ARS'}
                    onClose={() => setIsMatchModalOpen(false)}
                    onReconcile={(updatedItems, ocOrder) => {
                      // Update invoice items in state
                      setLocalData((prev: any) => {
                        const updated = {
                          ...prev,
                          detalle: updatedItems
                        };
                        
                        // Recalculate totals
                        const totalNeto = updatedItems.reduce((acc, it) => acc + (it.total || 0), 0);
                        const totalIva = updatedItems.reduce((acc, it) => acc + ((it.total || 0) * (it.alicuota_iva || 21) / 100), 0);
                        const totalPerc = updatedItems.reduce((acc, it) => acc + ((it.total || 0) * (it.alicuota_percepcion_dgr || 0) / 100), 0);
                        const totalComprobante = totalNeto + totalIva + totalPerc;
                        
                        return {
                          ...updated,
                          totales: {
                            ...prev.totales,
                            neto_gravado: parseFloat(totalNeto.toFixed(2)),
                            iva_21: parseFloat(totalIva.toFixed(2)),
                            total: parseFloat(totalComprobante.toFixed(2))
                          }
                        };
                      });
                      
                      // Update ERP integration config
                      setRojosoftConfig((prev: RojosoftConfig) => ({
                        ...prev,
                        ordenCompra: String(ocOrder.NumeroComprobante),
                        facturaAfe: String(ocOrder.IdTabla || ocOrder.Id || '0')
                      }));
                      
                      setIsMatchModalOpen(false);
                    }}
                  />
                ) : (
                  <div className="h-full flex-1 flex flex-col items-center justify-center gap-4 text-slate-400 py-12">
                    <AlertCircle className="w-10 h-10" />
                    <p className="text-sm font-bold uppercase tracking-widest">No se obtuvieron datos de órdenes de compra</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Modal */}
      <AnimatePresence>
        {integrationStatus?.success && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", bounce: 0.5, duration: 0.6 }}
              className="bg-white dark:bg-slate-900 max-w-xl w-full rounded-3xl shadow-2xl overflow-hidden border border-emerald-500/20"
            >
              <div className="p-8 md:p-12 text-center flex flex-col items-center relative overflow-hidden">
                {/* Background glow */}
                <div className="absolute inset-0 bg-emerald-500/10 dark:bg-emerald-500/5 pointer-events-none" />
                
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring", bounce: 0.6 }}
                  className="w-24 h-24 bg-emerald-100 dark:bg-emerald-500/20 rounded-full flex items-center justify-center mb-8 relative z-10"
                >
                  <Check className="w-12 h-12 text-emerald-600 dark:text-emerald-400" />
                  <motion.div 
                    className="absolute inset-0 border-4 border-emerald-500 rounded-full"
                    initial={{ scale: 1, opacity: 1 }}
                    animate={{ scale: 1.5, opacity: 0 }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                </motion.div>
                
                <h2 className="text-3xl md:text-4xl font-black tracking-tighter text-slate-900 dark:text-white mb-4 relative z-10">
                  ¡Comprobante Insertado!
                </h2>
                
                <p className="text-slate-600 dark:text-slate-400 text-lg mb-8 relative z-10 leading-relaxed font-light">
                  {integrationStatus.message || 'El comprobante ha sido procesado e integrado exitosamente hacia Rojosoft.'}
                </p>

                <div className="w-full flex gap-4 relative z-10">
                  <button
                    onClick={() => {
                        setIntegrationStatus(null);
                        onUpdateData?.(null); // Optional: close the view and go back to uploader
                    }}
                    className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold uppercase tracking-widest text-sm transition-all shadow-lg hover:shadow-emerald-600/30 active:scale-95"
                  >
                    Procesar Otro
                  </button>
                  <button
                    onClick={() => setIntegrationStatus(null)}
                    className="flex-1 py-4 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-white rounded-xl font-bold uppercase tracking-widest text-sm transition-all active:scale-95"
                  >
                    Ver Detalles
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
