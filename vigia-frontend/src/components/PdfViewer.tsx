import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Loader2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

// Initialize the worker with a stable mjs source from unpkg
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  url: string;
  className?: string;
}

export function PdfViewer({ url, className = "" }: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadPdf = async () => {
      setLoading(true);
      setError(null);
      try {
        const loadingTask = pdfjsLib.getDocument(url);
        const pdfDoc = await loadingTask.promise;
        if (isMounted) {
          setPdf(pdfDoc);
          setNumPages(pdfDoc.numPages);
          setPageNum(1);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Error loading PDF:', err);
        if (isMounted) {
          setError('No se pudo cargar el PDF. Intente abrirlo en una ventana nueva.');
          setLoading(false);
        }
      }
    };

    loadPdf();
    return () => { isMounted = false; };
  }, [url]);

 useEffect(() => {
  const renderPage = async () => {
    if (!pdf || !canvasRef.current) return;

    try {
      const page = await pdf.getPage(pageNum);
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;

      const viewport = page.getViewport({ scale });
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      // El error estaba aquí: ahora se espera el objeto 'canvas' y 'canvasContext'
      const renderContext = {
        canvasContext: context, // En algunas versiones sigue siendo necesario
        viewport: viewport,
        // Agregamos la referencia al elemento canvas directamente
        // canvas: canvas // Descomenta si tu versión específica pide 'canvas'
      };

      // Si el error persiste con la interfaz RenderParameters:
      await page.render({
        canvasContext: context,
        viewport: viewport,
      } as any).promise; // El 'as any' es el camino rápido, pero probá primero lo de abajo:

    } catch (err) {
      console.error('Error rendering page:', err);
    }
  };
  renderPage();
}, [pdf, pageNum, scale]);

  const changePage = (offset: number) => {
    setPageNum(prev => Math.min(Math.max(1, prev + offset), numPages));
  };

  const adjustScale = (delta: number) => {
    setScale(prev => Math.min(Math.max(0.5, prev + delta), 3));
  };

  return (
    <div className={`flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden ${className}`} id="pdf-viewer-container">
      {/* Toolbar */}
      <div className="px-4 py-2 bg-slate-950 border-b border-slate-800 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => changePage(-1)} 
            disabled={pageNum <= 1}
            className="p-1 text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest whitespace-nowrap">
            Pág {pageNum} / {numPages}
          </span>
          <button 
            onClick={() => changePage(1)} 
            disabled={pageNum >= numPages}
            className="p-1 text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => adjustScale(-0.25)}
              className="p-1 text-slate-400 hover:text-white transition-colors"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-[9px] font-mono text-slate-500 w-10 text-center">
              {Math.round(scale * 100)}%
            </span>
            <button 
              onClick={() => adjustScale(0.25)}
              className="p-1 text-slate-400 hover:text-white transition-colors"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
          
          <button 
            onClick={() => window.open(url, '_blank')}
            className="p-1.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition-all"
            title="Pantalla Completa"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Viewer Area */}
      <div className="flex-1 overflow-auto bg-slate-800 flex justify-center p-4 relative custom-scrollbar" ref={containerRef}>
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-sm z-20">
            <Loader2 className="w-8 h-8 text-red-500 animate-spin mb-4" />
            <p className="text-[10px] font-black text-white uppercase tracking-[0.2em] animate-pulse">Inyectando Documento Neural...</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center p-10 text-center max-w-sm">
            <div className="w-12 h-12 bg-rose-500/20 rounded-full flex items-center justify-center mb-4">
              <span className="text-rose-500 text-xl font-bold">!</span>
            </div>
            <p className="text-sm font-bold text-white mb-2 uppercase tracking-widest">{error}</p>
            <button 
              onClick={() => window.open(url, '_blank')}
              className="mt-4 px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg"
            >
              Cargar en Ventana Nueva
            </button>
          </div>
        )}

        <div className="shadow-2xl h-fit border border-slate-700/50">
          <canvas ref={canvasRef} className="max-w-full h-auto" />
        </div>
      </div>
    </div>
  );
}
