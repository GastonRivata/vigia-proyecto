import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Scan, 
  UploadCloud, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  RefreshCw, 
  XCircle, 
  FileText, 
  Trash2, 
  Calendar, 
  Landmark, 
  DollarSign, 
  ArrowRight, 
  ShieldCheck, 
  Sparkles, 
  Building, 
  Briefcase, 
  ChevronRight,
  ShieldAlert,
  ArrowUpRight,
  Zap
} from 'lucide-react';
import { extractCheckData } from '../lib/gemini';
import { notify } from '../lib/notifications';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

// Sample demo cheque images (simulated previews)
const DEMO_PRESETS = [
  {
    name: "Agropecuaria Pampeana (Excelente)",
    cuit: "30-58471209-2",
    librador: "AGROINDUSTRIAS PAMPEANAS S.A.",
    banco: "BANCO GALICIA AND BUENOS AIRES S.A.U.",
    monto: 750000,
    chequeNum: "45091224",
    fEmision: "2026-05-15",
    fPago: "2026-06-15",
    preview: "https://placehold.co/600x300/10b981/ffffff?text=AGROINDUSTRIAS+PAMPEANAS%5CnCHEQUE+45091224%5Cn%24750.000&font=Montserrat"
  },
  {
    name: "Sergio Rivara (Leves Atrasos)",
    cuit: "20-31580941-6",
    librador: "RIVARA SERGIO MAURICIO",
    banco: "BANCO SANTANDER ARGENTINA S.A.",
    monto: 420000,
    chequeNum: "15421109",
    fEmision: "2026-05-10",
    fPago: "2026-06-10",
    preview: "https://placehold.co/600x300/eab308/ffffff?text=SERGIO+RIVARA%5CnCHEQUE+15421109%5Cn%24420.000&font=Montserrat"
  },
  {
    name: "Terranova S.R.L. (Mora Crítica)",
    cuit: "30-71402241-7",
    librador: "TERRANOVA LOGÍSTICA S.R.L.",
    banco: "BANCO PATAGONIA S.A.",
    monto: 1500000,
    chequeNum: "78120015",
    fEmision: "2026-05-01",
    fPago: "2026-05-05",
    preview: "https://placehold.co/600x300/f43f5e/ffffff?text=TERRANOVA+LOGISTICA%5CnCHEQUE+78120015%5Cn%241.500.000&font=Montserrat"
  }
];

interface CheckInfo {
  cuit_librador: string;
  razon_social_librador: string;
  banco: string;
  numero_cheque: string;
  fecha_emision: string;
  fecha_pago: string;
  importe: number;
  sucursal?: string;
}

interface BcraData {
  source: string;
  cuit: string;
  errorReason?: string;
  deudas: {
    identificacion: string;
    denominacion: string;
    periodo: string;
    periodos: Array<{
      periodo: string;
      entidades: Array<{
        entidad: string;
        situacion: number;
        importe: number;
        diasAtraso?: number;
      }>;
    }>;
  } | null;
  historicas: {
    identificacion: string;
    denominacion: string;
    periodo: string;
    periodos: Array<{
      periodo: string;
      entidades: Array<{
        entidad: string;
        situacion: number;
        importe: number;
      }>;
    }>;
  } | null;
  rechazados: {
    identificacion: string;
    denominacion: string;
    chequesRechazados: Array<{
      nroCheque: string;
      fechaRechazo: string;
      monto: number;
      causal: string;
      fechaPago?: string;
      multa?: string;
      revisacion?: string;
    }>;
  } | null;
}

