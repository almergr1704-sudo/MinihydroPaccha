import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppState, Client, Consumption, Transaction, Meeting, ClientType } from './types';

interface AppContextType extends AppState {
  user: any;
  loadingAuth: boolean;
  addClient: (client: Omit<Client, 'id' | 'fechaRegistro'>) => Promise<void>;
  updateClient: (id: string, client: Partial<Client>) => Promise<void>;
  addConsumption: (consumption: Omit<Consumption, 'id' | 'montoCalculado' | 'estadoPago'>) => Promise<void>;
  payConsumption: (consumptionId: string) => Promise<void>;
  addTransaction: (transaction: Omit<Transaction, 'id' | 'fecha'>) => Promise<void>;
  addMeeting: (meeting: Omit<Meeting, 'id'>) => Promise<void>;
  recordAttendance: (meetingId: string, clientId: string, status: Meeting['asistencia'][string]) => Promise<void>;
  updateAdmin: (id: string, updates: Partial<any>) => Promise<void>;
  login: (email: string) => void;
  logout: () => void;
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

  const [state, setState] = useState<AppState>(getLocalData());

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
    const newAdmins = state.admins.map(a => a.id === id ? { ...a, ...updates } : a);
    persistState({ ...state, admins: newAdmins });
  };

  const addClient = async (client: Omit<Client, 'id' | 'fechaRegistro'>) => {
    const newClient: Client = {
      ...client,
      id: generateId(),
      fechaRegistro: new Date().toISOString()
    };
    persistState({ ...state, clients: [...state.clients, newClient] });
  };

  const updateClient = async (id: string, updates: Partial<Client>) => {
    const newClients = state.clients.map(c => c.id === id ? { ...c, ...updates } : c);
    persistState({ ...state, clients: newClients });
  };

  const addConsumption = async (consumption: Omit<Consumption, 'id' | 'montoCalculado' | 'estadoPago'>) => {
    const client = state.clients.find(c => c.id === consumption.clientId);
    if (!client) return;

    const tarifa = client.tipo === 'SOCIO' ? TARIFA_SOCIO : TARIFA_USUARIO;
    const kwhFacturado = Math.max(consumption.kwh || 0, 6);
    const montoCalculado = kwhFacturado * tarifa;

    const newConsumption: Consumption = {
      ...consumption,
      id: generateId(),
      kwh: consumption.kwh || 0,
      montoCalculado,
      estadoPago: 'PENDIENTE',
    };
    persistState({ ...state, consumptions: [...state.consumptions, newConsumption] });
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

  const addTransaction = async (transaction: Omit<Transaction, 'id' | 'fecha'>) => {
    const newTx: Transaction = {
      ...transaction,
      id: generateId(),
      fecha: new Date().toISOString()
    };
    // Need to use current state, since this might be called in sequence with other updates
    setState(prev => {
      const newState = { ...prev, transactions: [...prev.transactions, newTx] };
      setLocalData(newState);
      return newState;
    });
  };

  const addMeeting = async (meeting: Omit<Meeting, 'id'>) => {
    const newMeeting: Meeting = {
      ...meeting,
      id: generateId()
    };
    persistState({ ...state, meetings: [...state.meetings, newMeeting] });
  };

  const recordAttendance = async (meetingId: string, clientId: string, status: Meeting['asistencia'][string]) => {
    const meeting = state.meetings.find(m => m.id === meetingId);
    if (!meeting) return;

    const newAsistencia = { ...(meeting.asistencia || {}), [clientId]: status };
    const newMeetings = state.meetings.map(m => m.id === meetingId ? { ...m, asistencia: newAsistencia } : m);
    persistState({ ...state, meetings: newMeetings });

    if (status === 'FALTA_INJUSTIFICADA') {
      const existingFine = state.transactions.find(t => 
        t.tipo === 'INGRESO' && 
        t.categoria === 'MULTA' && 
        t.clientId === clientId && 
        t.descripcion.includes(meetingId)
      );
      
      if (!existingFine) {
        await addTransaction({
          tipo: 'INGRESO',
          categoria: 'MULTA',
          monto: MULTA_FALTA,
          descripcion: `Multa por falta a reunión (${new Date(meeting.fecha).toLocaleDateString()}) - Ref: ${meetingId}`,
          clientId: clientId
        });
      }
    }
  };

  return (
    <AppContext.Provider value={{
      ...state,
      user,
      loadingAuth,
      addClient,
      updateClient,
      addConsumption,
      payConsumption,
      addTransaction,
      addMeeting,
      recordAttendance,
      updateAdmin,
      login,
      logout
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
