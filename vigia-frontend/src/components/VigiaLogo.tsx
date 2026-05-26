import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, Brain, Sparkles, FileCheck, ScanLine } from 'lucide-react';
import { cn } from '../lib/utils';

interface VigiaLogoProps {
  className?: string;
  size?: 'sm' | 'lg';
  animated?: boolean;
}

export function VigiaLogo({ className, size = 'lg', animated = true }: VigiaLogoProps) {
  const [animationPhase, setAnimationPhase] = useState<'idle' | 'scanning' | 'classifying' | 'success'>('idle');

  useEffect(() => {
    if (!animated) return;
    let isMounted = true;
    const runSequence = async () => {
      while (isMounted) {
        setAnimationPhase('scanning');
        await new Promise(r => setTimeout(r, 1500));
        if (!isMounted) break;
        setAnimationPhase('classifying');
        await new Promise(r => setTimeout(r, 1200));
        if (!isMounted) break;
        setAnimationPhase('success');
        await new Promise(r => setTimeout(r, 1500));
        if (!isMounted) break;
        setAnimationPhase('idle');
        await new Promise(r => setTimeout(r, 800));
      }
    };
    runSequence();
    return () => { isMounted = false; };
  }, [animated]);

  const isSmall = size === 'sm';

  return (
    <div className={cn("relative flex items-center justify-center", isSmall ? "w-8 h-8" : "w-16 h-16", className)}>
      {animated && (
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 15, ease: "linear" }}
          className={cn(
            "absolute rounded-full blur-xl",
            isSmall ? "inset-[-50%] bg-gradient-to-r from-red-500/20 to-transparent" : "inset-[-20%] bg-gradient-to-r from-red-600/10 via-rose-500/10 to-transparent"
          )}
        />
      )}

      {/* Main Container */}
      <div 
        className={cn(
          "relative bg-white dark:bg-slate-900 border shadow-sm z-10 w-full h-full flex items-center justify-center overflow-hidden transition-colors duration-500",
          isSmall ? "rounded-lg border-slate-200 dark:border-slate-800" : "rounded-[1.25rem] border-slate-100 dark:border-white/10 p-2",
          animationPhase === 'success' && "border-emerald-500/30 dark:border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]"
        )}
      >
        {/* Document Icon & Abstract Content */}
        <motion.div
           animate={{
             scale: animationPhase === 'success' ? 0.9 : 1,
             opacity: animationPhase === 'classifying' ? 0.3 : 1
           }}
           transition={{ duration: 0.4 }}
           className="w-full h-full flex flex-col items-center justify-center relative z-10"
        >
          {animationPhase === 'success' ? (
            <FileCheck className={cn("transition-colors duration-500 text-emerald-500", isSmall ? "w-4 h-4" : "w-7 h-7")} strokeWidth={isSmall ? 1.5 : 1} />
          ) : (
            <FileText className={cn("transition-colors duration-500", 
              animationPhase === 'scanning' ? "text-slate-400 dark:text-slate-500" : "text-slate-800 dark:text-slate-200"
            , isSmall ? "w-4 h-4" : "w-7 h-7")} strokeWidth={isSmall ? 1.5 : 1} />
          )}

          {/* Abstract Data Lines (Only for Large size) */}
          {!isSmall && animationPhase !== 'success' && (
             <div className="absolute inset-0 flex flex-col items-center justify-center gap-[3px] opacity-30 mt-1 pointer-events-none">
                <div className="w-3 h-[1.5px] bg-slate-500 rounded-full translate-x-[-2px]" />
                <div className="w-5 h-[1.5px] bg-slate-500 rounded-full" />
                <div className="w-4 h-[1.5px] bg-slate-500 rounded-full translate-x-[1px]" />
             </div>
          )}
        </motion.div>
        
        {/* Phase 1: Scanning Line */}
        <AnimatePresence>
          {animationPhase === 'scanning' && animated && (
            <motion.div 
              initial={{ y: '-100%', opacity: 0 }}
              animate={{ y: '100%', opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
              transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
              className={cn(
                "absolute top-0 w-full bg-gradient-to-b from-transparent z-20 border-b",
                isSmall ? "h-[50%] to-red-500/20 border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" : "h-[60%] to-red-500/10 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]"
              )}
            />
          )}
        </AnimatePresence>

        {/* Phase 2: Neural Classification AI Brain */}
        <AnimatePresence>
          {animationPhase === 'classifying' && animated && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
              animate={{ opacity: 1, scale: 1.1, rotate: 0 }}
              exit={{ opacity: 0, scale: 1.5 }}
              transition={{ duration: 0.4, type: "spring" }}
              className="absolute inset-0 z-20 flex items-center justify-center backdrop-blur-[1px] bg-white/40 dark:bg-slate-900/40"
            >
              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 bg-red-500/20 rounded-full blur-md animate-pulse" />
                <Brain className={cn("text-red-500 animate-pulse drop-shadow-lg relative z-10", isSmall ? "w-4 h-4" : "w-7 h-7")} strokeWidth={1.5} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Decorative Sparkle Component */}
        <div className={cn("absolute z-30 opacity-70", isSmall ? "top-[2px] right-[2px]" : "top-2 right-2")}>
           <motion.div
             animate={{ 
               scale: [1, 1.2, 1],
               opacity: [0.5, 1, 0.5]
             }}
             transition={{ duration: 2, repeat: Infinity }}
           >
             <Sparkles className={cn("text-red-400", isSmall ? "w-2 h-2" : "w-3 h-3")} />
           </motion.div>
        </div>
      </div>
    </div>
  );
}
