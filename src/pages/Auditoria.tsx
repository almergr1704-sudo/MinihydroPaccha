import React, { useState, useMemo } from 'react';
import { Search, Filter, ShieldAlert, History } from 'lucide-react';
import { useAppContext } from '../store/AppContext';
import { Card, CardContent, Pagination, Badge } from '../components/ui';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Auditoria() {
  const { auditLogs, userRole } = useAppContext();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [moduloFilter, setModuloFilter] = useState<string>('TODOS');
  
  const filteredLogs = useMemo(() => {
    return (auditLogs || []).filter(log => {
      const matchesSearch = log.usuario.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            log.detalles.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesModulo = moduloFilter === 'TODOS' || log.modulo === moduloFilter;
      return matchesSearch && matchesModulo;
    });
  }, [auditLogs, searchTerm, moduloFilter]);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  
  const currentLogs = filteredLogs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (userRole !== 'ADMIN' && userRole !== 'FISCALIZADOR') {
    return (
      <div className="flex flex-col items-center justify-center p-10 h-[60vh] text-center">
        <ShieldAlert className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-slate-100 mb-2">Acceso Denegado</h2>
        <p className="text-slate-400 max-w-md">
          No tienes permisos suficientes para ver el módulo de auditoría. 
          Se requiere rol de ADMINISTRADOR o FISCALIZADOR.
        </p>
      </div>
    );
  }

  const getActionColor = (accion: string) => {
    switch (accion) {
      case 'CREAR': return 'success';
      case 'ELIMINAR': return 'danger';
      case 'ACTUALIZAR': return 'warning';
      default: return 'info';
    }
  };

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold leading-7 text-slate-100 sm:truncate sm:text-3xl sm:tracking-tight flex items-center">
            <History className="h-8 w-8 mr-3 text-blue-500" />
            Auditoría y Trazabilidad
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Registro inmutable de actividades y modificaciones en el sistema.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b border-slate-800 bg-[#0B0E14] sm:flex sm:items-center sm:justify-between space-y-3 sm:space-y-0 sm:space-x-4">
            <div className="relative flex-1 max-w-sm">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="h-4 w-4 text-slate-500" />
              </div>
              <input
                type="text"
                placeholder="Buscar por usuario o detalles..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full rounded-md border-0 py-1.5 pl-9 bg-slate-900/50 text-slate-200 ring-1 ring-inset ring-slate-800 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-slate-500" />
              <select
                value={moduloFilter}
                onChange={(e) => setModuloFilter(e.target.value)}
                className="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 bg-slate-900/50 text-slate-200 ring-1 ring-inset ring-slate-800 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 cursor-pointer"
              >
                <option value="TODOS">Todos los Módulos</option>
                <option value="USUARIOS">Usuarios</option>
                <option value="SOCIOS">Socios</option>
                <option value="CONSUMOS">Consumos y Facturación</option>
                <option value="FINANZAS">Finanzas</option>
                <option value="REUNIONES">Reuniones</option>
                <option value="SISTEMA">Sistema</option>
              </select>
            </div>
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredLogs.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={(items) => { setItemsPerPage(items); setCurrentPage(1); }}
            disableTopBorder={true}
          />

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800">
              <thead className="bg-slate-800/50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Fecha</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Usuario</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Módulo / Acción</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider text-right">Detalles</th>
                </tr>
              </thead>
              <tbody className="bg-[#0B0E14] divide-y divide-slate-800">
                {currentLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                      {format(parseISO(log.fecha), 'dd MMM yyyy, HH:mm:ss', { locale: es })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                      {log.usuario}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                      <div className="flex items-center space-x-2">
                        <span className="text-slate-400 font-medium">{log.modulo}</span>
                        <Badge variant={getActionColor(log.accion) as any}>{log.accion}</Badge>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-400 text-right max-w-md truncate" title={log.detalles}>
                      {log.detalles}
                    </td>
                  </tr>
                ))}
                {currentLogs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-slate-400">
                      No hay registros de auditoría que coincidan con la búsqueda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredLogs.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={(items) => { setItemsPerPage(items); setCurrentPage(1); }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
