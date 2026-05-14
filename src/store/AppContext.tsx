import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppState, Client, Consumption, Transaction, Meeting, ClientType } from './types';
import { db, auth } from '../lib/firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, serverTimestamp, query } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

interface AppContextType extends AppState {
  user: any;
  loadingAuth: boolean;
  addClient: (client: Omit<Client, 'id' | 'fechaRegistro'>) => Promise<void>;
  updateClient: (id: string, client: Partial<Client>) => Promise<void>;
  addConsumption: (consumption: Omit<Consumption, 'id' | 'montoCalculado' | 'estadoPago'>) => Promise<void>;
  payConsumption: (consumptionId: string) => Promise<void>;
  addTransaction: (transaction: Omit<Transaction, 'id' | 'fecha'>) => Promise<void>;
  addMeeting: (meeting: Omit<Meeting, 'id' | 'createdAt'>) => Promise<void>;
  recordAttendance: (meetingId: string, clientId: string, status: Meeting['asistencia'][string]) => Promise<void>;
  updateAdmin: (id: string, updates: Partial<any>) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const TARIFA_SOCIO = 0.20;
const TARIFA_USUARIO = 0.30;
const MULTA_FALTA = 40;

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [isAdminUser, setIsAdminUser] = useState(false);

  const [state, setState] = useState<AppState>({
    clients: [],
    consumptions: [],
    transactions: [],
    meetings: [],
    admins: [],
  });

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async u => {
      setUser(u);
      if (u) {
        // Wait for admin profile to be available
        setLoadingAuth(true);
        let retries = 5;
        let adminExists = false;
        while (retries > 0 && !adminExists) {
          try {
            const adminDoc = await import('firebase/firestore').then(firestore => firestore.getDoc(firestore.doc(db, 'admins', u.uid)));
            if (adminDoc.exists()) {
              adminExists = true;
              setIsAdminUser(true);
            }
          } catch (e: any) {
            console.error("Error checking admin profile", e);
            if (e && e.code === 'permission-denied') {
              break;
            }
          }
          if (!adminExists) {
            await new Promise(r => setTimeout(r, 1000));
            retries--;
          }
        }
        setLoadingAuth(false);
      } else {
        setIsAdminUser(false);
        setLoadingAuth(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !isAdminUser) return;

    const unsubs: (() => void)[] = [];

    unsubs.push(onSnapshot(query(collection(db, 'clients')), (snapshot) => {
      setState(prev => ({
        ...prev,
        clients: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client))
      }));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'clients')));

    unsubs.push(onSnapshot(query(collection(db, 'consumptions')), (snapshot) => {
      setState(prev => ({
        ...prev,
        consumptions: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Consumption))
      }));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'consumptions')));

    unsubs.push(onSnapshot(query(collection(db, 'transactions')), (snapshot) => {
      setState(prev => ({
        ...prev,
        transactions: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction))
      }));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'transactions')));

    unsubs.push(onSnapshot(query(collection(db, 'meetings')), (snapshot) => {
      setState(prev => ({
        ...prev,
        meetings: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Meeting))
      }));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'meetings')));

    unsubs.push(onSnapshot(query(collection(db, 'admins')), (snapshot) => {
      setState(prev => ({
        ...prev,
        admins: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any))
      }));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'admins')));

    return () => unsubs.forEach(fn => fn());
  }, [user, isAdminUser]);

  const generateId = () => Math.random().toString(36).substr(2, 9);

  const updateAdmin = async (id: string, updates: Partial<any>) => {
    try {
      await updateDoc(doc(db, 'admins', id), updates);
    } catch(err) {
      handleFirestoreError(err, OperationType.UPDATE, 'admins');
    }
  };

  const addClient = async (client: Omit<Client, 'id' | 'fechaRegistro'>) => {
    try {
      const id = generateId();
      await setDoc(doc(db, 'clients', id), {
        ...client,
        fechaRegistro: new Date().toISOString()
      });
    } catch(err) {
      handleFirestoreError(err, OperationType.CREATE, 'clients');
    }
  };

  const updateClient = async (id: string, updates: Partial<Client>) => {
    try {
      await updateDoc(doc(db, 'clients', id), updates);
    } catch(err) {
      handleFirestoreError(err, OperationType.UPDATE, 'clients');
    }
  };

  const addConsumption = async (consumption: Omit<Consumption, 'id' | 'montoCalculado' | 'estadoPago'>) => {
    try {
      const client = state.clients.find(c => c.id === consumption.clientId);
      if (!client) return;

      const tarifa = client.tipo === 'SOCIO' ? TARIFA_SOCIO : TARIFA_USUARIO;
      const kwhFacturado = Math.max(consumption.kwh || 0, 6);
      const montoCalculado = kwhFacturado * tarifa;

      const id = generateId();
      await setDoc(doc(db, 'consumptions', id), {
        ...consumption,
        kwh: consumption.kwh || 0,
        montoCalculado,
        estadoPago: 'PENDIENTE',
      });
    } catch(err) {
      handleFirestoreError(err, OperationType.CREATE, 'consumptions');
    }
  };

  const payConsumption = async (consumptionId: string) => {
    try {
      const consumption = state.consumptions.find(c => c.id === consumptionId);
      if (!consumption) return;

      await updateDoc(doc(db, 'consumptions', consumptionId), {
        estadoPago: 'PAGADO'
      });

      await addTransaction({
        tipo: 'INGRESO',
        categoria: 'CONSUMO',
        monto: consumption.montoCalculado,
        descripcion: `Pago Consumo ${consumption.mes}`,
        clientId: consumption.clientId,
      });
    } catch(err) {
      handleFirestoreError(err, OperationType.UPDATE, 'consumptions');
    }
  };

  const addTransaction = async (transaction: Omit<Transaction, 'id' | 'fecha'>) => {
    try {
      const id = generateId();
      await setDoc(doc(db, 'transactions', id), {
        ...transaction,
        fecha: new Date().toISOString()
      });
    } catch(err) {
      handleFirestoreError(err, OperationType.CREATE, 'transactions');
    }
  };

  const addMeeting = async (meeting: Omit<Meeting, 'id' | 'createdAt'>) => {
    try {
      const id = generateId();
      await setDoc(doc(db, 'meetings', id), {
        ...meeting,
        createdAt: serverTimestamp()
      });
    } catch(err) {
      handleFirestoreError(err, OperationType.CREATE, 'meetings');
    }
  };

  const recordAttendance = async (meetingId: string, clientId: string, status: Meeting['asistencia'][string]) => {
    try {
      const meeting = state.meetings.find(m => m.id === meetingId);
      if (!meeting) return;

      const newAsistencia = { ...(meeting.asistencia || {}), [clientId]: status };
      await updateDoc(doc(db, 'meetings', meetingId), {
        asistencia: newAsistencia
      });

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
    } catch(err) {
      handleFirestoreError(err, OperationType.UPDATE, 'meetings');
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
