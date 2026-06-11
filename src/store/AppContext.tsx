import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppState, Client, Consumption, Transaction, Meeting, ClientType, Fine, AuditLog, Committee, CommitteeMember, Trabajador, PagoSueldo } from './types';
import { normalizeSupplyCode } from '../lib/utils';
import bcrypt from 'bcryptjs';

interface AppContextType extends AppState {
  user: any;
  userRole: string;
  mustChangePassword?: boolean;
  loadingAuth: boolean;
  comites: Committee[];
  trabajadores: Trabajador[];
  pagosSueldos: PagoSueldo[];
  addCommittee: (committee: Omit<Committee, 'id' | 'createdBy' | 'createdAt'>) => Promise<void>;
  updateCommittee: (id: string, updates: Partial<Committee>) => Promise<void>;
  deleteCommittee: (id: string) => Promise<void>;
  toggleCommitteeStatus: (id: string) => Promise<void>;
  addAuditLog: (accion: AuditLog['accion'], modulo: AuditLog['modulo'], detalles: string) => void;
  addClient: (client: Omit<Client, 'id' | 'fechaRegistro'>) => Promise<Client>;
  updateClient: (id: string, client: Partial<Client>) => Promise<void>;
  transferSupply: (fromClientId: string, toClientId: string, supplyCode: string) => Promise<void>;
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
  markSupplyAsSocio: (supplyCode: string) => Promise<void>;
  setSupplySocioStatus: (supplyCode: string, isSocio: boolean) => Promise<void>;
  login: (email: string) => void;
  logout: () => void;
  addTrabajador: (trabajador: Omit<Trabajador, 'id' | 'fechaRegistro'>) => Promise<void>;
  updateTrabajador: (id: string, updates: Partial<Trabajador>) => Promise<void>;
  addPagoSueldo: (pago: Omit<PagoSueldo, 'id' | 'fechaPago' | 'comprobante' | 'createdBy'>) => Promise<PagoSueldo>;
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
  auditLogs: [],
  suppliesInfo: [],
  comites: [],
  trabajadores: [],
  pagosSueldos: [],
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
  if (data) {
    try {
      const parsed = JSON.parse(data);
      return {
        clients: parsed.clients || initialData.clients,
        consumptions: parsed.consumptions || initialData.consumptions,
        transactions: parsed.transactions || initialData.transactions,
        meetings: parsed.meetings || initialData.meetings,
        admins: parsed.admins || initialData.admins,
        fines: parsed.fines || initialData.fines,
        auditLogs: parsed.auditLogs || initialData.auditLogs,
        suppliesInfo: parsed.suppliesInfo || initialData.suppliesInfo,
        settings: { ...initialData.settings, ...(parsed.settings || {}) },
        comites: parsed.comites || [],
        trabajadores: parsed.trabajadores || [],
        pagosSueldos: parsed.pagosSueldos || [],
      };
    } catch (e) {
      console.error('Failed to parse local data', e);
    }
  }
  return initialData;
};

