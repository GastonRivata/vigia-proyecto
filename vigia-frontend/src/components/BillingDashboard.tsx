import { motion } from 'motion/react';
import { 
  Activity, 
  CreditCard, 
  Download, 
  TrendingUp, 
  Calendar,
  FileText,
  Zap
} from 'lucide-react';
import { useTenant } from '../lib/TenantContext';

export function BillingDashboard() {
  const { activeTenant } = useTenant();

  if (!activeTenant) return null;

  const currentMonthDocs = activeTenant.usage?.currentMonthExtractions || 0;
  const rate = activeTenant.billing?.ratePerDocument || 0.15;
  const totalCost = currentMonthDocs * rate;

  return (
    <div className="space-y-10 max-w-5xl mx-auto py-8">
      {/* Neural Billing Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase italic tracking-tight">
            Consumo <span className="text-red-600">Neural</span>
          </h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium text-sm mt-1 border-l-2 border-red-500/30 pl-3">
            Monitoreo en tiempo real de transacciones por cliente.
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 px-4 py-2 rounded-2xl shadow-sm flex items-center gap-3">
           <Calendar className="w-4 h-4 text-slate-400" />
           <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest">Periodo: Mayo 2026</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Unit Count */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative group bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-white/5 overflow-hidden shadow-sm"
        >
          <div className="absolute -right-6 -bottom-6 opacity-[0.03] group-hover:scale-110 transition-transform duration-700">
             <FileText className="w-40 h-40 text-slate-950 dark:text-white" />
          </div>
          <Activity className="w-8 h-8 text-red-600 mb-6" />
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Comprobantes Procesados</h4>
          <div className="flex items-baseline gap-2">
             <span className="text-4xl font-black text-slate-900 dark:text-white italic uppercase">{currentMonthDocs}</span>
             <span className="text-sm font-bold text-slate-400">unids.</span>
          </div>
        </motion.div>

        {/* Current Cost */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="relative group bg-slate-900 dark:bg-red-600 p-8 rounded-[2.5rem] overflow-hidden shadow-xl shadow-red-600/20"
        >
          <div className="absolute -right-6 -bottom-6 opacity-10 group-hover:scale-110 transition-transform duration-700">
             <TrendingUp className="w-40 h-40 text-white" />
          </div>
          <CreditCard className="w-8 h-8 text-white mb-6" />
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60 mb-2">Costo Acumulado (USD)</h4>
          <div className="flex items-baseline gap-2">
             <span className="text-4xl font-black text-white italic uppercase">${totalCost.toFixed(2)}</span>
          </div>
        </motion.div>

        {/* Plan Info */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="relative group bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-white/5 overflow-hidden shadow-sm"
        >
          <Zap className="w-8 h-8 text-emerald-500 mb-6" />
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Tarifa Neural</h4>
          <div className="flex items-baseline gap-2">
             <span className="text-4xl font-black text-slate-900 dark:text-white italic uppercase">${rate}</span>
             <span className="text-sm font-bold text-slate-400">/doc</span>
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mt-4 group-hover:translate-x-1 transition-transform">Plan Pay-as-you-go activo</p>
        </motion.div>
      </div>

      {/* History / Projected */}
      <div className="bg-white dark:bg-slate-900/60 p-8 rounded-[2.5rem] border border-slate-200 dark:border-white/5 backdrop-blur-xl">
         <div className="flex items-center justify-between mb-8">
            <h4 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white flex items-center gap-3">
               <Activity className="w-4 h-4 text-red-500" /> Detalle de Consumo Reciente
            </h4>
            <button className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-red-500 transition-colors flex items-center gap-2">
               <Download className="w-3.5 h-3.5" /> Descargar Reporte
            </button>
         </div>
         
         <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-transparent hover:border-red-500/20 transition-all cursor-default">
                 <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-400">
                       <FileText className="w-5 h-5" />
                    </div>
                    <div>
                       <p className="text-sm font-bold text-slate-900 dark:text-white">Extracción Neural Lote #{84 * i}</p>
                       <p className="text-[10px] font-bold text-slate-500 uppercase">Procesado hace {i} días</p>
                    </div>
                 </div>
                 <div className="text-right">
                    <p className="text-sm font-black text-slate-900 dark:text-white italic uppercase">+$0.{15 * i}</p>
                 </div>
              </div>
            ))}
         </div>
         
         <div className="mt-8 p-6 bg-red-50/50 dark:bg-red-500/5 rounded-3xl border border-red-100 dark:border-red-500/20 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center text-white animate-pulse">
                  <Zap className="w-6 h-6" />
               </div>
               <div>
                  <h5 className="text-sm font-bold text-slate-900 dark:text-white">Próximo Cierre de Facturación</h5>
                  <p className="text-xs text-slate-500 font-medium">Su corte de ciclo es el 30 de Mayo.</p>
               </div>
            </div>
            <button className="px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-transform shadow-lg">
               Configurar Pago Automático
            </button>
         </div>
      </div>
    </div>
  );
}
