import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { motion, AnimatePresence } from 'motion/react';
import { Truck, AlertTriangle, Activity, Navigation, Wifi, ShieldCheck, MapPin, Search } from 'lucide-react';
import { cn } from '../lib/utils';

// Solución para imágenes de Leaflet en React (si llegaran a usarse marcadores default)
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

interface TruckData {
  id: string;
  choferNombre: string;
  lat: number;
  lng: number;
  velocidad: number;
  estado: 'en_ruta' | 'detenido' | 'alerta';
  ultimaActualizacion: Date;
}

const INITIAL_TRUCKS: TruckData[] = [
  { id: 'TRK-001', choferNombre: 'Carlos G.', lat: -31.4201, lng: -64.1888, velocidad: 65, estado: 'en_ruta', ultimaActualizacion: new Date() },
  { id: 'TRK-002', choferNombre: 'Miguel A.', lat: -32.9468, lng: -60.6393, velocidad: 0, estado: 'detenido', ultimaActualizacion: new Date() },
  { id: 'TRK-003', choferNombre: 'Roberto V.', lat: -31.4135, lng: -64.1810, velocidad: 85, estado: 'alerta', ultimaActualizacion: new Date() },
  { id: 'TRK-004', choferNombre: 'Javier P.', lat: -33.1235, lng: -64.3456, velocidad: 78, estado: 'en_ruta', ultimaActualizacion: new Date() },
  { id: 'TRK-005', choferNombre: 'Lucas C.', lat: -32.41, lng: -63.24, velocidad: 55, estado: 'en_ruta', ultimaActualizacion: new Date() },
];

