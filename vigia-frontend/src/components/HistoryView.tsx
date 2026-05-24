import { useState } from 'react';
import { motion } from 'motion/react';
import { FileText, Search, Filter, ChevronRight, CheckCircle2, AlertCircle, FileCheck, Brain, ArrowDownToLine, Trash2, Database } from 'lucide-react';
import { cn } from '../lib/utils';

export function HistoryView({ history }: { history: any[] }) {
  const [searchTerm, setSearchTerm] = useState('');

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

  return (
    <div className="h-full flex flex-col pt-6 pb-6 px-4 md:px-8 max-w-7xl mx-auto w-full">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Database className="w-6 h-6 text-red-500" />
            Historial de Procesamiento
          </h2>
          <p className="text-sm text-slate-500 mt-1 font-medium">Visualización de los comprobantes procesados recientemente.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            <ArrowDownToLine className="w-4 h-4" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-3 mb-6 bg-white dark:bg-slate-900/50 p-3 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar por archivo o emisor..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/5 rounded-xl py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 dark:text-white"
          />
        </div>
        <button className="flex items-center justify-center w-full sm:w-auto gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/5 rounded-xl text-sm font-semibold hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
          <Filter className="w-4 h-4" />
          Filtros
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-white/10">
                <th className="px-6 py-4 text-[10px] uppercase font-black tracking-widest text-slate-500">Documento</th>
                <th className="px-6 py-4 text-[10px] uppercase font-black tracking-widest text-slate-500">Emisor</th>
                <th className="px-6 py-4 text-[10px] uppercase font-black tracking-widest text-slate-500">Tipo</th>
                <th className="px-6 py-4 text-[10px] uppercase font-black tracking-widest text-slate-500 text-right">Monto</th>
                <th className="px-6 py-4 text-[10px] uppercase font-black tracking-widest text-slate-500 text-center">Estado AI</th>
                <th className="px-6 py-4 text-[10px] uppercase font-black tracking-widest text-slate-500 text-right">Fecha</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {filteredHistory.map((item, idx) => (
                <motion.tr 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  key={item.id} 
                  className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group cursor-pointer"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border",
                        item.status === 'success' ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400" :
                        item.status === 'warning' ? "bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20 text-amber-600 dark:text-amber-400" :
                        item.status === 'error' ? "bg-rose-50 dark:bg-rose-500/10 border-rose-100 dark:border-rose-500/20 text-rose-600 dark:text-rose-400" :
                        "bg-red-50 dark:bg-red-500/10 border-red-100 dark:border-red-500/20 text-red-600 dark:text-red-400" // Custom documents processed locally
                      )}>
                        {item.status === 'success' || !item.status ? <FileCheck className="w-5 h-5" /> : 
                         item.status === 'warning' ? <AlertCircle className="w-5 h-5" /> :
                         <FileText className="w-5 h-5" />}
                      </div>
                      <div className="max-w-[200px] truncate">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{item.filename}</p>
                        <p className="text-xs text-slate-500 uppercase tracking-wider">{item.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {item.data?.Emisor?.RazonSocial ? (
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{item.data.Emisor.RazonSocial}</span>
                    ) : (
                      <span className="text-sm text-slate-400 italic">Desconocido</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold uppercase rounded-md">
                      {item.data?.Comprobante?.Tipo || 'Desconocido'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm font-black text-slate-900 dark:text-white">
                      {item.data?.Totales?.Total !== undefined ? 
                        new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(item.data.Totales.Total) : 
                        '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {item.status === 'error' ? (
                       <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold">
                         <AlertCircle className="w-3 h-3" />
                         Fallido
                       </span>
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-1.5">
                          <Brain className="w-3.5 h-3.5 text-red-500" />
                          <span className={cn(
                            "text-xs font-bold",
                            (item.confidence || 95) > 90 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                          )}>
                            {item.confidence || 95}%
                          </span>
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                      {item.timestamp instanceof Date ? item.timestamp.toLocaleDateString() : new Date(item.timestamp).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-slate-400 uppercase tracking-widest">
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
              ))}

              {filteredHistory.length === 0 && (
                <tr>
                   <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                     <div className="w-16 h-16 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                       <Search className="w-6 h-6 opacity-40" />
                     </div>
                     <p className="text-sm font-bold text-slate-900 dark:text-white">No se encontraron resultados</p>
                     <p className="text-xs mt-1">Prueba con otros términos de búsqueda.</p>
                   </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
