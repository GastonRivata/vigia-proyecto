import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, Search, Filter, ChevronRight, CheckCircle2, AlertCircle, FileCheck, Brain, ArrowDownToLine, Trash2, Database, Receipt } from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '../lib/utils';

export function HistoryView({ history }: { history: any[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState<any | null>(null);

  const mockHistory = [
    {
      id: "h1x9a1",
      filename: "FAC-A-0004561.pdf",
      timestamp: new Date(Date.now() - 1000 * 60 * 5),
      status: "success",
      confidence: 98,
      data: {
        Comprobante: { Tipo: "Factura A", Numero: "0001-00004561" },
        Emisor: { RazonSocial: "AgroTech Insumos S.A." },
        Totales: { Total: 544500 }
      }
    },
    {
      id: "h2b8c3",
      filename: "REMITO-R-1234.png",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
      status: "success",
      confidence: 95,
      data: {
        Comprobante: { Tipo: "Remito R", Numero: "0002-00001234" },
        Emisor: { RazonSocial: "Transportes del Gran Sur SRL" },
        Totales: { Total: 0 }
      }
    },
    {
      id: "h5f9e9",
      filename: "FACTURA-LPG-001.pdf",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5),
      status: "warning",
      confidence: 82,
      data: {
        Comprobante: { Tipo: "Factura C", Numero: "0008-00000112" },
        Emisor: { RazonSocial: "Servicios Agrarios Independientes" },
        Totales: { Total: 12500.50 }
      }
    },
    {
      id: "h3d7e5",
      filename: "TICKET-FE-9988.pdf",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
      status: "success",
      confidence: 99,
      data: {
        Comprobante: { Tipo: "Tique Factura B", Numero: "0005-00009988" },
        Emisor: { RazonSocial: "Estación de Servicio Sol" },
        Totales: { Total: 30250 }
      }
    },
    {
      id: "h4e9f1",
      filename: "SCAN_2023_09_15_fac.jpg",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48),
      status: "error",
      confidence: 45,
      errorMsg: "No se pudo detectar un CUIT válido ni los totales del comprobante."
    }
  ];

  const displayHistory = [...history, ...mockHistory];

  const filteredHistory = displayHistory.filter(item => 
    item.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.data?.Emisor?.RazonSocial && item.data.Emisor.RazonSocial.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleExportExcel = () => {
    const exportData = filteredHistory.map(item => ({
       "ID Procesamiento": item.id,
       "Archivo": item.filename,
       "Fecha": item.timestamp instanceof Date ? item.timestamp.toLocaleDateString() : new Date(item.timestamp).toLocaleDateString(),
       "Hora": item.timestamp instanceof Date ? item.timestamp.toLocaleTimeString() : new Date(item.timestamp).toLocaleTimeString(),
       "Estado Neural": item.status === 'success' || !item.status ? 'EXITOSO' : item.status === 'warning' ? 'REVISIÓN' : 'FALLIDO',
       "Confianza IA (%)": item.confidence || 95,
       "Emisor": item.data?.Emisor?.RazonSocial || item.data?.cabecera?.razon_social_emisor || 'Desconocido',
       "Tipo Comprobante": item.data?.Comprobante?.Tipo || item.data?.cabecera?.tipo || 'Desconocido',
       "Número": item.data?.Comprobante?.Numero || item.data?.cabecera?.numero || '-',
       "Monto Total ($)": item.data?.Totales?.Total !== undefined ? item.data.Totales.Total : (item.data?.totales?.total || 0),
       "Mensaje Error": item.errorMsg || ""
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Historial_Procesamiento");
    XLSX.writeFile(workbook, `VIGIA_Historial_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="h-full flex flex-col pt-6 pb-6 px-4 md:px-8 max-w-7xl mx-auto w-full relative">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Database className="w-6 h-6 text-red-650" />
            Historial Lotes
          </h2>
          <p className="text-sm text-slate-500 mt-1 font-medium border-l-2 border-red-500/30 pl-2 ml-1">Visualización de los comprobantes y lotes procesados recientemente por la IA.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
             onClick={handleExportExcel}
             className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-black shadow-lg hover:shadow-xl transition-all uppercase tracking-widest outline-none"
          >
            <ArrowDownToLine className="w-4 h-4" />
            Exportar Excel
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-3 mb-6 bg-white dark:bg-slate-900/50 p-2.5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm backdrop-blur-xl">
        <div className="relative flex-1 w-full">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar por nombre de archivo o razón social de emisor..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200/50 dark:border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-500/50 dark:text-white transition-all shadow-inner"
          />
        </div>
        <button className="flex items-center justify-center w-full sm:w-auto gap-2 px-5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/5 rounded-xl text-xs uppercase tracking-widest font-black text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors outline-none">
          <Filter className="w-4 h-4" />
          Filtros
        </button>
      </div>

      {/* Table grid layout for better scaling */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
         {/* Main Table Area */}
         <div className={cn("bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-[2rem] shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden flex flex-col transition-all duration-500", selectedItem ? "lg:col-span-2 hidden lg:flex" : "lg:col-span-3")}>
            <div className="overflow-x-auto overflow-y-auto custom-scrollbar flex-1">
            <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur border-b border-slate-200 dark:border-white/10">
                    <th className="px-6 py-4 text-[10px] uppercase font-black tracking-widest text-slate-500">Documento / Remito</th>
                    <th className="px-6 py-4 text-[10px] uppercase font-black tracking-widest text-slate-500 hidden sm:table-cell">Emisor Extraído</th>
                    <th className="px-6 py-4 text-[10px] uppercase font-black tracking-widest text-slate-500 text-right hidden md:table-cell">Monto</th>
                    <th className="px-6 py-4 text-[10px] uppercase font-black tracking-widest text-slate-500 text-center">Precisión Neural</th>
                    <th className="px-6 py-4 text-[10px] uppercase font-black tracking-widest text-slate-500 text-right hidden sm:table-cell">Procesamiento</th>
                    <th className="px-6 py-4"></th>
                </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {filteredHistory.map((item, idx) => {
                    const emisor = item.data?.Emisor?.RazonSocial || item.data?.cabecera?.razon_social_emisor;
                    const tipo = item.data?.Comprobante?.Tipo || item.data?.cabecera?.tipo;
                    const total = item.data?.Totales?.Total !== undefined ? item.data.Totales.Total : item.data?.totales?.total;

                    return (
                    <motion.tr 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    key={item.id} 
                    onClick={() => setSelectedItem(item)}
                    className={cn(
                        "hover:bg-red-50/50 dark:hover:bg-red-500/5 transition-colors group cursor-pointer",
                        selectedItem?.id === item.id ? "bg-red-50 dark:bg-white/5 border-l-2 border-red-500" : "border-l-2 border-transparent"
                    )}
                    >
                    <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                        <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-transform duration-300 group-hover:scale-110",
                            item.status === 'success' || !item.status ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400" :
                            item.status === 'warning' ? "bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20 text-amber-600 dark:text-amber-400" :
                            "bg-rose-50 dark:bg-rose-500/10 border-rose-100 dark:border-rose-500/20 text-rose-600 dark:text-rose-400" 
                        )}>
                            {item.status === 'success' || !item.status ? <FileCheck className="w-5 h-5" /> : 
                            item.status === 'warning' ? <AlertCircle className="w-5 h-5" /> :
                            <FileText className="w-5 h-5" />}
                        </div>
                        <div className="max-w-[150px] md:max-w-[200px] truncate">
                            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{item.filename}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="inline-flex px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[9px] font-bold uppercase rounded">
                                    {tipo || 'Desc.'}
                                </span>
                                <span className="text-[10px] text-slate-500 uppercase tracking-widest">{item.id}</span>
                            </div>
                        </div>
                        </div>
                    </td>
                    <td className="px-6 py-4 hidden sm:table-cell">
                        {emisor ? (
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{emisor}</span>
                        ) : (
                        <span className="text-sm text-slate-400 italic">No extraído</span>
                        )}
                    </td>
                    <td className="px-6 py-4 text-right hidden md:table-cell">
                        <span className="text-sm font-black text-slate-900 dark:text-white italic">
                        {total !== undefined ? 
                            new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(total) : 
                            '-'}
                        </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                        {item.status === 'error' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 text-[10px] font-black uppercase tracking-widest">
                            <AlertCircle className="w-3 h-3" />
                            Fallido
                        </span>
                        ) : (
                        <div className="flex flex-col items-center gap-1">
                            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 px-2 py-1 rounded-lg border border-slate-200/50 dark:border-white/5">
                            <Brain className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                            <span className={cn(
                                "text-[11px] font-black",
                                (item.confidence || 95) > 90 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                            )}>
                                {item.confidence || 95}%
                            </span>
                            </div>
                        </div>
                        )}
                    </td>
                    <td className="px-6 py-4 text-right hidden sm:table-cell">
                        <p className="text-sm text-slate-700 dark:text-slate-300 font-bold">
                        {item.timestamp instanceof Date ? item.timestamp.toLocaleDateString() : new Date(item.timestamp).toLocaleDateString()}
                        </p>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">
                        {item.timestamp instanceof Date ? item.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors">
                            <ChevronRight className="w-4 h-4" />
                        </button>
                        </div>
                    </td>
                    </motion.tr>
                    );
                })}

                {filteredHistory.length === 0 && (
                    <tr>
                    <td colSpan={7} className="px-6 py-16 text-center text-slate-500">
                        <div className="w-20 h-20 bg-slate-100 dark:bg-white/5 rounded-[2rem] flex items-center justify-center mx-auto mb-4 rotate-12">
                        <Search className="w-8 h-8 opacity-40 -rotate-12 text-slate-400" />
                        </div>
                        <p className="text-lg font-black tracking-tight text-slate-900 dark:text-white mb-2">Sin coincidencias neurales</p>
                        <p className="text-sm">No se encontraron comprobantes para esta búsqueda en el historial.</p>
                    </td>
                    </tr>
                )}
                </tbody>
            </table>
            </div>
         </div>

         {/* Side Details Panel */}
         <AnimatePresence>
            {selectedItem && (
               <motion.div 
                 initial={{ opacity: 0, x: 20 }}
                 animate={{ opacity: 1, x: 0 }}
                 exit={{ opacity: 0, x: 20, transition: { duration: 0.2 } }}
                 className="fixed inset-0 lg:static z-50 lg:z-auto bg-slate-900/40 lg:bg-transparent backdrop-blur-sm lg:backdrop-blur-none flex justify-end lg:block overflow-hidden"
                 onClick={() => setSelectedItem(null)}
               >
                 <div 
                   className="w-[90%] max-w-sm lg:w-full h-full bg-white dark:bg-slate-900 lg:border border-slate-200 dark:border-white/10 lg:rounded-[2rem] shadow-2xl lg:shadow-none overflow-y-auto custom-scrollbar p-6"
                   onClick={(e) => e.stopPropagation()}
                 >
                    <div className="flex items-center justify-between mb-6">
                       <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Detalle de Extracción</h3>
                       <button 
                         onClick={() => setSelectedItem(null)}
                         className="p-2 bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-full lg:hidden"
                       >
                         <ChevronRight className="w-4 h-4" />
                       </button>
                    </div>

                    <div className="flex items-start gap-4 mb-8">
                       <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border my-auto",
                            selectedItem.status === 'success' || !selectedItem.status ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400" :
                            selectedItem.status === 'warning' ? "bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20 text-amber-600 dark:text-amber-400" :
                            "bg-rose-50 dark:bg-rose-500/10 border-rose-100 dark:border-rose-500/20 text-rose-600 dark:text-rose-400" 
                        )}>
                            {selectedItem.status === 'success' || !selectedItem.status ? <FileCheck className="w-6 h-6" /> : 
                            selectedItem.status === 'warning' ? <AlertCircle className="w-6 h-6" /> :
                            <FileText className="w-6 h-6" />}
                        </div>
                        <div className="overflow-hidden w-[calc(100%-4rem)]">
                           <h4 className="text-base font-bold text-slate-900 dark:text-white truncate" title={selectedItem.filename}>{selectedItem.filename}</h4>
                           <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-1 block">ID: {selectedItem.id}</span>
                        </div>
                    </div>

                    {selectedItem.errorMsg ? (
                        <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 p-4 rounded-2xl">
                           <p className="text-sm text-rose-600 dark:text-rose-400 font-bold">{selectedItem.errorMsg}</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                           <div>
                              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Métricas IA</p>
                              <div className="grid grid-cols-2 gap-3">
                                 <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-2xl border border-slate-100 dark:border-white/5">
                                    <p className="text-xs text-slate-500 mb-1">Confianza</p>
                                    <p className="text-lg font-black text-slate-900 dark:text-white italic">{selectedItem.confidence || 95}%</p>
                                 </div>
                                 <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-2xl border border-slate-100 dark:border-white/5">
                                    <p className="text-xs text-slate-500 mb-1">Status</p>
                                    <p className={cn(
                                       "text-xs font-black uppercase tracking-widest mt-1",
                                       selectedItem.status === 'warning' ? "text-amber-500" : "text-emerald-500"
                                    )}>
                                       {selectedItem.status === 'warning' ? "Revisión" : "Óptimo"}
                                    </p>
                                 </div>
                              </div>
                           </div>

                           <div>
                              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Datos Extraídos</p>
                              <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-100 dark:border-white/5 space-y-4">
                                 <div>
                                    <p className="text-[10px] uppercase font-bold text-slate-500">Emisor</p>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate" title={selectedItem.data?.Emisor?.RazonSocial || selectedItem.data?.cabecera?.razon_social_emisor || 'Desconocido'}>
                                      {selectedItem.data?.Emisor?.RazonSocial || selectedItem.data?.cabecera?.razon_social_emisor || 'Desconocido'}
                                    </p>
                                 </div>
                                 <div className="grid grid-cols-2 gap-4">
                                    <div>
                                       <p className="text-[10px] uppercase font-bold text-slate-500">Tipo Cmp.</p>
                                       <p className="text-sm font-bold text-slate-900 dark:text-white">{selectedItem.data?.Comprobante?.Tipo || selectedItem.data?.cabecera?.tipo || '-'}</p>
                                    </div>
                                    <div className="truncate">
                                       <p className="text-[10px] uppercase font-bold text-slate-500">Número</p>
                                       <p className="text-sm font-bold text-slate-900 dark:text-white truncate" title={selectedItem.data?.Comprobante?.Numero || selectedItem.data?.cabecera?.numero || '-'}>
                                         {selectedItem.data?.Comprobante?.Numero || selectedItem.data?.cabecera?.numero || '-'}
                                       </p>
                                    </div>
                                 </div>
                                 <div className="border-t border-slate-200 dark:border-white/10 pt-4 mt-2">
                                    <p className="text-[10px] uppercase font-bold text-slate-500">Monto Total</p>
                                    <p className="text-2xl font-black text-slate-900 dark:text-white italic">
                                       {(selectedItem.data?.Totales?.Total !== undefined || selectedItem.data?.totales?.total !== undefined) ? 
                                       new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(selectedItem.data?.Totales?.Total ?? (selectedItem.data?.totales?.total || 0)) : 
                                       '-'}
                                    </p>
                                 </div>
                              </div>
                           </div>
                           
                           <button className="w-full flex items-center justify-center gap-2 py-3 bg-slate-900 text-white dark:bg-white dark:text-slate-900 border border-slate-950 dark:border-white rounded-xl text-xs font-black uppercase tracking-widest hover:scale-[1.02] transition-transform">
                              <Receipt className="w-4 h-4" />
                              Ver JSON Original
                           </button>
                        </div>
                    )}
                 </div>
               </motion.div>
            )}
         </AnimatePresence>
      </div>

    </div>
  );
}
