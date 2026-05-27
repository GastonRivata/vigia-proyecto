import React, { useState, useEffect, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'sonner';
import { 
  Scan, 
  History, 
  Settings as SettingsIcon, 
  LogOut, 
  Database,
  ArrowLeft,
  Sun,
  Moon,
  Sparkles,
  LayoutGrid,
  FileText,
  Truck,
  Link2,
  Menu,
  X,
  CreditCard,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Cpu,
  ShieldCheck,
  Wifi
} from 'lucide-react';
import { UploadSection } from './components/UploadSection';
import { ResultsDisplay } from './components/ResultsDisplay';
import { Login } from './components/Login';
import { ApiConfig } from './components/ApiConfig';
import { Settings } from './components/Settings';
import { HistoryView } from './components/HistoryView';
import { VigiaLogo } from './components/VigiaLogo';
import { ChequeReader } from './components/ChequeReader';
import { LiveMapDashboard } from './components/LiveMapDashboard';
import { extractDocumentData } from './lib/gemini';
import { cn, optimizeFileIfNeeded } from './lib/utils';
import { notify } from './lib/notifications';
import { auth, db, handleFirestoreError } from './lib/firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc, updateDoc, deleteField } from 'firebase/firestore';
import { useTenant } from './lib/TenantContext';
import { useAnimatedFavicon } from './lib/useAnimatedFavicon';

type ViewState = 'hub' | 'extractor' | 'cheques' | 'history' | 'api' | 'settings' | 'livemap';

function TabItem({ active, onClick, icon, label, className }: { active: boolean; onClick: () => void; icon: ReactNode; label: string, className?: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-4 py-3 hover:bg-slate-100 hover:dark:bg-white/5 transition-all outline-none rounded-xl relative w-full text-left",
        active ? "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 font-bold border border-red-100 dark:border-red-500/20" : "text-slate-600 dark:text-slate-400 font-medium",
        className
      )}
    >
      {icon}
      <span className="text-sm tracking-tight whitespace-nowrap flex-1">
        {label}
      </span>
      {active && (
        <motion.div layoutId="activeTabIndicatorDesktop" className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-red-600 rounded-r-full hidden md:block" />
      )}
    </button>
  );
}

