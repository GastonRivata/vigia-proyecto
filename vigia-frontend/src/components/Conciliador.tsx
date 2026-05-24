import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, 
  Check, 
  AlertTriangle, 
  Search, 
  Shuffle, 
  Layers, 
  Info, 
  CheckCircle2, 
  ArrowRight,
  HelpCircle,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { toast } from 'sonner';

interface OCBody {
  Id: string | number;
  IdTabla: string | number;
  FacturaCuerpoAfe: string | number;
  FacturaAfe: string | number;
  IdCuerpo: string | number;
  Articulo: string;
  ArticuloPrecio: string | number;
  Cantidad: number;
  Precio: number;
  ImporteGravado: number;
  Descripcion: string;
}

interface OCOrder {
  Id: string | number;
  IdTabla: string | number;
  Comprobante: string;
  NumeroComprobante: string;
  Cliente: string;
  Total: number;
  ImporteGravado: number;
  cuerpos: OCBody[];
}

interface InvoiceItem {
  codigo_articulo?: string;
  descripcion: string;
  cantidad: number;
  precio: number;
  alicuota_iva?: number;
  total: number;
  id_cuerpo_afe?: string | number;
  id_cuerpo_facafe?: string | number;
  articulo_precio?: string | number;
  alicuota_percepcion_dgr?: number;
}

interface ConciliadorProps {
  invoiceItems: InvoiceItem[];
  ocOrders: OCOrder[];
  onReconcile: (updatedItems: InvoiceItem[], selectedOC: OCOrder) => void;
  onClose: () => void;
  currency?: string;
}

