import { motion, AnimatePresence } from 'motion/react';
import { 
  Database, 
  Server, 
  Settings2, 
  Loader2, 
  Save, 
  Users, 
  Key, 
  Globe, 
  FileJson, 
  AlertCircle, 
  CheckCircle2,
  Plus,
  Trash2,
  Check,
  ChevronRight,
  Activity,
  Zap,
  Sparkles,
  FileText
} from 'lucide-react';
import { useTenant } from '../lib/TenantContext';
import { useState, useEffect } from 'react';
import { cn } from '../lib/utils';
import { notify } from '../lib/notifications';

type CustomEndpoint = {
  id: string;
  name: string;
  url: string;
  type: 'compras' | 'servicios'| 'acopio';
  soapAction?: string; // Optional custom soapAction
};

export function ApiConfig({ isAdmin }: { isAdmin?: boolean }) {
  const { tenants, activeTenant, setActiveTenant, updateTenantSqlConfig, updateTenantModules } = useTenant();

  // Test states
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'none' | 'success' | 'error'>('none');
  const [testMessage, setTestMessage] = useState('');

  // Local form states for active tenant SQL editing
  const [sqlServer, setSqlServer] = useState('');
  const [sqlPort, setSqlPort] = useState('1433');
  const [sqlDatabase, setSqlDatabase] = useState('');
  const [sqlUser, setSqlUser] = useState('');
  const [sqlPassword, setSqlPassword] = useState('');
  const [sqlInstance, setSqlInstance] = useState('');
  const [endpointCompras, setEndpointCompras] = useState('');
  const [endpointServicios, setEndpointServicios] = useState('');
  const [erpHost, setErpHost] = useState('');

  // Modules activation states
  const [modExtractor, setModExtractor] = useState(true);
  const [modCheques, setModCheques] = useState(true);
  const [modCintelink, setModCintelink] = useState(false);
  const [modWilliams, setModWilliams] = useState(false);
  
  const [compCompras, setCompCompras] = useState(true);
  const [compServicios, setCompServicios] = useState(true);
  const [compRetenciones, setCompRetenciones] = useState(true);

  // Form for adding a custom endpoint
  const [showAddEndpoint, setShowAddEndpoint] = useState(false);
  const [newEndpointName, setNewEndpointName] = useState('');
  const [newEndpointUrl, setNewEndpointUrl] = useState('/IA/ServiceCustom.asmx');
  const [newEndpointType, setNewEndpointType] = useState<'compras' | 'servicios'>('compras');
  const [newSoapAction, setNewSoapAction] = useState('');

  // Sync edit form with selected active tenant
  useEffect(() => {
    if (activeTenant) {
      const config = activeTenant.sqlConfig || ({} as any);
      setSqlServer(config.server || '');
      setSqlPort(config.port || '1433');
      setSqlDatabase(config.database || '');
      setSqlUser(config.user || '');
      setSqlPassword(config.password || '');
      setSqlInstance(config.instanceName || '');
      setEndpointCompras(config.endpointCompras || '/IA/ServiceFactura.asmx');
      setEndpointServicios(config.endpointServicios || '/IA/ServiceCuentaCorriente.asmx');
      setErpHost(config.erpHost || 'https://terra-verde.ddns.net/');

      const modules = activeTenant.modules || {};
      setModExtractor(modules.extractorActivo ?? true);
      setModCheques(modules.chequesActivo ?? true);
      setModCintelink(modules.cintelinkActivo ?? false);
      setModWilliams(modules.williamsActivo ?? false);
      
      setCompCompras(modules.compComprasActivo ?? true);
      setCompServicios(modules.compServiciosActivo ?? true);
      setCompRetenciones(modules.compRetencionesActivo ?? true);
    }
  }, [activeTenant]);

  if (!activeTenant) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-slate-500 space-y-4">
        <Users className="w-16 h-16 opacity-30 text-[#E30613] animate-pulse" />
        <h3 className="text-lg font-black uppercase tracking-widest text-[11px]">Control de Integración VIGIA</h3>
        <p className="text-sm max-w-md text-center text-slate-400">Debe tener al menos un miembro o cliente configurado en Nexus para gestionar las integraciones.</p>
      </div>
    );
  }

  const customEndpoints: CustomEndpoint[] = activeTenant.sqlConfig?.customEndpoints || [];

  const handleSaveConfig = async () => {
    try {
      const updatedConfig = {
        ...(activeTenant.sqlConfig || {}),
        server: sqlServer,
        port: sqlPort,
        database: sqlDatabase,
        user: sqlUser,
        password: sqlPassword,
        instanceName: sqlInstance,
        endpointCompras,
        endpointServicios,
        erpHost,
        customEndpoints // maintain current list
      };

      const updatedModules = {
        extractorActivo: modExtractor,
        chequesActivo: modCheques,
        cintelinkActivo: modCintelink,
        williamsActivo: modWilliams,
        compComprasActivo: compCompras,
        compServiciosActivo: compServicios,
        compRetencionesActivo: compRetenciones,
      };

      await updateTenantSqlConfig(activeTenant.id, updatedConfig);
      await updateTenantModules(activeTenant.id, updatedModules);
      
      notify({
        type: 'success',
        title: 'Configuración Guardada',
        message: 'Los parámetros de enlace para ' + activeTenant.name + ' han sido actualizados.'
      });
    } catch (err: any) {
      notify({
        type: 'error',
        title: 'Error de Guardado',
        message: err.message || 'No se pudo guardar la configuración.'
      });
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult('none');
    setTestMessage('');
    
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
      const connectionParams = {
        host: sqlServer,
        server: sqlServer,
        port: sqlPort,
        database: sqlDatabase,
        user: sqlUser,
        pass: sqlPassword,
        password: sqlPassword,
        instanceName: sqlInstance
      };

      const res = await fetch(`${backendUrl}/api/db/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: connectionParams })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al conectar');
      
      setTestResult('success');
      setTestMessage('Enlace SQL Server establecido de forma segura.');
      notify({
        type: 'success',
        title: 'Conexión Exitosa',
        message: 'Se estableció conexión con la base ' + sqlDatabase
      });
    } catch (e: any) {
      setTestResult('error');
      setTestMessage(e.message || 'Fallo en la prueba de handshake.');
      notify({
        type: 'error',
        title: 'Fallo de Enlace',
        message: 'No se pudo conectar a la base de datos SQL.'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleAddCustomEndpoint = async () => {
    if (!newEndpointName.trim() || !newEndpointUrl.trim()) {
      alert('Complete los campos para agregar el endpoint.');
      return;
    }

    try {
      const templateEndpoint: CustomEndpoint = {
        id: Math.random().toString(36).substring(2, 9),
        name: newEndpointName,
        url: newEndpointUrl,
        type: newEndpointType,
        soapAction: newSoapAction.trim() || undefined
      };

      const newEndpoints = [...customEndpoints, templateEndpoint];
      const updatedConfig = {
        ...(activeTenant.sqlConfig || {}),
        server: sqlServer,
        port: sqlPort,
        database: sqlDatabase,
        user: sqlUser,
        password: sqlPassword,
        instanceName: sqlInstance,
        endpointCompras: newEndpointType === 'compras' ? templateEndpoint.url : endpointCompras,
        endpointServicios: newEndpointType === 'servicios' ? templateEndpoint.url : endpointServicios,
        erpHost,
        customEndpoints: newEndpoints
      };

      // Auto-set the new endpoint for its corresponding type
      if (newEndpointType === 'compras') {
        setEndpointCompras(templateEndpoint.url);
      } else {
        setEndpointServicios(templateEndpoint.url);
      }

      await updateTenantSqlConfig(activeTenant.id, updatedConfig);
      
      // Reset form
      setNewEndpointName('');
      setNewEndpointUrl('/IA/ServiceCustom.asmx');
      setNewSoapAction('');
      setShowAddEndpoint(false);

      notify({
        type: 'success',
        title: 'Endpoint Registrado',
        message: 'Nuevo canal SOAP agregado permanentemente para ' + activeTenant.name
      });
    } catch (err: any) {
      notify({
        type: 'error',
        title: 'Error al agregar',
        message: err.message
      });
    }
  };

  const handleDeleteEndpoint = async (id: string) => {
    try {
      const filtered = customEndpoints.filter(ep => ep.id !== id);
      const updatedConfig = {
        ...(activeTenant.sqlConfig || {}),
        customEndpoints: filtered
      };

      await updateTenantSqlConfig(activeTenant.id, updatedConfig);
      notify({
        type: 'success',
        title: 'Endpoint Removido',
        message: 'Canal SOAP eliminado correctamente.'
      });
    } catch (err: any) {
      notify({
        type: 'error',
        title: 'Error',
        message: 'No se pudo eliminar el endpoint.'
      });
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-6xl mx-auto space-y-8 pb-12 text-slate-900 dark:text-white transition-colors duration-300"
    >
      {/* Upper Header: Neural & Corporate Accent */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-white/5 pb-6">
        <div>
          <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#E30613] to-rose-500 leading-tight inline-block pb-1">
            Conexión de Clientes.
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Configure credenciales SQL Server de Rojosoft y administre múltiples canales soap alternativos.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveConfig}
            className="px-5 py-3 bg-[#E30613] hover:bg-red-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 hover:scale-[1.02] shadow-xl shadow-red-600/20 flex items-center gap-2"
          >
            <Save className="w-3.5 h-3.5" /> Guardar Todo
          </button>
        </div>
      </div>

      {/* Selector de Cliente Activo (Solo si hay más de 1 cliente disponible) */}
      {tenants.length > 1 && (
        <div className="bg-white dark:bg-slate-900/60 p-6 rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-sm space-y-3">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block px-1">
            Paso 1: Seleccione Cliente de Enlace
          </label>
          <div className="flex flex-wrap gap-2">
            {tenants.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTenant(t)}
                className={cn(
                  "px-5 py-3 rounded-2xl text-xs font-bold transition-all border duration-300 flex items-center gap-2",
                  activeTenant.id === t.id
                    ? "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/30 ring-2 ring-red-500/10"
                    : "bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/10"
                )}
              >
                <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* SQL Credentials Panel (Left - col-span-5) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white dark:bg-slate-900/60 p-6 rounded-[2.2rem] border border-slate-200 dark:border-white/5 shadow-sm space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-200 dark:border-white/5 pb-4">
              <div className="p-3 bg-red-50 dark:bg-red-500/10 rounded-2xl text-red-600 dark:text-red-400">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Rojosoft SQL</span>
                <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Ecosistema Base de Datos</h4>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block px-1">SQL Servidor / IP Host</label>
                  <div className="relative">
                    <Globe className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={sqlServer}
                      onChange={(e) => setSqlServer(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-white/5 pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-mono outline-none focus:ring-2 focus:ring-red-500/30 transition-all text-slate-800 dark:text-slate-200"
                      placeholder="e.g. terra-verde.ddns.net"
                    />
                  </div>
                </div>
                <div className="col-span-1 space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-[#E30613] block px-1 font-bold">Puerto TCP</label>
                  <input
                    type="text"
                    value={sqlPort}
                    onChange={(e) => setSqlPort(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-white/5 px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-mono outline-none focus:ring-2 focus:ring-red-500/30 transition-all text-slate-800 dark:text-slate-200 font-bold"
                    placeholder="1433"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block px-1">Database</label>
                  <input
                    type="text"
                    value={sqlDatabase}
                    onChange={(e) => setSqlDatabase(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-white/5 px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold outline-none focus:ring-2 focus:ring-red-500/30 transition-all text-slate-800 dark:text-slate-200"
                    placeholder="e.g. TerraVerde_DB"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block px-1">Instancia (Opcional)</label>
                  <input
                    type="text"
                    value={sqlInstance}
                    onChange={(e) => setSqlInstance(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-white/5 px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-medium outline-none focus:ring-2 focus:ring-red-500/30 transition-all text-slate-800 dark:text-slate-200"
                    placeholder="Dejar vacío si usa puerto directo"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block px-1">SQL User</label>
                  <input
                    type="text"
                    value={sqlUser}
                    onChange={(e) => setSqlUser(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-white/5 px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-mono outline-none focus:ring-2 focus:ring-red-500/30 transition-all text-slate-800 dark:text-slate-200"
                    placeholder="sa"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block px-1">SQL Password</label>
                  <div className="relative">
                    <Key className="w-3.5 h-3.5 absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      type="password"
                      value={sqlPassword}
                      onChange={(e) => setSqlPassword(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-white/5 pl-9 pr-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-mono outline-none focus:ring-2 focus:ring-red-500/30 transition-all text-slate-800 dark:text-slate-200"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-amber-600 dark:text-amber-400 leading-normal px-2.5 py-2.5 rounded-xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/15 font-medium transition-colors">
                ⚠️ <strong>Recomendación de Red:</strong> Para conectar remotamente con SQL Server, se recomienda especificar el <strong>Puerto TCP</strong> (ej: <code>1433</code>) y dejar el campo de <strong>Instancia vacío</strong>. Así evitará el lookup UDP por el puerto 1434 (SQL Browser), que a menudo se bloquea en redes externas.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-white/5 space-y-3">
              <button
                onClick={handleTestConnection}
                disabled={isTesting}
                className="w-full py-3 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-all duration-300 flex items-center justify-center gap-2 uppercase tracking-wider"
              >
                {isTesting ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#E30613]" />
                ) : (
                  <Zap className="w-4 h-4 text-[#E30613]" />
                )}
                {isTesting ? 'Estableciendo handshake...' : 'Probar Enlace Especial'}
              </button>

              <AnimatePresence mode="wait">
                {testResult !== 'none' && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className={cn(
                      "p-3 rounded-xl border text-xs font-medium flex gap-2 items-start transition-colors",
                      testResult === 'success' 
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                        : "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400"
                    )}
                  >
                    {testResult === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-bold uppercase tracking-wider text-[9px] mb-0.5">
                        {testResult === 'success' ? 'TEST STATUS: ONLINE' : 'TEST STATUS: FAILURE'}
                      </p>
                      <p className="opacity-90">{testMessage}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900/60 p-6 rounded-[2.2rem] border border-slate-200 dark:border-white/5 shadow-sm space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-200 dark:border-white/5 pb-4">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl text-indigo-600 dark:text-indigo-400">
                <Settings2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Permisos por Cliente</span>
                <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Módulos Activos</h4>
              </div>
            </div>

            <div className="space-y-4">
              <label className="flex items-center justify-between cursor-pointer group">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">Lector Inteligente</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Extracción de datos desde facturas.</span>
                </div>
                <div className={cn("w-10 h-6 border-2 rounded-full relative transition-colors", modExtractor ? "bg-red-600 border-red-600" : "bg-transparent border-slate-300 dark:border-slate-600")}>
                   <input type="checkbox" className="hidden" checked={modExtractor} onChange={(e) => setModExtractor(e.target.checked)} />
                   <div className={cn("absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-transform", modExtractor ? "translate-x-4" : "")} />
                </div>
              </label>

              <label className="flex items-center justify-between cursor-pointer group">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">Lector de Cheques</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Análisis visual de valores y cheques.</span>
                </div>
                <div className={cn("w-10 h-6 border-2 rounded-full relative transition-colors", modCheques ? "bg-red-600 border-red-600" : "bg-transparent border-slate-300 dark:border-slate-600")}>
                   <input type="checkbox" className="hidden" checked={modCheques} onChange={(e) => setModCheques(e.target.checked)} />
                   <div className={cn("absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-transform", modCheques ? "translate-x-4" : "")} />
                </div>
              </label>

              <label className="flex items-center justify-between cursor-pointer group">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">Cintelink Sync</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Sincronización bancaria.</span>
                </div>
                <div className={cn("w-10 h-6 border-2 rounded-full relative transition-colors", modCintelink ? "bg-red-600 border-red-600" : "bg-transparent border-slate-300 dark:border-slate-600")}>
                   <input type="checkbox" className="hidden" checked={modCintelink} onChange={(e) => setModCintelink(e.target.checked)} />
                   <div className={cn("absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-transform", modCintelink ? "translate-x-4" : "")} />
                </div>
              </label>

              <label className="flex items-center justify-between cursor-pointer group">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">Williams Logística</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Cartas de porte y auditorías.</span>
                </div>
                <div className={cn("w-10 h-6 border-2 rounded-full relative transition-colors", modWilliams ? "bg-red-600 border-red-600" : "bg-transparent border-slate-300 dark:border-slate-600")}>
                   <input type="checkbox" className="hidden" checked={modWilliams} onChange={(e) => setModWilliams(e.target.checked)} />
                   <div className={cn("absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-transform", modWilliams ? "translate-x-4" : "")} />
                </div>
              </label>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900/60 p-6 rounded-[2.2rem] border border-slate-200 dark:border-white/5 shadow-sm space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-200 dark:border-white/5 pb-4">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl text-emerald-600 dark:text-emerald-400">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Restricciones del Motor</span>
                <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Tipos de Comprobantes</h4>
              </div>
            </div>

            <div className="space-y-4">
              <label className="flex items-center justify-between cursor-pointer group">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">Facturas de Compras (Bienes)</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Mercadería e Insumos Físicos</span>
                </div>
                <div className={cn("w-10 h-6 border-2 rounded-full relative transition-colors", compCompras ? "bg-emerald-600 border-emerald-600" : "bg-transparent border-slate-300 dark:border-slate-600")}>
                   <input type="checkbox" className="hidden" checked={compCompras} onChange={(e) => setCompCompras(e.target.checked)} />
                   <div className={cn("absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-transform", compCompras ? "translate-x-4" : "")} />
                </div>
              </label>

              <label className="flex items-center justify-between cursor-pointer group">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">Facturas de Servicios (Gastos)</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Internet, Honorarios, Suscripciones</span>
                </div>
                <div className={cn("w-10 h-6 border-2 rounded-full relative transition-colors", compServicios ? "bg-emerald-600 border-emerald-600" : "bg-transparent border-slate-300 dark:border-slate-600")}>
                   <input type="checkbox" className="hidden" checked={compServicios} onChange={(e) => setCompServicios(e.target.checked)} />
                   <div className={cn("absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-transform", compServicios ? "translate-x-4" : "")} />
                </div>
              </label>

              <label className="flex items-center justify-between cursor-pointer group">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">Retenciones e Impuestos</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">IIBB, Ganancias, IVA</span>
                </div>
                <div className={cn("w-10 h-6 border-2 rounded-full relative transition-colors", compRetenciones ? "bg-emerald-600 border-emerald-600" : "bg-transparent border-slate-300 dark:border-slate-600")}>
                   <input type="checkbox" className="hidden" checked={compRetenciones} onChange={(e) => setCompRetenciones(e.target.checked)} />
                   <div className={cn("absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-transform", compRetenciones ? "translate-x-4" : "")} />
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Dynamic SOAP Endpoints management (Right - col-span-7) */}
        <div className="lg:col-span-7 space-y-8">
          
          {/* Active Endpoints Selection */}
          <div className="bg-white dark:bg-slate-900/60 p-6 rounded-[2.2rem] border border-slate-200 dark:border-white/5 shadow-sm space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-200 dark:border-white/5 pb-4">
              <div className="p-3 bg-red-50 dark:bg-red-500/10 rounded-2xl text-red-600 dark:text-red-400">
                <FileJson className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Rojosoft Enlaces Activos</span>
                <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Canales SOAP de Destino</h4>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5 bg-slate-50 dark:bg-white/5 p-4 rounded-xl border border-slate-200/50 dark:border-white/5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block px-1">Servidor URL Base ERP (Host SOAP)</label>
                <div className="relative">
                  <Globe className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={erpHost}
                    onChange={(e) => setErpHost(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-mono outline-none focus:ring-2 focus:ring-red-500/30 transition-all text-slate-800 dark:text-slate-200 font-bold"
                    placeholder="e.g. https://terra-verde.ddns.net/"
                  />
                </div>
                <p className="text-[10px] text-slate-400 dark:text-slate-400/80 px-1 leading-normal pt-1.5">
                  Este es el host HTTPS público donde se exponen los servicios web de Rojosoft (ej: <code>https://terra-verde.ddns.net/</code>). Se utilizará para llamadas SOAP XML de inserción.
                </p>
              </div>

              <div className="h-px bg-slate-200 dark:bg-white/10 my-2" />

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block px-1">Canal para Compras / Stock (Flujo B)</label>
                <select
                  value={endpointCompras}
                  onChange={(e) => setEndpointCompras(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-white/5 px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-mono outline-none focus:ring-2 focus:ring-red-500/30 text-slate-700 dark:text-slate-300 font-bold"
                >
                  <option value="/IA/ServiceFactura.asmx">Predeterminado (/IA/ServiceFactura.asmx)</option>
                  {customEndpoints
                    .filter(ep => ep.type === 'compras')
                    .map(ep => (
                      <option key={ep.id} value={ep.url}>{ep.name} ({ep.url})</option>
                    ))
                  }
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block px-1">Canal para Servicios / Retenciones (Flujo C)</label>
                <select
                  value={endpointServicios}
                  onChange={(e) => setEndpointServicios(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-white/5 px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-mono outline-none focus:ring-2 focus:ring-red-500/30 text-slate-700 dark:text-slate-300 font-bold"
                >
                  <option value="/IA/ServiceCuentaCorriente.asmx">Predeterminado (/IA/ServiceCuentaCorriente.asmx)</option>
                  {customEndpoints
                    .filter(ep => ep.type === 'servicios')
                    .map(ep => (
                      <option key={ep.id} value={ep.url}>{ep.name} ({ep.url})</option>
                    ))
                  }
                </select>
              </div>
            </div>
          </div>

          {/* Endpoints List with Add Form */}
          <div className="bg-white dark:bg-slate-900/60 p-6 rounded-[2.2rem] border border-slate-200 dark:border-white/5 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-slate-100 dark:bg-white/5 rounded-2xl text-slate-600 dark:text-slate-400">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Multicanal SOAP</span>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Canales Personalizados</h4>
                </div>
              </div>

              <button
                onClick={() => setShowAddEndpoint(!showAddEndpoint)}
                className="px-4 py-2 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all hover:scale-105"
              >
                {showAddEndpoint ? 'Cerrar Form' : 'Agregar Canal'}
              </button>
            </div>

            <AnimatePresence>
              {showAddEndpoint && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-slate-50 dark:bg-white/5 p-5 rounded-2xl border border-slate-100 dark:border-white/5 space-y-4 overflow-hidden"
                >
                  <h5 className="text-[10px] font-black uppercase tracking-widest text-red-600">Nuevo Endpoint SOAP de Enlace</h5>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5 col-span-2 sm:col-span-1">
                      <label className="text-[9px] font-bold text-slate-400">Nombre del Canal</label>
                      <input
                        type="text"
                        value={newEndpointName}
                        onChange={(e) => setNewEndpointName(e.target.value)}
                        placeholder="e.g. Producción Local"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-xl p-2.5 text-xs font-bold text-slate-800 dark:text-white"
                      />
                    </div>
                    <div className="space-y-1.5 col-span-2 sm:col-span-1">
                      <label className="text-[9px] font-bold text-slate-400">Ruta URL relative</label>
                      <input
                        type="text"
                        value={newEndpointUrl}
                        onChange={(e) => setNewEndpointUrl(e.target.value)}
                        placeholder="/IA/ServiceFactura.asmx"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-xl p-2.5 text-xs font-mono text-slate-800 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5 col-span-2 sm:col-span-1">
                      <label className="text-[9px] font-bold text-slate-400">Flujo / Propósito</label>
                      <select
                        value={newEndpointType}
                        onChange={(e) => setNewEndpointType(e.target.value as any)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-xl p-2.5 text-xs font-bold text-slate-700 dark:text-slate-300"
                      >
                        <option value="compras">Flujo B: Compras y Stock</option>
                        <option value="servicios">Flujo C: Servicios y Retenciones</option>
                      </select>
                    </div>

                    <div className="space-y-1.5 col-span-2 sm:col-span-1">
                      <label className="text-[9px] font-bold text-slate-400">Custom SOAPAction Namespace (Opt)</label>
                      <input
                        type="text"
                        value={newSoapAction}
                        onChange={(e) => setNewSoapAction(e.target.value)}
                        placeholder="e.g. 'http://www/Insertar'"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-xl p-2.5 text-xs font-mono text-slate-800 dark:text-white"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleAddCustomEndpoint}
                    className="w-full py-3 bg-[#E30613] hover:bg-red-700 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-md active:scale-95"
                  >
                    Guardar Endpoint en {activeTenant.name}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-3">
              {customEndpoints.length === 0 ? (
                <div className="p-4 bg-slate-50 dark:bg-white/5 border border-dashed border-slate-200 dark:border-white/10 rounded-xl text-center">
                  <p className="text-xs text-slate-400">No hay endpoints personalizados definidos para {activeTenant.name}. Se usarán los predeterminados de Rojosoft.</p>
                </div>
              ) : (
                customEndpoints.map((ep) => (
                  <div
                    key={ep.id}
                    className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200/40 dark:border-white/5 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-2.5 h-2.5 rounded-full",
                        ep.type === 'compras' ? 'bg-red-500' : 'bg-rose-500'
                      )} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-800 dark:text-white">{ep.name}</span>
                          <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 bg-slate-200 dark:bg-white/10 rounded text-slate-500 dark:text-slate-400">
                            {ep.type === 'compras' ? 'Compras' : 'Servicios'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">{ep.url}</p>
                        {ep.soapAction && (
                          <p className="text-[8px] text-slate-400 font-mono mt-0.5">SOAPAction: {ep.soapAction}</p>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteEndpoint(ep.id)}
                      className="p-2 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-500/10 transition-colors"
                      title="Eliminar Endpoint"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>

    </motion.div>
  );
}
