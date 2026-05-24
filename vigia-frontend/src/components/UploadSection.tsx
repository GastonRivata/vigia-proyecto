import { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Loader2, AlertCircle, Camera, CheckCircle2, XCircle, Clock, Scan } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';

interface UploadSectionProps {
  onFilesSelected: (files: File[]) => Promise<void>;
  onViewItem?: (item: any) => void;
  isProcessing: boolean;
  setIsProcessing: (val: boolean) => void;
  batchItems: { name: string; status: 'queued' | 'processing' | 'done' | 'error'; data?: any; error?: string; fileUrl?: string; fileType?: string }[];
}

export function UploadSection({ onFilesSelected, onViewItem, isProcessing, setIsProcessing, batchItems }: UploadSectionProps) {
  const [error, setError] = useState<string | null>(null);
  const [isDraggingOverBody, setIsDraggingOverBody] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    setError(null);
    setIsDraggingOverBody(false);
    await onFilesSelected(acceptedFiles);
  }, [onFilesSelected]);

  useEffect(() => {
    let dragCounter = 0;

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer?.types.includes('Files') && !isProcessing) {
        dragCounter++;
        setIsDraggingOverBody(true);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (!isProcessing) setIsDraggingOverBody(true);
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter === 0) {
        setIsDraggingOverBody(false);
      }
    };

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      dragCounter = 0;
      setIsDraggingOverBody(false);
      
      if (isProcessing) return;

      const files = Array.from(e.dataTransfer?.files || []).filter(
        f => f.type.startsWith('image/') || f.type === 'application/pdf'
      );
      
      if (files.length > 0) {
        setError(null);
        await onFilesSelected(files);
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, [isProcessing, onFilesSelected]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({

    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg'],
      'application/pdf': ['.pdf']
    },
    disabled: isProcessing,
    multiple: true,
    noClick: true
  } as any);

  return (
    <div className="w-full space-y-8">
      <AnimatePresence>
        {isDraggingOverBody && !isProcessing && (
          <motion.div
            initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            animate={{ opacity: 1, backdropFilter: 'blur(8px)' }}
            exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            className="fixed inset-0 z-[99999] bg-slate-900/40 dark:bg-slate-950/60 flex flex-col items-center justify-center p-6 md:p-12 transition-all duration-300"
          >
            {/* Elegant dashed border matching the red theme but very discreet */}
            <div className="absolute inset-6 md:inset-12 z-0 rounded-[2.5rem] md:rounded-[3rem] border-2 border-dashed border-red-500/40 bg-red-500/5 pointer-events-none transition-all duration-300 shadow-[inset_0_0_100px_rgba(239,68,68,0.05)] flex items-center justify-center">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-red-500/5 rounded-[2.5rem] md:rounded-[3rem] pointer-events-none" />
            </div>
            
            <motion.div 
              animate={{ y: [0, -8, 0], scale: [1, 1.02, 1] }}
              transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
              className="relative z-10 bg-white/20 dark:bg-slate-900/60 p-6 rounded-3xl border border-white/30 dark:border-white/10 shadow-2xl backdrop-blur-md flex items-center justify-center gap-4"
            >
              <div className="relative">
                <FileText className="w-12 h-12 text-white/90 drop-shadow-md" />
                <motion.div
                  animate={{ y: [-10, 24, -10] }}
                  transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                  className="absolute left-0 right-0 h-0.5 bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.8)] z-20"
                />
              </div>
              <Scan className="w-8 h-8 text-white/50" />
            </motion.div>

            <h2 className="text-xl md:text-3xl font-medium tracking-tight text-white drop-shadow-lg relative z-10 mt-6 mb-2 text-center flex items-center gap-2">
              <FileText className="w-5 h-5 text-red-400" />
              Suelte el documento aquí
            </h2>
            <p className="text-white/60 dark:text-white/50 font-bold tracking-[0.2em] uppercase text-[10px] md:text-xs relative z-10 text-center">
               El motor Vigia extraerá automáticamente los datos
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        {...(getRootProps() as any)}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "relative group overflow-hidden rounded-[2rem] border-2 border-dashed transition-all duration-500 shadow-sm",
          "flex flex-col md:flex-row items-center justify-between p-6 md:p-8 text-left gap-6 md:gap-8",
          isDragActive 
            ? "border-red-600 bg-red-600/5 shadow-red-600/10 scale-[1.01]" 
            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 hover:border-red-500/50 hover:bg-slate-50 dark:hover:bg-slate-800/50",
          isProcessing && "pointer-events-none opacity-80"
        )}
      >
        <div className="absolute inset-0 cursor-pointer pointer-events-auto" onClick={open} />
        <input {...getInputProps()} />
        
        <div className="flex flex-col md:flex-row items-center gap-6 pointer-events-none relative z-10 w-full">
          <div className={cn(
            "w-16 h-16 shrink-0 rounded-2xl flex items-center justify-center transition-all duration-700 shadow-md",
            isDragActive 
              ? "bg-red-600 text-white scale-110 shadow-red-600/40 rotate-6" 
              : "bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-500 group-hover:scale-110 group-hover:bg-red-50 dark:group-hover:bg-red-600/10 group-hover:text-red-600 dark:group-hover:text-red-400 group-hover:-rotate-3"
          )}>
            {isProcessing ? (
              <Loader2 className="w-8 h-8 animate-spin" />
            ) : (
              <Upload className="w-8 h-8" />
            )}
          </div>
  
          <div className="flex-1 space-y-1 text-center md:text-left">
            <h3 className="text-lg md:text-xl font-black text-slate-900 dark:text-white tracking-tighter uppercase italic flex items-center justify-center md:justify-start gap-2">
              {isProcessing ? 'Procesamiento Neuronal...' : 'Capturar Comprobantes'}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs md:text-sm font-medium">
              Haz clic, arrastra archivos aquí o <span className="font-bold text-slate-700 dark:text-slate-300">suéltalos en cualquier parte de la pantalla</span>.
            </p>
            <div className="flex justify-center md:justify-start gap-4 mt-3 text-[9px] font-black text-slate-400 dark:text-slate-600 tracking-[0.2em] uppercase italic">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                Direct OCR
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                SOAP V3.1
              </div>
            </div>
          </div>
  
          <div className="relative z-20 flex shrink-0 justify-center w-full md:w-auto" onClick={(e) => e.stopPropagation()}>
            <label className="flex items-center justify-center gap-3 w-full md:w-auto px-6 py-4 bg-slate-900 dark:bg-red-600 text-white rounded-xl text-[11px] font-black cursor-pointer transition-all shadow-xl hover:shadow-red-500/20 active:scale-95 group">
              <Camera className="w-4 h-4 group-hover:scale-125 transition-transform" />
              TOMAR FOTO
              <input 
                type="file" 
                accept="image/*" 
                capture="environment" 
                multiple
                className="hidden" 
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    onFilesSelected(Array.from(e.target.files));
                  }
                }} 
              />
            </label>
          </div>
        </div>
      </motion.div>

      {/* Batch Processing List */}
      <AnimatePresence>
        {batchItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-white dark:bg-slate-950 rounded-[2rem] border border-slate-100 dark:border-white/5 overflow-hidden shadow-2xl"
          >
            <div className="px-8 py-5 border-b border-slate-50 dark:border-white/5 flex items-center justify-between">
              <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest italic">Estado de Procesamiento de Lote</h4>
              <span className="text-[10px] font-black px-3 py-1 bg-red-50 dark:bg-red-600/10 text-red-600 dark:text-red-400 rounded-full border border-red-100 dark:border-red-600/20 uppercase tracking-widest">
                {batchItems.filter(i => i.status === 'done').length} / {batchItems.length} Finalizados
              </span>
            </div>
            <div className="p-4 max-h-[300px] overflow-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {batchItems.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 transition-all">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                        item.status === 'done' && "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500",
                        item.status === 'processing' && "bg-red-50 dark:bg-red-500/10 text-red-500",
                        item.status === 'queued' && "bg-slate-100 dark:bg-white/10 text-slate-400",
                        item.status === 'error' && "bg-rose-50 dark:bg-rose-500/10 text-rose-500"
                      )}>
                        {item.status === 'done' ? <CheckCircle2 className="w-5 h-5" /> : 
                         item.status === 'processing' ? <Loader2 className="w-5 h-5 animate-spin" /> : 
                         item.status === 'error' ? <XCircle className="w-5 h-5" /> : 
                         <Clock className="w-5 h-5" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-slate-900 dark:text-white truncate uppercase tracking-tight">{item.name}</p>
                        <p className={cn("text-[10px] font-medium uppercase tracking-widest mt-0.5", item.status === 'error' ? 'text-rose-500 normal-case' : 'text-slate-400')}>
                          {item.status === 'done' ? 'Extracción Completa' : 
                           item.status === 'processing' ? 'Analizando documento...' : 
                           item.status === 'error' ? (item.error || 'Fallo en lectura') : 'En cola de espera'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {item.status === 'done' && onViewItem && (
                        <button 
                          onClick={() => onViewItem(item)}
                          className="px-4 py-2 bg-slate-900 dark:bg-red-600 text-white text-[10px] font-black uppercase rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg"
                        >
                          Ver
                        </button>
                      )}
                      {item.fileUrl && (
                        <a 
                          href={item.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-2 bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-xl transition-all flex items-center justify-center shrink-0"
                          title="Abrir en ventana nueva"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-6 bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/20 rounded-2xl flex items-start gap-4 text-rose-600 dark:text-rose-400 shadow-xl"
          >
            <AlertCircle className="w-6 h-6 flex-shrink-0" />
            <div className="space-y-1">
              <p className="text-xs font-black uppercase tracking-widest">Error Crítico de Integración</p>
              <p className="text-sm font-medium leading-relaxed">{error}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