export function Conciliador({ invoiceItems, ocOrders, onReconcile, onClose, currency = 'ARS' }: ConciliadorProps) {
  // Local state based on standard conciliador.js
  const [selectedOCIndex, setSelectedOCIndex] = useState<number>(0);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [selectedOCLines, setSelectedOCLines] = useState<Set<number>>(new Set());
  const [ocSearchTerm, setOcSearchTerm] = useState('');
  
  // Feature flags
  const [allowMultipleItemSelection, setAllowMultipleItemSelection] = useState(true);
  const [tolerance, setTolerance] = useState(0.001); // 0.1% tolerance
  
  const currentOC = ocOrders[selectedOCIndex] || null;

  // Formatting helpers
  const formatMoney = (val: number) => {
    return '$ ' + val.toLocaleString('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Check and evaluate error conditions for a row (Rules validation logicasValidacion.md)
  const getOCValidationErrors = (item: InvoiceItem, ocline?: OCBody): string[] => {
    const errors: string[] = [];
    if (!ocline) return errors;

    // Rule 2: quantity must not exceed pending OC quantity
    if (item.cantidad > ocline.Cantidad) {
      errors.push(`La cantidad de factura (${item.cantidad.toFixed(2)}) excede a lo pendiente en OC (${ocline.Cantidad.toFixed(2)})`);
    }

    // Rule 3: unit price match with 1% tolerance
    const priceDiff = Math.abs(item.precio - ocline.Precio) / ocline.Precio;
    if (priceDiff > 0.01) {
      errors.push(`Diferencia de precio unitario supera el 1% (Factura: ${formatMoney(item.precio)} vs OC: ${formatMoney(ocline.Precio)})`);
    }

    return errors;
  };

  // Selection management
  const toggleItemSelection = (index: number) => {
    const next = new Set(selectedItems);
    if (next.has(index)) {
      next.delete(index);
    } else {
      if (!allowMultipleItemSelection && next.size >= 1) {
        toast.warning('La multi-selección de ítems de factura está deshabilitada. Actívela en los módulos de arriba.', {
          duration: 3000
        });
        return;
      }
      // N x N Block
      if (selectedOCLines.size > 1 && next.size >= 1) {
        toast.warning('No se permite conciliar múltiples ítems contra múltiples líneas de la OC simultáneamente.', {
          description: 'Seleccione un solo ítem si desea dividirlo contra múltiples OCs.',
          duration: 4000
        });
        return;
      }
      next.add(index);
    }
    setSelectedItems(next);
  };

  const toggleOCLineSelection = (index: number) => {
    const next = new Set(selectedOCLines);
    if (next.has(index)) {
      next.delete(index);
    } else {
      // N x N Block
      if (selectedItems.size > 1 && next.size >= 1) {
        toast.warning('No se permite conciliar múltiples ítems contra múltiples líneas de la OC simultáneamente.', {
          description: 'Seleccione una sola línea de OC si desea agrupar múltiples ítems de la factura.',
          duration: 4000
        });
        return;
      }
      next.add(index);
    }
    setSelectedOCLines(next);
  };

  // Search logic for OC lines
  const filteredOCLines = currentOC?.cuerpos.filter(line => {
    if (!ocSearchTerm.trim()) return true;
    const term = ocSearchTerm.toLowerCase();
    return (
      line.Articulo?.toLowerCase().includes(term) ||
      line.Descripcion?.toLowerCase().includes(term) ||
      line.Precio.toString().includes(term)
    );
  }) || [];

  // Summary calculation
  const getTotals = () => {
    let invoiceSum = 0;
    let invoiceQty = 0;
    selectedItems.forEach(idx => {
      const item = invoiceItems[idx];
      if (item) {
        invoiceSum += item.total;
        invoiceQty += item.cantidad;
      }
    });

    let ocSum = 0;
    let ocQty = 0;
    selectedOCLines.forEach(idx => {
      const line = currentOC?.cuerpos[idx];
      if (line) {
        ocSum += line.Cantidad * line.Precio;
        ocQty += line.Cantidad;
      }
    });

    const isQtyMatch = Math.abs(invoiceQty - ocQty) < 0.0001;
    const diffTotal = Math.abs(ocSum - invoiceSum);
    const maxVal = Math.max(invoiceSum, ocSum);
    const isTotalMatch = maxVal > 0 ? (diffTotal <= maxVal * tolerance) : true;

    return {
      invoiceSum,
      invoiceQty,
      ocSum,
      ocQty,
      isQtyMatch,
      isTotalMatch,
      diffTotal
    };
  };

  const totals = getTotals();

  // Validate if reconciliation of selected cards is permited
  const canReconcile = (): boolean => {
    if (selectedItems.size === 0 || selectedOCLines.size === 0) return false;
    
    // N x N is strictly prohibited
    if (selectedItems.size > 1 && selectedOCLines.size > 1) return false;

    // Check quantities and tolerances
    if (selectedItems.size === 1 && selectedOCLines.size > 1) {
      // Demands exact total match to distribute
      return totals.isTotalMatch;
    }

    if (selectedItems.size > 1 && selectedOCLines.size === 1) {
      // Fuse items, total sum must match
      return totals.isTotalMatch;
    }

    // 1 to 1: Must be within 1% price tolerance and quantity must not exceed pending OC
    const firstItemIdx = Array.from(selectedItems)[0] as number;
    const firstOCIdx = Array.from(selectedOCLines)[0] as number;
    const singleItem = invoiceItems[firstItemIdx];
    const singleOCLine = currentOC?.cuerpos[firstOCIdx];
    if (singleItem && singleOCLine) {
      const validationErrs = getOCValidationErrors(singleItem, singleOCLine);
      return validationErrs.length === 0;
    }

    return false;
  };

  // Reconciliation processing
  const handleReconcile = () => {
    if (!canReconcile() || !currentOC) return;

    const updatedItems = [...invoiceItems];
    const selectedItemIndices = Array.from(selectedItems).map(Number).sort((a, b) => a - b);
    const selectedOCIndices = Array.from(selectedOCLines).map(Number);

    if (selectedItemIndices.length === 1 && selectedOCIndices.length >= 1) {
      // ==========================================
      // SPLIT CASE: 1 Invoice Item -> N OC Lines
      // ==========================================
      const targetIdx = selectedItemIndices[0];
      const baseItem = updatedItems[targetIdx];
      
      const reconciledSubItems: InvoiceItem[] = selectedOCIndices.map((ocLineIdx, index) => {
        const ocline = currentOC.cuerpos[ocLineIdx];
        const isFirst = index === 0;
        
        let subQty = ocline.Cantidad;
        let subPrice = ocline.Precio;
        let subAlicuota = baseItem.alicuota_iva || 21;
        let subTotal = subQty * subPrice;

        return {
          descripcion: isFirst ? baseItem.descripcion : `${baseItem.descripcion} (Partición OC: ${ocline.Articulo})`,
          cantidad: subQty,
          precio: subPrice,
          alicuota_iva: subAlicuota,
          total: subTotal,
          codigo_articulo: ocline.Articulo,
          id_cuerpo_afe: ocline.FacturaCuerpoAfe,
          id_cuerpo_facafe: ocline.FacturaAfe,
          articulo_precio: ocline.ArticuloPrecio
        };
      });

      // Splice back into items
      updatedItems.splice(targetIdx, 1, ...reconciledSubItems);
      
      toast.success('¡Partición de ítem realizada con éxito!', {
        description: `El ítem fue dividido en ${selectedOCIndices.length} líneas alineadas con el ERP.`,
        icon: <Shuffle className="w-5 h-5 text-indigo-500" />
      });

    } else if (selectedItemIndices.length > 1 && selectedOCIndices.length === 1) {
      // ==========================================
      // GROUP CASE: N Invoice Items -> 1 OC Line
      // ==========================================
      const ocline = currentOC.cuerpos[selectedOCIndices[0]];
      const firstTargetIdx = selectedItemIndices[0];
      
      // Calculate sums of grouped items
      let totalQty = 0;
      selectedItemIndices.forEach(idx => {
        totalQty += invoiceItems[idx].cantidad;
      });

      // Survivor item
      const survivorItem: InvoiceItem = {
        descripcion: `${invoiceItems[firstTargetIdx].descripcion} (Agrupado contra Art: ${ocline.Articulo})`,
        cantidad: totalQty,
        precio: ocline.Precio,
        alicuota_iva: invoiceItems[firstTargetIdx].alicuota_iva || 21,
        total: totalQty * ocline.Precio,
        codigo_articulo: ocline.Articulo,
        id_cuerpo_afe: ocline.FacturaCuerpoAfe,
        articulo_precio: ocline.ArticuloPrecio
      };

      // Delete items in reverse order
      const reversedIndices = [...selectedItemIndices].reverse();
      reversedIndices.forEach(idx => {
        updatedItems.splice(idx, 1);
      });

      // Insert survivor at original first position
      updatedItems.splice(firstTargetIdx, 0, survivorItem);

      toast.success('¡Agrupación de ítems realizada con éxito!', {
        description: `${selectedItemIndices.length} ítems de factura fueron agrupados bajo el artículo ERP.`,
        icon: <Layers className="w-5 h-5 text-emerald-500" />
      });
    } else {
      // ==========================================
      // SIMPLE 1x1 MATCH
      // ==========================================
      const targetIdx = selectedItemIndices[0];
      const ocline = currentOC.cuerpos[selectedOCIndices[0]];

      updatedItems[targetIdx] = {
        ...updatedItems[targetIdx],
        codigo_articulo: ocline.Articulo,
        id_cuerpo_afe: ocline.FacturaCuerpoAfe,
        articulo_precio: ocline.ArticuloPrecio,
        // Aligns quantity and price to strictly fulfill transaction controls
        precio: ocline.Precio,
        total: updatedItems[targetIdx].cantidad * ocline.Precio
      };

      toast.success('¡Ítem vinculado con éxito!', {
        description: `Vinculado al artículo ${ocline.Articulo} de la Orden ${currentOC.NumeroComprobante}.`
      });
    }

    // Call callback with updated items list and selected OC object
    onReconcile(updatedItems, currentOC);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      
      {/* Configuration Header controls (Tolerancia, Multi-selection) */}
      <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-4 items-center transition-colors">
        
        {/* OC Selector */}
        <div className="space-y-1">
          <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-black tracking-widest block">Orden de Compra ERP</label>
          <select 
            value={selectedOCIndex}
            onChange={(e) => {
              setSelectedOCIndex(parseInt(e.target.value));
              setSelectedOCLines(new Set()); // Reset OC side selections on switch
            }}
            className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 dark:text-slate-200 outline-none transition-all cursor-pointer"
          >
            {ocOrders.map((oc, idx) => (
              <option key={idx} value={idx}>
                {oc.NumeroComprobante} ({formatMoney(oc.Total)})
              </option>
            ))}
          </select>
        </div>

        {/* Multi selection toggle */}
        <div className="flex items-center gap-3">
          <input 
            type="checkbox"
            id="multi-select"
            checked={allowMultipleItemSelection}
            onChange={(e) => {
              setAllowMultipleItemSelection(e.target.checked);
              setSelectedItems(new Set()); // reset to prevent mismatch
            }}
            className="rounded text-red-600 focus:ring-red-500/20 size-4 border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 transition-colors"
          />
          <label htmlFor="multi-select" className="text-xs font-semibold text-slate-600 dark:text-slate-400 select-none cursor-pointer">
            Permitir selección múltiple (Agrupación de ítems)
          </label>
        </div>

        {/* Total match tolerance */}
        <div className="space-y-1">
          <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-black tracking-widest block">Tolerancia de diferencias entre comprobantes</label>
          <div className="flex items-center gap-3">
            <select
              value={tolerance}
              onChange={(e) => setTolerance(parseFloat(e.target.value))}
              className="bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-700 dark:text-slate-300 font-bold cursor-pointer"
            >
              <option value="0">0% (Exacto)</option>
              <option value="0.001">0.1% (Estándar)</option>
              <option value="0.005">0.5% (Tolerante)</option>
              <option value="0.01">1% (Máximo)</option>
            </select>
            <span className="text-[10px] text-slate-400 font-medium">Permite ajustar desvíos menores de redondeo.</span>
          </div>
        </div>

      </div>

      {/* Main split work area */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 overflow-hidden h-full min-h-0">
        
        {/* Left Side: Extracted Bill Items */}
        <div className="border-r border-slate-200 dark:border-slate-800 flex flex-col h-full overflow-hidden">
          <div className="p-4 bg-slate-100/50 dark:bg-slate-950/20 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
              Líneas Extraídas del Comprobante
            </span>
            <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-400">
              {invoiceItems.length} ítems
            </span>
          </div>

          <div className="flex-1 overflow-auto p-4 space-y-3 custom-scrollbar">
            {invoiceItems.map((item, idx) => {
              const isSelected = selectedItems.has(idx);
              const firstOCIdx = selectedOCLines.size === 1 ? Array.from(selectedOCLines)[0] as number : undefined;
              const singleOCLine = firstOCIdx !== undefined ? currentOC?.cuerpos[firstOCIdx] : undefined;
              const errors = getOCValidationErrors(item, singleOCLine);
              const hasErrors = errors.length > 0 && selectedItems.has(idx);

              return (
                <motion.div
                  key={idx}
                  whileHover={{ scale: 1.005 }}
                  onClick={() => toggleItemSelection(idx)}
                  className={cn(
                    "p-4 rounded-2xl border transition-all cursor-pointer flex gap-4 items-start relative overflow-hidden",
                    isSelected 
                      ? "bg-red-50/40 dark:bg-red-950/10 border-red-500/40 dark:border-red-500/20 shadow-sm"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                  )}
                >
                  <div className="pt-0.5">
                    <input 
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="rounded text-red-600 focus:ring-red-500/20 size-3.5 border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-900"
                    />
                  </div>
                  
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">
                        ÍTEM #{idx + 1} {item.codigo_articulo ? `(${item.codigo_articulo})` : ''}
                      </span>
                      {item.id_cuerpo_afe && (
                        <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Conciliado
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-snug">
                      {item.descripcion}
                    </p>
                    <div className="flex items-center gap-4 text-xs font-semibold text-slate-500 dark:text-slate-400 pt-1">
                      <span>Cant: <strong className="font-mono text-slate-700 dark:text-slate-300">{item.cantidad.toFixed(2)}</strong></span>
                      <span>Precio: <strong className="font-mono text-slate-700 dark:text-slate-300">{formatMoney(item.precio)}</strong></span>
                      <span>Total: <strong className="font-mono text-red-600 dark:text-red-400">{formatMoney(item.total)}</strong></span>
                    </div>

                    {/* Displays real-time errors in item matching CARD */}
                    <AnimatePresence>
                      {hasErrors && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="mt-3 p-3 rounded-xl bg-orange-500/5 dark:bg-orange-500/10 border border-orange-500/20 text-[10px] text-orange-600 dark:text-orange-400 space-y-1 flex items-start gap-2"
                        >
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-orange-500 mt-0.5" />
                          <div>
                            <p className="font-black uppercase tracking-widest">Advertencia de cuadre</p>
                            {errors.map((err, i) => (
                              <p key={i} className="font-medium mt-0.5 normal-case">{err}</p>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Right Side: OC Pending Lines */}
        <div className="flex flex-col h-full overflow-hidden bg-slate-50/50 dark:bg-slate-900/10">
          
          {/* Search bar & filter controls */}
          <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 space-y-3 transition-colors">
            <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest block">
              Líneas Disponibles de la OC {currentOC?.NumeroComprobante}
            </span>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 dark:text-slate-600 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                placeholder="Buscar por descripción, artículo o precio de OC..."
                value={ocSearchTerm}
                onChange={(e) => setOcSearchTerm(e.target.value)}
                className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-red-500/10 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
              />
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4 space-y-3 custom-scrollbar">
            {filteredOCLines.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 italic">
                <p>No se encontraron líneas para la búsqueda.</p>
              </div>
            ) : (
              filteredOCLines.map((line) => {
                // Find original index inside the currentOC
                const originalOCIdx = currentOC.cuerpos.findIndex(c => c.Id === line.Id);
                const isSelected = selectedOCLines.has(originalOCIdx);

                return (
                  <motion.div
                    key={line.Id}
                    whileHover={{ scale: 1.005 }}
                    onClick={() => toggleOCLineSelection(originalOCIdx)}
                    className={cn(
                      "p-4 rounded-2xl border transition-all cursor-pointer flex gap-4 items-start relative overflow-hidden",
                      isSelected 
                        ? "bg-indigo-50/40 dark:bg-indigo-950/10 border-indigo-500/40 dark:border-indigo-500/20 shadow-sm"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                    )}
                  >
                    <div className="pt-0.5">
                      <input 
                        type="checkbox"
                        checked={isSelected}
                        readOnly
                        className="rounded text-indigo-600 focus:ring-indigo-500/20 size-3.5 border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-900"
                      />
                    </div>
                    
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">
                          RENGLÓN DE OC: #{line.IdCuerpo || line.Id} ({line.Articulo})
                        </span>
                      </div>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-snug">
                        {line.Descripcion}
                      </p>
                      <div className="flex items-center gap-4 text-xs font-semibold text-slate-500 dark:text-slate-400 pt-1">
                        <span>Pendiente: <strong className="font-mono text-indigo-600 dark:text-indigo-400">{line.Cantidad.toFixed(2)}</strong></span>
                        <span>Precio: <strong className="font-mono text-slate-700 dark:text-slate-300">{formatMoney(line.Precio)}</strong></span>
                        <span>Total: <strong className="font-mono text-slate-700 dark:text-slate-300">{formatMoney(line.Cantidad * line.Precio)}</strong></span>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* Intelligence control match stats / Actions Footer */}
      <div className="p-6 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 transition-colors flex flex-col md:flex-row gap-6 justify-between items-center relative z-20 shadow-[0_-10px_30px_rgba(0,0,0,0.02)]">
        
        {/* Real-time match comparisons */}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="space-y-1">
            <span className="text-[9px] text-slate-400 uppercase font-black tracking-widest block">Selección de conciliador</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                <strong>{selectedItems.size}</strong> Factura
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                <strong>{selectedOCLines.size}</strong> OC
              </span>
            </div>
          </div>

          <div className="w-px h-8 bg-slate-200 dark:bg-slate-800 hidden md:block" />

          {selectedItems.size > 0 && selectedOCLines.size > 0 && (
            <div className="flex items-center gap-2">
              {/* Strategy Badge */}
              <span className={cn(
                "flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border",
                selectedItems.size === 1 && selectedOCLines.size === 1
                  ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200/50 dark:border-blue-500/20"
                  : selectedItems.size === 1 && selectedOCLines.size > 1
                  ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200/50 dark:border-indigo-500/20"
                  : "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-500/20"
              )}>
                {selectedItems.size === 1 && selectedOCLines.size === 1 && (
                  <>
                    <ArrowRight className="w-3 h-3 text-blue-500 font-bold" />
                    Mapeo: Directo (1:1)
                  </>
                )}
                {selectedItems.size === 1 && selectedOCLines.size > 1 && (
                  <>
                    <Shuffle className="w-3 h-3 text-indigo-500 animate-pulse" />
                    Mapeo: Partición (1:N)
                  </>
                )}
                {selectedItems.size > 1 && selectedOCLines.size === 1 && (
                  <>
                    <Layers className="w-3 h-3 text-emerald-500" />
                    Mapeo: Agrupación (N:1)
                  </>
                )}
              </span>

              {/* Qty Badge */}
              <span className={cn(
                "flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border",
                totals.isQtyMatch
                  ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-500/20"
                  : "bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200/50 dark:border-orange-500/20"
              )}>
                {totals.isQtyMatch ? <Check className="w-3 h-3 text-emerald-500" /> : <AlertTriangle className="w-3 h-3 text-orange-500" />}
                Cantidades {totals.isQtyMatch ? 'CONCORDANTES' : 'DESVIADAS'}
              </span>

              {/* Price / Subtotal check Badge */}
              <span className={cn(
                "flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border",
                totals.isTotalMatch
                  ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-500/20"
                  : "bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200/50 dark:border-orange-500/20"
              )}>
                {totals.isTotalMatch ? <Check className="w-3 h-3 text-emerald-500" /> : <AlertTriangle className="w-3 h-3 text-orange-500" />}
                Totales {totals.isTotalMatch ? 'CUADRAN PERFECTO' : `DESVIADOS (${formatMoney(totals.diffTotal)})`}
              </span>
            </div>
          )}
        </div>

        {/* Global Action buttons */}
        <div className="flex gap-3 w-full md:w-auto">
          <button
            onClick={() => {
              setSelectedItems(new Set());
              setSelectedOCLines(new Set());
              toast.info('Se limpiaron todas las selecciones.');
            }}
            className="flex-1 md:flex-none px-5 py-3 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
          >
            LIMPIAR
          </button>
          
          <button
            onClick={handleReconcile}
            disabled={!canReconcile()}
            className={cn(
              "flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg text-white",
              canReconcile()
                ? "bg-red-600 hover:bg-red-700 shadow-red-600/20 cursor-pointer"
                : "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed shadow-none"
            )}
          >
            {selectedItems.size === 1 && selectedOCLines.size > 1 ? (
              <>
                <Shuffle className="w-4 h-4 text-white" /> DIVIDR ÍTEM
              </>
            ) : selectedItems.size > 1 && selectedOCLines.size === 1 ? (
              <>
                <Layers className="w-4 h-4 text-white" /> AGRUPAR ÍTEMS
              </>
            ) : (
              <>
                <Check className="w-4 h-4" /> ENLAZAR COMPROBANTES
              </>
            )}
          </button>
        </div>

      </div>

    </div>
  );
}