export function LiveMapDashboard() {
  const [trucks, setTrucks] = useState<TruckData[]>(INITIAL_TRUCKS);
  const [alerts, setAlerts] = useState<{ id: string; msg: string; time: Date }[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTrucks((prev) => {
        let newAlerts: { id: string; msg: string; time: Date }[] = [];
        
        const nextTrucks = prev.map((truck) => {
          // Movimiento aleatorio
          const latDiff = (Math.random() - 0.5) * 0.005;
          const lngDiff = (Math.random() - 0.5) * 0.005;
          
          let newVel;
          if (truck.estado === 'detenido') {
             // 10% de probabilidad de arrancar de nuevo
             if (Math.random() > 0.9) {
                newVel = 40;
             } else {
                newVel = 0;
             }
          } else {
             newVel = Math.max(0, Math.min(110, truck.velocidad + (Math.random() - 0.5) * 15));
          }
          
          let newState = truck.estado;
          if (newVel === 0) {
              newState = 'detenido';
          } else {
            if (newVel > 90 && newState !== 'alerta') {
              newState = 'alerta';
              newAlerts.push({ id: Math.random().toString(), msg: `Exceso de vel. detectado: ${truck.id} (${Math.round(newVel)} km/h)`, time: new Date() });
            } else if (newVel <= 90) {
              newState = 'en_ruta';
            }
          }

          return {
            ...truck,
            lat: truck.lat + (newVel > 0 ? latDiff : 0),
            lng: truck.lng + (newVel > 0 ? lngDiff : 0),
            velocidad: Math.round(newVel),
            estado: newState,
            ultimaActualizacion: new Date()
          };
        });

        if (newAlerts.length > 0) {
          setAlerts(curr => [...newAlerts, ...curr].slice(0, 10)); // Mantener último 10 alertas
        }

        return nextTrucks;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const createIcon = (truck: TruckData) => {
    const isAlert = truck.estado === 'alerta';
    const isStopped = truck.estado === 'detenido';
    
    let bgColorClass = 'bg-emerald-500';
    if (isAlert) bgColorClass = 'bg-red-600 animate-[pulse_1s_ease-in-out_infinite]';
    if (isStopped) bgColorClass = 'bg-amber-500';
    
    const ringClass = isAlert ? '<div class="absolute inset-0 rounded-full bg-red-500 animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite] opacity-75"></div>' : '';

    const html = `
      <div class="relative flex items-center justify-center">
        ${ringClass}
        <div class="w-8 h-8 rounded-full border-2 border-white shadow-lg ${bgColorClass} flex items-center justify-center text-white relative z-10 transition-colors duration-300">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 18H3c-1.1 0-2-.9-2-2V8c0-1.1.9-2 2-2h3.5l3.5-3.5h7c1.1 0 2 .9 2 2v1"/><path d="M16 16v-2.5c0-1.4 1.1-2.5 2.5-2.5s2.5 1.1 2.5 2.5V16c0 1.1-.9 2-2 2h-1"/><path d="M8 18H5"/><path d="M5 18a2 2 0 1 0 4 0 2 2 0 1 0-4 0"/><path d="M16 18a2 2 0 1 0 4 0 2 2 0 1 0-4 0"/></svg>
        </div>
        <div class="absolute top-10 left-1/2 -translate-x-1/2 whitespace-nowrap px-2.5 py-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur border border-slate-200 dark:border-white/10 rounded-[0.4rem] shadow-sm text-[10px] font-black uppercase text-slate-800 dark:text-slate-200 tracking-wider">
          ${truck.choferNombre} 
        </div>
      </div>
    `;

    return L.divIcon({
      html,
      className: 'bg-transparent border-0',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -16]
    });
  };

  const activeCount = trucks.filter(t => t.estado === 'en_ruta').length;
  const alertCount = trucks.filter(t => t.estado === 'alerta').length;

  return (
    <div className="relative w-full h-[calc(100vh-140px)] md:h-[calc(100vh-100px)] rounded-[2.5rem] overflow-hidden border border-slate-200 dark:border-white/10 shadow-sm bg-slate-50 dark:bg-slate-900">
      
      {/* MAPA BASE */}
      <div className="absolute inset-0 z-0">
        <MapContainer 
          center={[-32.41, -63.24]} 
          zoom={7} 
          style={{ width: '100%', height: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            className="hue-rotate-15 dark:brightness-75 dark:invert dark:hue-rotate-180 transition-all duration-300"
          />
          {trucks.map(truck => (
            <Marker 
              key={truck.id} 
              position={[truck.lat, truck.lng]} 
              icon={createIcon(truck)}
            >
              <Popup className="custom-popup border-none">
                 <div className="text-center font-sans">
                   <h3 className="font-black text-slate-900 uppercase text-xs tracking-wider">{truck.id}</h3>
                   <p className="text-xs text-slate-500 font-bold mt-1">{truck.choferNombre}</p>
                   <div className={cn(
                       "mt-2 text-[10px] font-black tracking-widest uppercase p-1.5 rounded-lg border",
                       truck.estado === 'alerta' ? "bg-red-50 text-red-600 border-red-200" :
                       truck.estado === 'detenido' ? "bg-amber-50 text-amber-600 border-amber-200" :
                       "bg-emerald-50 text-emerald-600 border-emerald-200"
                   )}>
                     Velocidad: {truck.velocidad} km/h
                   </div>
                 </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* OVERLAY PANEL IZQUIERDO */}
      <div className="absolute bottom-4 left-4 right-4 md:bottom-6 md:top-6 md:left-6 md:right-auto md:w-80 z-10 flex flex-col gap-2 md:gap-4 pointer-events-none">
        
        {/* HEADER STATS */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white/90 dark:bg-slate-950/90 backdrop-blur-md border border-slate-200 dark:border-white/10 p-4 md:p-5 rounded-2xl md:rounded-3xl shadow-lg pointer-events-auto shrink-0"
        >
           <div className="flex items-center gap-3 md:gap-4 mb-3 md:mb-5">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 dark:from-white dark:to-slate-200 text-white dark:text-slate-900 flex items-center justify-center shadow-md">
                 <Navigation className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <div>
                 <h2 className="text-xs md:text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight italic">Centro de <span className="text-red-600">Control</span></h2>
                 <div className="flex items-center gap-1.5 text-[9px] md:text-[10px] uppercase font-bold tracking-widest text-emerald-500 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live Tracking
                 </div>
              </div>
           </div>

           <div className="grid grid-cols-2 gap-2 md:gap-3">
              <div className="bg-white dark:bg-white/5 rounded-xl md:rounded-2xl p-3 md:p-4 border border-slate-200 dark:border-white/5 shadow-sm">
                 <div className="text-[8px] md:text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><Truck className="w-3 h-3"/> Activos</div>
                 <div className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">{activeCount}</div>
              </div>
              <div className="bg-red-50 dark:bg-red-500/10 rounded-xl md:rounded-2xl p-3 md:p-4 border border-red-100 dark:border-red-500/20 shadow-sm relative overflow-hidden">
                 <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-red-500/10 to-transparent" />
                 <div className="text-[8px] md:text-[9px] text-red-600 dark:text-red-400 font-black uppercase tracking-widest mb-1.5 flex items-center gap-1.5 relative z-10"><AlertTriangle className="w-3 h-3"/> Alertas</div>
                 <div className="text-2xl md:text-3xl font-black text-red-600 dark:text-red-400 tracking-tight relative z-10">{alertCount}</div>
              </div>
           </div>
        </motion.div>

        {/* LISTA DE CAMIONES */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="hidden md:flex bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border border-slate-200 dark:border-white/10 p-5 rounded-3xl shadow-lg pointer-events-auto flex-1 flex-col min-h-0"
        >
          <div className="flex items-center justify-between mb-4 border-b border-slate-200 dark:border-white/10 pb-3">
             <h3 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
               <Activity className="w-4 h-4 text-slate-400" /> Unidades Monitoreadas
             </h3>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
             <AnimatePresence>
               {trucks.map(truck => (
                 <motion.div 
                   key={truck.id}
                   layout
                   initial={{ opacity: 0, y: 10 }}
                   animate={{ opacity: 1, y: 0 }}
                   className="p-3 bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm group hover:border-slate-300 dark:hover:border-white/20 transition-colors"
                 >
                    <div className="flex items-center justify-between mb-2">
                       <div className="flex items-center gap-2">
                          <div className="text-xs font-black text-slate-900 dark:text-white uppercase">{truck.id}</div>
                          <button
                             onClick={() => setTrucks(curr => curr.filter(t => t.id !== truck.id))}
                             className="opacity-0 group-hover:opacity-100 p-0.5 px-1.5 bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 rounded hover:bg-red-100 dark:hover:bg-red-500/20 transition-all font-black text-[8px] uppercase tracking-widest cursor-pointer"
                             title="Eliminar del mapa"
                          >
                             Eliminar
                          </button>
                       </div>
                       <div className={cn(
                         "text-[9px] uppercase font-black tracking-widest px-2 py-1 rounded-md",
                         truck.estado === 'en_ruta' ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" :
                         truck.estado === 'alerta' ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 animate-pulse border border-red-200 dark:border-red-500/20" :
                         "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
                       )}>
                          {truck.estado.replace('_', ' ')}
                       </div>
                    </div>
                    <div className="flex items-center justify-between">
                       <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5"><Truck className="w-3.5 h-3.5"/> {truck.choferNombre}</div>
                       <div className="text-[12px] font-black text-slate-900 dark:text-white font-mono bg-slate-50 dark:bg-white/5 px-2 py-0.5 rounded-lg border border-slate-100 dark:border-white/5">
                         {truck.velocidad} <span className="text-[9px] text-slate-400 font-sans tracking-tight">km/h</span>
                       </div>
                    </div>
                 </motion.div>
               ))}
             </AnimatePresence>
          </div>
        </motion.div>

      </div>

      {/* OVERLAY PANEL DERECHO: ALERTAS FEED */}
      <div className="hidden md:block absolute top-6 right-6 w-80 z-10 pointer-events-none">
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border border-slate-200 dark:border-white/10 p-5 rounded-3xl shadow-lg pointer-events-auto flex flex-col max-h-[60vh] overflow-hidden"
        >
          <div className="flex items-center justify-between mb-4 shrink-0 border-b border-slate-200 dark:border-white/10 pb-3">
             <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertTriangle className="w-4 h-4" />
                <h3 className="text-[10px] font-black uppercase tracking-widest">Alerta Temprana</h3>
             </div>
             <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-md">{alerts.length} Evtos</span>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-3">
             <AnimatePresence>
               {alerts.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-6 font-bold uppercase tracking-widest">Monitor despejado</p>
               )}
               {alerts.map(alert => (
                 <motion.div
                   key={alert.id}
                   initial={{ opacity: 0, height: 0, scale: 0.95 }}
                   animate={{ opacity: 1, height: 'auto', scale: 1 }}
                   exit={{ opacity: 0, height: 0 }}
                   className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-2xl shadow-sm relative overflow-hidden"
                 >
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500" />
                    <div className="flex flex-col gap-1.5 pl-2">
                      <span className="text-xs font-bold text-red-700 dark:text-red-300 leading-snug">{alert.msg}</span>
                      <div className="text-[9px] uppercase font-black tracking-widest text-red-600/70 dark:text-red-400/70 flex items-center gap-1.5">
                        <Activity className="w-3 h-3" /> {alert.time.toLocaleTimeString()}
                      </div>
                    </div>
                 </motion.div>
               ))}
             </AnimatePresence>
          </div>
        </motion.div>
      </div>

    </div>
  );
}
