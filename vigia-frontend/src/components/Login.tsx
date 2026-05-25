import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform, Variants, useReducedMotion } from 'motion/react';
import { FileText, ArrowRight, LogIn, Database, Truck, Scan, ShieldAlert } from 'lucide-react';
import { cn } from '../lib/utils';
import { auth, db, handleFirestoreError } from '../lib/firebase';
import { signInWithPopup, GoogleAuthProvider, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// ==========================================
// 1. CONSTANTES Y CONFIGURACIÓN ESTÁTICA
// ==========================================
// Mover esto fuera del componente evita que se re-asignen en memoria en cada render
const SYSTEM_MODULES = [
  { icon: <Database className="w-3.5 h-3.5" />, text: 'ERP SYNC' },
  { icon: <FileText className="w-3.5 h-3.5" />, text: 'FISCAL' },
  { icon: <Truck className="w-3.5 h-3.5" />, text: 'LOGISTICA' }
];

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } }
};

// ==========================================
// 2. LÓGICA DE NEGOCIO (CUSTOM HOOK)
// ==========================================
// Abstraemos Firebase. La UI no necesita saber CÓMO se autentica, solo el resultado.
const useNeuralAuth = (onLoginSuccess: (isAdmin: boolean) => void) => {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verifyAndCreateUser = async (user: User) => {
    const userDocRef = doc(db, 'users', user.uid);
    try {
      const userDocSnap = await getDoc(userDocRef);
      
      if (!userDocSnap.exists()) {
        // PRO TIP: En un entorno real, este email debería venir de variables de entorno (ej. import.meta.env.VITE_ADMIN_EMAIL)
        const isAdmin = user.email === 'rivatagaston@gmail.com';
        await setDoc(userDocRef, {
          email: user.email,
          name: user.displayName,
          role: isAdmin ? 'admin' : 'operator',
          createdAt: new Date().toISOString()
        });
        return isAdmin;
      }
      
      return userDocSnap.data().role === 'admin';
    } catch (err) {
      handleFirestoreError(err, 'get' as any, `users/${user.uid}`);
      throw new Error('Imposible conectar con el directorio de identidades neurales.');
    }
  };

  // useCallback previene re-renders innecesarios en componentes hijos si los hubiera
  const handleLogin = useCallback(async () => {
    setIsLoggingIn(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const isAdmin = await verifyAndCreateUser(result.user);
      onLoginSuccess(isAdmin);
    } catch (err: any) {
      console.error('[Auth Error]:', err);
      setError(err.message || 'La sincronización de seguridad falló u operación cancelada.');
    } finally {
      setIsLoggingIn(false);
    }
  }, [onLoginSuccess]);

  return { handleLogin, isLoggingIn, error };
};

// ==========================================
// 3. COMPONENTE DE VISTA (PRESENTACIONAL)
// ==========================================
interface LoginProps {
  onLogin: (isAdmin: boolean) => void;
}

