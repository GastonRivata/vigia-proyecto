import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, Plus, Server, CreditCard, Activity, DollarSign, 
  Database, ShieldCheck, Search, X, Building2, Zap, 
  CheckCircle2, Lock, LayoutGrid, FileText
} from 'lucide-react';
import { useTenant } from '../lib/TenantContext';
import { db } from '../lib/firebase';
import { collection, addDoc, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { notify } from '../lib/notifications';

interface LocalTenantConfig {
  id?: string;
  name?: string;
  sqlConfig?: any;
  billing?: any;
  usage?: any;
  modules?: any;
  settings?: any;
}

export function ClientManagement() {
  const { tenants, activeTenant, setActiveTenant } = useTenant();
  const safeTenants = Array.isArray(tenants) ? tenants : [];
  
  const [isAdding, setIsAdding] = useState(false);
  const [editingOrg, setEditingOrg] = useState<LocalTenantConfig | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    ratePerDoc: 0.15,
    status: 'active',
    maxMonthlyExtractions: 500,
    strictItemCheck: true,
    notificationEmail: '',
    extractorActivo: true,
    chequesActivo: true,
    cintelinkActivo: false,
    williamsActivo: false,
    compComprasActivo: true,
    compServiciosActivo: true,
    compRetencionesActivo: true
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const orgData = {
        name: formData.name,
        sqlConfig: editingOrg?.sqlConfig || {
          server: '',
          database: '',
          user: '',
          password: '',
          instanceName: 'SQLEXPRESS'
        },
        billing: {
          ratePerDocument: Number(formData.ratePerDoc),
          status: formData.status
        },
        usage: editingOrg?.usage || {
          totalExtractions: 0,
          currentMonthExtractions: 0,
          lastExtractionAt: Timestamp.now()
        },
        modules: {
          ...(editingOrg as any)?.modules,
          extractorActivo: formData.extractorActivo,
          chequesActivo: formData.chequesActivo,
          cintelinkActivo: formData.cintelinkActivo,
          williamsActivo: formData.williamsActivo,
          compComprasActivo: formData.compComprasActivo,
          compServiciosActivo: formData.compServiciosActivo,
          compRetencionesActivo: formData.compRetencionesActivo
        },
        settings: {
          maxMonthlyExtractions: Number(formData.maxMonthlyExtractions || 500),
          allowComprasFlow: formData.compComprasActivo,
          allowCCFlow: formData.compRetencionesActivo,
          strictItemCheck: formData.strictItemCheck,
          notificationEmail: formData.notificationEmail
        }
      };

      if (editingOrg && editingOrg.id) {
        await updateDoc(doc(db, 'organizations', editingOrg.id), orgData);
        notify({ type: 'success', title: 'Comisionamiento Actualizado', message: 'La configuración de la organización se ha sincronizado correctamente.' });
      } else {
        await addDoc(collection(db, 'organizations'), orgData);
        notify({ type: 'success', title: 'Organización Activada', message: 'El entorno de tenant ha sido provisionado exitosamente.' });
      }

      setIsAdding(false);
      setEditingOrg(null);
    } catch (err: any) {
      notify({ type: 'error', title: 'Error de Sincronización', message: 'No se pudo guardar la configuración de la organización.' });
    }
  };

  const startEdit = (org: any) => {
    setEditingOrg(org);
    const m = org?.modules || {};
    setFormData({
      name: org?.name || '',
      ratePerDoc: org?.billing?.ratePerDocument || 0.15,
      status: org?.billing?.status || 'active',
      maxMonthlyExtractions: org?.settings?.maxMonthlyExtractions || 500,
      strictItemCheck: org?.settings?.strictItemCheck !== false,
      notificationEmail: org?.settings?.notificationEmail || '',
      extractorActivo: m.extractorActivo ?? true,
      chequesActivo: m.chequesActivo ?? true,
      cintelinkActivo: m.cintelinkActivo ?? false,
      williamsActivo: m.williamsActivo ?? false,
      compComprasActivo: m.compComprasActivo ?? true,
      compServiciosActivo: m.compServiciosActivo ?? true,
      compRetencionesActivo: m.compRetencionesActivo ?? true,
    });
    setIsAdding(true);
  };

  const totalMonthlyDocs = safeTenants.reduce((acc, t) => acc + (t?.usage?.currentMonthExtractions || 0), 0);
  const totalRevenue = safeTenants.reduce((acc, t) => acc + ((t?.usage?.currentMonthExtractions || 0) * (t?.billing?.ratePerDocument || 0)), 0);

  const filteredTenants = useMemo(() => {
    return safeTenants.filter(t => t?.name?.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [safeTenants, searchQuery]);

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] w-full">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 shrink-0">
        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-2xl p-5 shadow-sm">
           <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Building2 className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Total Orgs</span>
           </div>
           <h4 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{safeTenants.length}</h4>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-2xl p-5 shadow-sm">
           <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Suscripciones Activas</span>
           </div>
           <h4 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
             {safeTenants.filter(t => t?.billing?.status === 'active').length}
           </h4>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-2xl p-5 shadow-sm">
           <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-500/10 flex items-center justify-center text-red-600 dark:text-red-400">
                <Activity className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Transacciones (Mes)</span>
           </div>
           <h4 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{totalMonthlyDocs.toLocaleString()}</h4>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-slate-900 dark:bg-red-600 border border-slate-800 dark:border-red-500/50 rounded-2xl p-5 shadow-xl shadow-red-500/10 text-white flex flex-col justify-between relative overflow-hidden">
           <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/4" />
           <div className="flex items-center gap-3 mb-2 relative z-10">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white">
                <DollarSign className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-300 dark:text-red-100">MRR Estimado</span>
           </div>
           <h4 className="text-3xl font-black tracking-tight relative z-10">${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h4>
        </motion.div>
      </div>

      {/* Main Table Area */}
      <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm flex flex-col overflow-hidden relative">
        <div className="p-5 border-b border-slate-200 dark:border-white/5 flex items-center justify-between gap-4 shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
           <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-200 dark:bg-white/10 rounded-lg text-slate-600 dark:text-slate-300">
                <LayoutGrid className="w-4 h-4" />
              </div>
              <div>
                 <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Portafolio de Entidades</h2>
                 <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest font-black">Directorio Global de Instancias</p>
              </div>
           </div>

           <div className="flex items-center gap-4">
              <div className="relative">
                 <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                 <input 
                   type="text"
                   value={searchQuery}
                   onChange={e => setSearchQuery(e.target.value)}
                   placeholder="Filtrar entidad..."
                   className="w-64 bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl py-2 pl-9 pr-4 text-xs font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all placeholder:text-slate-400"
                 />
              </div>
              <button 
                onClick={() => {
                  setEditingOrg(null);
                  setFormData({
                    name: '', ratePerDoc: 0.15, status: 'active',
                    maxMonthlyExtractions: 500, strictItemCheck: true, notificationEmail: '',
                    extractorActivo: true, chequesActivo: true, cintelinkActivo: false, williamsActivo: false,
                    compComprasActivo: true, compServiciosActivo: true, compRetencionesActivo: true
                  });
                  setIsAdding(true);
                }}
                className="bg-black dark:bg-white text-white dark:text-slate-900 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors shadow-lg shadow-black/10"
              >
                <Plus className="w-3.5 h-3.5" /> Nuevo Entorno
              </button>
           </div>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar">
           <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-900/80 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-3 border-b border-slate-200 dark:border-slate-800 text-[10px] items-center font-black uppercase tracking-wider text-slate-400">Entidad</th>
                  <th className="px-6 py-3 border-b border-slate-200 dark:border-slate-800 text-[10px] items-center font-black uppercase tracking-wider text-slate-400">Conexión DB</th>
                  <th className="px-6 py-3 border-b border-slate-200 dark:border-slate-800 text-[10px] items-center font-black uppercase tracking-wider text-slate-400">Estado Licencia</th>
                  <th className="px-6 py-3 border-b border-slate-200 dark:border-slate-800 text-[10px] items-center font-black uppercase tracking-wider text-slate-400 text-right">Volumen Procesado</th>
                  <th className="px-6 py-3 border-b border-slate-200 dark:border-slate-800 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {filteredTenants.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                      No se encontraron entidades que coincidan con la búsqueda.
                    </td>
                  </tr>
                ) : (
                  filteredTenants.map((t) => {
                    const isActive = t?.billing?.status === 'active';
                    return (
                      <tr key={t?.id} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-slate-200 dark:bg-white/10 rounded-lg flex items-center justify-center text-xs font-black text-slate-600 dark:text-slate-300">
                              {(t?.name || 'O').substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                               <div className="text-sm font-bold text-slate-900 dark:text-white">{t?.name || 'Compañía Desconocida'}</div>
                               <div className="text-[10px] text-slate-500 font-medium">ID: {t?.id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                           <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 font-mono">
                             <Database className="w-3.5 h-3.5 opacity-60" /> 
                             {t?.sqlConfig?.server || <span className="text-slate-400 italic font-sans text-[10px]">Sin Endpoint</span>}
                           </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest",
                            isActive 
                              ? "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                              : "bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400"
                          )}>
                            <div className={cn("w-1.5 h-1.5 rounded-full", isActive ? "bg-emerald-500" : "bg-amber-500")} />
                            {t?.billing?.status || 'Pendiente'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                           <div className="text-sm font-bold text-slate-900 dark:text-white">
                             {t?.usage?.currentMonthExtractions || 0} span <span className="text-[10px] font-medium text-slate-400">docs</span>
                           </div>
                           <div className="text-[10px] text-slate-500">
                             Límite: {t?.settings?.maxMonthlyExtractions || 0}
                           </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => startEdit(t)}
                            className="p-2 text-slate-400 hover:text-black dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                          >
                            Configurar
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
           </table>
        </div>
      </div>

      {/* Corporate Settings Drawer */}
      <AnimatePresence>
        {isAdding && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 transition-opacity"
              onClick={() => setIsAdding(false)}
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-full max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-white/10 shadow-2xl z-50 flex flex-col"
            >
              <div className="px-6 py-5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between shrink-0 bg-slate-50 dark:bg-slate-950/50">
                <div className="flex items-center gap-3">
                   <div className="p-2 bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg">
                      <ShieldCheck className="w-5 h-5" />
                   </div>
                   <div>
                     <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
                       {editingOrg ? 'Configuración de Entidad' : 'Nueva Entidad'}
                     </h3>
                     <p className="text-[10px] tracking-widest uppercase font-bold text-slate-500">Parámetros de Subsistema</p>
                   </div>
                </div>
                <button onClick={() => setIsAdding(false)} className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-auto custom-scrollbar p-6">
                <form id="orgForm" onSubmit={handleSubmit} className="space-y-8">
                  {/* General */}
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-[#E30613] flex items-center gap-2 border-b border-slate-100 dark:border-white/5 pb-2">
                       <Building2 className="w-4 h-4" /> Datos Generales
                    </h4>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block mb-1.5 uppercase">Identificación Corporativa</label>
                      <input 
                        required
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                        className="w-full bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all placeholder:font-normal placeholder:opacity-50"
                        placeholder="Ej. Terra Verde Corporativo S.A."
                      />
                    </div>
                  </div>

                  {/* Modules */}
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-[#E30613] flex items-center gap-2 border-b border-slate-100 dark:border-white/5 pb-2">
                       <Zap className="w-4 h-4" /> Arquitectura Neural & Módulos
                    </h4>
                    
                    <div className="space-y-1 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-200 dark:border-slate-800 p-2">
                       <ToggleRow 
                         label="Extracción IA (Facturas)" 
                         desc="Visión computacional para documentos contables" 
                         checked={formData.extractorActivo} 
                         onChange={v => setFormData({...formData, extractorActivo: v})} 
                       />
                       <ToggleRow 
                         label="Procesamiento de Cheques" 
                         desc="Captura anversa y reversa simultánea" 
                         checked={formData.chequesActivo} 
                         onChange={v => setFormData({...formData, chequesActivo: v})} 
                       />
                       <ToggleRow 
                         label="Subsistema Cintelink" 
                         desc="Auditoría de extractos bancarios Cintelink" 
                         checked={formData.cintelinkActivo} 
                         onChange={v => setFormData({...formData, cintelinkActivo: v})} 
                       />
                    </div>

                    <div className="space-y-1 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-200 dark:border-slate-800 p-2">
                       <h5 className="text-[9px] font-black uppercase text-slate-500 px-3 py-1 mb-1 tracking-widest">Protocolos de Negocio Permisados</h5>
                       <ToggleRow 
                         label="Ingreso Compras (Flujo B)" 
                         desc="Permitir carga de remitos e insumos" 
                         checked={formData.compComprasActivo} 
                         onChange={v => setFormData({...formData, compComprasActivo: v})} 
                       />
                       <ToggleRow 
                         label="Carga Honorarios/Servicios (Flujo A)" 
                         desc="Gastos distribuidos en Centros de Costo" 
                         checked={formData.compServiciosActivo} 
                         onChange={v => setFormData({...formData, compServiciosActivo: v})} 
                       />
                       <ToggleRow 
                         label="Retenciones (Flujo C)" 
                         desc="Certificados impositivos multiprovinciales" 
                         checked={formData.compRetencionesActivo} 
                         onChange={v => setFormData({...formData, compRetencionesActivo: v})} 
                       />
                       <ToggleRow 
                         label="Estricticidad Contable" 
                         desc="Control absoluto de sumatorias en líneas de detalle" 
                         checked={formData.strictItemCheck} 
                         onChange={v => setFormData({...formData, strictItemCheck: v})} 
                       />
                    </div>
                  </div>

                  {/* Quotas & Alerts */}
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-[#E30613] flex items-center gap-2 border-b border-slate-100 dark:border-white/5 pb-2">
                       <Activity className="w-4 h-4" /> Límites Operacionales & Alertas
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block mb-1.5 uppercase">Ráfaga Máxima (Mensual)</label>
                        <input 
                          type="number"
                          required
                          value={formData.maxMonthlyExtractions}
                          onChange={e => setFormData({...formData, maxMonthlyExtractions: Number(e.target.value)})}
                          className="w-full bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-red-500/50"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block mb-1.5 uppercase">Destinatario Log</label>
                        <input 
                          type="email"
                          value={formData.notificationEmail}
                          onChange={e => setFormData({...formData, notificationEmail: e.target.value})}
                          className="w-full bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-sm font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-red-500/50 placeholder:text-slate-400"
                          placeholder="soc@empresa.com"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Billing */}
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-[#E30613] flex items-center gap-2 border-b border-slate-100 dark:border-white/5 pb-2">
                       <CreditCard className="w-4 h-4" /> Licenciamiento SaaS
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block mb-1.5 uppercase">Tarifa Neural / Tx (USD)</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-black text-sm">$</span>
                          <input 
                            type="number"
                            step="0.01"
                            value={formData.ratePerDoc}
                            onChange={e => setFormData({...formData, ratePerDoc: Number(e.target.value)})}
                            className="w-full pl-7 pr-4 py-2 bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-black outline-none focus:ring-2 focus:ring-red-500/50 text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block mb-1.5 uppercase">Estado de Infraestructura</label>
                        <select 
                          value={formData.status}
                          onChange={e => setFormData({...formData, status: e.target.value})}
                          className="w-full bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-red-500/50"
                        >
                            <option value="active">Operational (Activo)</option>
                            <option value="suspended">Locked (Suspendido)</option>
                            <option value="trial">Sandbox (Prueba)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </form>
              </div>

              {/* Drawer Footer Actions */}
              <div className="p-6 border-t border-slate-200 dark:border-white/10 shrink-0 bg-slate-50 dark:bg-slate-950/50 grid grid-cols-2 gap-3">
                 <button 
                   type="button" 
                   onClick={() => setIsAdding(false)}
                   className="w-full py-3 rounded-xl border-2 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-xs font-black uppercase tracking-widest hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
                 >
                    Cancelar
                 </button>
                 <button 
                   form="orgForm"
                   type="submit"
                   className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg hover:shadow-red-600/30 active:scale-95 flex items-center justify-center gap-2"
                 >
                    <CheckCircle2 className="w-4 h-4" /> {editingOrg ? 'Aplicar Config' : 'Desplegar Instancia'}
                 </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function ToggleRow({ label, desc, checked, onChange }: { label: string, desc: string, checked: boolean, onChange: (val: boolean) => void }) {
  return (
    <label className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900/50 cursor-pointer transition-colors group">
      <div>
         <div className="text-xs font-bold text-slate-800 dark:text-slate-200">{label}</div>
         <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">{desc}</div>
      </div>
      <div className={cn("w-10 h-5.5 rounded-full border-2 transition-colors relative shrink-0 ml-4", checked ? "bg-emerald-500 border-emerald-500" : "bg-transparent border-slate-300 dark:border-slate-600")}>
         <input type="checkbox" className="hidden" checked={checked} onChange={(e) => onChange(e.target.checked)} />
         <div className={cn("absolute top-0.5 left-0.5 bg-white w-3.5 h-3.5 rounded-full transition-transform shadow-sm", checked ? "translate-x-[18px]" : "")} />
      </div>
    </label>
  );
}

