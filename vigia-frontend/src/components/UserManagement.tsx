import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, UserCheck, ShieldCheck, Mail, Calendar, UserX, UserPlus, FileText, Settings, Loader2 } from 'lucide-react';
import { collection, query, onSnapshot, doc, updateDoc, deleteField } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { notify } from '../lib/notifications';
import { useTenant } from '../lib/TenantContext';
import { cn } from '../lib/utils';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'supervisor' | 'operator' | 'driver';
  status: 'active' | 'pending' | 'suspended';
  createdAt: string;
  orgId?: string;
}

export function UserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const { tenants } = useTenant();

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));
      setUsers(usersData);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching users:', err);
      setLoading(false);
      notify({ type: 'error', title: 'Error', message: 'No se pudieron cargar los usuarios.' });
    });

    return () => unsubscribe();
  }, []);

  const updateUser = async (userId: string, updates: Partial<UserProfile>) => {
    try {
      await updateDoc(doc(db, 'users', userId), updates);
      notify({ type: 'success', title: 'Usuario Actualizado', message: 'Los permisos han sido modificados.' });
    } catch (err) {
      console.error(err);
      notify({ type: 'error', title: 'Error', message: 'No se pudo actualizar el usuario.' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
      </div>
    );
  }

  const pendingUsers = users.filter(u => u.status === 'pending');
  const activeUsers = users.filter(u => u.status !== 'pending');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl flex items-center justify-center shadow-lg">
          <Users className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Control de Accesos</h2>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Gestión de identidades de la red</p>
        </div>
      </div>

      {pendingUsers.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-[2rem] p-6 shadow-sm">
          <h3 className="text-xs font-black uppercase tracking-widest text-amber-700 dark:text-amber-500 mb-4 flex items-center gap-2">
            <UserPlus className="w-4 h-4" /> Solicitudes Pendientes ({pendingUsers.length})
          </h3>
          <div className="space-y-3">
            {pendingUsers.map(user => (
              <div key={user.id} className="flex flex-col md:flex-row md:items-center justify-between bg-white dark:bg-slate-900/50 p-4 rounded-2xl border border-amber-100 dark:border-amber-500/10 gap-4">
                <div>
                   <div className="flex items-center gap-2">
                     <span className="font-bold text-slate-900 dark:text-white">{user.name || user.email.split('@')[0]}</span>
                     <span className="text-[10px] bg-slate-100 dark:bg-white/5 text-slate-500 px-2 py-0.5 rounded-md font-black uppercase tracking-widest">{user.email}</span>
                   </div>
                   <div className="text-xs font-semibold text-slate-500 mt-1 uppercase tracking-wider flex items-center gap-1.5">
                     Rol solicitado: <span className={cn("font-black", user.role === 'admin' ? "text-red-500" : user.role === 'supervisor' ? "text-purple-500" : user.role === 'driver' ? "text-emerald-500" : "text-blue-500")}>{user.role}</span>
                   </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => updateUser(user.id, { status: 'active' })}
                    className="px-4 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-1.5"
                  >
                    <UserCheck className="w-3.5 h-3.5" /> Aprobar
                  </button>
                  <button 
                    onClick={() => updateUser(user.id, { status: 'suspended' })}
                    className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-1.5"
                  >
                    <UserX className="w-3.5 h-3.5" /> Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-[2rem] shadow-sm overflow-hidden p-2">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-white/5">
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Usuario</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Rol</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Organización</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Estado</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-white/5">
              {activeUsers.map(user => (
                <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors group">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center font-black text-xs">
                        {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-slate-900 dark:text-white leading-tight">{user.name || 'Sin Nombre'}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <select 
                      value={user.role} 
                      onChange={(e) => updateUser(user.id, { role: e.target.value as any })}
                      className="bg-transparent text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
                    >
                      <option value="operator">Operador</option>
                      <option value="driver">Chofer</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </td>
                  <td className="p-4">
                    <select 
                      value={user.orgId || ''} 
                      onChange={(e) => updateUser(user.id, { orgId: e.target.value === '' ? deleteField() as any : e.target.value })}
                      className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-300 max-w-[150px] truncate outline-none cursor-pointer"
                    >
                      <option value="">Global / Todas</option>
                      {tenants.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-4">
                    <button 
                      onClick={() => updateUser(user.id, { status: user.status === 'active' ? 'suspended' : 'active' })}
                      className={cn(
                        "px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest transition-colors cursor-pointer border",
                        user.status === 'active' ? "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400 hover:bg-red-50 hover:text-red-600 hover:border-red-200" :
                        "bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200"
                      )}
                      title="Click para cambiar estado"
                    >
                      {user.status}
                    </button>
                  </td>
                  <td className="p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex gap-2">
                       <button className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                         <Settings className="w-4 h-4" />
                       </button>
                    </div>
                  </td>
                </tr>
              ))}
              {activeUsers.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500 text-sm font-semibold">
                    No hay usuarios activos.
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
