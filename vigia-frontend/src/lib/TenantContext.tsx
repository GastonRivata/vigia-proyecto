import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { db, auth } from './firebase';
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc, increment, Timestamp } from 'firebase/firestore';

export interface TenantConfig {
  id: string;
  name: string;
  modules?: {
    extractorActivo?: boolean;
    chequesActivo?: boolean;
    cintelinkActivo?: boolean;
    williamsActivo?: boolean;
    compComprasActivo?: boolean;
    compServiciosActivo?: boolean;
    compRetencionesActivo?: boolean;
  };
  sqlConfig?: {
    server: string;
    port?: string;
    database: string;
    user: string;
    password?: string;
    instanceName?: string;
    erpHost?: string;
    endpointCompras?: string;
    endpointServicios?: string;
    customEndpoints?: { id: string; name: string; url: string; type: 'compras' | 'servicios' }[];
  };
  billing?: {
    ratePerDocument: number;
    status: 'active' | 'suspended' | 'trial';
  };
  usage?: {
    totalExtractions: number;
    currentMonthExtractions: number;
    lastExtractionAt?: any;
  };
  settings?: {
    maxMonthlyExtractions?: number;
    strictItemCheck?: boolean;
    notificationEmail?: string;
  };
}

interface TenantContextType {
  activeTenant: TenantConfig | null;
  setActiveTenant: (tenant: TenantConfig | null) => void;
  tenants: TenantConfig[];
  loading: boolean;
  isAdmin: boolean;
  userRole: 'admin' | 'supervisor' | 'operator' | 'driver' | null;
  userStatus: 'active' | 'pending' | 'suspended' | null;
  incrementTenantUsage: (tenantId: string) => Promise<void>;
  updateTenantSqlConfig: (tenantId: string, sqlConfig: any) => Promise<void>;
  updateTenantModules: (tenantId: string, modules: any) => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const [rawTenants, setRawTenants] = useState<TenantConfig[]>([]);
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState<'admin' | 'supervisor' | 'operator' | 'driver' | null>(null);
  const [userStatus, setUserStatus] = useState<'active' | 'pending' | 'suspended' | null>(null);

  // Local storage cache for offline/instant increment tracking
  const [localExtractions, setLocalExtractions] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('local_extractions');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  // Local storage cache for client-specific SQL / endpoints overriding
  const [localSqlConfigs, setLocalSqlConfigs] = useState<Record<string, any>>(() => {
    try {
      const saved = localStorage.getItem('local_sql_configs');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const [localModules, setLocalModules] = useState<Record<string, any>>(() => {
    try {
      const saved = localStorage.getItem('local_modules');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem('local_extractions', JSON.stringify(localExtractions));
  }, [localExtractions]);

  useEffect(() => {
    localStorage.setItem('local_sql_configs', JSON.stringify(localSqlConfigs));
  }, [localSqlConfigs]);

  useEffect(() => {
    localStorage.setItem('local_modules', JSON.stringify(localModules));
  }, [localModules]);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      if (user) {
        // 1. Verificar rol y orgId del usuario
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.data();
        const userOrgId = userData?.orgId;
        const userRoleDb = userData?.role || (user.email === 'rivatagaston@gmail.com' ? 'supervisor' : 'operator');
        const userStatusDb = userData?.status || (user.email === 'rivatagaston@gmail.com' ? 'active' : 'pending');
        
        setUserRole(userRoleDb);
        setUserStatus(userStatusDb);
        setIsAdmin((userRoleDb === 'admin' || userRoleDb === 'supervisor') && !userOrgId);

        // 2. Cargar organizaciones permitidas
        let unsubscribeOrgs: () => void;

        if ((userRoleDb === 'admin' || userRoleDb === 'supervisor') && !userOrgId) {
          // SuperAdmin ve todo
          const q = query(collection(db, 'organizations'));
          unsubscribeOrgs = onSnapshot(q, (snapshot) => {
            const orgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TenantConfig));
            setRawTenants(orgs);
            if (orgs.length > 0) {
              setActiveTenantId(prevId => {
                if (prevId && orgs.find(o => o.id === prevId)) return prevId;
                return orgs[0].id;
              });
            } else {
              setActiveTenantId(null);
            }
            setLoading(false);
          }, (err) => {
            console.error("Error from organizations snapshot list (SuperAdmin):", err);
            setLoading(false);
          });
        } else if (userOrgId) {
          // Miembro de org solo ve la suya
          const docRef = doc(db, 'organizations', userOrgId);
          unsubscribeOrgs = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
              const org = { id: docSnap.id, ...docSnap.data() } as TenantConfig;
              setRawTenants([org]);
              setActiveTenantId(org.id);
            } else {
              setRawTenants([]);
              setActiveTenantId(null);
            }
            setLoading(false);
          }, (err) => {
            console.error("Error from organization doc snapshot (User):", err);
            setLoading(false);
          });
        } else {
          setRawTenants([]);
          setActiveTenantId(null);
          setLoading(false);
          return;
        }

