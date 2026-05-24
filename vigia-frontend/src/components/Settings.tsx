import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, 
  Globe2, 
  BrainCircuit, 
  SlidersHorizontal,
  BellRing,
  ShieldCheck,
  Sun,
  Moon,
  Save,
  CheckCircle2,
  User as UserIcon,
  CreditCard,
  LayoutDashboard
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useState } from 'react';
import { loadNotificationSettings, saveNotificationSettings, requestOsNotificationPermission, notify } from '../lib/notifications';
import { auth } from '../lib/firebase';
import { useTenant } from '../lib/TenantContext';
import { ClientManagement } from './ClientManagement';
import { BillingDashboard } from './BillingDashboard';

interface SettingsProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export function Settings({ theme, onToggleTheme }: SettingsProps) {
  const isDarkMode = theme === 'dark';
  const user = auth.currentUser;
  const { tenants, activeTenant, isAdmin, setActiveTenant } = useTenant();
  
  const [activeTab, setActiveTab] = useState<'profile' | 'nexus' | 'billing' | 'ia'>(isAdmin ? 'nexus' : 'billing');
  
  // AI Settings State with local persistence
  const [automationLevel, setAutomationLevel] = useState<'manual' | 'assist' | 'auto'>(() => {
    return (localStorage.getItem('vigia_automation_level') as any) || 'assist';
  });
  const [tolerance, setTolerance] = useState(() => {
    return localStorage.getItem('vigia_ai_tolerance') || '10';
  });

  // Real Notification Settings
  const [alerts, setAlerts] = useState(() => {
    const saved = loadNotificationSettings();
    return {
      os_enabled: saved.os_enabled || false,
      sound: saved.sound !== false,
      soap: true,
      iva: true,
      cuit: false
    };
  });

  const [isSaved, setIsSaved] = useState(false);
  
  const toggleAlert = async (key: keyof typeof alerts) => {
    if (key === 'os_enabled' && !alerts.os_enabled) {
      const granted = await requestOsNotificationPermission();
      if (granted) {
        setAlerts(prev => {
          const newAlerts = { ...prev, os_enabled: true };
          saveNotificationSettings({ os_enabled: newAlerts.os_enabled, sound: newAlerts.sound });
          return newAlerts;
        });
      }
    } else {
      setAlerts(prev => {
        const newAlerts = { ...prev, [key]: !prev[key] };
        if (key === 'os_enabled' || key === 'sound') {
           saveNotificationSettings({ os_enabled: newAlerts.os_enabled, sound: newAlerts.sound });
        }
        return newAlerts;
      });
    }
  };

