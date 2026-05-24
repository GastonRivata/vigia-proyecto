import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Plus, 
  Server, 
  ExternalLink, 
  CreditCard, 
  TrendingUp, 
  AlertCircle,
  Database,
  ShieldCheck,
  MoreVertical,
  Activity,
  DollarSign
} from 'lucide-react';
import { useTenant } from '../lib/TenantContext';
import { db } from '../lib/firebase';
import { collection, addDoc, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { notify } from '../lib/notifications';

// Definición local para evitar problemas de exportación en versiones previas de TenantContext
interface LocalTenantConfig {
  id?: string;
  name?: string;
  sqlConfig?: any;
  billing?: any;
  usage?: any;
}

export function ClientManagement() {
  const { tenants, activeTenant, setActiveTenant } = useTenant();
  const safeTenants = Array.isArray(tenants) ? tenants : [];
  
  const [isAdding, setIsAdding] = useState(false);
  const [editingOrg, setEditingOrg] = useState<LocalTenantConfig | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    ratePerDoc: 0.15,
    status: 'active',
    maxMonthlyExtractions: 500,
    allowComprasFlow: true,
    allowCCFlow: true,
    strictItemCheck: true,
    notificationEmail: ''
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
        settings: {
          maxMonthlyExtractions: Number(formData.maxMonthlyExtractions || 500),
          allowComprasFlow: formData.allowComprasFlow,
          allowCCFlow: formData.allowCCFlow,
          strictItemCheck: formData.strictItemCheck,
          notificationEmail: formData.notificationEmail
        }
      };

      if (editingOrg && editingOrg.id) {
        await updateDoc(doc(db, 'organizations', editingOrg.id), orgData);
        notify({ type: 'success', title: 'Cliente Actualizado', message: 'Los cambios se han guardado con éxito.' });
      } else {
        await addDoc(collection(db, 'organizations'), orgData);
        notify({ type: 'success', title: 'Cliente Creado', message: 'Nueva conexión neural establecida.' });
      }

      setIsAdding(false);
      setEditingOrg(null);
      setFormData({
        name: '',
        ratePerDoc: 0.15,
        status: 'active',
        maxMonthlyExtractions: 500,
        allowComprasFlow: true,
        allowCCFlow: true,
        strictItemCheck: true,
        notificationEmail: ''
      });
    } catch (err: any) {
      notify({ type: 'error', title: 'Error', message: 'No se pudo guardar la organización.' });
    }
  };

  const startEdit = (org: any) => {
    setEditingOrg(org);
    setFormData({
      name: org?.name || '',
      ratePerDoc: org?.billing?.ratePerDocument || 0.15,
      status: org?.billing?.status || 'active',
      maxMonthlyExtractions: org?.settings?.maxMonthlyExtractions || 500,
      allowComprasFlow: org?.settings?.allowComprasFlow !== false,
      allowCCFlow: org?.settings?.allowCCFlow !== false,
      strictItemCheck: org?.settings?.strictItemCheck !== false,
      notificationEmail: org?.settings?.notificationEmail || ''
    });
    setIsAdding(true);
  };

  const totalMonthlyDocs = safeTenants.reduce((acc, t) => acc + (t?.usage?.currentMonthExtractions || 0), 0);
  const totalRevenue = safeTenants.reduce((acc, t) => acc + ((t?.usage?.currentMonthExtractions || 0) * (t?.billing?.ratePerDocument || 0)), 0);

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-sm"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-red-50 dark:bg-red-500/10 rounded-2xl text-red-600">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Tráfico Neural Mensual</p>
              <h4 className="text-2xl font-black text-slate-900 dark:text-white uppercase italic">{totalMonthlyDocs} <span className="text-sm font-medium not-italic text-slate-400">docs</span></h4>
            </div>
          </div>
          <div className="w-full bg-slate-100 dark:bg-white/5 h-1.5 rounded-full overflow-hidden">
             <div className="bg-red-600 h-full w-2/3 rounded-full" />
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-sm"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl text-emerald-600">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Recaudación Proyectada</p>
              <h4 className="text-2xl font-black text-slate-900 dark:text-white uppercase italic">${totalRevenue.toFixed(2)}</h4>
            </div>
          </div>
          <p className="text-xs text-slate-500 font-medium">Basado en consumo SaaS (Pay-as-you-go)</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-slate-900 dark:bg-red-600 p-6 rounded-[2rem] shadow-xl shadow-red-600/20 text-white"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-white/10 rounded-2xl">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Clientes Activos</p>
              <h4 className="text-2xl font-black uppercase italic">{safeTenants.length}</h4>
            </div>
          </div>
          <button 
            onClick={() => { setIsAdding(true); setEditingOrg(null); }}
            className="w-full py-2 bg-white text-slate-900 dark:text-red-600 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:scale-105 transition-transform"
          >
            <Plus className="w-3.5 h-3.5" /> Agregar Miembro
          </button>
        </motion.div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Main Client List */}
        <div className="flex-1 space-y-4">
           {safeTenants.map((tenant) => (
             <motion.div 
               key={tenant?.id || Math.random().toString()}
               layout
               className={cn(
                 "group bg-white dark:bg-slate-900/60 p-5 rounded-[1.8rem] border border-slate-200 dark:border-white/5 transition-all hover:bg-slate-50 dark:hover:bg-white/5 relative overflow-hidden",
                 activeTenant?.id === tenant?.id && "ring-2 ring-red-600/50 border-red-500/30"
               )}
             >
                <div className="flex items-center justify-between gap-4">
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-100 dark:bg-white/5 rounded-2xl flex items-center justify-center font-black text-slate-400">
                         {(tenant?.name || 'O').charAt(0).toUpperCase()}
                      </div>
                      <div>
                         <h5 className="text-lg font-bold text-slate-900 dark:text-white leading-none mb-1">{tenant?.name || 'Compañía Desconocida'}</h5>
                         <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1">
                               <Server className="w-3 h-3" /> {tenant?.sqlConfig?.server || 'Sin configurar'}
                            </span>
                            <span className="w-1 h-1 bg-slate-300 dark:bg-slate-700 rounded-full" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">
                               {tenant?.billing?.status || 'desconocido'}
                            </span>
                         </div>
                      </div>
                   </div>

                   <div className="flex items-center gap-2">
                       <div className="text-right mr-4 hidden sm:block">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Consumo</p>
                          <p className="text-sm font-bold text-slate-900 dark:text-white italic">{tenant?.usage?.currentMonthExtractions || 0} docs</p>
                       </div>
                       <button 
                        onClick={() => startEdit(tenant)}
                        className="p-2.5 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl transition-all"
                       >
                         <SettingsIcon className="w-5 h-5" />
                       </button>
                   </div>
                </div>
             </motion.div>
           ))}
        </div>

        {/* Modal / Overlay de Edición */}
        <AnimatePresence>
          {isAdding && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="lg:w-96 shrink-0 bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-white/10 shadow-2xl sticky top-8 h-fit z-50 overflow-hidden"
            >
               <div className="absolute top-0 right-0 p-4">
                  <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white">
                     <AlertCircle className="rotate-45 w-6 h-6" />
                  </button>
               </div>
               <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase italic tracking-tight mb-8">
                 {editingOrg ? 'Editar Nexus' : 'Nueva Integración'}
               </h3>

               <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2 px-1">Nombre Comercial</label>
                    <input 
                      required
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-3 text-sm font-bold placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-red-500/50"
                      placeholder="e.g. Terra Verde S.A."
                    />
                  </div>

                  <div className="pt-4 border-t border-slate-200 dark:border-white/5 space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#E30613] mb-2 flex items-center gap-2">
                       <Database className="w-3 h-3" /> Políticas y Límites Neurales
                    </p>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 block mb-1">Cupo Mensual Máximo (Docs)</label>
                        <input 
                          type="number"
                          required
                          value={formData.maxMonthlyExtractions}
                          onChange={e => setFormData({...formData, maxMonthlyExtractions: Number(e.target.value)})}
                          className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-3 text-xs font-black outline-none focus:ring-2 focus:ring-red-500/50 text-slate-800 dark:text-white"
                          placeholder="e.g. 500"
                        />
                      </div>

                      <div>
                        <label className="text-[9px] font-bold text-slate-400 block mb-1">Email de Alertas VIGIA</label>
                        <input 
                          type="email"
                          value={formData.notificationEmail}
                          onChange={e => setFormData({...formData, notificationEmail: e.target.value})}
                          className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-3 text-xs font-medium outline-none focus:ring-2 focus:ring-red-500/50 text-slate-800 dark:text-white"
                          placeholder="alertas@terraverde.com"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-200 dark:border-white/5 space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#E30613] flex items-center gap-2">
                       <ShieldCheck className="w-3.5 h-3.5" /> Flujos y Auditoría Activa
                    </p>
                    
                    <div className="space-y-2.5">
                      <label className="flex items-center gap-3 p-2 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl cursor-pointer select-none transition-colors">
                        <input 
                          type="checkbox"
                          checked={formData.allowComprasFlow}
                          onChange={e => setFormData({...formData, allowComprasFlow: e.target.checked})}
                          className="accent-[#E30613] w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                        />
                        <div>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-none">Flujo B: Factura Compras</p>
                          <p className="text-[9px] text-slate-400 mt-0.5">Habilitar auditoría de Compras y stock en Rojosoft.</p>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-2 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl cursor-pointer select-none transition-colors">
                        <input 
                          type="checkbox"
                          checked={formData.allowCCFlow}
                          onChange={e => setFormData({...formData, allowCCFlow: e.target.checked})}
                          className="accent-[#E30613] w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                        />
                        <div>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-none">Flujo C: Retenciones / CC</p>
                          <p className="text-[9px] text-slate-400 mt-0.5">Procesar movimientos de cuenta corriente y retenciones.</p>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-2 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl cursor-pointer select-none transition-colors">
                        <input 
                          type="checkbox"
                          checked={formData.strictItemCheck}
                          onChange={e => setFormData({...formData, strictItemCheck: e.target.checked})}
                          className="accent-[#E30613] w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                        />
                        <div>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-none">Control de Suma Estricto</p>
                          <p className="text-[9px] text-slate-400 mt-0.5">Conciliar obligatoriamente total de líneas vs cabecera.</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-200 dark:border-white/5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-4 flex items-center gap-2">
                       <CreditCard className="w-3 h-3" /> Modelo de Negocio (SaaS)
                    </p>
                    <div className="flex items-center gap-4">
                        <div className="flex-1">
                           <label className="text-[9px] font-bold text-slate-400 block mb-1">Precio x Doc (USD)</label>
                           <input 
                             type="number"
                             step="0.01"
                             value={formData.ratePerDoc}
                             onChange={e => setFormData({...formData, ratePerDoc: Number(e.target.value)})}
                             className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-3 text-sm font-black"
                           />
                        </div>
                        <div className="flex-1">
                           <label className="text-[9px] font-bold text-slate-400 block mb-1">Estado</label>
                           <select 
                             value={formData.status}
                             onChange={e => setFormData({...formData, status: e.target.value})}
                             className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-3 text-xs font-bold"
                           >
                              <option value="active">Activo</option>
                              <option value="suspended">Suspendido</option>
                              <option value="trial">Demo/Trial</option>
                           </select>
                        </div>
                    </div>
                  </div>

                  <button className="w-full py-4 bg-slate-900 dark:bg-red-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-red-600/20">
                     {editingOrg ? 'Actualizar Sistema' : 'Comisionar Cliente'}
                  </button>
               </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
  );
}