        return () => {
          if (unsubscribeOrgs) unsubscribeOrgs();
        };
      } else {
        setRawTenants([]);
        setActiveTenantId(null);
        setLoading(false);
        setIsAdmin(false);
        setUserRole(null);
        setUserStatus(null);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const incrementTenantUsage = async (tenantId: string) => {
    // 1. Update local counter
    setLocalExtractions(prev => {
      const current = prev[tenantId] || 0;
      return { ...prev, [tenantId]: current + 1 };
    });

    // 2. Try updating Firestore
    try {
      const orgRef = doc(db, 'organizations', tenantId);
      await updateDoc(orgRef, {
        'usage.totalExtractions': increment(1),
        'usage.currentMonthExtractions': increment(1),
        'usage.lastExtractionAt': Timestamp.now()
      });
      console.log(`[VIGIA] Firestore usage counter incremented for tenant ${tenantId}`);
    } catch (err: any) {
      console.warn(`[VIGIA] Could not update Firestore usage. Falling back to local storage count:`, err.message || err);
    }
  };

  const updateTenantSqlConfig = async (tenantId: string, sqlConfig: any) => {
    // 1. Save locally first so it runs immediately
    setLocalSqlConfigs(prev => ({
      ...prev,
      [tenantId]: sqlConfig
    }));

    // 2. Try saving to Firestore
    try {
      const orgRef = doc(db, 'organizations', tenantId);
      await updateDoc(orgRef, { sqlConfig });
      console.log(`[VIGIA] Firestore sqlConfig updated for tenant ${tenantId}`);
    } catch (err: any) {
      console.warn(`[VIGIA] Could not update Firestore sqlConfig. Saved as local setting:`, err.message || err);
    }
  };

  const updateTenantModules = async (tenantId: string, modules: any) => {
    // 1. Save locally first so it runs immediately
    setLocalModules(prev => ({
      ...prev,
      [tenantId]: modules
    }));

    // 2. Try saving to Firestore
    try {
      const orgRef = doc(db, 'organizations', tenantId);
      await updateDoc(orgRef, { modules });
      console.log(`[VIGIA] Firestore modules updated for tenant ${tenantId}`);
    } catch (err: any) {
      console.warn(`[VIGIA] Could not update Firestore modules. Saved as local setting:`, err.message || err);
    }
  };

  // Map standard tenants array to include merged values
  const mergedTenants = rawTenants.map(tenant => {
    const localExtra = localExtractions[tenant.id] || 0;
    const localConfig = localSqlConfigs[tenant.id] || null;
    const localMods = localModules[tenant.id] || null;
    return {
      ...tenant,
      sqlConfig: localConfig ? { ...(tenant.sqlConfig || {}), ...localConfig } : tenant.sqlConfig,
      modules: localMods ? { ...(tenant.modules || {}), ...localMods } : tenant.modules,
      usage: {
        totalExtractions: (tenant.usage?.totalExtractions || 0) + localExtra,
        currentMonthExtractions: (tenant.usage?.currentMonthExtractions || 0) + localExtra,
        lastExtractionAt: tenant.usage?.lastExtractionAt || null
      }
    };
  });

  // Find active tenant based on selection
  const activeTenant = activeTenantId 
    ? (mergedTenants.find(t => t.id === activeTenantId) || null) 
    : null;

  const handleSetActiveTenant = (tenant: TenantConfig | null) => {
    setActiveTenantId(tenant ? tenant.id : null);
  };

  return (
    <TenantContext.Provider value={{ 
      activeTenant, 
      setActiveTenant: handleSetActiveTenant, 
      tenants: mergedTenants, 
      loading, 
      isAdmin,
      userRole,
      userStatus,
      incrementTenantUsage,
      updateTenantSqlConfig,
      updateTenantModules
    }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}
