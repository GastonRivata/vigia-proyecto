import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, Zap, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';

interface VigiaLogoProps {
  className?: string;
  size?: 'sm' | 'lg';
  animated?: boolean;
}

export function VigiaLogo({ className, size = 'lg', animated = true }: VigiaLogoProps) {
  const [animationPhase, setAnimationPhase] = useState<'idle' | 'scanning' | 'success'>('idle');

  useEffect(() => {
    if (!animated) return;
    let isMounted = true;
    const runSequence = async () => {
      while (isMounted) {
        setAnimationPhase('scanning');
        await new Promise(r => setTimeout(r, 2000));
        if (!isMounted) break;
        setAnimationPhase('success');
        await new Promise(r => setTimeout(r, 2000));
        if (!isMounted) break;
        setAnimationPhase('idle');
        await new Promise(r => setTimeout(r, 500));
      }
    };
    runSequence();
    return () => { isMounted = false; };
  }, [animated]);

  if (size === 'sm') {
    return (
      <div className={cn("relative flex items-center justify-center w-8 h-8", className)}>
        {animated && (
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 10, ease: "linear" }}
            className="absolute inset-[-50%] bg-gradient-to-r from-red-500/20 to-rose-500/20 rounded-full blur-md"
          />
        )}
        <div className={cn(
          "relative bg-white dark:bg-slate-900 border rounded-lg shadow-sm z-10 w-full h-full flex items-center justify-center overflow-hidden transition-colors duration-500",
          animationPhase === 'success' ? "border-emerald-500/50 dark:border-emerald-500/50" : "border-slate-200 dark:border-slate-800"
        )}>
          <FileText className={cn("w-4 h-4 transition-colors duration-500", animationPhase === 'success' ? "text-emerald-500" : "text-slate-800 dark:text-slate-200")} strokeWidth={1.5} />
          
          <AnimatePresence>
            {animationPhase === 'scanning' && animated && (
              <motion.div 
                initial={{ y: '-100%', opacity: 0 }}
                animate={{ y: '100%', opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.2 } }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                className="absolute top-0 w-full h-[40%] bg-gradient-to-b from-transparent to-red-500/30 border-b border-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)] z-20"
              />
            )}
          </AnimatePresence>
          <div className="absolute top-[2px] right-[2px] z-30 opacity-70">
            <Sparkles className="w-2 h-2 text-red-400" />
          </div>
          <AnimatePresence>
            {animationPhase === 'success' && animated && (
              <motion.div 
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: [0, 1.2, 1], opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="absolute bottom-[2px] right-[2px] flex items-center justify-center w-3 h-3 bg-emerald-500 rounded-full border border-white dark:border-slate-900 z-30"
              >
                <Zap className="w-2 h-2 text-white" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      {animated && (
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
          className="absolute inset-[-20%] bg-gradient-to-r from-red-500/10 to-rose-500/10 rounded-full blur-xl"
        />
      )}
      <div className={cn("relative bg-white dark:bg-slate-900 border p-3 rounded-2xl shadow-sm z-10 w-full h-full flex flex-col items-center justify-center overflow-hidden transition-colors duration-500", animationPhase === 'success' ? "border-emerald-500/30 dark:border-emerald-500/30" : "border-slate-100 dark:border-slate-800")}>
        <motion.div
           animate={{
             y: animationPhase === 'idle' ? 2 : animationPhase === 'scanning' ? 0 : -2
           }}
           transition={{ duration: 0.5 }}
           className="w-full h-full flex items-center justify-center relative z-10"
        >
          <FileText className={cn("w-10 h-10 transition-colors duration-500", animationPhase === 'success' ? "text-emerald-500" : "text-slate-800 dark:text-slate-200")} strokeWidth={1} />
        </motion.div>
        
        <AnimatePresence>
          {animationPhase === 'scanning' && animated && (
            <motion.div 
              initial={{ y: '-100%', opacity: 0 }}
              animate={{ y: '100%', opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
              className="absolute top-0 w-full h-[40%] bg-gradient-to-b from-transparent to-red-500/20 border-b border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)] z-20"
            />
          )}
        </AnimatePresence>
        
        <div className="absolute top-2 right-2 z-30 opacity-50">
          <Sparkles className="w-3 h-3 text-red-400" />
        </div>
        
        <AnimatePresence>
          {animationPhase === 'success' && animated && (
            <motion.div 
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.2, 1], opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="absolute bottom-2 right-2 flex items-center justify-center w-5 h-5 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900 z-30 shadow-sm"
            >
              <Zap className="w-3 h-3 text-white" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
