import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppState, Client, Consumption, Transaction, Meeting, ClientType, Fine } from './types';

interface AppContextType extends AppState {
  user: any;
  userRole: string;
  mustChangePassword?: boolean;
  loadingAuth: boolean;
  addClient: (client: Omit<Client, 'id' | 'fechaRegistro'>) => Promise<void>;
  updateClient: (id: string, client: Partial<Client>) => Promise<void>;
  addConsumption: (consumption: Omit<Consumption, 'id' | 'montoCalculado' | 'estadoPago'>) => Promise<void>;
  payConsumption: (consumptionId: string) => Promise<void>;
  addFine: (fine: Omit<Fine, 'id' | 'estadoPago' | 'fecha'>) => Promise<void>;
  payFine: (fineId: string) => Promise<void>;
  addTransaction: (transaction: Omit<Transaction, 'id' | 'fecha'>) => Promise<void>;
  toggleTransactionConciliado: (id: string) => Promise<void>;
  addMeeting: (meeting: Omit<Meeting, 'id'>) => Promise<void>;
  updateMeeting: (id: string, meeting: Partial<Meeting>) => Promise<void>;
  updateSettings: (settings: any) => Promise<void>;
  recordAttendance: (meetingId: string, clientId: string, status: Meeting['asistencia'][string]) => Promise<void>;
  updateAdmin: (id: string, updates: Partial<any>) => Promise<void>;
  addAdmin: (admin: any) => Promise<void>;
  deleteConsumption: (id: string, reason: string) => Promise<void>;
  login: (email: string) => void;
  logout: () => void;
  setPdfPreview: (url: string | null, name?: string) => void;
  pdfPreviewUrl: string | null;
  pdfPreviewName: string;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const TARIFA_SOCIO = 0.20;
const TARIFA_USUARIO = 0.30;
const MULTA_FALTA = 40;

const initialData: AppState = {
  clients: [],
  consumptions: [],
  transactions: [],
  meetings: [],
  admins: [],
  fines: [],
  settings: {
    costoSocio: 0.20,
    costoUsuario: 0.30,
    costoTrifasico: 0.00,
    multaReunion: 40,
    costoReconexion: 0.00,
    consumoMinimo: 6.00
  }
};

const getLocalData = (): AppState => {
  const data = localStorage.getItem('erp_data');
  return data ? JSON.parse(data) : initialData;
};

const setLocalData = (data: AppState) => {
  localStorage.setItem('erp_data', JSON.stringify(data));
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [pdfPreviewUrl, setPdfPreviewUrlState] = useState<string | null>(null);
  const [pdfPreviewName, setPdfPreviewName] = useState<string>('');

  const setPdfPreview = (url: string | null, name?: string) => {
    setPdfPreviewUrlState(url);
    if (name) setPdfPreviewName(name);
  };

  const [state, setState] = useState<AppState>(() => {
    const data = getLocalData();
    if (!data.fines) {
      data.fines = []; // fallback for legacy data
    }
    if (!data.settings) {
      data.settings = initialData.settings;
    }
    
    // Ensure default admin exists
    const hasAdmin = data.admins.find((a: any) => a.email === 'admin@paccha.local');
    if (!hasAdmin) {
      data.admins.push({
        id: 'admin_default',
        email: 'admin@paccha.local',
        username: 'admin',
        password: 'ALANgaona2010@', // Will be plain or handled by backward compatibility check
        role: 'ADMIN',
        nombres: 'Super',
        apellidos: 'Admin',
        mustChangePassword: true
      });
      setLocalData(data);
    }
    
    return data;
  });

  const adminProfile = state.admins.find(a => a.email === user?.email || a.username === user?.email);
  const userRole = adminProfile?.role || 'ADMIN';
  const mustChangePassword = adminProfile?.mustChangePassword || false;

  useEffect(() => {
    const savedUser = localStorage.getItem('erp_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoadingAuth(false);
  }, []);

  const persistState = (newState: AppState) => {
    setState(newState);
    setLocalData(newState);
  };

  const login = (email: string) => {
    const newUser = { email, uid: 'local_uid' };
    setUser(newUser);
    localStorage.setItem('erp_user', JSON.stringify(newUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('erp_user');
  };

  const generateId = () => Math.random().toString(36).substr(2, 9);

  const updateAdmin = async (id: string, updates: Partial<any>) => {
    // Validate DNI duplicate if updating
    if (updates.dni) {
      const existing = state.admins.find(a => a.dni === updates.dni && a.id !== id);
      if (existing) {
        throw new Error('El DNI ingresado ya se encuentra registrado en otro usuario.');
      }
    }
    const newAdmins = state.admins.map(a => a.id === id ? { ...a, ...updates, updatedAt: new Date().toISOString(), updatedBy: user?.email || 'Unknown' } : a);
    persistState({ ...state, admins: newAdmins });
  };

  const addAdmin = async (admin: any) => {
    if (!admin.dni || !/^\d{8}$/.test(admin.dni)) {
      throw new Error('El DNI debe tener exactamente 8 dígitos numéricos.');
    }
    const existing = state.admins.find(a => a.dni === admin.dni);
    if (existing) {
      throw new Error('El DNI ya se encuentra registrado en el sistema.');
    }
    
    const newAdmin = {
      ...admin,
      id: generateId(),
      estado: 'ACTIVO',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: user?.email || 'Unknown',
      updatedBy: user?.email || 'Unknown',
    };
    
    persistState({
      ...state,
      admins: [...state.admins, newAdmin]
    });
  };

  const addClient = async (client: Omit<Client, 'id' | 'fechaRegistro'>) => {
    const newClient: Client = {
      ...client,
      id: generateId(),
      fechaRegistro: new Date().toISOString(),
      createdBy: user?.email || 'Unknown'
    };
    setState(prev => {
      const newState = { ...prev, clients: [...prev.clients, newClient] };
      setLocalData(newState);
      return newState;
    });
  };

  const updateClient = async (id: string, updates: Partial<Client>) => {
    setState(prev => {
      const newClients = prev.clients.map(c => c.id === id ? { ...c, ...updates } : c);
      const newState = { ...prev, clients: newClients };
      setLocalData(newState);
      return newState;
    });
  };

  const addConsumption = async (consumption: Omit<Consumption, 'id' | 'montoCalculado' | 'estadoPago'>) => {
    // Need to use the current state synchronously here, so we get it from the latest possible
    setState(currentState => {
      const client = currentState.clients.find(c => c.id === consumption.clientId);
      if (!client) return currentState;

      const settings = currentState.settings || initialData.settings;
      const tarifa = client.faseSuministro === 'TRIFASICO' && settings.costoTrifasico > 0 
        ? settings.costoTrifasico 
        : client.tipo === 'SOCIO' ? settings.costoSocio : settings.costoUsuario;
        
      const minimoAplica = settings.consumoMinimo !== undefined ? settings.consumoMinimo : 6;
      let montoCalculado = (consumption.kwh || 0) * tarifa;
      if (montoCalculado < minimoAplica) {
        montoCalculado = minimoAplica;
      }
      
      const newConsumption: Consumption = {
        ...consumption,
        id: generateId(),
        kwh: consumption.kwh || 0,
        montoCalculado,
        estadoPago: 'PENDIENTE',
        createdBy: user?.email || 'Unknown',
      };
      
      const newState = { ...currentState, consumptions: [...currentState.consumptions, newConsumption] };
      setLocalData(newState);
      return newState;
    });
  };

  const payConsumption = async (consumptionId: string) => {
    const consumption = state.consumptions.find(c => c.id === consumptionId);
    if (!consumption) return;

    const newConsumptions = state.consumptions.map(c => 
      c.id === consumptionId ? { ...c, estadoPago: 'PAGADO' as const } : c
    );
    persistState({ ...state, consumptions: newConsumptions });

    await addTransaction({
      tipo: 'INGRESO',
      categoria: 'CONSUMO',
      monto: consumption.montoCalculado,
      descripcion: `Pago Consumo ${consumption.mes}`,
      clientId: consumption.clientId,
    });
  };

  const deleteConsumption = async (id: string, reason: string) => {
    const consumption = state.consumptions.find(c => c.id === id);
    if (!consumption) return;
    
    // Simplistic audit log via console since there's no backend
    console.warn(`[AUDIT] Consumption Deleted: ID ${id}, Reason: ${reason}, By: ${user?.email || 'Unknown'}`);
    
    const newConsumptions = state.consumptions.filter(c => c.id !== id);
    persistState({ ...state, consumptions: newConsumptions });
  };

  const addFine = async (fine: Omit<Fine, 'id' | 'estadoPago' | 'fecha'>) => {
    const newFine: Fine = {
      ...fine,
      id: generateId(),
      estadoPago: 'PENDIENTE',
      fecha: new Date().toISOString(),
      createdBy: user?.email || 'Unknown'
    };
    setState(prev => {
      const newState = { ...prev, fines: [...(prev.fines || []), newFine] };
      setLocalData(newState);
      return newState;
    });
  };

  const payFine = async (fineId: string) => {
    const fine = state.fines?.find(f => f.id === fineId);
    if (!fine) return;

    const newFines = (state.fines || []).map(f => 
      f.id === fineId ? { ...f, estadoPago: 'PAGADO' as const } : f
    );
    persistState({ ...state, fines: newFines });

    await addTransaction({
      tipo: 'INGRESO',
      categoria: 'MULTA',
      monto: fine.monto,
      descripcion: `Pago Multa - ${fine.motivo}`,
      clientId: fine.clientId,
    });
  };

  const addTransaction = async (transaction: Omit<Transaction, 'id' | 'fecha'>) => {
    const newTx: Transaction = {
      ...transaction,
      id: generateId(),
      fecha: new Date().toISOString(),
      createdBy: user?.email || 'Unknown'
    };
    // Need to use current state, since this might be called in sequence with other updates
    setState(prev => {
      const newState = { ...prev, transactions: [...prev.transactions, newTx] };
      setLocalData(newState);
      return newState;
    });
  };

  const toggleTransactionConciliado = async (id: string) => {
    setState(prev => {
      const newState = { 
        ...prev, 
        transactions: prev.transactions.map(t => t.id === id ? { ...t, conciliado: !t.conciliado } : t) 
      };
      setLocalData(newState);
      return newState;
    });
  };

  const addMeeting = async (meeting: Omit<Meeting, 'id'>) => {
    const newMeeting: Meeting = {
      ...meeting,
      id: generateId(),
      createdBy: user?.email || 'Unknown'
    };
    persistState({ ...state, meetings: [...state.meetings, newMeeting] });
  };

  const updateMeeting = async (id: string, meetingInfo: Partial<Meeting>) => {
    persistState({
      ...state,
      meetings: state.meetings.map(m => m.id === id ? { ...m, ...meetingInfo } : m)
    });
  };

  const recordAttendance = async (meetingId: string, clientId: string, status: Meeting['asistencia'][string]) => {
    const meeting = state.meetings.find(m => m.id === meetingId);
    if (!meeting) return;

    const newAsistencia = { ...(meeting.asistencia || {}), [clientId]: status };
    const newMeetings = state.meetings.map(m => m.id === meetingId ? { ...m, asistencia: newAsistencia } : m);
    
    let newFines = [...(state.fines || [])];
    
    if (status === 'FALTA_INJUSTIFICADA') {
      const existingFine = newFines.find(f => f.clientId === clientId && f.meetingId === meetingId);
      if (!existingFine) {
        newFines.push({
          id: generateId(),
          clientId,
          meetingId,
          monto: state.settings?.multaReunion || 40,
          motivo: `Falta a reunión ${new Date(meeting.fecha).toLocaleDateString()}`,
          estadoPago: 'PENDIENTE',
          fecha: new Date().toISOString()
        });
      }
    } else {
      // Remove fine if the user was updated to something else
      newFines = newFines.filter(f => !(f.clientId === clientId && f.meetingId === meetingId && f.estadoPago === 'PENDIENTE'));
    }

    persistState({ ...state, meetings: newMeetings, fines: newFines });
  };

  const updateSettings = async (settings: any) => {
    persistState({
      ...state,
      settings: { ...state.settings, ...settings }
    });
  };

  return (
    <AppContext.Provider value={{
      ...state,
      user,
      userRole,
      mustChangePassword,
      loadingAuth,
      addClient,
      updateClient,
      addConsumption,
      payConsumption,
      addFine,
      payFine,
      addTransaction,
      toggleTransactionConciliado,
      addMeeting,
      updateMeeting,
      updateSettings,
      recordAttendance,
      updateAdmin,
      addAdmin,
      deleteConsumption,
      login,
      logout,
      setPdfPreview,
      pdfPreviewUrl,
      pdfPreviewName
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
