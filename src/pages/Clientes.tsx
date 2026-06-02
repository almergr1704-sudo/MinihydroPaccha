import React, { useState, useRef } from 'react';
import { Plus, Search, User, Filter, Upload, Download, FileWarning } from 'lucide-react';
import { useAppContext } from '../store/AppContext';
import { Button, Card, CardContent, Badge, Pagination } from '../components/ui';
import { Client, ClientType } from '../store/types';
import { normalizeSearchText } from '../lib/utils';
import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';

export default function Clientes() {
  const { clients, addClient, updateClient, settings, consumptions, fines, addTransaction, userRole, meetings } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<ClientType | 'TODOS' | 'CORTADO'>('TODOS');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [suministrosStr, setSuministrosStr] = useState('');
  const [apellidoPaterno, setApellidoPaterno] = useState('');
  const [apellidoMaterno, setApellidoMaterno] = useState('');
  const initialFormState: Omit<Client, 'id' | 'fechaRegistro'> = {
    nombres: '',
    apellidos: '',
    tipoPersona: 'PERSONA',
    dni: '',
    direccion: '',
    numeroDireccion: '',
    referenciaDireccion: '',
    telefono: '',
    correo: '',
    codigoSuministro: '',
    suministros: [],
    tipo: 'USUARIO',
    estado: 'ACTIVO'
  };
  const [formData, setFormData] = useState<Omit<Client, 'id' | 'fechaRegistro'>>(initialFormState);

  const openEditModal = (client: Client) => {
    setEditingId(client.id);
    const aps = client.apellidos || client.nombre?.split(' ').slice(1).join(' ') || '';
    const parts = aps.split(' ');
    setApellidoPaterno(parts[0] || '');
    setApellidoMaterno(parts.slice(1).join(' ') || '');
    
    setFormData({
      nombres: client.nombres || client.nombre?.split(' ')[0] || '',
      apellidos: aps,
      tipoPersona: client.tipoPersona || 'PERSONA',
      dni: client.dni || '',
      direccion: client.direccion || '',
      numeroDireccion: client.numeroDireccion || '',
      referenciaDireccion: client.referenciaDireccion || '',
      telefono: client.telefono || '',
      correo: client.correo || '',
      codigoSuministro: client.codigoSuministro || '',
      suministros: client.suministros || [],
      tipo: client.tipo || 'USUARIO',
      estado: client.estado || 'ACTIVO'
    });
    setSuministrosStr((client.suministros || [client.codigoSuministro]).join(', '));
    setIsModalOpen(true);
  };

  const filteredClients = clients.filter(c => {
    const rawFullName = c.nombre ? c.nombre : `${c.nombres || ''} ${c.apellidos || ''}`;
    const fullName = normalizeSearchText(rawFullName);
    const dni = normalizeSearchText(c.dni || '');
    const allSuministros = normalizeSearchText([c.codigoSuministro || '', ...(c.suministros || [])].join(' '));
    const normalizedSearch = normalizeSearchText(searchTerm);
    
    const matchesSearch = !normalizedSearch || 
                          fullName.includes(normalizedSearch) || 
                          dni.includes(normalizedSearch) || 
                          allSuministros.includes(normalizedSearch);
                          
    const matchesType = filterType === 'TODOS' || 
                        (filterType === 'CORTADO' ? c.estado === 'CORTADO' : c.tipo === filterType);

    return matchesSearch && matchesType;
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const totalPages = Math.ceil(filteredClients.length / itemsPerPage);
  
  const currentClients = filteredClients.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset to first page if search/filter changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType]);

  const ensurePrefix = (s: string) => {
    const trimmed = s.trim();
    if (!trimmed) return "";
    return trimmed.toUpperCase().startsWith('SUM-') ? trimmed.toUpperCase() : `SUM-${trimmed}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.confirm('¿Está seguro de guardar este registro?')) return;

    if (editingId && formData.estado === 'ACTIVO') {
      const client = clients.find(c => c.id === editingId);
      if (client && client.estado === 'CORTADO') {
        const pendingDebtsCount = consumptions.filter(c => c.clientId === editingId && c.estadoPago === 'PENDIENTE').length;
        const pendingFinesCount = (fines || []).filter(f => f.clientId === editingId && f.estadoPago === 'PENDIENTE').length;
        
        if (pendingDebtsCount > 0 || pendingFinesCount > 0) {
          toast.error('El cliente no puede ser reactivado porque tiene recibos de consumo o multas pendientes.');
          return;
        }

        if (settings?.costoReconexion > 0) {
          const confirmReconexion = window.confirm(`Para reactivar el servicio se requiere el pago de reconexión (S/ ${settings.costoReconexion.toFixed(2)}).\n\n¿El cliente ya realizó este pago?\nAl aceptar, se registrará el ingreso automáticamente y el estado cambiará a ACTIVO.`);
          if (!confirmReconexion) {
            return;
          }

          await addTransaction({
            tipo: 'INGRESO',
            categoria: 'RECONEXION',
            monto: settings.costoReconexion,
            descripcion: 'Cobro y pago por reconexión de servicio',
            clientId: editingId
          });
        }
      }
    }

    const suministrosArray = suministrosStr.split(',').map(s => ensurePrefix(s)).filter(s => s);
    const clientData = {
      ...formData,
      apellidos: `${apellidoPaterno} ${apellidoMaterno}`.trim(),
      suministros: suministrosArray,
      codigoSuministro: suministrosArray[0] || ensurePrefix(formData.codigoSuministro)
    };

    if (editingId) {
      await updateClient(editingId, clientData);
    } else {
      await addClient(clientData);
    }
    closeModal();
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setSuministrosStr('');
    setApellidoPaterno('');
    setApellidoMaterno('');
    setFormData(initialFormState);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        // Process records
        let processed = 0;
        data.forEach((row: any) => {
          // Identify fields loosely based on possible naming
          const nombres = row.Nombres || row.nombres || row.Nombre || row.nombre || '';
          
          let apellidos = '';
          if (row['Apellido Paterno'] || row['Apellido Materno']) {
            apellidos = `${row['Apellido Paterno'] || ''} ${row['Apellido Materno'] || ''}`.trim();
          } else {
            apellidos = row.Apellidos || row.apellidos || row.Apellido || row.apellido || '';
          }
          
          const dni = (row['DNI/RUC'] || row.DNI || row.dni || row.RUC || row.ruc || row.Documento || '').toString();
          const tipoPersonaRaw = (row['Tipo Persona'] || row.tipoPersona || row.TipoPersona || '').toString().toUpperCase();
          const tipoPersona = tipoPersonaRaw === 'EMPRESA' ? 'EMPRESA' : 'PERSONA';
          const tipo = (row.Tipo || row.tipo || 'USUARIO').toString().toUpperCase() === 'SOCIO' ? 'SOCIO' as const : 'USUARIO' as const;
          const suministroStr = (row.Suministro || row.suministro || row.Suministros || '').toString();
          
          if (nombres || apellidos || dni) {
            const suministrosArray = suministroStr.split(',').map((s: string) => ensurePrefix(s)).filter((s: string) => s);
            addClient({
              nombres,
              apellidos,
              tipoPersona,
              dni,
              tipo,
              estado: 'ACTIVO',
              direccion: row.Direccion || row.direccion || '',
              numeroDireccion: (row.Numero || row.numero || '').toString(),
              referenciaDireccion: row.Referencia || row.referencia || '',
              telefono: (row.Telefono || row.telefono || '').toString(),
              correo: row.Correo || row.correo || row.Email || row.email || '',
              codigoSuministro: suministrosArray[0] || '',
              suministros: suministrosArray
            });
            processed++;
          }
        });
        
        toast.success(`Se importaron ${processed} registros correctamente.`);
        setTimeout(() => window.location.reload(), 1000); // Wait for toast to display briefly
      } catch (err) {
        console.error(err);
        toast.error('Hubo un error importando el archivo.');
      }
    };
    reader.readAsBinaryString(file);
    if(fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([{
      'Tipo Persona': 'PERSONA o EMPRESA',
      Nombres: 'Juan (o Razón Social)',
      'Apellido Paterno': 'Perez (vacío si es empresa)',
      'Apellido Materno': 'Gomez (vacío si es empresa)',
      'DNI/RUC': '12345678',
      Tipo: 'SOCIO o USUARIO',
      Suministro: '001, 002',
      Direccion: 'Av. Principal',
      Numero: '123',
      Referencia: 'Frente al parque',
      Telefono: '987654321',
      Correo: 'juan@example.com'
    }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');
    XLSX.writeFile(wb, 'Plantilla_Clientes.xlsx');
  };

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold leading-7 text-slate-100 sm:truncate sm:text-3xl sm:tracking-tight">
            Gestión de Clientes
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Directorio de socios y usuarios de la central.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex gap-2">
          <input 
            type="file" 
            accept=".xlsx, .xls, .csv" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
          />
          <Button variant="outline" className="hidden sm:inline-flex" onClick={handleDownloadTemplate}>
            <Download className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
            Descargar Plantilla
          </Button>
          {userRole !== 'FISCALIZADOR' && (
            <>
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Upload className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                Importar Excel
              </Button>
              <Button onClick={() => setIsModalOpen(true)}>
                <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                Nuevo Registro
              </Button>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b border-slate-800 sm:flex sm:items-center sm:justify-between space-y-3 sm:space-y-0">
            <div className="relative rounded-md shadow-sm max-w-md w-full">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-slate-500" aria-hidden="true" />
              </div>
              <input
                type="text"
                className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-slate-700 rounded-md py-2 border bg-[#0B0E14] text-slate-100"
                placeholder="Buscar por nombre, DNI o suministro..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center space-x-2">
                <Filter className="h-5 w-5 text-slate-500 hidden sm:block" />
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as any)}
                  className="block w-full pl-3 pr-10 py-2 text-base border-slate-700 bg-transparent text-slate-100 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md border [&>option]:bg-slate-900"
                >
                  <option value="TODOS">Todos</option>
                  <option value="SOCIO">Solo Socios</option>
                  <option value="USUARIO">Solo Usuarios</option>
                  <option value="CORTADO">Solo En Corte</option>
                </select>
              </div>
            </div>
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredClients.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={(items) => { setItemsPerPage(items); setCurrentPage(1); }}
            disableTopBorder={true}
          />

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800">
              <thead className="bg-slate-800/50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Cliente / Suministro
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Contacto
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Estado
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Asistencia
                  </th>
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-[#0B0E14] divide-y divide-slate-800">
                {currentClients.length > 0 ? currentClients.map((client) => {
                  const pendingDebtsCount = consumptions.filter(c => c.clientId === client.id && c.estadoPago === 'PENDIENTE').length;
                  const aptForCut = pendingDebtsCount >= 3 && client.estado !== 'CORTADO';

                  // Calculate attendance percentage
                  let asisPercent = 0;
                  if (client.tipo === 'SOCIO') {
                    const asambleas = meetings.filter(m => m.tipo === 'ASAMBLEA' && m.estado === 'FINALIZADA');
                    const asambleasAsistidas = asambleas.filter(m => m.asistencia[client.id] === 'ASISTIO' || m.asistencia[client.id] === 'JUSTIFICO');
                    asisPercent = asambleas.length > 0 ? Math.round((asambleasAsistidas.length / asambleas.length) * 100) : 100;
                  }

                  return (
                  <tr key={client.id} className="hover:bg-slate-800/50">
                    <td className="px-6 py-4 whitespace-normal min-w-[250px]">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center">
                          <User className="h-5 w-5 text-slate-500" />
                        </div>
                        <div className="ml-4 break-words">
                          <div className="text-sm font-medium text-slate-100 flex flex-wrap gap-2 items-center">
                             {client.nombre ? client.nombre : `${client.nombres} ${client.apellidos}`.trim()}
                             {aptForCut && (
                                <span title="Apto para corte: 3 o más deudas pendientes" className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-900/50 text-red-400 border border-red-500/20 whitespace-nowrap">
                                  APTO PARA CORTE ({pendingDebtsCount} deudas)
                                </span>
                             )}
                          </div>
                          <div className="text-sm text-slate-400">{(client.suministros?.length ? client.suministros.join(', ') : client.codigoSuministro)} ({client.tipoPersona === 'EMPRESA' ? 'RUC' : 'DNI'}: {client.dni})</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-normal min-w-[200px] max-w-[300px] break-words">
                      <div className="text-sm text-slate-100">{client.telefono}</div>
                      <div className="text-sm text-slate-400">{client.direccion} {client.numeroDireccion ? `N° ${client.numeroDireccion}` : ''} {client.referenciaDireccion ? `(${client.referenciaDireccion})` : ''}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1 items-start">
                        <Badge variant={client.tipo === 'SOCIO' ? 'success' : 'info'}>
                          {client.tipo}
                        </Badge>
                        {client.faseSuministro && (
                          <Badge variant="info" className="text-slate-400 border-slate-700">
                            {client.faseSuministro}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant={client.estado === 'ACTIVO' ? 'success' : client.estado === 'CORTADO' ? 'danger' : 'warning'}>
                        {client.estado}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {client.tipo === 'SOCIO' ? (
                        <div className="flex items-center">
                          <div className="w-16 bg-slate-700 rounded-full h-2 mr-2">
                            <div className={`h-2 rounded-full ${asisPercent >= 80 ? 'bg-emerald-500' : asisPercent >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${asisPercent}%` }}></div>
                          </div>
                          <span className="text-xs text-slate-300">{asisPercent}%</span>
                        </div>
                      ) : (
                         <span className="text-xs text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                       {userRole !== 'FISCALIZADOR' && aptForCut && (
                          <button 
                            onClick={() => {
                              if(window.confirm('¿Desea marcar el servicio como EN CORTE?')) {
                                updateClient(client.id, { estado: 'CORTADO' });
                              }
                            }}
                            className="text-red-500 hover:text-red-700 underline underline-offset-2 mr-3 font-semibold"
                          >
                            En corte
                          </button>
                       )}
                       {userRole !== 'FISCALIZADOR' && client.estado === 'CORTADO' && (
                         <button 
                           onClick={() => {
                             if(pendingDebtsCount > 0) {
                               toast.error('El cliente no puede ser reactivado porque tiene deudas pendientes.');
                             } else {
                               if(window.confirm('¿Desea REACTIVAR el servicio del cliente?')) {
                                 updateClient(client.id, { estado: 'ACTIVO' });
                               }
                             }
                           }}
                           className={`${pendingDebtsCount > 0 ? "text-slate-500 cursor-not-allowed" : "text-emerald-500 hover:text-emerald-400"} mr-3 font-semibold`}
                         >
                           Reactivar
                         </button>
                       )}
                      {userRole !== 'FISCALIZADOR' && (
                        <button 
                          onClick={() => openEditModal(client)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Editar
                        </button>
                      )}
                    </td>
                  </tr>
                )}) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-slate-400">
                      No se encontraron registros que coincidan con la búsqueda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            
            {/* Pagination Controls */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredClients.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={(items) => { setItemsPerPage(items); setCurrentPage(1); }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Modal for Add Client */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-slate-900 bg-opacity-75 transition-opacity" onClick={() => setIsModalOpen(false)}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="relative z-10 inline-block align-bottom bg-[#0B0E14] rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleSubmit}>
                <div className="bg-[#0B0E14] px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                      <h3 className="text-lg leading-6 font-medium text-slate-100" id="modal-title">
                        {editingId ? 'Editar Cliente' : 'Registrar Nuevo Cliente'}
                      </h3>
                      <div className="mt-4 space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-1">Tipo de Persona</label>
                          <div className="flex gap-4">
                            <label className="flex items-center text-slate-300">
                              <input type="radio" value="PERSONA" checked={formData.tipoPersona === 'PERSONA'} onChange={e => setFormData({...formData, tipoPersona: 'PERSONA'})} className="mr-2 text-blue-500 focus:ring-blue-500 bg-[#0B0E14] border-slate-700" />
                              Persona Natural
                            </label>
                            <label className="flex items-center text-slate-300">
                              <input type="radio" value="EMPRESA" checked={formData.tipoPersona === 'EMPRESA'} onChange={e => setFormData({...formData, tipoPersona: 'EMPRESA'})} className="mr-2 text-blue-500 focus:ring-blue-500 bg-[#0B0E14] border-slate-700" />
                              Empresa
                            </label>
                          </div>
                        </div>
                        
                        {formData.tipoPersona === 'PERSONA' ? (
                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-slate-300">Nombres</label>
                              <input type="text" required value={formData.nombres} onChange={e => setFormData({...formData, nombres: e.target.value})} className="mt-1 block w-full border border-slate-700 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-[#0B0E14] text-slate-100" />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-slate-300">Apellido Paterno</label>
                              <input type="text" required value={apellidoPaterno} onChange={e => setApellidoPaterno(e.target.value)} className="mt-1 block w-full border border-slate-700 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-[#0B0E14] text-slate-100" />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-slate-300">Apellido Materno</label>
                              <input type="text" value={apellidoMaterno} onChange={e => setApellidoMaterno(e.target.value)} className="mt-1 block w-full border border-slate-700 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-[#0B0E14] text-slate-100" />
                            </div>
                          </div>
                        ) : (
                          <div>
                            <label className="block text-sm font-medium text-slate-300">Razón Social</label>
                            <input type="text" required value={formData.nombres} onChange={e => setFormData({...formData, nombres: e.target.value})} className="mt-1 block w-full border border-slate-700 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-[#0B0E14] text-slate-100" />
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-300">
                              {formData.tipoPersona === 'PERSONA' ? 'DNI' : 'RUC'}
                            </label>
                            <input 
                              type="text" 
                              required 
                              value={formData.dni} 
                              onChange={e => {
                                const val = e.target.value.replace(/\D/g, '');
                                setFormData({...formData, dni: val});
                              }} 
                              maxLength={formData.tipoPersona === 'PERSONA' ? 8 : 11}
                              minLength={formData.tipoPersona === 'PERSONA' ? 8 : 11}
                              pattern={formData.tipoPersona === 'PERSONA' ? "\\d{8}" : "\\d{11}"}
                              title={formData.tipoPersona === 'PERSONA' ? "Debe contener 8 dígitos" : "Debe contener 11 dígitos"}
                              className="mt-1 block w-full border border-slate-700 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-[#0B0E14] text-slate-100" 
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-300">Cod. Suministro(s)</label>
                            <div className="mt-1 flex rounded-md shadow-sm border border-slate-700 overflow-hidden focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500">
                              <span className="inline-flex items-center px-3 border-r border-slate-700 bg-slate-800 text-slate-400 text-sm">
                                SUM-
                              </span>
                              <input 
                                type="text" 
                                required 
                                value={suministrosStr.split(',').map(s => s.trim().replace(/^SUM-/i, '')).join(', ')} 
                                onChange={e => setSuministrosStr(e.target.value)} 
                                placeholder="Ej: 001, 002" 
                                className="flex-1 block w-full py-2 px-3 focus:outline-none sm:text-sm bg-[#0B0E14] text-slate-100" 
                              />
                            </div>
                            <p className="text-xs text-slate-500 mt-1">Separe múltiples códigos por comas (el prefijo SUM- se añade automáticamente).</p>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-300">Calle / Av. / Jr.</label>
                          <input type="text" required value={formData.direccion} onChange={e => setFormData({...formData, direccion: e.target.value})} className="mt-1 block w-full border border-slate-700 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-[#0B0E14] text-slate-100" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-300">N° de Dirección</label>
                            <input type="text" required value={formData.numeroDireccion} onChange={e => setFormData({...formData, numeroDireccion: e.target.value})} className="mt-1 block w-full border border-slate-700 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-[#0B0E14] text-slate-100" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-300">Referencia (Opcional)</label>
                            <input type="text" value={formData.referenciaDireccion} onChange={e => setFormData({...formData, referenciaDireccion: e.target.value})} className="mt-1 block w-full border border-slate-700 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-[#0B0E14] text-slate-100" />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-300">Teléfono</label>
                            <input type="text" value={formData.telefono} onChange={e => setFormData({...formData, telefono: e.target.value})} className="mt-1 block w-full border border-slate-700 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-[#0B0E14] text-slate-100" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-300">Tipo de Cliente</label>
                            <select value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value as any})} className="mt-1 block w-full bg-[#0B0E14] border border-slate-700 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                              <option value="USUARIO">USUARIO (S/ {settings?.costoUsuario?.toFixed(2) || '0.30'}/kWh)</option>
                              <option value="SOCIO">SOCIO (S/ {settings?.costoSocio?.toFixed(2) || '0.20'}/kWh)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-300">Tipo de Servicio</label>
                            <select value={formData.faseSuministro || 'MONOFASICO'} onChange={e => setFormData({...formData, faseSuministro: e.target.value as any})} className="mt-1 block w-full bg-[#0B0E14] border border-slate-700 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-slate-100">
                              <option value="MONOFASICO">Monofásico</option>
                              <option value="TRIFASICO">Trifásico</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-300">Estado</label>
                            <select value={formData.estado} onChange={e => setFormData({...formData, estado: e.target.value as any})} className="mt-1 block w-full bg-[#0B0E14] border border-slate-700 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-slate-100">
                              <option value="ACTIVO">ACTIVO</option>
                              <option value="INACTIVO">INACTIVO</option>
                              <option value="CORTADO">CORTADO</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-slate-800/50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <Button type="submit" className="w-full sm:ml-3 sm:w-auto">
                    {editingId ? 'Actualizar' : 'Guardar Registro'}
                  </Button>
                  <Button type="button" variant="outline" onClick={closeModal} className="mt-3 w-full sm:mt-0 sm:w-auto">
                    Cancelar
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
