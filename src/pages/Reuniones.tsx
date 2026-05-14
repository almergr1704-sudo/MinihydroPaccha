import React, { useState } from 'react';
import { Plus, Users, Calendar, AlertCircle } from 'lucide-react';
import { useAppContext } from '../store/AppContext';
import { Button, Card, CardContent, Badge, CardHeader, CardTitle } from '../components/ui';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Reuniones() {
  const { clients, meetings, addMeeting, recordAttendance } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<string | null>(null);
  const [attendanceFilter, setAttendanceFilter] = useState<'SOCIO' | 'TODOS'>('SOCIO');
  
  const socios = clients.filter(c => c.tipo === 'SOCIO' && c.estado === 'ACTIVO');
  const filteredClientsList = clients.filter(c => c.estado === 'ACTIVO' && (attendanceFilter === 'TODOS' || c.tipo === 'SOCIO'));

  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().slice(0, 16),
    motivo: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.motivo) return;
    
    addMeeting({
      fecha: new Date(formData.fecha).toISOString(),
      motivo: formData.motivo,
      asistencia: {} // Initialize with empty attendance
    });
    
    setIsModalOpen(false);
    setFormData({ fecha: new Date().toISOString().slice(0, 16), motivo: '' });
  };

  const activeMeeting = meetings.find(m => m.id === selectedMeeting);

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold leading-7 text-slate-100 sm:truncate sm:text-3xl sm:tracking-tight">
            Gestión de Reuniones
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Programación de asambleas y control de asistencia (solo socios).
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
            Programar Reunión
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <h3 className="text-lg font-medium text-slate-100">Historial de Reuniones</h3>
          <div className="space-y-3">
             {meetings.length > 0 ? [...meetings].sort((a,b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()).map(m => (
               <Card 
                 key={m.id} 
                 className={`cursor-pointer transition-colors ${selectedMeeting === m.id ? 'border-blue-500 ring-1 ring-blue-500' : 'hover:border-slate-700'}`}
                 onClick={() => setSelectedMeeting(m.id)}
                >
                 <CardContent className="p-4 flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-1">
                      <Calendar className="h-5 w-5 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-100">{m.motivo}</p>
                      <p className="text-xs text-slate-400">{format(parseISO(m.fecha), "dd MMM yyyy 'a las' HH:mm", { locale: es })}</p>
                      <div className="mt-2 flex items-center space-x-2">
                        <Badge variant="info">{Object.values(m.asistencia).filter(a => a === 'ASISTIO').length} Asistentes</Badge>
                      </div>
                    </div>
                 </CardContent>
               </Card>
             )) : (
               <div className="text-center py-8 text-slate-400 bg-[#0B0E14] rounded-xl border border-slate-800">
                 No hay reuniones programadas.
               </div>
             )}
          </div>
        </div>

        <div className="lg:col-span-2">
          {activeMeeting ? (
            <Card>
              <CardHeader className="bg-slate-800/50 border-b border-slate-800">
                 <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                    <div>
                      <CardTitle>{activeMeeting.motivo}</CardTitle>
                      <p className="text-sm text-slate-400 mt-1">
                        {format(parseISO(activeMeeting.fecha), "eeee, dd 'de' MMMM 'de' yyyy, HH:mm", { locale: es })}
                      </p>
                    </div>
                    
                    <div className="flex space-x-2">
                       <button
                         onClick={() => setAttendanceFilter('SOCIO')}
                         className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                           attendanceFilter === 'SOCIO' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                         }`}
                       >
                         Solo Socios
                       </button>
                       <button
                         onClick={() => setAttendanceFilter('TODOS')}
                         className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                           attendanceFilter === 'TODOS' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                         }`}
                       >
                         Todos los Clientes
                       </button>
                    </div>
                 </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="bg-yellow-500/10 p-4 border-b border-yellow-500/20 flex items-start space-x-3">
                   <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                   <p className="text-sm text-yellow-200/80">
                     Marcar a una persona con <strong>"Falta Injustificada"</strong> penalizará según las reglas.
                   </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-800">
                    <thead className="bg-slate-800/50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Persona</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Estado de Asistencia</th>
                      </tr>
                    </thead>
                    <tbody className="bg-[#0B0E14] divide-y divide-slate-800">
                       {filteredClientsList.map(socio => {
                         const status = activeMeeting.asistencia[socio.id];
                         return (
                           <tr key={socio.id} className="hover:bg-slate-800/50">
                             <td className="px-6 py-4 whitespace-nowrap">
                               <div className="flex items-center">
                                 <div className="flex-shrink-0 h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                                   <Users className="h-4 w-4 text-blue-600" />
                                 </div>
                                 <div className="ml-4">
                                   <div className="text-sm font-medium text-slate-100">{socio.nombre ? socio.nombre : `${socio.nombres} ${socio.apellidos}`} <span className="ml-2 text-xs text-slate-400">({socio.tipo})</span></div>
                                   <div className="text-xs text-slate-400">{socio.codigoSuministro}</div>
                                 </div>
                               </div>
                             </td>
                             <td className="px-6 py-4 whitespace-nowrap">
                               <div className="flex space-x-2">
                                  <button
                                    onClick={() => recordAttendance(activeMeeting.id, socio.id, 'ASISTIO')}
                                    className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                                      status === 'ASISTIO' ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/50' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                    }`}
                                  >
                                    Asistió
                                  </button>
                                  <button
                                    onClick={() => recordAttendance(activeMeeting.id, socio.id, 'FALTA_JUSTIFICADA')}
                                    className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                                      status === 'FALTA_JUSTIFICADA' ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/50' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                    }`}
                                  >
                                    Falta Justificada
                                  </button>
                                  <button
                                    onClick={() => recordAttendance(activeMeeting.id, socio.id, 'FALTA_INJUSTIFICADA')}
                                    className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                                      status === 'FALTA_INJUSTIFICADA' ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500/50' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                    }`}
                                  >
                                    Injustificada (Multa)
                                  </button>
                               </div>
                             </td>
                           </tr>
                         )
                       })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : (
             <div className="h-full flex flex-col items-center justify-center bg-[#0B0E14] border border-slate-800 rounded-xl border-dashed py-12">
                <Calendar className="h-12 w-12 text-slate-600 mb-3" />
                <h3 className="text-lg font-medium text-slate-100">Ninguna reunión seleccionada</h3>
                <p className="text-slate-400 mt-1">Selecciona una reunión de la lista para gestionar la asistencia.</p>
             </div>
          )}
        </div>
      </div>

      {/* Modal Add Meeting */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-slate-900 bg-opacity-75 transition-opacity" onClick={() => setIsModalOpen(false)}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="relative z-10 inline-block align-bottom bg-[#0B0E14] rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full">
              <form onSubmit={handleSubmit}>
                <div className="bg-[#0B0E14] px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg leading-6 font-medium text-slate-100" id="modal-title">
                    Programar Asamblea / Reunión
                  </h3>
                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300">Fecha y Hora</label>
                      <input 
                        type="datetime-local" 
                        required 
                        value={formData.fecha} 
                        onChange={e => setFormData({...formData, fecha: e.target.value})} 
                        className="mt-1 block w-full border border-slate-700 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-[#0B0E14] text-slate-100" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300">Motivo de la Reunión</label>
                      <input
                        type="text"
                        required
                        placeholder="Ej. Asamblea General Ordinaria"
                        value={formData.motivo} 
                        onChange={e => setFormData({...formData, motivo: e.target.value})} 
                        className="mt-1 block w-full border border-slate-700 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-[#0B0E14] text-slate-100 placeholder-slate-500" 
                      />
                    </div>
                  </div>
                </div>
                <div className="bg-slate-800/50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <Button type="submit" className="w-full sm:ml-3 sm:w-auto">Crear Reunión</Button>
                  <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="mt-3 w-full sm:mt-0 sm:w-auto">Cancelar</Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