  const handleSave = () => {
    setIsSaved(true);
    localStorage.setItem('vigia_automation_level', automationLevel);
    localStorage.setItem('vigia_ai_tolerance', tolerance.toString());
    
    notify({
      type: 'success',
      title: 'Configuración Guardada',
      message: 'Los ajustes globales han sido actualizados.',
      important: false
    });
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleReset = () => {
    if (confirm("¿Estás seguro de que deseas restablecer la caché y la interfaz local? Esto no afectará las bases de datos.")) {
      setAutomationLevel('assist');
      setTolerance('10');
      localStorage.removeItem('vigia_automation_level');
      localStorage.removeItem('vigia_ai_tolerance');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto space-y-8 pb-20 px-4 sm:px-6"
    >
      {/* Settings Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 dark:border-white/10 pb-6 gap-6">
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 dark:bg-white/5 p-1 rounded-2xl border border-slate-200 dark:border-white/10 w-fit">
          {isAdmin && (
            <button 
              onClick={() => setActiveTab('nexus')}
              className={cn(
                "px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                activeTab === 'nexus' ? "bg-white dark:bg-slate-900 text-red-600 shadow-sm" : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              <div className="flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5" /> Nexus Global
              </div>
            </button>
          )}
          <button 
            onClick={() => setActiveTab('billing')}
            className={cn(
              "px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
              activeTab === 'billing' ? "bg-white dark:bg-slate-900 text-red-600 shadow-sm" : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            <div className="flex items-center gap-2">
              <CreditCard className="w-3.5 h-3.5" /> Consumo & Billing
            </div>
          </button>
          <button 
            onClick={() => setActiveTab('profile')}
            className={cn(
              "px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
              activeTab === 'profile' ? "bg-white dark:bg-slate-900 text-red-600 shadow-sm" : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            <div className="flex items-center gap-2">
              <UserIcon className="w-3.5 h-3.5" /> Mi Perfil
            </div>
          </button>
          <button 
            onClick={() => setActiveTab('ia')}
            className={cn(
              "px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
              activeTab === 'ia' ? "bg-white dark:bg-slate-900 text-red-600 shadow-sm" : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            <div className="flex items-center gap-2">
              <BrainCircuit className="w-3.5 h-3.5" /> Core Local
            </div>
          </button>
        </div>

        <div className="flex items-center gap-3">
           <div className="text-right hidden sm:block">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Sesión Actual</p>
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[150px]">{user?.email}</p>
           </div>
           <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-600 to-rose-500 p-[2px]">
              <div className="w-full h-full bg-white dark:bg-slate-900 rounded-[10px] flex items-center justify-center overflow-hidden">
                {user?.photoURL ? <img src={user.photoURL} alt="" /> : <UserIcon className="w-5 h-5 text-red-600" />}
              </div>
           </div>
        </div>
      </div>

      {/* Content Area */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'nexus' && isAdmin && <ClientManagement />}
          {activeTab === 'billing' && <BillingDashboard />}
          {activeTab === 'ia' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-8 space-y-6">
                <div className="bg-gradient-to-br from-red-50 to-rose-50 dark:from-slate-900 dark:to-red-950/20 rounded-[2.5rem] border border-red-100 dark:border-white/5 p-8 space-y-8">
                  <div className="flex items-center gap-3">
                    <BrainCircuit className="w-6 h-6 text-red-600" />
                    <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase italic tracking-tight">Reglas de Automatización</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {(['manual', 'assist', 'auto'] as const).map((level) => (
                      <button
                        key={level}
                        onClick={() => setAutomationLevel(level)}
                        className={cn(
                          "flex flex-col items-center justify-center p-6 rounded-3xl border-2 transition-all p-8 text-center",
                          automationLevel === level 
                            ? "bg-white dark:bg-slate-900 border-red-500 shadow-xl shadow-red-500/10 text-red-600"
                            : "bg-white/50 dark:bg-white/5 border-transparent hover:border-red-200 dark:hover:border-white/10 text-slate-500"
                        )}
                      >
                         <span className="text-xs font-black uppercase tracking-widest mb-2">
                           {level === 'manual' ? 'Manual' : level === 'assist' ? 'Asistido' : 'Full AI'}
                         </span>
                         <span className="text-[10px] leading-relaxed font-medium opacity-80">
                           {level === 'manual' ? 'Control manual total.' : level === 'assist' ? 'IA supervisada.' : 'Autopiloto neural.'}
                         </span>
                      </button>
                    ))}
                  </div>

                  <div className="space-y-4 pt-4">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <SlidersHorizontal className="w-4 h-4" /> Tolerancia de Auditoría: {tolerance}%
                     </label>
                     <input 
                       type="range" min="1" max="50" value={tolerance} onChange={e => setTolerance(e.target.value)}
                       className="w-full accent-red-600 h-2 bg-slate-200 dark:bg-white/10 rounded-full appearance-none cursor-pointer"
                     />
                  </div>
                </div>
              </div>
              <div className="lg:col-span-4 flex flex-col gap-6">
                 <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-white/5">
                   <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                      <Sun className="w-4 h-4" /> Apariencia
                   </h4>
                   <button 
                    onClick={onToggleTheme}
                    className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 rounded-2xl group transition-all hover:bg-slate-100 dark:hover:bg-white/10"
                   >
                     <span className="text-sm font-bold text-slate-800 dark:text-white">Modo Interfaz</span>
                     {isDarkMode ? <Moon className="w-5 h-5 text-red-600" /> : <Sun className="w-5 h-5 text-amber-500" />}
                   </button>
                 </div>
              </div>
            </div>
          )}
          {activeTab === 'profile' && (
             <div className="max-w-2xl mx-auto bg-white dark:bg-slate-900 p-10 rounded-[3rem] border border-slate-200 dark:border-white/5 shadow-sm text-center">
                <div className="w-24 h-24 mx-auto mb-6 rounded-[2rem] bg-slate-100 dark:bg-white/5 flex items-center justify-center overflow-hidden border-2 border-red-500/20">
                   {user?.photoURL ? <img src={user.photoURL} alt="" /> : <UserIcon className="w-12 h-12 text-slate-300" />}
                </div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase italic tracking-tight">{user?.displayName || 'Usuario VIGIA'}</h3>
                <p className="text-sm font-black uppercase tracking-widest text-red-600 mt-1">{isAdmin ? 'System Architect' : 'Operador de Integración'}</p>
                <div className="mt-10 pt-10 border-t border-slate-100 dark:border-white/5 space-y-4">
                   <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 rounded-2xl">
                      <span className="text-xs font-bold text-slate-500">Email Auth</span>
                      <span className="text-xs font-black uppercase text-slate-900 dark:text-white">{user?.email}</span>
                   </div>
                </div>
             </div>
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
