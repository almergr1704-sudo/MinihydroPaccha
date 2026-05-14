import React, { useState, useRef } from 'react';
import { Plus, Search, User, Filter, Upload, Download } from 'lucide-react';
import { useAppContext } from '../store/AppContext';
import { Button, Card, CardContent, Badge } from '../components/ui';
import { Client, ClientType } from '../store/types';
import * as XLSX from 'xlsx';

export default function Clientes() {
  const { clients, addClient, updateClient } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<ClientType | 'TODOS'>('TODOS');
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
      dni: client.dni,
      direccion: client.direccion || '',
      numeroDireccion: client.numeroDireccion || '',
      referenciaDireccion: client.referenciaDireccion || '',
      telefono: client.telefono || '',
      correo: client.correo || '',
      codigoSuministro: client.codigoSuministro || '',
      suministros: client.suministros || [],
      tipo: client.tipo,
      estado: client.estado || 'ACTIVO'
    });
    setSuministrosStr((client.suministros || [client.codigoSuministro]).join(', '));
    setIsModalOpen(true);
  };

  const filteredClients = clients.filter(c => {
    const fullName = c.nombre ? c.nombre.toLowerCase() : `${c.nombres || ''} ${c.apellidos || ''}`.toLowerCase();
    const allSuministros = [c.codigoSuministro || '', ...(c.suministros || [])].join(' ').toLowerCase();
    const matchesSearch = fullName.includes(searchTerm.toLowerCase()) || 
                          c.dni.includes(searchTerm) || 
                          allSuministros.includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'TODOS' || c.tipo === filterType;
    return matchesSearch && matchesType;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const suministrosArray = suministrosStr.split(',').map(s => s.trim()).filter(s => s);
    const clientData = {
      ...formData,
      apellidos: `${apellidoPaterno} ${apellidoMaterno}`.trim(),
      suministros: suministrosArray,
      codigoSuministro: suministrosArray[0] || formData.codigoSuministro
    };

    if (editingId) {
      updateClient(editingId, clientData);
    } else {
      addClient(clientData);
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
          
          const dni = (row.DNI || row.dni || row.Documento || '').toString();
          const tipo = (row.Tipo || row.tipo || 'USUARIO').toString().toUpperCase() === 'SOCIO' ? 'SOCIO' as const : 'USUARIO' as const;
          const suministroStr = (row.Suministro || row.suministro || row.Suministros || '').toString();
          
          if (nombres || apellidos || dni) {
            const suministrosArray = suministroStr.split(',').map((s: string) => s.trim()).filter((s: string) => s);
            addClient({
              nombres,
              apellidos,
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
        
        alert(`Se importaron ${processed} registros correctamente. (Se requiere recargar la página para ver cambios agregados muy rapido)`);
        window.location.reload(); // Quick refresh to force sync state since we might fire multiple synchronous addClient which relies on previous state
      } catch (err) {
        console.error(err);
        alert('Hubo un error importando el archivo.');
      }
    };
    reader.readAsBinaryString(file);
    if(fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([{
      Nombres: 'Juan',
      'Apellido Paterno': 'Perez',
      'Apellido Materno': 'Gomez',
      DNI: '12345678',
      Tipo: 'SOCIO o USUARIO',
      Suministro: 'SUM-001, SUM-002',
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
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
            Importar Excel
          </Button>
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
            Nuevo Registro
          </Button>
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
            <div className="flex items-center space-x-2">
              <Filter className="h-5 w-5 text-slate-500" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="block w-full pl-3 pr-10 py-2 text-base border-slate-700 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md border"
              >
                <option value="TODOS">Todos</option>
                <option value="SOCIO">Solo Socios</option>
                <option value="USUARIO">Solo Usuarios</option>
              </select>
            </div>
          </div>

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
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-[#0B0E14] divide-y divide-slate-800">
                {filteredClients.length > 0 ? filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-slate-800/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center">
                          <User className="h-5 w-5 text-slate-500" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-slate-100">{client.nombre ? client.nombre : `${client.nombres} ${client.apellidos}`}</div>
                          <div className="text-sm text-slate-400">{(client.suministros?.length ? client.suministros.join(', ') : client.codigoSuministro)} (DNI: {client.dni})</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-100">{client.telefono}</div>
                      <div className="text-sm text-slate-400">{client.direccion} {client.numeroDireccion ? `N° ${client.numeroDireccion}` : ''} {client.referenciaDireccion ? `(${client.referenciaDireccion})` : ''}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant={client.tipo === 'SOCIO' ? 'success' : 'info'}>
                        {client.tipo}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant={client.estado === 'ACTIVO' ? 'success' : 'danger'}>
                        {client.estado}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button 
                        onClick={() => openEditModal(client)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-slate-400">
                      No se encontraron clientes con esos filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-300">DNI</label>
                            <input type="text" required value={formData.dni} onChange={e => setFormData({...formData, dni: e.target.value})} className="mt-1 block w-full border border-slate-700 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-[#0B0E14] text-slate-100" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-300">Cod. Suministro(s)</label>
                            <input type="text" required value={suministrosStr} onChange={e => setSuministrosStr(e.target.value)} placeholder="Ej: SUM-001, SUM-002" className="mt-1 block w-full border border-slate-700 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-[#0B0E14] text-slate-100" />
                            <p className="text-xs text-slate-500 mt-1">Separe múltiples códigos por comas.</p>
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
                              <option value="USUARIO">USUARIO (S/ 0.30/kWh)</option>
                              <option value="SOCIO">SOCIO (S/ 0.20/kWh)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-300">Estado</label>
                            <select value={formData.estado} onChange={e => setFormData({...formData, estado: e.target.value as any})} className="mt-1 block w-full bg-[#0B0E14] border border-slate-700 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-slate-100">
                              <option value="ACTIVO">ACTIVO</option>
                              <option value="INACTIVO">INACTIVO</option>
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