export function Login({ onLogin }: LoginProps) {
  // Consumimos la lógica de negocio limpia
  const { handleLogin, isLoggingIn, error } = useNeuralAuth(onLogin);

  // Optimizaciones de Motion y Accesibilidad
  const prefersReducedMotion = useReducedMotion();
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const smoothX = useSpring(mouseX, { damping: 40, stiffness: 150, mass: 0.5 });
  const smoothY = useSpring(mouseY, { damping: 40, stiffness: 150, mass: 0.5 });

  const parallaxRange = prefersReducedMotion ? [0, 0] : [-20, 20];
  const spotlightRange = prefersReducedMotion ? ['0%', '0%'] : ['-15%', '15%'];

  const bgMoveX = useTransform(smoothX, [-1, 1], parallaxRange);
  const bgMoveY = useTransform(smoothY, [-1, 1], parallaxRange);
  const spotlightX = useTransform(smoothX, [-1, 1], spotlightRange);
  const spotlightY = useTransform(smoothY, [-1, 1], spotlightRange);

  useEffect(() => {
    if (prefersReducedMotion) return;

    let animationFrameId: number;
    const handleMouseMove = (e: MouseEvent) => {
      animationFrameId = requestAnimationFrame(() => {
        mouseX.set((e.clientX / window.innerWidth - 0.5) * 2);
        mouseY.set((e.clientY / window.innerHeight - 0.5) * 2);
      });
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, [mouseX, mouseY, prefersReducedMotion]);

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-[#080808] font-sans text-slate-900 dark:text-white transition-colors duration-500 overflow-hidden relative flex flex-col items-center justify-center selection:bg-red-500/30">
      
      {/* Background Neural Grid */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <motion.div 
          className="absolute inset-0 opacity-[0.25] dark:opacity-[0.1]"
          style={{
            x: bgMoveX,
            y: bgMoveY,
            backgroundImage: `radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)`,
            backgroundSize: '40px 40px',
            maskImage: `radial-gradient(ellipse 60% 60% at 50% 50%, black, transparent 80%)`,
            WebkitMaskImage: `radial-gradient(ellipse 60% 60% at 50% 50%, black, transparent 80%)`,
          }}
        />

        <motion.div 
          className="absolute top-1/2 left-1/2 w-[800px] h-[800px] -translate-x-1/2 -translate-y-1/2 bg-red-600/[0.03] dark:bg-red-500/[0.05] rounded-full blur-[120px] will-change-transform"
          style={{ x: spotlightX, y: spotlightY }}
        />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay pointer-events-none"></div>
      </div>

      <div className="relative z-10 w-full max-w-7xl px-6 sm:px-8 py-10 min-h-screen flex items-center xl:scale-[1.15] 2xl:scale-[1.25] transform origin-center transition-transform duration-500">
        <motion.div 
          variants={staggerContainer} 
          initial="hidden" 
          animate="show" 
          className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 w-full items-center"
        >
          {/* COLUMNA IZQUIERDA: Contexto Visual */}
          <motion.section variants={fadeInUp} className="flex flex-col items-start pt-10 lg:pt-0">
     

            <div className="flex flex-col md:flex-row items-center md:items-center gap-8 lg:gap-12 mb-10 w-full relative">
              
              {/* Portal de Fusión Neural (Zona lista para WebGL/Blender) */}
              <div className="relative group perspective w-48 h-48 sm:w-56 sm:h-56 lg:w-52 lg:h-52 shrink-0 flex items-center justify-center">
                <div className="absolute inset-0 bg-red-600/20 dark:bg-red-500/20 rounded-full blur-[40px] opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all duration-1000"></div>
                <div className="absolute -inset-4 rounded-full border border-red-500/10 dark:border-red-500/20 scale-[1.0] group-hover:scale-[1.1] animate-[spin_10s_linear_infinite] transition-transform duration-1000"></div>
                <div className="absolute -inset-8 rounded-full border border-dashed border-red-600/10 dark:border-red-400/20 scale-[1.0] group-hover:scale-[1.15] animate-[spin_15s_linear_infinite_reverse] transition-transform duration-1000"></div>
                
                <div className="absolute inset-0 rounded-[2.5rem] overflow-hidden shadow-[0_0_40px_rgba(220,38,38,0.25)] dark:shadow-[0_0_60px_rgba(220,38,38,0.2)] border-2 border-red-500/30 dark:border-white/10 z-10 bg-black transform transition-all duration-700 group-hover:scale-[1.33]">
                  <div className="absolute inset-0 bg-red-900/10 dark:bg-black/20 mix-blend-overlay z-10 pointer-events-none"></div>
                  
                  <video 
                    autoPlay loop muted playsInline 
                    className="w-full h-full object-cover scale-[1.05] brightness-110 contrast-125 dark:brightness-100 dark:contrast-100 transition-opacity duration-500"
                    src="/rojosoft-ai.mp4" 
                    poster="https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=400&fm=jpg"
                  />
                  
                  <div className="absolute inset-0 bg-gradient-to-tr from-black/40 via-transparent to-red-500/10 z-20 pointer-events-none"></div>
                  <div className="absolute inset-x-0 h-[2px] z-30 pointer-events-none" style={{
                    background: 'linear-gradient(90deg, transparent, rgba(248,113,113,0.9), transparent)',
                    boxShadow: '0 0 20px rgba(248,113,113,1)',
                    animation: 'scan 2.5s cubic-bezier(0.4, 0, 0.2, 1) infinite'
                  }}></div>
                  <div className="absolute inset-0 ring-1 ring-inset ring-white/30 dark:ring-white/10 rounded-[2.5rem] pointer-events-none z-30"></div>
                </div>

                <div className="hidden md:block absolute right-[-48px] top-1/2 -translate-y-1/2 w-[48px] h-[2px] bg-gradient-to-r from-red-500/50 to-transparent z-0 overflow-hidden">
                   <div className="absolute inset-0 bg-white shadow-[0_0_8px_white] w-4 animate-[moveRight_2s_linear_infinite]"></div>
                </div>
              </div>

              <div className="flex flex-col items-center md:items-start text-center md:text-left z-10 relative">
                <h1 className="text-4xl sm:text-5xl lg:text-5xl xl:text-7xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mb-2 leading-[0.9]">
                  Integraciones <br/>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-rose-500 dark:from-red-500 dark:to-rose-400 font-extrabold tracking-tighter drop-shadow-sm">ROJOSOFT</span>
                </h1>
              </div>
            </div>
            
            <div className="relative max-w-lg mb-10">
              <p className="text-slate-600 dark:text-slate-300/90 text-lg md:text-xl font-medium leading-relaxed border-l-[3px] border-red-500 pl-6 dark:border-red-500/60 text-left">
                Su central de automatización con <span className="text-slate-900 dark:text-white font-bold">IA</span>
                <span className="text-slate-400 dark:text-slate-500 font-semibold uppercase text-xs tracking-widest block mt-3">Lectura • Conciliación • Inserción</span>
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {SYSTEM_MODULES.map((pill, i) => (
                <div 
                  key={i} 
                  className="px-3.5 py-2 bg-white/50 dark:bg-white/[0.04] text-slate-600 dark:text-slate-400 text-xs font-medium uppercase tracking-wider rounded-lg border border-slate-200/60 dark:border-white/[0.06] flex items-center gap-2 backdrop-blur-md transition-colors hover:bg-white dark:hover:bg-white/[0.08]"
                >
                  {pill.icon}
                  {pill.text}
                </div>
              ))}
            </div>
          </motion.section>

          {/* COLUMNA DERECHA: Autenticación */}
          <motion.section variants={fadeInUp} className="flex flex-col items-center lg:items-end justify-center pb-10 lg:pb-0">
            <div className="w-full max-w-md p-[1px] bg-gradient-to-b from-slate-200/80 to-slate-100 dark:from-white/[0.08] dark:to-transparent rounded-[2.5rem] shadow-sm">
              <div className="bg-white/80 dark:bg-[#0A0A0A]/80 backdrop-blur-2xl rounded-[2.4rem] p-8 md:p-12 border border-white/50 dark:border-white/[0.02] shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.4)] relative overflow-hidden group">
                
                <div className="absolute -bottom-8 -right-8 opacity-[0.02] dark:opacity-[0.03] group-hover:scale-105 transition-transform duration-700 pointer-events-none">
                  <Scan className="w-64 h-64 text-slate-900 dark:text-white" />
                </div>

                <div className="relative z-10">
                  <div className="flex flex-col items-center text-center mb-8">
                    <div className="w-12 h-12 bg-slate-900 dark:bg-red-600 rounded-2xl flex items-center justify-center shadow-md dark:shadow-red-600/20 mb-5 group-hover:-translate-y-1 transition-transform duration-300">
                      <LogIn className="w-5 h-5 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Acceso Seguro</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1.5">Autenticación digital requerida</p>
                  </div>

                  <AnimatePresence>
                    {error && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                        animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
                        exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                      >
                        <div role="alert" aria-live="polite" className="flex items-center gap-3 text-rose-600 dark:text-rose-400 text-xs font-semibold bg-rose-50 dark:bg-rose-500/10 px-4 py-3 rounded-xl border border-rose-200 dark:border-rose-500/20">
                          <ShieldAlert className="w-4 h-4 shrink-0" />
                          <span>{error}</span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  
                  <button 
                    onClick={handleLogin}
                    disabled={isLoggingIn}
                    aria-label="Ingresar con Google"
                    className={cn(
                      "w-full relative px-6 py-4 bg-white dark:bg-white/[0.05] hover:bg-slate-50 dark:hover:bg-white/[0.1] text-slate-700 dark:text-white rounded-xl font-bold text-sm transition-all duration-300 group flex items-center justify-center gap-3 shadow-sm border border-slate-200 dark:border-white/10 active:scale-[0.98] overflow-hidden",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 dark:focus-visible:ring-offset-[#0A0A0A]",
                      isLoggingIn && "opacity-70 cursor-not-allowed"
                    )}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-100/50 dark:via-white/[0.05] to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                    
                    {!isLoggingIn ? (
                      <>
                        <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" xmlns="http://www.w3.org/2000/svg">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        <span className="relative z-10 tracking-wide">Ingresar con Google</span>
                        <ArrowRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-white transition-all group-hover:translate-x-1" />
                      </>
                    ) : (
                      <span className="relative z-10 tracking-wide flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-slate-300 dark:border-white/20 border-t-slate-700 dark:border-t-white rounded-full animate-spin"></span>
                        Verificando identidad...
                      </span>
                    )}
                  </button>
                  
                  <div className="mt-8 flex items-center justify-center gap-3 opacity-40 grayscale group-hover:grayscale-0 transition-all duration-700">
                     <div className="w-[1px] h-3 bg-slate-300 dark:bg-slate-700"></div>
                     <div className="flex gap-1.5">
                        {[1,2,3].map(i => <div key={i} className="w-1 h-1.5 bg-red-600/60 dark:bg-white/40 rounded-full animate-pulse" style={{ animationDelay: `${i*0.2}s` }} />)}
                     </div>
                     <div className="w-[1px] h-3 bg-slate-300 dark:bg-slate-700"></div>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>
        </motion.div>
      </div>

      <footer className="fixed bottom-6 w-full text-center pointer-events-none z-20">
        <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-semibold flex items-center justify-center gap-2">
          Design system por <span className="text-slate-700 dark:text-slate-300 font-bold">Gastón Rivata</span>
        </p>
      </footer>
    </main>
  );
}