const TopNavItem = ({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) => (
  <button 
    onClick={onClick}
    className={cn(
      "flex items-center gap-2 px-4 py-2 rounded-full transition-all outline-none text-sm font-semibold relative",
      active ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"
    )}
  >
    {icon}
    <span className="tracking-tight">{label}</span>
  </button>
);

const SubNavItem = ({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) => (
  <button 
    onClick={onClick}
    className={cn(
      "flex items-center gap-2 px-4 py-3 transition-all outline-none border-b-2 text-sm font-semibold whitespace-nowrap",
      active ? "border-red-600 text-red-600 dark:text-red-400" : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
    )}
  >
    {icon}
    {label}
  </button>
);

function DriverRegistrationScreen({ uid, defaultName, onCancel }: { uid: string; defaultName: string; onCancel: () => void }) {
  const [step, setStep] = useState<'data' | 'verify'>('data');
  const [driverName, setDriverName] = useState(defaultName);
  const [truckId, setTruckId] = useState('');
  const [phone, setPhone] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDataSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!truckId || !driverName || !phone) return;
    setIsSubmitting(true);
    // Simula envío de SMS
    setTimeout(() => {
      setIsSubmitting(false);
      setStep('verify');
      notify({ type: 'success', title: 'SMS Enviado', message: 'Se ha enviado un código a ' + phone });
    }, 1500);
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode) return;
    if (verificationCode.length < 4) {
      notify({ type: 'error', title: 'Código Inválido', message: 'El código debe tener al menos 4 dígitos.' });
      return;
    }
    
    setIsSubmitting(true);
    // Simulate verif
    setTimeout(async () => {
      try {
        await updateDoc(doc(db, 'users', uid), { 
          role: 'driver', 
          status: 'active',
          name: driverName,
          truckId: truckId.toUpperCase(),
          phone: phone
        });
        window.location.reload();
      } catch (err) {
        console.error(err);
        setIsSubmitting(false);
      }
    }, 1000);
  };

  if (step === 'verify') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 transition-colors duration-300">
         <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-8 rounded-3xl shadow-xl">
             <div className="w-16 h-16 bg-blue-50 dark:bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-6">
               <ShieldCheck className="w-8 h-8" />
             </div>
             <h2 className="text-2xl font-black uppercase italic tracking-tight text-slate-900 dark:text-white mb-2 text-center">Verifica tu Número</h2>
             <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-8 leading-relaxed text-center">
               Ingresa el código que acabamos de enviar por SMS al <strong>{phone}</strong>
             </p>
             <form onSubmit={handleVerifySubmit} className="space-y-4">
                <div>
                   <input type="text" value={verificationCode} onChange={e => setVerificationCode(e.target.value)} required className="w-full text-center tracking-[1em] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-4 text-2xl font-black text-slate-900 dark:text-white uppercase outline-none focus:border-blue-500 transition-colors" placeholder="000000" maxLength={6} />
                </div>
                <div className="pt-4 flex gap-3">
                   <button type="button" onClick={() => setStep('data')} className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Modificar</button>
                   <button type="submit" disabled={isSubmitting} className="flex-1 px-4 py-3 bg-blue-500 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center justify-center">
                     {isSubmitting ? 'Chequeando...' : 'Confirmar'}
                   </button>
                </div>
             </form>
         </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 transition-colors duration-300">
         <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-8 rounded-3xl shadow-xl">
             <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
               <Truck className="w-8 h-8" />
             </div>
             <h2 className="text-2xl font-black uppercase italic tracking-tight text-slate-900 dark:text-white mb-2 text-center">Registro de Unidad</h2>
             <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-8 leading-relaxed text-center">
               Para comenzar a emitir tu ubicación, necesitamos registrar los datos de tu vehículo comercial.
             </p>
             
             <form onSubmit={handleDataSubmit} className="space-y-4">
                <div>
                   <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">Nombre del Chofer</label>
                   <input type="text" value={driverName} onChange={e => setDriverName(e.target.value)} required className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" placeholder="Ej: Juan Pérez" />
                </div>
                <div>
                   <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">Teléfono Móvil (Validación SMS)</label>
                   <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} required className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" placeholder="+54 9 11 1234-5678" />
                </div>
                <div>
                   <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">Identificador de Unidad / Patente</label>
                   <input type="text" value={truckId} onChange={e => setTruckId(e.target.value)} required className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-black text-slate-900 dark:text-white uppercase outline-none focus:border-emerald-500 transition-colors" placeholder="Ej: TRK-001 o AC123XX" />
                </div>
                
                <div className="pt-4 flex gap-3">
                   <button type="button" onClick={onCancel} className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Volver</button>
                   <button type="submit" disabled={isSubmitting} className="flex-1 px-4 py-3 bg-emerald-500 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-emerald-600 transition-colors disabled:opacity-50 flex items-center justify-center">
                     {isSubmitting ? 'Enviando...' : 'Requerir PIN SMS'}
                   </button>
                </div>
             </form>
         </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const { activeTenant, setActiveTenant, tenants, isAdmin, userStatus, userRole, loading: tenantLoading } = useTenant();
  
  const [currentView, setCurrentView] = useState<ViewState>('hub');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) return 'dark';
    return 'light';
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<any | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileType, setFileType] = useState<string | null>(null);
  const [batchItems, setBatchItems] = useState<{ name: string; status: 'queued' | 'processing' | 'done' | 'error'; data?: any; error?: string; fileUrl?: string; fileType?: string }[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isTenantDropdownOpen, setIsTenantDropdownOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isRegisteringDriver, setIsRegisteringDriver] = useState(false);

  // Activa el gif iconico en modo claro o modo oscuro
  useAnimatedFavicon(theme);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  const handleProcessFiles = async (files: File[]) => {
    setIsProcessing(true);
    setBatchItems(files.map(f => ({ name: f.name, status: 'queued' })));

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setBatchItems(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'processing' } : item));

        try {
            const optimized = await optimizeFileIfNeeded(file);
            const data = await extractDocumentData(optimized.base64, optimized.mimeType);
            const objectUrl = URL.createObjectURL(file);
            
            setBatchItems(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'done', data, fileUrl: objectUrl, fileType: file.type } : item));
            setHistory(prev => [{ data, timestamp: new Date(), id: Math.random().toString(36).substr(2, 9), filename: file.name, status: 'success', fileType: file.type }, ...prev]);
            
            notify({
              type: 'success',
              title: 'Extracción Exitosa',
              message: `Comprobante ${file.name} procesado correctamente.`,
              important: false
            });

            if (files.length === 1) {
                setExtractedData(data);
                setFileUrl(objectUrl);
                setFileType(file.type);
            }
        } catch (err: any) {
            setBatchItems(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'error', error: err.message } : item));
            setHistory(prev => [{ timestamp: new Date(), id: Math.random().toString(36).substr(2, 9), filename: file.name, status: 'error', errorMsg: err.message }, ...prev]);
            
            notify({
              type: 'error',
              title: 'Error de Procesamiento',
              message: err.message || `Fallo al procesar ${file.name}.`,
              important: true
            });
        }
    }
    setIsProcessing(false);
  };

  const reset = () => {
    setExtractedData(null);
    setFileUrl(null);
    setFileType(null);
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const navigateTo = (view: ViewState) => {
    setCurrentView(view);
    setMobileMenuOpen(false);
  };

  if (authLoading || tenantLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#050505] flex flex-col items-center justify-center gap-6">
        <VigiaLogo animated />
        <div className="flex flex-col items-center gap-2">
           <div className="animate-spin w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full" />
           <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 animate-pulse">Sincronizando Neural Link...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={() => {}} />;
  }

  if (isRegisteringDriver) {
    return (
      <DriverRegistrationScreen 
        uid={user.uid} 
        defaultName={user.displayName || user.email?.split('@')[0] || ''} 
        onCancel={() => setIsRegisteringDriver(false)} 
      />
    );
  }

  if (userStatus === 'pending') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 transition-colors duration-300">
         <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-8 rounded-3xl shadow-xl text-center">
             <div className="w-16 h-16 bg-amber-50 dark:bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-6">
               <ShieldCheck className="w-8 h-8" />
             </div>
             <h2 className="text-2xl font-black uppercase italic tracking-tight text-slate-900 dark:text-white mb-2">Cuenta en Revisión</h2>
             <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
               Tu acceso a la red de VIGIA está pendiente de revisión. Por favor indica qué tipo de rol necesitas para agilizar el proceso de alta.
             </p>

             <div className="flex flex-col gap-3">
                <button 
                  onClick={async () => {
                    await updateDoc(doc(db, 'users', user.uid), { role: 'operator' });
                    notify({ type: 'success', title: 'Solicitud Enviada', message: 'Se ha solicitado el acceso Operador.' });
                  }}
                  className="p-4 rounded-2xl border-2 border-slate-200 dark:border-white/5 hover:border-red-500 dark:hover:border-red-500 flex items-center gap-4 group transition-all text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
                     <Database className="w-5 h-5" />
                  </div>
                  <div>
                     <span className="block font-black text-slate-900 dark:text-white uppercase text-xs">Operador Corporativo</span>
                     <span className="block text-[10px] text-slate-500 font-semibold leading-tight mt-1">Acceso a lectura de comprobantes y enlace ERP.</span>
                  </div>
                </button>

                <button 
                  onClick={() => setIsRegisteringDriver(true)}
                  className="p-4 rounded-2xl border-2 border-slate-200 dark:border-white/5 hover:border-emerald-500 dark:hover:border-emerald-500 flex items-center gap-4 group transition-all text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                     <Truck className="w-5 h-5" />
                  </div>
                  <div>
                     <span className="block font-black text-slate-900 dark:text-white uppercase text-xs">Chofer Logístico</span>
                     <span className="block text-[10px] text-slate-500 font-semibold leading-tight mt-1">Aplicación móvil de localización y enrutamiento.</span>
                  </div>
                </button>
             </div>

             <button onClick={handleLogout} className="mt-8 text-xs font-black uppercase text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 tracking-widest transition-colors flex items-center justify-center gap-2 w-full">
               <LogOut className="w-4 h-4" /> Cancelar / Cerrar Sesión
             </button>
         </div>
      </div>
    );
  }

  // Chofer layout
  if (userRole === 'driver') {
    return (
      <div className="min-h-screen flex flex-col bg-slate-900 dark:bg-slate-950 font-sans selection:bg-emerald-500/30">
        {/* Cabecera chofer */}
        <header className="h-16 bg-slate-950 border-b border-white/10 px-4 flex items-center justify-between">
           <div className="flex items-center gap-2 text-white">
              <Truck className="w-6 h-6 text-emerald-500" />
              <h1 className="text-lg font-black tracking-tight italic uppercase">Vigia <span className="text-emerald-500">Chofer</span></h1>
           </div>
           <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-white transition-colors">
              <LogOut className="w-5 h-5" />
           </button>
        </header>
        <div className="flex-1 p-6 flex flex-col items-center justify-center text-center text-white">
           <div className="w-32 h-32 bg-emerald-500/10 rounded-full flex items-center justify-center border-4 border-emerald-500/20 shadow-[0_0_50px_rgba(16,185,129,0.3)] mb-8">
              <Wifi className="w-12 h-12 text-emerald-500 animate-pulse" />
           </div>
           <h2 className="text-2xl font-black uppercase tracking-widest mb-2">Transmisión Activa</h2>
           <p className="text-slate-400 font-medium text-sm">Tu ubicación está siendo monitoreada por el centro de control.</p>
           
           <div className="mt-12 bg-white/5 border border-white/10 p-4 rounded-2xl w-full max-w-sm">
             <div className="flex justify-between items-center text-sm font-bold border-b border-white/5 pb-2 mb-2">
               <span className="text-slate-400">Estado</span>
               <span className="text-emerald-400">En Ruta</span>
             </div>
             <div className="flex justify-between items-center text-sm font-bold border-b border-white/5 pb-2 mb-2">
               <span className="text-slate-400">Velocidad Promedio</span>
               <span className="text-white">75 km/h</span>
             </div>
             <div className="flex justify-between items-center text-sm font-bold">
               <span className="text-slate-400">Próximo Reporte</span>
               <span className="text-slate-300">Emisíon continua</span>
             </div>
           </div>
           
           <div className="mt-8 pt-8 border-t border-white/5 w-full max-w-sm flex flex-col gap-2">
                <button 
                  onClick={async () => {
                     await updateDoc(doc(db, 'users', user.uid), { role: 'supervisor', status: 'active', phone: deleteField(), truckId: deleteField() });
                     window.location.reload();
                  }}
                  className="px-4 py-3 border border-white/10 rounded-xl text-[10px] font-black uppercase text-slate-400 hover:text-white hover:bg-white/5 transition-colors tracking-widest"
                >
                  Simular reinicio (Volver a HUB)
                </button>
           </div>
        </div>
      </div>
    );
  }

  const initialLetter = user.displayName ? user.displayName.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase() || 'U';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 font-sans selection:bg-red-500/30 transition-colors duration-300">
      <Toaster 
        theme={theme} 
        position="top-right" 
        toastOptions={{
          duration: 4000,
          className: 'font-sans tracking-tight',
        }} 
      />      {/* Floating Top Nav (Desktop Command Center, Horizontal Nav) */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] hidden md:flex items-center justify-between bg-white/70 dark:bg-slate-950/70 backdrop-blur-xl border border-white/40 dark:border-white/10 p-1.5 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] w-[calc(100%-3rem)] max-w-7xl transition-all duration-500">
        
        {/* Left: Brand Logo & Horizontal Nav Links */}
        <div className="flex items-center gap-3 pl-2">
          <button 
            onClick={() => navigateTo('hub')} 
            className="flex items-center gap-2.5 hover:bg-slate-100 dark:hover:bg-white/5 py-1.5 px-3 rounded-full transition-all outline-none"
          >
            <VigiaLogo size="sm" animated={false} />
            <span className="font-extrabold text-sm text-slate-900 dark:text-white tracking-tight italic uppercase">
              Vig<span className="text-red-650">ia</span>
            </span>
          </button>

          <div className="h-6 w-px bg-slate-200 dark:bg-white/10 mx-1" />

          {/* Unified Horizontal Nav Navbar */}
          <nav className="flex items-center gap-1">
            {[
              { id: 'hub', label: 'Hub', icon: LayoutGrid, visible: true },
              { id: 'extractor', label: 'Lector', icon: Scan, visible: activeTenant?.modules?.extractorActivo !== false },
              { id: 'cheques', label: 'Cheques', icon: CreditCard, visible: activeTenant?.modules?.chequesActivo !== false },
              { id: 'livemap', label: 'Rastreo', icon: Truck, visible: activeTenant?.modules?.williamsActivo !== false },
              { id: 'api', label: 'Conexión ERP', icon: Database, visible: true },
              { id: 'settings', label: 'Preferencias', icon: SettingsIcon, visible: true }
            ].filter(i => i.visible).map((item) => {
              const active = item.id === 'extractor' 
                ? ['extractor', 'history'].includes(currentView)
                : currentView === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => navigateTo(item.id as ViewState)}
                  className={cn(
                    "relative px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-widest transition-colors flex items-center gap-2 outline-none group",
                    active ? "text-red-650" : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                  )}
                >
                  {active && (
                    <motion.div
                      layoutId="desktop-active-nav-pill"
                      className="absolute inset-0 bg-white dark:bg-white/10 rounded-full shadow-[0_2px_10px_rgba(0,0,0,0.06)] dark:shadow-none border border-slate-200/40 dark:border-white/5"
                      initial={false}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <Icon className={cn("w-3.5 h-3.5 relative z-10 transition-transform duration-300 group-hover:scale-110", active && "animate-pulse delay-75")} />
                  <span className="relative z-10">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Center-Right: Connected Client Active Status Dropdown */}
        <div className="flex items-center gap-3 pr-2">
          <div className="relative flex items-center gap-3 px-4 py-1.5 rounded-full border border-slate-200/60 dark:border-white/10 bg-white/50 dark:bg-white/[0.04] backdrop-blur-md shadow-sm">
            <div className="relative size-2 flex items-center justify-center shrink-0">
              <span className="absolute inset-0 rounded-full bg-emerald-500 animate-[ping_2.5s_cubic-bezier(0,0,0.2,1)_infinite] opacity-75" />
              <span className="relative rounded-full size-1.5 bg-emerald-500" />
            </div>

            <div className="flex items-center gap-1.5 text-[10px] font-black tracking-[0.2em] uppercase text-slate-400 dark:text-slate-500">
              <span>Cliente DB:</span>
            </div>

            {/* Interactive dropdown trigger */}
            <div className="relative border-l border-slate-200/60 dark:border-white/10 pl-3">
              <button
                onClick={() => {
                  if (tenants.length > 1) {
                    setIsTenantDropdownOpen(!isTenantDropdownOpen);
                    setIsProfileDropdownOpen(false);
                  }
                }}
                className={cn(
                  "flex items-center gap-1.5 text-[11px] font-extrabold text-slate-800 dark:text-slate-200 select-none outline-none tracking-wide",
                  tenants.length > 1 && "hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
                )}
              >
                <span className="truncate max-w-[12rem]">{activeTenant?.name || 'Vigia Pro'}</span>
                {tenants.length > 1 && (
                  <ChevronDown className={cn("w-3.5 h-3.5 text-slate-400 transition-transform duration-300", isTenantDropdownOpen && "rotate-180")} />
                )}
              </button>

              {/* Selector Dropdown Panel (Only if multiple clients/tenants are available to superadmin) */}
              <AnimatePresence>
                {isTenantDropdownOpen && tenants.length > 1 && (
                  <>
                    <div 
                      className="fixed inset-0 z-40 cursor-default" 
                      onClick={() => setIsTenantDropdownOpen(false)} 
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 15, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 15, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-4 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-2.5 z-50 backdrop-blur-2xl"
                    >
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 p-2 border-b border-slate-100 dark:border-white/5 mb-1.5 text-center">
                        Seleccionar Base ERP
                      </p>
                      <div className="flex flex-col gap-1 max-h-48 overflow-y-auto custom-scrollbar">
                        {tenants.map(t => (
                          <button
                            key={t.id}
                            onClick={() => {
                              setActiveTenant(t);
                              setIsTenantDropdownOpen(false);
                              
                              notify({
                                type: 'success',
                                title: 'Conector ERP Actualizado',
                                message: `Establecido el canal neural con la base de ${t.name}`,
                                important: false
                              });
                            }}
                            className={cn(
                              "w-full text-left p-2.5 text-xs rounded-xl font-extrabold transition-all flex items-center justify-between",
                              activeTenant?.id === t.id 
                                ? "bg-red-500/10 text-red-600 dark:bg-emerald-500/10 dark:text-emerald-400" 
                                : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-slate-200"
                            )}
                          >
                            <span className="truncate pr-2">{t.name}</span>
                            {activeTenant?.id === t.id ? (
                              <div className="size-2 rounded-full bg-red-600 dark:bg-emerald-400 animate-pulse" />
                            ) : (
                              <div className="size-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
                            )}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>

          <button onClick={toggleTheme} className="p-2.5 text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors shrink-0">
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>

          <div className="w-px h-6 bg-slate-200 dark:bg-white/10 mx-1" />

          {/* Connected User Avatar & Menu */}
          <div className="relative">
            <button 
              onClick={() => {
                setIsProfileDropdownOpen(!isProfileDropdownOpen);
                setIsTenantDropdownOpen(false);
              }}
              className="flex items-center gap-1.5 focus:outline-none outline-none"
            >
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-red-650 via-rose-500 to-indigo-650 text-white flex items-center justify-center font-black text-xs shadow-md border border-slate-200 dark:border-white/10 shrink-0 overflow-hidden relative group hover:scale-[1.05] transition-all duration-300 ring-2 ring-transparent hover:ring-red-500/30">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" className="size-full object-cover" />
                ) : (
                  <span className="font-extrabold">{initialLetter}</span>
                )}
              </div>
            </button>

            <AnimatePresence>
              {isProfileDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40 cursor-default" 
                    onClick={() => setIsProfileDropdownOpen(false)} 
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 15, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 15, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-3 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-2 z-50 backdrop-blur-2xl"
                  >
                    <div className="p-3 border-b border-slate-100 dark:border-white/5 mb-1.5 text-left">
                      <p className="text-xs font-black text-slate-900 dark:text-white truncate">{user.displayName || user.email}</p>
                      <p className="text-[9px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-extrabold mt-0.5">
                        {isAdmin ? 'Administrador General' : 'Operador Corporativo'}
                      </p>
                    </div>
                    
                    <button
                      onClick={() => {
                        setIsProfileDropdownOpen(false);
                        navigateTo('api');
                      }}
                      className="w-full text-left px-2.5 py-2 text-xs rounded-xl font-bold text-slate-600 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white flex items-center gap-2 transition-all"
                    >
                      <Database className="w-4 h-4 text-slate-400" />
                      <span>Conexión de Terminal</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsProfileDropdownOpen(false);
                        navigateTo('settings');
                      }}
                      className="w-full text-left px-2.5 py-2 text-xs rounded-xl font-bold text-slate-600 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white flex items-center gap-2 transition-all"
                    >
                      <SettingsIcon className="w-4 h-4 text-slate-400" />
                      <span>Preferencias Globales</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsProfileDropdownOpen(false);
                        setIsRegisteringDriver(true);
                      }}
                      className="w-full text-left px-2.5 py-2 text-xs rounded-xl font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 flex items-center gap-2 transition-all mt-0.5"
                    >
                      <Truck className="w-4 h-4" />
                      <span>Probar Form de Chofer</span>
                    </button>

                    <div className="h-px bg-slate-100 dark:bg-white/5 my-1.5" />

                    <button
                      onClick={() => {
                        setIsProfileDropdownOpen(false);
                        handleLogout();
                      }}
                      className="w-full text-left px-2.5 py-2 text-xs rounded-xl font-bold text-rose-600 dark:text-rose-450 hover:bg-rose-500/10 flex items-center gap-2 transition-all"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Cerrar Sesión</span>
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen relative overflow-hidden transition-colors duration-300 pt-0 md:pt-28">
        
        {/* Mobile Header */}
        <header className="md:hidden h-16 bg-white/80 dark:bg-slate-950/80 backdrop-blur-2xl border-b border-slate-200/50 dark:border-white/5 px-4 flex items-center justify-between sticky top-0 z-[100] transition-colors duration-300 shadow-sm">
           <div className="flex items-center gap-2.5">
            <VigiaLogo size="sm" animated={false} />
            <h1 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight italic uppercase">
              Vig<span className="text-red-650">ia</span>
            </h1>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={toggleTheme} className="p-2.5 text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors">
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2.5 text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors">
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </header>

        {/* Mobile Menu Overlay */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="md:hidden fixed inset-x-0 top-16 bottom-0 bg-white dark:bg-slate-950 z-[90] overflow-y-auto flex flex-col"
            >
              {tenants.length > 1 && (
                <div className="px-4 py-4 border-b border-slate-200 dark:border-white/10">
                  <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Cliente Activo</span>
                  </div>
                  <select 
                    value={activeTenant?.id} 
                    onChange={(e) => setActiveTenant(tenants.find(t => t.id === e.target.value) || null)}
                    className="mt-1 w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg p-2 text-sm font-semibold text-slate-900 dark:text-white"
                  >
                    {tenants.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <nav className="flex-1 px-4 py-6 flex flex-col gap-2">
                <p className="px-4 text-[4px] font-black tracking-widest uppercase text-slate-400 mb-2">Secciones</p>
                <TabItem 
                  active={currentView === 'hub'} 
                  onClick={() => navigateTo('hub')}
                  icon={<LayoutGrid className="w-5 h-5" />}
                  label="Hub de Integraciones"
                />
                {(activeTenant?.modules?.extractorActivo !== false) && (
                  <TabItem 
                    active={['extractor', 'history'].includes(currentView)} 
                    onClick={() => navigateTo('extractor')}
                    icon={<Scan className="w-5 h-5" />}
                    label="Lector Inteligente"
                  />
                )}
                {(activeTenant?.modules?.chequesActivo !== false) && (
                  <TabItem 
                    active={currentView === 'cheques'} 
                    onClick={() => navigateTo('cheques')}
                    icon={<CreditCard className="w-5 h-5" />}
                    label="Lector de Cheques"
                  />
                )}
                {(activeTenant?.modules?.williamsActivo !== false) && (
                  <TabItem 
                    active={currentView === 'livemap'} 
                    onClick={() => navigateTo('livemap')}
                    icon={<Truck className="w-5 h-5" />}
                    label="Rastreo Logístico"
                  />
                )}
                <TabItem 
                  active={currentView === 'api'} 
                  onClick={() => navigateTo('api')}
                  icon={<Database className="w-5 h-5" />}
                  label="Conexión ERP"
                />
                <TabItem 
                  active={currentView === 'settings'} 
                  onClick={() => navigateTo('settings')}
                  icon={<SettingsIcon className="w-5 h-5" />}
                  label="Preferencias"
                />
              </nav>
              <div className="p-4 border-t border-slate-200 dark:border-white/10 mt-auto">
                <div className="flex items-center bg-slate-50 dark:bg-white/5 p-3 rounded-xl">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-600 to-rose-500 flex items-center justify-center font-black text-white shadow-lg shadow-red-600/20 text-sm overflow-hidden shrink-0">
                    {user.photoURL ? <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" /> : initialLetter}
                  </div>
                  <div className="ml-3 overflow-hidden flex-1">
                     <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{user.displayName || user.email}</p>
                     <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-0.5">{isAdmin ? 'Admin' : 'Operador'}</p>
                  </div>
                  <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-500 transition-colors" title="Cerrar Sesión">
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sub Navigation (Desktop & Mobile if needed) */}
        {['extractor', 'history'].includes(currentView) && (
          <div className="w-full border-b border-slate-200 dark:border-white/10 bg-white/50 dark:bg-slate-950/50 backdrop-blur-md px-4 md:px-8 flex items-center gap-6 overflow-x-auto custom-scrollbar sticky top-16 md:top-0 z-40">
             <SubNavItem active={currentView === 'extractor'} onClick={() => navigateTo('extractor')} icon={<Scan className="w-4 h-4" />} label="Lector" />
             <SubNavItem active={currentView === 'history'} onClick={() => navigateTo('history')} icon={<History className="w-4 h-4" />} label="Historial" />
          </div>
        )}
        
        {['api', 'settings'].includes(currentView) && (
          <div className="w-full border-b border-slate-200 dark:border-white/10 bg-white/50 dark:bg-slate-950/50 backdrop-blur-md px-4 md:px-8 flex items-center gap-6 overflow-x-auto custom-scrollbar sticky top-16 md:top-0 z-40">
             <SubNavItem active={currentView === 'api'} onClick={() => navigateTo('api')} icon={<Database className="w-4 h-4" />} label="Conexión Cliente" />
             <SubNavItem active={currentView === 'settings'} onClick={() => navigateTo('settings')} icon={<SettingsIcon className="w-4 h-4" />} label="Configuración Global" />
          </div>
        )}

        <main className="flex-1 overflow-auto custom-scrollbar relative px-4 py-6 md:p-8">
          <AnimatePresence mode="wait">
            {currentView === 'hub' && (
              <motion.div
                key="hub"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="w-full max-w-6xl mx-auto flex flex-col items-center justify-start mt-4 md:mt-8 relative"
              >
                {/* Decorative neural backgrounds */}
                <div className="absolute -top-40 -left-40 w-80 h-80 bg-red-500/10 dark:bg-red-500/5 rounded-full blur-[120px] pointer-events-none" />
                <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-indigo-500/10 dark:bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />
                
                <div className="w-full text-center mb-12 flex flex-col items-center relative z-10">
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="inline-flex items-center gap-2 px-3 py-1 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-full shadow-sm mb-6"
                  >
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">Sessión Activa: {activeTenant?.name || 'VIGIA PRO'}</span>
                  </motion.div>

                  <h2 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white mb-4 leading-tight italic uppercase">
                    Hub de <span className="text-red-600">Integraciones</span>
                  </h2>
                  <p className="text-slate-500 dark:text-slate-400 text-sm md:text-base font-medium tracking-tight max-w-xl mx-auto leading-relaxed">
                    Selecciona el módulo de automatización que deseas operar.
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full relative z-10 px-4">
                          {/* Lector Inteligente */}
                  {(activeTenant?.modules?.extractorActivo !== false) && (
                  <motion.div
                    whileHover={{ y: -8, scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigateTo('extractor')}
                    className="p-8 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-white/5 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] hover:shadow-[0_20px_60px_rgba(220,38,38,0.15)] hover:border-red-500/50 transition-all cursor-pointer group relative overflow-hidden backdrop-blur-xl flex flex-col justify-between h-full"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-red-500/0 via-red-500/0 to-red-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="absolute -bottom-4 -right-4 p-4 opacity-5 group-hover:opacity-10 transition-all duration-700 group-hover:scale-[1.3] group-hover:rotate-12">
                      <Scan className="w-56 h-56 text-red-600" />
                    </div>
                    <div className="flex justify-between items-start mb-10 relative z-10">
                       <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-red-700 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-red-600/30 group-hover:rotate-6 group-hover:scale-110 transition-all duration-500 border border-red-400 dark:border-white/10">
                         <Scan className="w-8 h-8" />
                       </div>
                       <span className="px-3 py-1 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-emerald-500/20 animate-pulse border border-emerald-400">
                         Online
                       </span>
                    </div>
                    <div className="relative z-10 flex-1">
                      <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-4 tracking-tight italic uppercase drop-shadow-sm">
                        Lector <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-rose-400">Inteligente</span>
                      </h3>
                      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 leading-relaxed border-l-2 border-red-500/30 pl-3">
                        Procesa facturas de insumos/servicios, retenciones o Cartas de Porte. Inserción directa en tiempo real.
                      </p>
                    </div>
                    <div className="mt-8 flex items-center gap-2 text-red-600 dark:text-red-400 text-xs font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity group-hover:-translate-x-1 duration-300 relative z-10">
                      <span>Iniciar Terminal</span>
                      <ArrowLeft className="w-4 h-4 rotate-180" />
                    </div>
                  </motion.div>
                  )}

                  {/* Lector de Cheques */}
                  {(activeTenant?.modules?.chequesActivo !== false) && (
                  <motion.div
                    whileHover={{ y: -8, scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigateTo('cheques')}
                    className="p-8 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-white/5 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] hover:shadow-[0_20px_60px_rgba(79,70,229,0.15)] hover:border-indigo-500/50 transition-all cursor-pointer group relative overflow-hidden backdrop-blur-xl flex flex-col justify-between h-full"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/0 via-indigo-500/0 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="absolute -bottom-4 -right-4 p-4 opacity-5 group-hover:opacity-10 transition-all duration-700 group-hover:scale-[1.3] group-hover:rotate-12">
                      <CreditCard className="w-56 h-56 text-indigo-600" />
                    </div>
                    <div className="flex justify-between items-start mb-10 relative z-10">
                       <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-indigo-700 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/30 group-hover:-rotate-6 group-hover:scale-110 transition-all duration-500 border border-indigo-400 dark:border-white/10">
                         <CreditCard className="w-8 h-8" />
                       </div>
                       <span className="px-3 py-1 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-emerald-500/20 animate-pulse border border-emerald-400">
                         Online
                       </span>
                    </div>
                    <div className="relative z-10 flex-1">
                      <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-4 tracking-tight italic uppercase drop-shadow-sm">
                        Lector de <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-400">Cheques</span>
                      </h3>
                      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 leading-relaxed border-l-2 border-indigo-500/30 pl-3">
                        Clasifica cheques con IA de visión. Obtén deudas, alertas impositivas y rechazos directo del BCRA.
                      </p>
                    </div>
                    <div className="mt-8 flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-xs font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity group-hover:-translate-x-1 duration-300 relative z-10">
                      <span>Iniciar Terminal</span>
                      <ArrowLeft className="w-4 h-4 rotate-180" />
                    </div>
                  </motion.div>
                  )}

                  {/* Cintelink */}
                  {(activeTenant?.modules?.cintelinkActivo !== false) && (
                  <div className="p-8 bg-slate-100/50 dark:bg-slate-900/20 border border-slate-200 dark:border-white/5 rounded-[2.5rem] relative overflow-hidden group cursor-not-allowed grayscale">
                    <div className="flex justify-between items-start mb-8">
                      <div className="w-14 h-14 bg-slate-200 dark:bg-slate-800 text-slate-400 rounded-2xl flex items-center justify-center">
                        <Link2 className="w-7 h-7" />
                      </div>
                      <span className="px-3 py-1 bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-500 text-[10px] font-black uppercase tracking-widest rounded-full border border-slate-300 dark:border-slate-700">
                        Proximamente
                      </span>
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-3 tracking-tight italic uppercase">
                      Cintelink <span className="text-slate-400 font-medium">Sync</span>
                    </h3>
                    <p className="text-base font-medium text-slate-500 dark:text-slate-400 leading-snug">
                      Sincronización bancaria y conciliación proyectiva para flujos de caja automáticos.
                    </p>
                  </div>
                  )}

                  {/* Vigia Transporte */}
                  {(activeTenant?.modules?.williamsActivo !== false) && (
                  <motion.div
                    whileHover={{ y: -8, scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigateTo('livemap')}
                    className="p-8 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-white/5 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] hover:shadow-[0_20px_60px_rgba(16,185,129,0.15)] hover:border-emerald-500/50 transition-all cursor-pointer group relative overflow-hidden backdrop-blur-xl flex flex-col justify-between h-full"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/0 via-emerald-500/0 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="absolute -bottom-4 -right-4 p-4 opacity-5 group-hover:opacity-10 transition-all duration-700 group-hover:scale-[1.3] group-hover:rotate-12">
                      <Truck className="w-56 h-56 text-emerald-600" />
                    </div>
                    <div className="flex justify-between items-start mb-10 relative z-10">
                       <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-emerald-700 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-600/30 group-hover:rotate-6 group-hover:scale-110 transition-all duration-500 border border-emerald-400 dark:border-white/10">
                         <Truck className="w-8 h-8" />
                       </div>
                       <span className="px-3 py-1 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-emerald-500/20 animate-pulse border border-emerald-400">
                         Online
                       </span>
                    </div>
                    <div className="relative z-10 flex-1">
                      <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-4 tracking-tight italic uppercase drop-shadow-sm">
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-400">Tracker</span>
                      </h3>
                      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 leading-relaxed border-l-2 border-emerald-500/30 pl-3">
                        Monitoreo satelital y gestión de flotas. Control total de entregas con IA en tiempo real.
                      </p>
                    </div>
                    <div className="mt-8 flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity group-hover:-translate-x-1 duration-300 relative z-10">
                      <span>Live Tracker</span>
                      <ArrowLeft className="w-4 h-4 rotate-180" />
                    </div>
                  </motion.div>
                  )}

                </div>

                {/* Secondary Administration & System Configuration Tier */}
                <div className="w-full mt-14 flex flex-col gap-4 relative z-10 px-4">
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 dark:text-slate-500">ADMINISTRACIÓN & SOPORTE TÉCNICO VIGIA</span>
                    <div className="h-px flex-1 bg-slate-200 dark:bg-white/5" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                    {/* Configuración de Terminal */}
                    <motion.div
                      whileHover={{ scale: 1.01, y: -4 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => navigateTo('api')}
                      className="p-6 bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-white/5 rounded-3xl shadow-sm hover:border-red-500/30 dark:hover:border-red-550/30 cursor-pointer flex items-center justify-between group transition-all"
                    >
                      <div className="flex items-center gap-4 overflow-hidden">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                          <Database className="w-6 h-6" />
                        </div>
                        <div className="truncate text-left">
                          <h4 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">Terminal & Conexión ERP</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">Configurar URLs SOAP de Terraverde, test de base SQL Server y variables.</p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-400 group-hover:translate-x-1.5 transition-transform shrink-0" />
                    </motion.div>

                    {/* Preferencias Globales */}
                    <motion.div
                      whileHover={{ scale: 1.01, y: -4 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => navigateTo('settings')}
                      className="p-6 bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-white/5 rounded-3xl shadow-sm hover:border-red-500/30 dark:hover:border-red-550/30 cursor-pointer flex items-center justify-between group transition-all"
                    >
                      <div className="flex items-center gap-4 overflow-hidden">
                        <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                          <SettingsIcon className="w-6 h-6" />
                        </div>
                        <div className="truncate text-left">
                          <h4 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">Preferencias Globales</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">Control de claves API Gemini, registros históricos de auditoría y temas.</p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-400 group-hover:translate-x-1.5 transition-transform shrink-0" />
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            )}

            {currentView === 'extractor' && (
              !extractedData ? (
                <motion.div
                  key="upload"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.4 }}
                  className="w-full max-w-5xl mx-auto flex flex-col items-center justify-start mt-6 md:mt-12"
                >
                  <div className="text-center mb-12 flex flex-col items-center">
                    
                    <h2 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white mb-4 leading-tight italic uppercase">
                      Lector <span className="text-red-600">Inteligente</span>
                    </h2>
                    <p className="text-slate-600 dark:text-slate-400 text-sm md:text-base font-medium tracking-tight max-w-xl mx-auto leading-relaxed border-l-2 border-red-600 pl-4 dark:border-red-500/50">
                      Sube o captura tus comprobantes. Nuestro motor de IA extraerá los datos y permitirá la sincronización directa con su ecosistema contable.
                    </p>
                  </div>
                  
                  <div className="w-full">
                    <UploadSection 
                      isProcessing={isProcessing}
                      setIsProcessing={setIsProcessing}
                      onFilesSelected={handleProcessFiles}
                      onViewItem={(item) => {
                        setExtractedData(item.data);
                        setFileUrl(item.fileUrl);
                        setFileType(item.fileType);
                      }}
                      batchItems={batchItems}
                    />
                  </div>
                </motion.div>
              ) : (
                <motion.div key="results" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="w-full pb-10">
                   <div className="flex justify-between items-center mb-4">
                     <button 
                        onClick={reset}
                        className="text-sm font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 transition-colors bg-white dark:bg-slate-900 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow"
                      >
                        <ArrowLeft className="w-4 h-4" /> Escanear otro comprobante
                     </button>
                   </div>
                  <ResultsDisplay 
                    data={extractedData} 
                    fileUrl={fileUrl} 
                    fileType={fileType}
                    onUpdateData={setExtractedData} 
                  />
                </motion.div>
              )
            )}
            
            {currentView === 'cheques' && (
              <motion.div key="cheques" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="w-full">
                <ChequeReader />
              </motion.div>
            )}

            {currentView === 'livemap' && (
              <motion.div key="livemap" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="w-full">
                <LiveMapDashboard />
              </motion.div>
            )}

            {currentView === 'api' && (
              <motion.div key="api" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="w-full">
                <ApiConfig isAdmin={isAdmin} />
              </motion.div>
            )}
            {currentView === 'settings' && (
              <motion.div key="settings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="w-full">
                <Settings 
                  theme={theme} 
                  onToggleTheme={toggleTheme} 
                />
              </motion.div>
            )}
            {/* Kept full History route if they want to see the big table */}
            {currentView === 'history' && (
              <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full">
                <HistoryView history={history} />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
      
      {/* Power Footer */}
      <footer className="py-6 px-8 border-t border-slate-200 dark:border-white/5 bg-white/30 dark:bg-slate-950/30 backdrop-blur-sm text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-600 italic">
          Powered by <span className="text-slate-900 dark:text-white">Gastón Rivata</span>
        </p>
      </footer>
    </div>
  );
}

// EOF