export function ChequeReader() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [extractedInfo, setExtractedInfo] = useState<CheckInfo | null>(null);
  const [bcraResults, setBcraResults] = useState<BcraData | null>(null);
  const [loadingBcra, setLoadingBcra] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle Drag over
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processBase64AndExtract = async (base64: string, mime: string) => {
    setIsProcessing(true);
    setExtractedInfo(null);
    setBcraResults(null);
    try {
      const data = await extractCheckData(base64, mime);
      
      setExtractedInfo({
        cuit_librador: data.cuit_librador || '',
        razon_social_librador: data.razon_social_librador || 'Titular no descifrado',
        banco: data.banco || 'BANCO NO IDENTIFICADO',
        numero_cheque: data.numero_cheque || '',
        fecha_emision: data.fecha_emision || '',
        fecha_pago: data.fecha_pago || '',
        importe: data.importe || 0,
        sucursal: data.sucursal || ''
      });

      notify({
        type: 'success',
        title: 'Cheque Procesado',
        message: 'CUIT de librador y montos extraídos con inteligencia neural.',
        important: false
      });
    } catch (err: any) {
      toast.error('Error de Procesamiento', {
        description: err.message || 'No se pudo leer la imagen del cheque.'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Drop
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const objectUrl = URL.createObjectURL(file);
      setFileUrl(objectUrl);

      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        processBase64AndExtract(base64, file.type);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle Input Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const objectUrl = URL.createObjectURL(file);
      setFileUrl(objectUrl);

      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        processBase64AndExtract(base64, file.type);
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerInputFile = () => {
    fileInputRef.current?.click();
  };

  // Load a demo preset
  const handleLoadPreset = (preset: typeof DEMO_PRESETS[0]) => {
    setFileUrl(preset.preview);
    setExtractedInfo({
      cuit_librador: preset.cuit,
      razon_social_librador: preset.librador,
      banco: preset.banco,
      numero_cheque: preset.chequeNum,
      fecha_emision: preset.fEmision,
      fecha_pago: preset.fPago,
      importe: preset.monto,
      sucursal: "Suc. Principal"
    });
    setBcraResults(null);
    toast.success('Simulación: Cheque de plantilla cargado.', {
      description: `Librador: ${preset.librador}`
    });
  };

  // Query BCRA
  const handleQueryBcra = async () => {
    if (!extractedInfo?.cuit_librador) return;
    setLoadingBcra(true);
    setBcraResults(null);

    const cuitClean = extractedInfo.cuit_librador.replace(/\D/g, '');
    try {
      const response = await fetch(`/api/cheques/bcra/${cuitClean}`);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Fallo general al consultar BCRA');
      }

      const rawData = await response.json();
      setBcraResults(rawData);

      // Determine global situation to show toast icon
      const sit = getWorstSituation(rawData);
      const isOk = sit <= 2;

      toast.success('Central de Deudores BCRA', {
        description: `Información de ${rawData.deudas?.denominacion || 'Cuit'} consultada con éxito.`,
        icon: isOk ? <ShieldCheck className="w-5 h-5 text-emerald-500" /> : <ShieldAlert className="w-5 h-5 text-rose-500" />
      });
    } catch (err: any) {
      toast.error('Error BCRA', {
        description: err.message || 'No se pudo conectar con el servidor del BCRA.'
      });
    } finally {
      setLoadingBcra(false);
    }
  };

  const getWorstSituation = (data: BcraData): number => {
    if (!data.deudas?.periodos?.[0]?.entidades) return 1;
    let worst = 1;
    data.deudas.periodos[0].entidades.forEach(ent => {
      if (ent.situacion > worst) worst = ent.situacion;
    });
    return worst;
  };

  const getSituationColor = (sit: number) => {
    switch (sit) {
      case 1: return "text-emerald-500 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
      case 2: return "text-yellow-500 dark:text-yellow-400 bg-yellow-500/10 border-yellow-500/20";
      case 3: return "text-amber-600 dark:text-amber-400 bg-amber-600/10 border-amber-600/20";
      case 4: return "text-orange-600 dark:text-orange-400 bg-orange-600/10 border-orange-600/20";
      case 5: return "text-red-600 dark:text-red-400 bg-red-600/10 border-red-600/20";
      case 6: return "text-purple-600 dark:text-purple-400 bg-purple-600/10 border-purple-600/20";
      default: return "text-slate-500 bg-slate-100 border-slate-200";
    }
  };

  const getSituationDesc = (sit: number) => {
    switch (sit) {
      case 1: return "SITUACIÓN 1: Normal. Excelente solvencia financiera.";
      case 2: return "SITUACIÓN 2: Seguimiento Especial. Demoras leves de 31 a 90 días.";
      case 3: return "SITUACIÓN 3: Con Problemas. Atrasos de 91 a 180 días.";
      case 4: return "SITUACIÓN 4: Alto Riesgo de Insolvencia. Atrasos de 181 a 365 días.";
      case 5: return "SITUACIÓN 5: Irrecuperable. Insolvente o en quiebra.";
      case 6: return "SITUACIÓN 6: En Gestión Judicial. Sumario judicial en curso.";
      default: return "SITUACIÓN DESCONOCIDA";
    }
  };

  const resetAll = () => {
    setFileUrl(null);
    setExtractedInfo(null);
    setBcraResults(null);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(val);
  };

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col gap-6">
      
      {/* Upper header */}
      <div className="text-center md:text-left mb-2 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white mt-1 italic uppercase leading-none">
            Lector de <span className="text-red-600">Cheques.</span>
          </h2>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2 max-w-2xl">
            Procesa imágenes de cheques físicos y eCheques mediante inteligencia artificial de visión, deduce el emisor (CUIT) y califica su perfil comercial en tiempo real en la central del Banco Central.
          </p>
        </div>

        {fileUrl && (
          <button 
            onClick={resetAll}
            className="px-5 py-2 text-xs font-black uppercase tracking-widest bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-xl transition-all border border-slate-200 dark:border-white/5 pointer-events-auto shrink-0"
          >
            Escanear Otro Cheque
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: Input/Preview/Extraction */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <AnimatePresence mode="wait">
            {!fileUrl ? (
              <motion.div 
                key="dropzone"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col gap-6"
              >
                {/* Drag zone */}
                <div 
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={triggerInputFile}
                  className={cn(
                    "relative border-2 border-dashed rounded-[2rem] p-8 md:p-12 text-center cursor-pointer transition-all h-[26rem] flex flex-col items-center justify-center gap-4 backdrop-blur-md group overflow-hidden",
                    dragActive 
                      ? "border-red-500 bg-red-500/5 shadow-inner" 
                      : "border-slate-300 dark:border-slate-800 hover:border-red-500/50 bg-white dark:bg-slate-900/40 hover:dark:bg-slate-900/60 shadow-[0_20px_50px_rgba(0,0,0,0.02)]"
                  )}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                  />
                  
                  {/* Neural decorative shapes */}
                  <div className="absolute inset-0 bg-gradient-to-br from-red-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  
                  <div className="w-20 h-20 bg-red-50 dark:bg-red-500/10 rounded-[2rem] border border-red-100 dark:border-red-500/20 flex items-center justify-center shadow-lg shadow-red-500/5 group-hover:scale-110 transition-all duration-300">
                    <UploadCloud className="w-10 h-10 text-red-600 dark:text-red-400 group-hover:animate-bounce" />
                  </div>

                  <div className="flex flex-col gap-1 z-10">
                    <p className="text-lg font-black text-slate-800 dark:text-slate-200 tracking-tight italic uppercase">Arrastra tu Cheque</p>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">o haz clic para buscar en tu dispositivo / activar cámara</p>
                  </div>

                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 dark:bg-white/5 py-1 px-3 border border-slate-200 dark:border-white/5 rounded-full z-10 transition-colors group-hover:border-red-500/30">
                    Soporta JPG, PNG y fotos de celulares
                  </span>
                </div>

                {/* Plantillas / Presets */}
                <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-white/5 p-6 rounded-3xl backdrop-blur-md">
                  <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-4 flex items-center gap-1.5 border-b border-slate-100 dark:border-white/5 pb-2">
                    <Sparkles className="w-4 h-4 text-amber-500" /> Plantillas de Demostración Rápida
                  </h4>
                  <div className="flex flex-col gap-3">
                    {DEMO_PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleLoadPreset(preset)}
                        className="flex flex-col sm:flex-row items-center gap-3 p-3.5 rounded-[1.5rem] bg-slate-50 hover:bg-slate-100 dark:bg-slate-950/50 dark:hover:bg-slate-900 transition-all border border-slate-200 dark:border-slate-800 hover:border-red-500/30 text-left outline-none text-slate-700 dark:text-slate-300 w-full group relative overflow-hidden"
                      >
                        <div className="flex items-center gap-4 w-full">
                          <div className="h-12 w-24 sm:h-14 sm:w-28 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shrink-0 relative">
                            <img src={preset.preview} referrerPolicy="no-referrer" alt="Cheque miniatura" className="size-full object-cover grayscale opacity-90 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-300" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-black tracking-tight uppercase truncate">{preset.name}</p>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5 truncate">{preset.librador}</p>
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <span className="text-[9px] font-mono bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 px-2 py-0.5 rounded text-slate-600 dark:text-slate-400">
                                CUIT {preset.cuit}
                              </span>
                              <span className="text-[9px] font-black uppercase tracking-[0.15em] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3" />
                                MOCK BCRA
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600 group-hover:text-red-500 transition-colors shrink-0 hidden sm:block" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="preview-box"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col gap-6"
              >
                {/* Cheque Picture Card with active scanning line */}
                <div className="relative aspect-[16/9] w-full rounded-[2rem] overflow-hidden border border-slate-200 dark:border-white/5 bg-slate-900 shadow-2xl">
                  <img 
                    src={fileUrl} 
                    referrerPolicy="no-referrer"
                    alt="Cheque Escaneado" 
                    className={cn(
                      "w-full h-full object-contain object-center transition-all duration-700",
                      isProcessing ? "opacity-40 blur-[1px] scale-[1.02]" : "opacity-100 blur-0 scale-100"
                    )}
                  />

                  {/* Laser line slider */}
                  {isProcessing && (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-b from-red-600/5 via-red-600/20 to-transparent" />
                      <motion.div 
                        initial={{ top: "0%" }}
                        animate={{ top: "100%" }}
                        transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
                        className="absolute left-0 right-0 h-[2px] bg-red-500 shadow-[0_0_15px_#ef4444,0_0_5px_#ef4444] z-10"
                      />
                      <div className="absolute inset-x-0 bottom-4 text-center z-10">
                        <div className="inline-flex items-center gap-2 bg-slate-950/80 backdrop-blur-md px-4 py-1.5 rounded-full border border-red-500/30 shadow-2xl">
                          <RefreshCw className="w-3.5 h-3.5 text-red-500 animate-spin" />
                          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-red-400">Analizando estructura formal con IA...</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Form of extracted values */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-white/5 flex flex-col gap-4 relative overflow-hidden backdrop-blur-md">
                  
                  {/* Glow header indicator */}
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-red-500" /> Atributos Extraídos del Cheque
                    </span>
                    <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">
                      Vision OCR Active
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    
                    {/* Banco */}
                    <div className="col-span-2">
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 block mb-1">Entidad Financiera Emisora</label>
                      <div className="relative">
                        <Landmark className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <input 
                          type="text" 
                          value={extractedInfo?.banco || ''}
                          onChange={(e) => setExtractedInfo(prev => prev ? { ...prev, banco: e.target.value } : null)}
                          disabled={isProcessing}
                          placeholder="Detectando Banco..."
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2 pl-9 pr-3 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:border-red-500 transition-colors"
                        />
                      </div>
                    </div>

                    {/* Librador CUIT */}
                    <div className="col-span-2">
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 block mb-1">CUIT del Librador (Emisor)</label>
                      <div className="relative">
                        <Building className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <input 
                          type="text" 
                          value={extractedInfo?.cuit_librador || ''}
                          onChange={(e) => setExtractedInfo(prev => prev ? { ...prev, cuit_librador: e.target.value } : null)}
                          disabled={isProcessing}
                          placeholder="XX-XXXXXXXX-X"
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2 pl-9 pr-3 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:border-red-500 transition-colors font-mono"
                        />
                      </div>
                      <span className="text-[9px] text-slate-400 italic block mt-1">Este CUIT será utilizado para la consulta ante la base del BCRA.</span>
                    </div>

                    {/* Razón Social */}
                    <div className="col-span-2">
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 block mb-1">Nombre / Razón Social del Librador</label>
                      <div className="relative">
                        <Briefcase className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <input 
                          type="text" 
                          value={extractedInfo?.razon_social_librador || ''}
                          onChange={(e) => setExtractedInfo(prev => prev ? { ...prev, razon_social_librador: e.target.value } : null)}
                          disabled={isProcessing}
                          placeholder="Buscando titular de cuenta..."
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2 pl-9 pr-3 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:border-red-500 transition-colors"
                        />
                      </div>
                    </div>

                    {/* Número Cheque */}
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 block mb-1">Nro Cheque</label>
                      <input 
                        type="text" 
                        value={extractedInfo?.numero_cheque || ''}
                        onChange={(e) => setExtractedInfo(prev => prev ? { ...prev, numero_cheque: e.target.value } : null)}
                        disabled={isProcessing}
                        placeholder="Nro"
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2 px-3 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:border-red-500 transition-colors font-mono"
                      />
                    </div>

                    {/* Importe */}
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 block mb-1">Importe ($)</label>
                      <div className="relative">
                        <DollarSign className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                        <input 
                          type="number" 
                          value={extractedInfo?.importe || ''}
                          onChange={(e) => setExtractedInfo(prev => prev ? { ...prev, importe: Number(e.target.value) } : null)}
                          disabled={isProcessing}
                          placeholder="Monto"
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2 pl-7 pr-3 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:border-red-500 transition-colors font-mono"
                        />
                      </div>
                    </div>

                    {/* Fecha Emisión */}
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 block mb-1">Fecha Emisión</label>
                      <div className="relative">
                        <Calendar className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                        <input 
                          type="text" 
                          value={extractedInfo?.fecha_emision || ''}
                          onChange={(e) => setExtractedInfo(prev => prev ? { ...prev, fecha_emision: e.target.value } : null)}
                          disabled={isProcessing}
                          placeholder="YYYY-MM-DD"
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2 pl-8 pr-3 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:border-red-500 transition-colors font-mono"
                        />
                      </div>
                    </div>

                    {/* Fecha Pago */}
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 block mb-1">Fecha de Pago</label>
                      <div className="relative">
                        <Calendar className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                        <input 
                          type="text" 
                          value={extractedInfo?.fecha_pago || ''}
                          onChange={(e) => setExtractedInfo(prev => prev ? { ...prev, fecha_pago: e.target.value } : null)}
                          disabled={isProcessing}
                          placeholder="YYYY-MM-DD"
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2 pl-8 pr-3 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:border-red-500 transition-colors font-mono"
                        />
                      </div>
                    </div>

                  </div>

                  {extractedInfo && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleQueryBcra}
                      disabled={loadingBcra || !extractedInfo.cuit_librador}
                      className={cn(
                        "mt-4 w-full py-3.5 rounded-2xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg",
                        loadingBcra 
                          ? "bg-slate-100 dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-white/5 cursor-wait" 
                          : "bg-red-650 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-750 text-white shadow-red-500/10 hover:shadow-red-500/20"
                      )}
                    >
                      {loadingBcra ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
                          Consultando Central BCRA...
                        </>
                      ) : (
                        <>
                          <Scan className="w-5 h-5 text-white animate-pulse" />
                          CONSULTAR HISTORIAL BCRA
                        </>
                      )}
                    </motion.button>
                  )}

                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* RIGHT COLUMN: BCRA results and metrics */}
        <div className="lg:col-span-7">
          <AnimatePresence mode="wait">
            {!bcraResults ? (
              <motion.div 
                key="empty-bcra"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full border border-slate-200 dark:border-white/5 rounded-[2.5rem] bg-white dark:bg-slate-900/10 backdrop-blur-md p-10 flex flex-col justify-center items-center text-center text-slate-600 gap-4 min-h-[35rem] relative overflow-hidden"
              >
                {/* Visual grid watermark */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-500/5 via-transparent to-transparent opacity-50 dark:opacity-30" />
                
                <div className="size-16 rounded-full bg-slate-50 dark:bg-white/5 flex items-center justify-center border border-slate-200 dark:border-white/5 leading-none relative z-10 shrink-0 mb-4 animate-pulse">
                  <Scan className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                </div>
                
                <h3 className="text-xl font-black tracking-tight uppercase italic text-slate-800 dark:text-slate-300 relative z-10">Análisis Comercial BCRA</h3>
                <p className="text-xs font-semibold max-w-sm text-slate-500 dark:text-slate-400 leading-relaxed relative z-10">
                  Carga un cheque o selecciona una plantilla para calificar la cuenta del firmante directamente con las bases consolidadas del BCRA.
                </p>
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400/90 text-[10px] px-4 py-2.5 rounded-2xl w-full max-w-sm mt-4 font-semibold tracking-tight leading-relaxed">
                  ⚠️ NOTA: El sistema de contingencia de VIGIA garantiza el fallback simulado si los servidores del BCRA reportan congestión momentánea o control de IP.
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="bcra-loaded"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="flex flex-col gap-6"
              >
                {/* Risk score panel (Gaston Style Neural Widget) */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 p-6 rounded-[2.5rem] shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center gap-6">
                  
                  {/* Outer gradient glow */}
                  <div className="absolute -top-10 -right-10 size-40 bg-gradient-to-br from-indigo-500/10 to-transparent blur-3xl pointer-events-none" />

                  {/* Rating Circle indicator */}
                  <div className="relative size-32 shrink-0 flex items-center justify-center">
                    
                    {/* Nested circle meter */}
                    <div className={cn(
                      "size-28 rounded-full border-4 flex flex-col items-center justify-center text-center",
                      getWorstSituation(bcraResults) === 1 
                        ? "border-emerald-500 dark:border-emerald-500/50 bg-emerald-500/5" 
                        : getWorstSituation(bcraResults) === 2 
                        ? "border-yellow-500 dark:border-yellow-500/50 bg-yellow-500/5" 
                        : "border-rose-500 dark:border-rose-500/50 bg-rose-500/5"
                    )}>
                      <span className="text-[9px] font-black tracking-widest text-slate-400 uppercase">SITUACIÓN</span>
                      <span className="text-4xl font-extrabold italic leading-none mt-1">
                        {getWorstSituation(bcraResults)}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500 mt-1">
                        {getWorstSituation(bcraResults) === 1 ? 'Excelente' : getWorstSituation(bcraResults) === 2 ? 'Con Cuidado' : 'Alto Riesgo'}
                      </span>
                    </div>

                    {/* Spinner circle around */}
                    <svg className="absolute inset-0 size-full -rotate-90">
                      <circle 
                        cx="64" 
                        cy="64" 
                        r="58" 
                        fill="transparent" 
                        stroke="currentColor" 
                        strokeWidth="2"
                        className={cn(
                          "transition-all duration-1000 origin-center",
                          getWorstSituation(bcraResults) === 1 
                            ? "text-emerald-500/30" 
                            : getWorstSituation(bcraResults) === 2 
                            ? "text-yellow-500/30" 
                            : "text-rose-500/30"
                        )}
                        strokeDasharray={2 * Math.PI * 58}
                        strokeDashoffset={2 * Math.PI * 58 * (1 - (getWorstSituation(bcraResults) / 6))}
                      />
                    </svg>
                  </div>

                  {/* Header text rating */}
                  <div className="flex-1 flex flex-col gap-2 w-full text-center md:text-left">
                    <span className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-400 flex items-center justify-center md:justify-start gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-500" /> Score de Confianza Comercial
                    </span>
                    <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white uppercase italic tracking-tight">
                      {bcraResults.deudas?.denominacion || 'EMPRESA CONSULTADA'}
                    </h3>

                    {/* Specific alert description */}
                    <div className={cn(
                      "text-xs font-semibold p-3.5 border rounded-2xl flex items-start gap-2.5",
                      getWorstSituation(bcraResults) === 1 
                        ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-500/10" 
                        : getWorstSituation(bcraResults) === 2 
                        ? "bg-yellow-50 dark:bg-yellow-500/10 text-yellow-800 dark:text-yellow-400 border-yellow-200/50 dark:border-yellow-500/10" 
                        : "bg-rose-50 dark:bg-rose-500/10 text-rose-800 dark:text-rose-400 border-rose-200/50 dark:border-rose-500/10"
                    )}>
                      {getWorstSituation(bcraResults) === 1 ? (
                        <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-500" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-500" />
                      )}
                      <div>
                        <p className="font-bold uppercase tracking-tight text-xs text-left">
                          {getSituationDesc(getWorstSituation(bcraResults))}
                        </p>
                        <p className="text-[11px] opacity-90 mt-0.5 text-left leading-relaxed">
                          {getWorstSituation(bcraResults) === 1 
                            ? "La firma emisora posee un comportamiento impecable. No se registran morosidades ni cheques rechazados activos en el sistema financiero."
                            : getWorstSituation(bcraResults) === 2
                            ? "La firma posee demoras menores de financiamiento. Es apta para negociación pero se sugiere controlar los plazos de cobro diferidos."
                            : "Atención: La firma posee morosidad crítica y cheques impagos activos en el mercado. Riesgo elevado de incobrabilidad."}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {bcraResults.source !== "BCRA_REAL" && (
                  <div className="bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 p-5 rounded-[2rem] text-xs font-semibold flex items-start gap-3 shadow-inner">
                    <AlertCircle className="w-5 h-5 shrink-0 text-amber-500 mt-0.5" />
                    <div>
                      <p className="font-extrabold uppercase tracking-wider text-[10px]">Modo de Contingencia Activo: Cortafuegos del Servidor US</p>
                      <p className="opacity-95 mt-1 leading-relaxed text-slate-700 dark:text-slate-350">
                        Los cortafuegos del Banco Central (WAF de <span className="font-mono text-[11px] bg-slate-100 dark:bg-white/5 px-1 py-0.5 rounded">api.bcra.gob.ar</span>) bloquean automáticamente todo tráfico proveniente de servidores en la nube de Google situados en el exterior (EE.UU.). 
                        Para garantizar una experiencia fluida, **VIGIA ha activado la contingencia determinista basada en el CUIT extraído**. 
                        El código de integración con el BCRA está completo y listo para producción; al ejecutar el sistema de manera local en una red argentina, este widget recuperará datos reales instantáneamente y omitirá esta advertencia.
                      </p>
                      {bcraResults.errorReason && (
                        <p className="text-[10px] font-mono text-amber-500 mt-2 uppercase tracking-wide">
                          Detalle del Error Técnico en la Nube: {bcraResults.errorReason}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Grid details (Current debts + Rejected checks count) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Active debts table */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 p-6 rounded-[2rem] flex flex-col gap-4 backdrop-blur-md">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
                      <span>Préstamos y Deudas por Banco</span>
                      <span className="text-[9px] bg-indigo-50 dark:bg-white/5 px-2 py-0.5 rounded text-indigo-700 dark:text-indigo-400">Mes: April 2026</span>
                    </span>

                    {bcraResults.deudas?.periodos?.[0]?.entidades && bcraResults.deudas.periodos[0].entidades.length > 0 ? (
                      <div className="flex flex-col gap-3 max-h-[14rem] overflow-auto custom-scrollbar pr-1">
                        {bcraResults.deudas.periodos[0].entidades.map((ent, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                            <div className="overflow-hidden flex-1 mr-2">
                              <p className="text-xs font-black truncate text-slate-800 dark:text-slate-200 uppercase">{ent.entidad}</p>
                              <p className="text-[10px] font-mono text-slate-400 mt-0.5 uppercase">Atraso: {ent.diasAtraso ?? 0} días</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs font-black text-slate-900 dark:text-white">{formatCurrency(ent.importe * 1000)}</p>
                              <span className={cn(
                                "inline-block text-[9px] font-black tracking-widest px-2 py-0.5 rounded border mt-1",
                                getSituationColor(ent.situacion)
                              )}>
                                Sit {ent.situacion}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-8 text-center text-xs font-semibold text-slate-400 bg-slate-50 dark:bg-slate-950 rounded-2xl">
                        No registra deudas activas en bancos.
                      </div>
                    )}
                  </div>

                  {/* Rejected Check Totals */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 p-6 rounded-[2rem] flex flex-col justify-between gap-4 backdrop-blur-md">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block border-b border-slate-100 dark:border-white/5 pb-3">
                        Métricas de Cheques Rechazados
                      </span>
                      
                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl text-center">
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Total Cantidad</p>
                          <p className="text-3xl font-extrabold text-slate-800 dark:text-white italic mt-1">
                            {bcraResults.rechazados?.chequesRechazados?.length ?? 0}
                          </p>
                        </div>

                        <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl text-center">
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Monto Acumulado</p>
                          <p className="text-lg font-black text-slate-850 dark:text-slate-100 italic mt-3 overflow-hidden text-ellipsis whitespace-nowrap">
                            {formatCurrency(
                              bcraResults.rechazados?.chequesRechazados?.reduce((acc, c) => acc + c.monto, 0) ?? 0
                            )}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
                        <span>Rechazos Regularizados:</span>
                        <span className="text-emerald-500 font-extrabold uppercase tracking-widest">
                          {bcraResults.rechazados?.chequesRechazados?.filter(c => c.fechaPago || c.multa === 'Paga').length ?? 0} Levantados
                        </span>
                      </div>
                      <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-400 mt-2">
                        <span>Rechazos Activos (Impagos):</span>
                        <span className={cn(
                          "font-extrabold uppercase tracking-widest",
                          (bcraResults.rechazados?.chequesRechazados?.filter(c => !c.fechaPago && c.multa !== 'Paga').length ?? 0) > 0 
                            ? "text-red-500 animate-pulse" 
                            : "text-slate-400"
                        )}>
                          {bcraResults.rechazados?.chequesRechazados?.filter(c => !c.fechaPago && c.multa !== 'Paga').length ?? 0} Impagos
                        </span>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Block Rejected checks detailed table */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 p-6 rounded-[2.5rem] flex flex-col gap-4 backdrop-blur-md">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100 dark:border-white/5 pb-3 block">
                    Detalle de Cheques Rechazados (BCRA Registros)
                  </span>

                  {bcraResults.rechazados?.chequesRechazados && bcraResults.rechazados.chequesRechazados.length > 0 ? (
                    <div className="overflow-x-auto custom-scrollbar">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-100 dark:border-white/5">
                            <th className="py-3 px-2 text-[9px] font-black uppercase tracking-widest text-slate-400">Nro Cheque</th>
                            <th className="py-3 px-2 text-[9px] font-black uppercase tracking-widest text-slate-400">Fecha Rechazo</th>
                            <th className="py-3 px-2 text-[9px] font-black uppercase tracking-widest text-slate-400">Monto</th>
                            <th className="py-3 px-2 text-[9px] font-black uppercase tracking-widest text-slate-400">Causal</th>
                            <th className="py-3 px-2 text-[9px] font-black uppercase tracking-widest text-slate-400">Levantado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bcraResults.rechazados.chequesRechazados.map((item, idx) => (
                            <tr key={idx} className="border-b border-slate-50 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-xs font-bold text-slate-800 dark:text-slate-300">
                              <td className="py-3.5 px-2 font-mono">{item.nroCheque}</td>
                              <td className="py-3.5 px-2">{item.fechaRechazo}</td>
                              <td className="py-3.5 px-2 font-black">{formatCurrency(item.monto)}</td>
                              <td className="py-3.5 px-2">
                                <span className="text-[10px] font-extrabold uppercase text-slate-500 truncate max-w-[8rem] block" title={item.causal}>
                                  {item.causal}
                                </span>
                              </td>
                              <td className="py-3.5 px-2">
                                {item.fechaPago ? (
                                  <span className="inline-flex items-center gap-1.5 text-[9px] leading-none font-black uppercase tracking-widest text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-full">
                                    Sí ({item.fechaPago})
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 text-[9px] leading-none font-black uppercase tracking-widest text-red-650 bg-red-600/10 border border-red-600/20 px-2 py-1 rounded-full animate-pulse">
                                    No (Impago)
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="py-12 text-center flex flex-col items-center justify-center gap-2">
                      <div className="size-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                        <ShieldCheck className="w-6 h-6" />
                      </div>
                      <p className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight">¡Sin Cheques Rechazados!</p>
                      <p className="text-[11px] text-slate-400">Esta cuenta no posee cheques acumulados con rechazos vigentes ni multas pendientes.</p>
                    </div>
                  )}
                </div>

                {/* Footer and Source metadata */}
                <div className="flex justify-between items-center bg-slate-50 dark:bg-white/5 px-6 py-4 rounded-3xl border border-slate-200 dark:border-white/5">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                    Procesado por: VIGIA Core Node
                  </span>
                  <span className={cn(
                    "text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded",
                    bcraResults.source === "BCRA_REAL" 
                      ? "bg-emerald-500/10 text-emerald-500" 
                      : "bg-blue-500/10 text-blue-400"
                  )}>
                    Canal: {bcraResults.source === "BCRA_REAL" ? "Conexión Real BCRA API (v1.0)" : "Sincronización Simulado Cloud"}
                  </span>
                </div>

              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>

    </div>
  );
}
