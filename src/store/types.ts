export type ClientType = 'SOCIO' | 'USUARIO';
export type TransactionType = 'INGRESO' | 'EGRESO';
export type IncomeCategory = 'CONSUMO' | 'APORTE' | 'MULTA' | 'RECONEXION' | 'OTROS';
export type ExpenseCategory = 'MANTENIMIENTO' | 'MATERIALES' | 'SUELDOS' | 'EQUIPOS' | 'ADMINISTRATIVOS' | 'OTROS';
export type AttendanceStatus = 'ASISTIO' | 'FALTA_JUSTIFICADA' | 'FALTA_INJUSTIFICADA';
export type PaymentStatus = 'PENDIENTE' | 'PAGADO';

export interface Client {
  id: string;
  nombres: string;
  apellidos: string;
  tipoPersona?: 'PERSONA' | 'EMPRESA';
  dni: string;
  direccion: string;
  numeroDireccion: string;
  referenciaDireccion: string;
  telefono: string;
  correo: string;
  codigoSuministro?: string;
  suministros?: string[];
  tipo: ClientType;
  faseSuministro?: 'MONOFASICO' | 'TRIFASICO';
  estado: 'ACTIVO' | 'INACTIVO' | 'CORTADO';
  fechaRegistro: string;
  nombre?: string; // Legacy fallback
}

export interface Consumption {
  id: string;
  clientId: string;
  codigoSuministro?: string;
  fechaLectura: string;
  mes: string; // YYYY-MM
  kwh: number;
  montoCalculado: number;
  estadoPago: PaymentStatus;
}

export interface Transaction {
  id: string;
  tipo: TransactionType;
  categoria: IncomeCategory | ExpenseCategory;
  monto: number;
  fecha: string;
  descripcion: string;
  destinatario?: string; // For egresos
  clientId?: string; // If associated with a specific client (e.g. payment, fine)
}

export interface Meeting {
  id: string;
  fecha: string;
  motivo: string;
  asistencia: Record<string, AttendanceStatus>; // clientId -> status
  lugar?: string;
  temas?: string;
  invitados?: 'SOCIO' | 'TODOS';
  finalizada?: boolean;
}

export interface Fine {
  id: string;
  clientId: string;
  meetingId?: string;
  monto: number;
  motivo: string;
  estadoPago: PaymentStatus;
  fecha: string;
}

export interface AppSettings {
  costoSocio: number;
  costoUsuario: number;
  costoTrifasico: number;
  multaReunion: number;
  costoReconexion: number;
  consumoMinimo: number;
}

export interface AppState {
  clients: Client[];
  consumptions: Consumption[];
  transactions: Transaction[];
  meetings: Meeting[];
  admins: any[];
  fines: Fine[];
  settings: AppSettings;
}