const setLocalData = (data: AppState) => {
  localStorage.setItem('erp_data', JSON.stringify(data));
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const [state, setState] = useState<AppState>(() => {
    const data = getLocalData();
    if (!data.fines) {
      data.fines = []; // fallback for legacy data
    }
    if (!data.auditLogs) {
      data.auditLogs = []; // fallback
    }
    if (!data.settings) {
      data.settings = initialData.settings;
    }
    if (!data.suppliesInfo) {
      data.suppliesInfo = [];
    }
    if (!data.comites) {
      data.comites = [];
    }
    if (!data.trabajadores) {
      data.trabajadores = [];
    }
    if (!data.pagosSueldos) {
      data.pagosSueldos = [];
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

  const addAuditLog = (accion: AuditLog['accion'], modulo: AuditLog['modulo'], detalles: string) => {
    setState(prev => {
      const newLog: AuditLog = {
        id: `AL${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`,
        fecha: new Date().toISOString(),
        usuario: user?.email || 'Sistema',
        accion,
        modulo,
        detalles
      };
      const newState = { ...prev, auditLogs: [newLog, ...(prev.auditLogs || [])] };
      setLocalData(newState);
      return newState;
    });
  };

  const login = (email: string) => {
    const newUser = { email, uid: 'local_uid' };
    setUser(newUser);
    localStorage.setItem('erp_user', JSON.stringify(newUser));
    // Cannot call addAuditLog yet because user state might not be updated, but we can do it asynchronously
    setTimeout(() => {
        addAuditLog('LOGIN', 'SISTEMA', `Inicio de sesión de ${email}`);
    }, 100);
  };

  const logout = () => {
    addAuditLog('LOGOUT', 'SISTEMA', `Cierra sesión ${user?.email || ''}`);
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
    if (updates.username) {
      const uClean = updates.username.trim().toLowerCase();
      const existing = state.admins.find(a => (a.username || '').trim().toLowerCase() === uClean && a.id !== id);
      if (existing) {
        throw new Error(`El nombre de usuario "${updates.username}" ya se encuentra registrado por otro usuario.`);
      }
    }
    if (updates.email) {
      const eClean = updates.email.trim().toLowerCase();
      const existing = state.admins.find(a => (a.email || '').trim().toLowerCase() === eClean && a.id !== id);
      if (existing) {
        throw new Error(`El correo electrónico "${updates.email}" ya se encuentra registrado por otro usuario.`);
      }
    }
    const newAdmins = state.admins.map(a => a.id === id ? { ...a, ...updates, updatedAt: new Date().toISOString(), updatedBy: user?.email || 'Unknown' } : a);
    persistState({ ...state, admins: newAdmins });
    setTimeout(() => addAuditLog('ACTUALIZAR', 'USUARIOS', `Actualizó usuario administrativo ${id}`), 0);
  };

  const addAdmin = async (admin: any) => {
    if (!admin.dni || !/^\d{8}$/.test(admin.dni)) {
      throw new Error('El DNI debe tener exactamente 8 dígitos numéricos.');
    }
    const existingDni = state.admins.find(a => a.dni === admin.dni);
    if (existingDni) {
      throw new Error('El DNI ya se encuentra registrado en el sistema.');
    }

    if (admin.username) {
      const uClean = admin.username.trim().toLowerCase();
      const existingUsername = state.admins.find(a => (a.username || '').trim().toLowerCase() === uClean);
      if (existingUsername) {
        throw new Error(`El nombre de usuario "${admin.username}" ya se encuentra registrado.`);
      }
    }

    if (admin.email) {
      const eClean = admin.email.trim().toLowerCase();
      const existingEmail = state.admins.find(a => (a.email || '').trim().toLowerCase() === eClean);
      if (existingEmail) {
        throw new Error(`El correo electrónico "${admin.email}" ya se encuentra registrado.`);
      }
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
    setTimeout(() => addAuditLog('CREAR', 'USUARIOS', `Creó usuario administrativo ${admin.email || admin.username}`), 0);
  };

  const markSupplyAsSocio = async (supplyCode: string) => {
    setState(prev => {
      if (prev.suppliesInfo.some(s => s.codigo === supplyCode && s.isSocio)) return prev;
      const newSocioInfo = {
        codigo: supplyCode,
        isSocio: true,
        fechaSocio: new Date().toISOString()
      };
      
      const exists = prev.suppliesInfo.some(s => s.codigo === supplyCode);
      const newSuppliesInfo = exists ? 
        prev.suppliesInfo.map(s => s.codigo === supplyCode ? newSocioInfo : s) : 
        [...prev.suppliesInfo, newSocioInfo];
        
      const newState = { ...prev, suppliesInfo: newSuppliesInfo };
      setLocalData(newState);
      setTimeout(() => addAuditLog('ACTUALIZAR', 'SOCIOS', `Asignó condición de SOCIO permanente al suministro ${supplyCode}`), 0);
      return newState;
    });
  };

  const setSupplySocioStatus = async (supplyCode: string, isSocio: boolean) => {
    setState(prev => {
      if (prev.suppliesInfo.some(s => s.codigo === supplyCode && s.isSocio === isSocio)) return prev;
      const newSocioInfo = {
        codigo: supplyCode,
        isSocio,
        fechaSocio: isSocio ? new Date().toISOString() : undefined
      };
      
      const exists = prev.suppliesInfo.some(s => s.codigo === supplyCode);
      const newSuppliesInfo = exists ? 
        prev.suppliesInfo.map(s => s.codigo === supplyCode ? { ...s, ...newSocioInfo } : s) : 
        [...prev.suppliesInfo, newSocioInfo];
        
      const newState = { ...prev, suppliesInfo: newSuppliesInfo };
      setLocalData(newState);
      setTimeout(() => addAuditLog('ACTUALIZAR', 'SOCIOS', `Definió condición de ${isSocio ? 'SOCIO' : 'USUARIO'} al suministro ${supplyCode}`), 0);
      return newState;
    });
  };

  const addClient = async (client: Omit<Client, 'id' | 'fechaRegistro'>): Promise<Client> => {
    if (client.dni && client.dni.trim() !== '') {
      const existing = state.clients.find(c => c.dni === client.dni.trim());
      if (existing) {
        throw new Error(`El DNI/RUC ${client.dni} ya se encuentra registrado.`);
      }
    }

    const rawSupplies = client.suministros?.length ? client.suministros : [client.codigoSuministro].filter(Boolean);
    const suppliesToCheck = (rawSupplies as string[]).map(normalizeSupplyCode).filter(Boolean);
    for (const sup of suppliesToCheck) {
      if (!sup) continue;
      for (const c of state.clients) {
        const cSupplies = (c.suministros?.length ? c.suministros : [c.codigoSuministro].filter(Boolean)).map(s => normalizeSupplyCode(s as string));
        if (cSupplies.includes(sup)) {
          throw new Error(`El suministro ${sup} ya se encuentra registrado.`);
        }
      }
    }
    if (client.numeroMedidor) {
     for (const c of state.clients) {
       if (c.numeroMedidor === client.numeroMedidor) {
          throw new Error(`El número de medidor ${client.numeroMedidor} ya se encuentra asignado a otro cliente.`);
       }
     }
    }

    const newClient: Client = {
      ...client,
      codigoSuministro: client.codigoSuministro ? normalizeSupplyCode(client.codigoSuministro) : undefined,
      suministros: client.suministros?.map(normalizeSupplyCode),
      id: generateId(),
      fechaRegistro: new Date().toISOString(),
      createdBy: user?.email || 'Unknown'
    };
    setState(prev => {
      let newSuppliesInfo = prev.suppliesInfo;
      if (client.tipo === 'SOCIO') {
         const suppliesToMark = client.suministros?.length ? client.suministros : [client.codigoSuministro].filter(Boolean);
         suppliesToMark.forEach(sup => {
            if (!sup) return;
            if (!newSuppliesInfo.some(s => s.codigo === sup && s.isSocio)) {
              newSuppliesInfo = [...newSuppliesInfo.filter(s => s.codigo !== sup), {
                 codigo: sup,
                 isSocio: true,
                 fechaSocio: new Date().toISOString()
              }];
            }
         });
      }

      const newState = { ...prev, clients: [...prev.clients, newClient], suppliesInfo: newSuppliesInfo };
      setLocalData(newState);
      setTimeout(() => addAuditLog('CREAR', 'SOCIOS', `Creó socio/usuario: ${client.dni}`), 0);
      return newState;
    });
    return newClient;
  };

  const updateClient = async (id: string, updates: Partial<Client>) => {
    if (updates.dni && updates.dni.trim() !== '') {
      const existing = state.clients.find(c => c.dni === updates.dni!.trim() && c.id !== id);
      if (existing) {
        throw new Error(`El DNI/RUC ${updates.dni} ya se encuentra registrado.`);
      }
    }

    if (updates.suministros || updates.codigoSuministro) {
       const clientBeingUpdated = state.clients.find(c => c.id === id);
       const rawSupplies = updates.suministros?.length ? updates.suministros : (updates.codigoSuministro ? [updates.codigoSuministro] : (clientBeingUpdated?.suministros || [clientBeingUpdated?.codigoSuministro]).filter(Boolean));
       const suppliesToCheck = (rawSupplies as string[]).map(normalizeSupplyCode).filter(Boolean);
       for (const sup of suppliesToCheck) {
         if (!sup) continue;
         for (const c of state.clients) {
           if (c.id === id) continue;
           const cSupplies = (c.suministros?.length ? c.suministros : [c.codigoSuministro].filter(Boolean)).map(s => normalizeSupplyCode(s as string));
           if (cSupplies.includes(sup)) {
             throw new Error(`El suministro ${sup} ya se encuentra registrado.`);
           }
         }
       }
    }
    if (updates.numeroMedidor) {
       for (const c of state.clients) {
         if (c.id === id) continue;
         if (c.numeroMedidor === updates.numeroMedidor) {
            throw new Error(`El número de medidor ${updates.numeroMedidor} ya se encuentra asignado a otro cliente.`);
         }
       }
    }

    if (updates.codigoSuministro !== undefined) {
       updates.codigoSuministro = updates.codigoSuministro ? normalizeSupplyCode(updates.codigoSuministro) : '';
    }
    if (updates.suministros !== undefined) {
       updates.suministros = updates.suministros.map(s => normalizeSupplyCode(s));
    }

    setState(prev => {
      const newClients = prev.clients.map(c => c.id === id ? { ...c, ...updates } : c);
      const newState = { ...prev, clients: newClients };
      setLocalData(newState);
      setTimeout(() => addAuditLog('ACTUALIZAR', 'SOCIOS', `Actualizó socio/usuario: ${id}`), 0);
      return newState;
    });
  };

  const transferSupply = async (fromClientId: string, toClientId: string, supplyCodeRaw: string) => {
    const supplyCode = normalizeSupplyCode(supplyCodeRaw);
    setState(currentState => {
      const fromClient = currentState.clients.find(c => c.id === fromClientId);
      const toClient = currentState.clients.find(c => c.id === toClientId);
      
      if (!fromClient || !toClient) return currentState;

      const newClients = currentState.clients.map(c => {
        if (c.id === fromClientId) {
          const sums = c.suministros || [];
          const newSums = sums.filter(s => normalizeSupplyCode(s) !== supplyCode);
          const oldCodigoNorm = normalizeSupplyCode(c.codigoSuministro || '');
          const newCodigo = oldCodigoNorm === supplyCode && newSums.length === 0 ? '' : (oldCodigoNorm === supplyCode ? newSums[0] : c.codigoSuministro);
          return { ...c, suministros: newSums, codigoSuministro: newCodigo };
        }
        if (c.id === toClientId) {
          const sums = c.suministros || [];
          if (!sums.map(s => normalizeSupplyCode(s)).includes(supplyCode)) {
             return { 
                ...c, 
                suministros: [...sums, supplyCode],
                codigoSuministro: c.codigoSuministro ? c.codigoSuministro : supplyCode 
             };
          }
        }
        return c;
      });

      const newConsumptions = currentState.consumptions.map(c => {
        if (c.clientId === fromClientId && normalizeSupplyCode(c.codigoSuministro) === supplyCode) {
          return { ...c, clientId: toClientId };
        }
        return c;
      });

      const newState = { ...currentState, clients: newClients, consumptions: newConsumptions };
      setLocalData(newState);
      
      const toName = toClient.nombre || `${toClient.nombres || ''} ${toClient.apellidos || ''}`;
      setTimeout(() => addAuditLog('ACTUALIZAR', 'SOCIOS', `Transfirió suministro ${supplyCode} a ${toName}`), 0);
      return newState;
    });
  };

  const addConsumption = async (consumption: Omit<Consumption, 'id' | 'montoCalculado' | 'estadoPago'>) => {
    // Need to use the current state synchronously here, so we get it from the latest possible
    setState(currentState => {
      const client = currentState.clients.find(c => c.id === consumption.clientId);
      if (!client) return currentState;

      // Check if this supply is currently exonerated by an active committee
      let isExonerated = false;
      if (currentState.comites) {
        const activeComite = currentState.comites.find(c => c.activo);
        if (activeComite) {
          // Check if consumption.mes falls within comite period
          const compDate = new Date(`${consumption.mes}-02`);
          const start = new Date(activeComite.fechaInicio);
          const end = new Date(activeComite.fechaFin);
          if (compDate >= start && compDate <= end) {
            const members = [
              activeComite.presidente,
              activeComite.secretario,
              activeComite.tesorero,
              activeComite.fiscalizador,
              activeComite.vocal
            ].filter(Boolean);
            if (members.some(m => m.supplyCodeExonerado === consumption.codigoSuministro)) {
              isExonerated = true;
            }
          }
        }
      }

      const settings = currentState.settings || initialData.settings;
      const isSocio = currentState.suppliesInfo.find(s => s.codigo === consumption.codigoSuministro)?.isSocio ?? (client.tipo === 'SOCIO');
      const tarifa = client.faseSuministro === 'TRIFASICO' && settings.costoTrifasico > 0 
        ? settings.costoTrifasico 
        : isSocio ? settings.costoSocio : settings.costoUsuario;
        
      const minimoAplica = settings.consumoMinimo !== undefined ? settings.consumoMinimo : 6;
      let montoCalculado = isExonerated ? 0 : (consumption.kwh || 0) * tarifa;
      if (!isExonerated && montoCalculado < minimoAplica) {
        montoCalculado = minimoAplica;
      }
      
      const newConsumption: Consumption = {
        ...consumption,
        id: generateId(),
        kwh: consumption.kwh || 0,
        montoCalculado,
        estadoPago: 'PENDIENTE',
        createdBy: user?.email || 'Unknown',
        observacion: isExonerated 
          ? `EXONERADO (Miembro Comité Directivo). ${consumption.observacion || ''}`.trim()
          : consumption.observacion
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
    addAuditLog('ACTUALIZAR', 'CONSUMOS', `Pagó recibo de ${consumption.montoCalculado} para suministro ${consumption.codigoSuministro}`);
  };

  const deleteConsumption = async (id: string, reason: string) => {
    const consumption = state.consumptions.find(c => c.id === id);
    if (!consumption) return;
    
    const newConsumptions = state.consumptions.filter(c => c.id !== id);
    persistState({ ...state, consumptions: newConsumptions });
    setTimeout(() => addAuditLog('ELIMINAR', 'CONSUMOS', `Eliminó recibo ${id}. Motivo: ${reason}`), 0);
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
    if (transaction.comprobante && transaction.comprobante.trim() !== '') {
      const exists = state.transactions.some(
        t => t.comprobante?.trim().toLowerCase() === transaction.comprobante!.trim().toLowerCase()
      );
      if (exists) {
        throw new Error(`El comprobante correlativo "${transaction.comprobante}" ya se encuentra registrado.`);
      }
    }

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
      setTimeout(() => addAuditLog('CREAR', 'FINANZAS', `Registró ${transaction.tipo} por S/ ${transaction.monto} - ${transaction.categoria}`), 0);
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
      setTimeout(() => addAuditLog('ACTUALIZAR', 'FINANZAS', `Alternó conciliación de transacción ${id}`), 0);
      return newState;
    });
  };

  const addMeeting = async (meeting: Omit<Meeting, 'id'>) => {
    if (meeting.fecha) {
      const exists = state.meetings.some(m => m.fecha === meeting.fecha);
      if (exists) {
        throw new Error(`Ya existe una reunión o asamblea programada para la fecha y hora seleccionada.`);
      }
    }

    const newMeeting: Meeting = {
      ...meeting,
      id: generateId(),
      createdBy: user?.email || 'Unknown'
    };
    persistState({ ...state, meetings: [...state.meetings, newMeeting] });
    setTimeout(() => addAuditLog('CREAR', 'REUNIONES', `Programó reunión para ${meeting.fecha.split('T')[0]}`), 0);
  };

  const updateMeeting = async (id: string, meetingInfo: Partial<Meeting>) => {
    persistState({
      ...state,
      meetings: state.meetings.map(m => m.id === id ? { ...m, ...meetingInfo } : m)
    });
    setTimeout(() => addAuditLog('ACTUALIZAR', 'REUNIONES', `Actualizó reunión ${id}`), 0);
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

  const syncCommitteeAdmins = (stateData: AppState, comite: Committee, oldActiveComite?: Committee) => {
    let updatedAdmins = [...stateData.admins];

    const syncMember = (member: CommitteeMember | undefined, role: string) => {
      if (!member || !member.clientId) return;
      const client = stateData.clients.find(c => c.id === member.clientId);
      if (!client) return;

      const dni = client.dni;
      const email = client.correo || `${dni}@paccha.local`;
      const existingIndex = updatedAdmins.findIndex(a => a.dni === dni || a.email?.toLowerCase() === email.toLowerCase());

      if (existingIndex >= 0) {
        updatedAdmins[existingIndex] = {
          ...updatedAdmins[existingIndex],
          role: role,
          estado: 'ACTIVO'
        };
      } else {
        const firstName = client.nombres || '';
        const lastName = client.apellidos || '';
        const usernameBase = (firstName.charAt(0) + (lastName.split(' ')[0] || '')).toLowerCase().replace(/[^a-z0-9]/g, '');
        
        let finalUsername = usernameBase;
        let counter = 1;
        let usernameExists = updatedAdmins.some(a => (a.username || '').trim().toLowerCase() === finalUsername.toLowerCase());
        while (usernameExists) {
          finalUsername = `${usernameBase}${counter}`;
          counter++;
          usernameExists = updatedAdmins.some(a => (a.username || '').trim().toLowerCase() === finalUsername.toLowerCase());
        }

        const tempPassword = `Comite2026#`;
        const hashedPassword = bcrypt.hashSync(tempPassword, 10);

        updatedAdmins.push({
          id: 'admin_' + Math.random().toString(36).substr(2, 9),
          email: email.toLowerCase(),
          username: finalUsername.toLowerCase(),
          password: hashedPassword,
          nombres: firstName,
          apellidos: lastName,
          dni: dni,
          role: role,
          estado: 'ACTIVO',
          mustChangePassword: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'SISTEMA_COMITE',
          updatedBy: 'SISTEMA_COMITE'
        });
      }
    };

    if (oldActiveComite) {
      const oldMemberIds = [
        oldActiveComite.presidente?.clientId,
        oldActiveComite.secretario?.clientId,
        oldActiveComite.tesorero?.clientId,
        oldActiveComite.fiscalizador?.clientId,
        oldActiveComite.vocal?.clientId
      ].filter(Boolean);

      const newMemberIds = [
        comite.presidente?.clientId,
        comite.secretario?.clientId,
        comite.tesorero?.clientId,
        comite.fiscalizador?.clientId,
        comite.vocal?.clientId
      ].filter(Boolean);

      oldMemberIds.forEach(oldId => {
        if (!newMemberIds.includes(oldId)) {
          const client = stateData.clients.find(c => c.id === oldId);
          if (client) {
            const adminIdx = updatedAdmins.findIndex(a => a.dni === client.dni && a.id !== 'admin_default');
            if (adminIdx >= 0) {
              updatedAdmins[adminIdx] = {
                ...updatedAdmins[adminIdx],
                estado: 'INACTIVO'
              };
            }
          }
        }
      });
    }

    syncMember(comite.presidente, 'ADMIN');
    syncMember(comite.secretario, 'SECRETARIO');
    syncMember(comite.tesorero, 'TESORERO');
    syncMember(comite.fiscalizador, 'FISCALIZADOR');
    if (comite.vocal) {
      syncMember(comite.vocal, 'VOCAL');
    }

    return updatedAdmins;
  };

  const deactiveMembersAdmins = (stateData: AppState, comite: Committee) => {
    let updatedAdmins = [...stateData.admins];
    const memberIds = [
      comite.presidente?.clientId,
      comite.secretario?.clientId,
      comite.tesorero?.clientId,
      comite.fiscalizador?.clientId,
      comite.vocal?.clientId
    ].filter(Boolean);

    memberIds.forEach(id => {
      const client = stateData.clients.find(c => c.id === id);
      if (client) {
        const adminIdx = updatedAdmins.findIndex(a => a.dni === client.dni && a.id !== 'admin_default');
        if (adminIdx >= 0) {
          updatedAdmins[adminIdx] = {
            ...updatedAdmins[adminIdx],
            estado: 'INACTIVO'
          };
        }
      }
    });

    return updatedAdmins;
  };

  const addCommittee = async (committee: Omit<Committee, 'id' | 'createdBy' | 'createdAt'>) => {
    const exists = (state.comites || []).some(
      c => c.nombrePeriodo.trim().toLowerCase() === committee.nombrePeriodo.trim().toLowerCase()
    );
    if (exists) {
      throw new Error(`Ya existe un comité registrado para el período de elección "${committee.nombrePeriodo}".`);
    }

    setState(prev => {
      const id = generateId();
      const newComite: Committee = {
        ...committee,
        id,
        createdAt: new Date().toISOString(),
        createdBy: user?.email || 'Unknown'
      };

      let updatedComites = [...(prev.comites || [])];
      let updatedAdmins = [...prev.admins];

      if (newComite.activo) {
        const oldActive = updatedComites.find(c => c.activo);
        updatedComites = updatedComites.map(c => ({ ...c, activo: false }));
        updatedAdmins = syncCommitteeAdmins(prev, newComite, oldActive);
      }

      updatedComites.push(newComite);

      const newState = { ...prev, comites: updatedComites, admins: updatedAdmins };
      setLocalData(newState);
      setTimeout(() => addAuditLog('CREAR', 'SISTEMA', `Registró nuevo comité: ${committee.nombrePeriodo}`), 0);
      return newState;
    });
  };

  const updateCommittee = async (id: string, updates: Partial<Committee>) => {
    if (updates.nombrePeriodo) {
      const exists = (state.comites || []).some(
        c => c.id !== id && c.nombrePeriodo.trim().toLowerCase() === updates.nombrePeriodo!.trim().toLowerCase()
      );
      if (exists) {
        throw new Error(`Ya existe otro comité registrado para el período de elección "${updates.nombrePeriodo}".`);
      }
    }

    setState(prev => {
      let updatedComites = [...(prev.comites || [])];
      let updatedAdmins = [...prev.admins];
      
      const targetComiteIdx = updatedComites.findIndex(c => c.id === id);
      if (targetComiteIdx === -1) return prev;

      const oldComite = updatedComites[targetComiteIdx];
      const mergedComite = { ...oldComite, ...updates };

      if (updates.activo !== undefined) {
        if (updates.activo === true) {
          const oldActive = updatedComites.find(c => c.activo && c.id !== id);
          updatedComites = updatedComites.map(c => c.id === id ? mergedComite : { ...c, activo: false });
          updatedAdmins = syncCommitteeAdmins(prev, mergedComite, oldActive);
        } else {
          updatedComites = updatedComites.map(c => c.id === id ? mergedComite : c);
          updatedAdmins = deactiveMembersAdmins(prev, mergedComite);
        }
      } else {
        updatedComites[targetComiteIdx] = mergedComite;
        if (mergedComite.activo) {
          updatedAdmins = syncCommitteeAdmins(prev, mergedComite, oldComite);
        }
      }

      const newState = { ...prev, comites: updatedComites, admins: updatedAdmins };
      setLocalData(newState);
      setTimeout(() => addAuditLog('ACTUALIZAR', 'SISTEMA', `Actualizó comité: ${mergedComite.nombrePeriodo}`), 0);
      return newState;
    });
  };

  const deleteCommittee = async (id: string) => {
    setState(prev => {
      const targetComite = (prev.comites || []).find(c => c.id === id);
      if (!targetComite) return prev;

      let updatedAdmins = [...prev.admins];
      if (targetComite.activo) {
        updatedAdmins = deactiveMembersAdmins(prev, targetComite);
      }

      const updatedComites = (prev.comites || []).filter(c => c.id !== id);
      const newState = { ...prev, comites: updatedComites, admins: updatedAdmins };
      setLocalData(newState);
      setTimeout(() => addAuditLog('ELIMINAR', 'SISTEMA', `Eliminó comité: ${targetComite.nombrePeriodo}`), 0);
      return newState;
    });
  };

  const toggleCommitteeStatus = async (id: string) => {
    setState(prev => {
      let updatedComites = [...(prev.comites || [])];
      let updatedAdmins = [...prev.admins];

      const targetIdx = updatedComites.findIndex(c => c.id === id);
      if (targetIdx === -1) return prev;

      const targetComite = updatedComites[targetIdx];
      const newStatus = !targetComite.activo;

      if (newStatus === true) {
        const oldActive = updatedComites.find(c => c.activo);
        updatedComites = updatedComites.map((c, idx) => {
          if (idx === targetIdx) {
            return { ...c, activo: true };
          }
          return { ...c, activo: false };
        });
        updatedAdmins = syncCommitteeAdmins(prev, { ...targetComite, activo: true }, oldActive);
      } else {
        updatedComites[targetIdx] = { ...targetComite, activo: false };
        updatedAdmins = deactiveMembersAdmins(prev, targetComite);
      }

      const newState = { ...prev, comites: updatedComites, admins: updatedAdmins };
      setLocalData(newState);
      setTimeout(() => addAuditLog('ACTUALIZAR', 'SISTEMA', `Modificó estado de vigencia del comité: ${targetComite.nombrePeriodo}`), 0);
      return newState;
    });
  };

  const addTrabajador = async (trabajador: Omit<Trabajador, 'id' | 'fechaRegistro'>) => {
    if (!trabajador.nombres || !trabajador.nombres.trim() || !trabajador.apellidos || !trabajador.apellidos.trim()) {
      throw new Error('Nombres y Apellidos no pueden estar vacíos.');
    }
    if (!trabajador.dni || !/^\d{8}$/.test(trabajador.dni)) {
      throw new Error('El DNI debe tener exactamente 8 dígitos numéricos.');
    }
    const existing = (state.trabajadores || []).find(t => t.dni === trabajador.dni);
    if (existing) {
      throw new Error('El DNI ingresado ya pertenece a un trabajador registrado.');
    }
    if (trabajador.sueldoMensual <= 0) {
      throw new Error('El sueldo mensual debe ser mayor a cero.');
    }

    const nTrabajador: Trabajador = {
      ...trabajador,
      id: `TRAB-${Date.now()}`,
      fechaRegistro: new Date().toISOString(),
      createdBy: user?.email || 'Admin'
    };

    const newTrabajadores = [...(state.trabajadores || []), nTrabajador];
    persistState({ ...state, trabajadores: newTrabajadores });
    setTimeout(() => addAuditLog('CREAR', 'SISTEMA', `Registró al trabajador de planta: ${nTrabajador.nombres} ${nTrabajador.apellidos}`), 0);
  };

  const updateTrabajador = async (id: string, updates: Partial<Trabajador>) => {
    if (updates.nombres !== undefined && (!updates.nombres || !updates.nombres.trim())) {
      throw new Error('El nombre no puede estar vacío.');
    }
    if (updates.apellidos !== undefined && (!updates.apellidos || !updates.apellidos.trim())) {
      throw new Error('El apellido no puede estar vacío.');
    }
    if (updates.dni !== undefined) {
      if (!updates.dni || !/^\d{8}$/.test(updates.dni)) {
        throw new Error('El DNI debe tener exactamente 8 dígitos numéricos.');
      }
      const existing = (state.trabajadores || []).find(t => t.dni === updates.dni && t.id !== id);
      if (existing) {
        throw new Error('El DNI ingresado ya pertenece a otro trabajador registrado.');
      }
    }
    if (updates.sueldoMensual !== undefined && updates.sueldoMensual <= 0) {
      throw new Error('El sueldo mensual debe ser mayor a cero.');
    }

    const newTrabajadores = (state.trabajadores || []).map(t => t.id === id ? { ...t, ...updates } : t);
    persistState({ ...state, trabajadores: newTrabajadores });
    setTimeout(() => addAuditLog('ACTUALIZAR', 'SISTEMA', `Actualizó información del trabajador ID: ${id}`), 0);
  };

  const addPagoSueldo = async (pago: Omit<PagoSueldo, 'id' | 'fechaPago' | 'comprobante' | 'createdBy'>) => {
    const worker = (state.trabajadores || []).find(t => t.id === pago.trabajadorId);
    if (!worker) {
      throw new Error('El trabajador seleccionado no existe.');
    }
    if (worker.estado !== 'ACTIVO') {
      throw new Error('Solo los trabajadores activos pueden recibir pagos de remuneración.');
    }

    const alreadyPaid = (state.pagosSueldos || []).some(
      p => p.trabajadorId === pago.trabajadorId && p.mesPagado === pago.mesPagado
    );
    if (alreadyPaid) {
      const [year, month] = pago.mesPagado.split('-');
      const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
      ];
      const monthName = monthNames[parseInt(month, 10) - 1] || month;
      throw new Error(`El trabajador ya tiene registrado el pago de sueldo correspondiente al mes de ${monthName}/${year}.`);
    }

    let compNo = `S-${Date.now().toString().slice(-6)}`;
    let existsComp = (state.pagosSueldos || []).some(p => p.comprobante === compNo) ||
                     (state.transactions || []).some(t => t.comprobante === compNo);
    let offset = 1;
    while (existsComp) {
      compNo = `S-${(Date.now() + offset).toString().slice(-6)}`;
      existsComp = (state.pagosSueldos || []).some(p => p.comprobante === compNo) ||
                   (state.transactions || []).some(t => t.comprobante === compNo);
      offset++;
    }

    const nPago: PagoSueldo = {
      ...pago,
      id: `PAG-${Date.now()}`,
      fechaPago: new Date().toISOString(),
      comprobante: compNo,
      createdBy: user?.email || 'Admin'
    };

    const newPagos = [...(state.pagosSueldos || []), nPago];

    const egresoTx: Transaction = {
      id: `TX-EG-${Date.now()}`,
      tipo: 'EGRESO',
      categoria: 'SUELDOS',
      monto: Number(pago.monto),
      fecha: new Date().toISOString(),
      descripcion: pago.observaciones || `PAGO DE SUELDO - MES: ${pago.mesPagado} - TRABAJADOR: ${pago.trabajadorNombreCompleto}`,
      destinatario: pago.trabajadorNombreCompleto,
      createdBy: user?.email || 'Admin',
      comprobante: compNo,
      metodoPago: 'EFECTIVO'
    };

    const newTransactions = [...(state.transactions || []), egresoTx];

    persistState({
      ...state,
      pagosSueldos: newPagos,
      transactions: newTransactions
    });

    setTimeout(() => addAuditLog('CREAR', 'FINANZAS', `Registró pago de sueldo a: ${pago.trabajadorNombreCompleto} por el mes ${pago.mesPagado}`), 0);
    return nPago;
  };

  const updateSettings = async (settings: any) => {
    persistState({
      ...state,
      settings: { ...state.settings, ...settings }
    });
    setTimeout(() => addAuditLog('ACTUALIZAR', 'SISTEMA', `Actualizó configuración del sistema`), 0);
  };

  return (
    <AppContext.Provider value={{
      ...state,
      comites: state.comites || [],
      trabajadores: state.trabajadores || [],
      pagosSueldos: state.pagosSueldos || [],
      user,
      userRole,
      mustChangePassword,
      loadingAuth,
      addClient,
      updateClient,
      transferSupply,
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
      markSupplyAsSocio,
      setSupplySocioStatus,
      login,
      logout,
      addAuditLog,
      addCommittee,
      updateCommittee,
      deleteCommittee,
      toggleCommitteeStatus,
      addTrabajador,
      updateTrabajador,
      addPagoSueldo
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
