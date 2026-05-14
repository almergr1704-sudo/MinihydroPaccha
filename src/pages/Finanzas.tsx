import React, { useState } from 'react';
import { Plus, ArrowUpRight, ArrowDownRight, Filter, Download } from 'lucide-react';
import { useAppContext } from '../store/AppContext';
import { Button, Card, CardContent, Badge, CardHeader, CardTitle } from '../components/ui';
import { formatCurrency } from '../lib/utils';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { TransactionType, Transaction } from '../store/types';

export default function Finanzas() {
  const { transactions, addTransaction, clients, consumptions, payConsumption, fines, payFine } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState<false | 'INGRESO' | 'EGRESO'>(false);
  const [filterType, setFilterType] = useState<TransactionType>('INGRESO');
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  
  const [formData, setFormData] = useState({
    tipo: 'INGRESO' as TransactionType,
    categoria: 'OTROS',
    monto: '',
    descripcion: '',
    destinatario: ''
  });

  const handleGenerateEgresoPDF = (t: Transaction) => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text('Central Hidroeléctrica', 14, 22);
    doc.setFontSize(12);
    doc.text('Comprobante de Egreso', 14, 30);
    
    doc.setFontSize(10);
    doc.text(`Fecha: ${format(parseISO(t.fecha), 'dd MMM yyyy, HH:mm')}`, 14, 40);
    doc.text(`Categoría: ${t.categoria}`, 14, 45);
    
    doc.text('Detalles del Pago:', 14, 55);
    doc.text(`Pagado a (Nombres/Apellidos): ${t.destinatario || 'No especificado'}`, 14, 60);
    doc.text(`Monto: ${formatCurrency(t.monto)}`, 14, 65);
    doc.text(`Concepto / Descripción: ${t.descripcion}`, 14, 70);

    doc.save(`Egreso_${t.categoria}_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isModalOpen === 'INGRESO' && ['CONSUMO', 'MULTA'].includes(formData.categoria)) {
      // In this mode, handled individually by pay consumption/fine buttons
      return;
    }
    
    if (!formData.monto) return;
    
    const newTx = {
      tipo: formData.tipo,
      categoria: formData.categoria as any,
      monto: Number(formData.monto),
      descripcion: formData.descripcion,
      destinatario: formData.tipo === 'EGRESO' ? formData.destinatario : undefined,
      clientId: selectedClientId || undefined
    };
    
    await addTransaction(newTx);
    
    if (formData.tipo === 'EGRESO') {
      // Create a dummy transaction object to pass to the PDF generator
      handleGenerateEgresoPDF({ ...newTx, id: 'temp', fecha: new Date().toISOString() });
    }
    
    setIsModalOpen(false);
    setFormData({ tipo: 'INGRESO', categoria: 'OTROS', monto: '', descripcion: '', destinatario: '' });
    setSelectedClientId('');
    setClientSearch('');
  };

  const handleGenerateReportPDF = () => {
    const doc = new jsPDF();
    doc.text(`Reporte de Transacciones - ${filterType}`, 14, 20);
    
    const tableData = filteredTransactions.map(t => [
      format(parseISO(t.fecha), 'dd/MM/yyyy HH:mm'),
      t.categoria.replace('_', ' '),
      t.descripcion,
      t.tipo === 'INGRESO' ? formatCurrency(t.monto) : '',
      t.tipo === 'EGRESO' ? formatCurrency(t.monto) : ''
    ]);

    autoTable(doc, {
      startY: 30,
      head: [['Fecha', 'Categoría', 'Descripción', 'Ingreso', 'Egreso']],
      body: tableData,
    });

    doc.save(`Reporte_Finanzas_${filterType}_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  const handleGenerateReportExcel = () => {
    const exportData = filteredTransactions.map(t => ({
      Fecha: format(parseISO(t.fecha), 'dd/MM/yyyy HH:mm'),
      Tipo: t.tipo,
      Categoría: t.categoria.replace('_', ' '),
      Descripción: t.descripcion,
      Destinatario: t.destinatario || '',
      Monto: t.monto
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transacciones");
    XLSX.writeFile(wb, `Reporte_Finanzas_${filterType}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  const filteredTransactions = transactions
    .filter(t => filterType === 'TODOS' || t.tipo === filterType)
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  // Quick stats
  const totalIngresos = transactions.filter(t => t.tipo === 'INGRESO').reduce((acc, t) => acc + t.monto, 0);
  const totalEgresos = transactions.filter(t => t.tipo === 'EGRESO').reduce((acc, t) => acc + t.monto, 0);
  const balance = totalIngresos - totalEgresos;

  const searchedClients = clients.filter(c => {
    if (!clientSearch) return true;
    const searchLower = clientSearch.toLowerCase();
    const fullName = c.nombre ? c.nombre.toLowerCase() : `${c.nombres || ''} ${c.apellidos || ''}`.toLowerCase();
    return c.codigoSuministro.toLowerCase().includes(searchLower) ||
           c.dni.includes(searchLower) ||
           fullName.includes(searchLower);
  }).filter(c => c.estado === 'ACTIVO');

  const pendingConsumptions = consumptions.filter(c => c.clientId === selectedClientId && c.estadoPago === 'PENDIENTE');
  const pendingFines = (fines || []).filter(c => c.clientId === selectedClientId && c.estadoPago === 'PENDIENTE');
  const totalDeuda = pendingConsumptions.reduce((acc, c) => acc + c.montoCalculado, 0) + pendingFines.reduce((acc, f) => acc + f.monto, 0);

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold leading-7 text-slate-100 sm:truncate sm:text-3xl sm:tracking-tight">
            Control Financiero
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Registro y seguimiento de ingresos y egresos de la central.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 space-x-3">
          <Button onClick={() => { setFormData({...formData, tipo: 'INGRESO', categoria: 'OTROS'}); setIsModalOpen('INGRESO'); }} className="bg-emerald-600 hover:bg-emerald-500 text-white border-0">
            <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
            Nuevo Cobro
          </Button>
          <Button onClick={() => { setFormData({...formData, tipo: 'EGRESO', categoria: 'MANTENIMIENTO'}); setIsModalOpen('EGRESO'); }} className="bg-red-600 hover:bg-red-500 text-white border-0">
            <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
            Nuevo Pago
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <dt className="text-sm font-medium text-slate-400 truncate">Total Ingresos</dt>
            <dd className="mt-1 text-2xl font-semibold text-emerald-600">{formatCurrency(totalIngresos)}</dd>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <dt className="text-sm font-medium text-slate-400 truncate">Total Egresos</dt>
            <dd className="mt-1 text-2xl font-semibold text-red-600">{formatCurrency(totalEgresos)}</dd>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <dt className="text-sm font-medium text-slate-400 truncate">Balance General</dt>
            <dd className={`mt-1 text-2xl font-semibold ${balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              {formatCurrency(balance)}
            </dd>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="border-b border-slate-800 flex justify-between items-center pr-4">
            <nav className="flex -mb-px w-2/3" aria-label="Tabs">
              <button
                onClick={() => setFilterType('INGRESO')}
                className={`w-1/2 py-4 px-1 text-center border-b-2 font-medium text-sm ${
                  filterType === 'INGRESO'
                    ? 'border-emerald-500 text-emerald-500'
                    : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-300'
                }`}
              >
                Cobros (Ingresos)
              </button>
              <button
                onClick={() => setFilterType('EGRESO')}
                className={`w-1/2 py-4 px-1 text-center border-b-2 font-medium text-sm ${
                  filterType === 'EGRESO'
                    ? 'border-red-500 text-red-500'
                    : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-300'
                }`}
              >
                Pagos (Egresos)
              </button>
            </nav>
            <div className="space-x-2">
               <Button variant="outline" size="sm" onClick={handleGenerateReportExcel} className="hidden sm:inline-flex">Excel</Button>
               <Button variant="outline" size="sm" onClick={handleGenerateReportPDF}>PDF</Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800">
              <thead className="bg-slate-800/50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Fecha</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Categoría</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Descripción</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Monto</th>
                </tr>
              </thead>
              <tbody className="bg-[#0B0E14] divide-y divide-slate-800">
                {filteredTransactions.length > 0 ? filteredTransactions.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                      {format(parseISO(t.fecha), 'dd MMM yyyy, HH:mm', { locale: es })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        t.tipo === 'INGRESO' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
                      }`}>
                        {t.categoria.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-100 max-w-xs truncate">
                      {t.tipo === 'EGRESO' && t.destinatario && <div className="text-xs text-slate-400 mb-0.5">Para: {t.destinatario}</div>}
                      {t.descripcion}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold text-right ${
                      t.tipo === 'INGRESO' ? 'text-emerald-500' : 'text-red-500'
                    }`}>
                      {t.tipo === 'INGRESO' ? '+' : '-'}{formatCurrency(t.monto)}
                      {t.tipo === 'EGRESO' && (
                        <Button variant="ghost" size="sm" onClick={() => handleGenerateEgresoPDF(t)} className="ml-2 px-2 text-slate-400 hover:text-slate-200">
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-slate-400">
                      No hay transacciones en esta sección.
                    </td>
                  </tr>
                )}
              </tbody>

            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal Add Transaction */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-slate-900 bg-opacity-75 transition-opacity" onClick={() => setIsModalOpen(false)}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="relative z-10 inline-block align-bottom bg-[#0B0E14] rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full">
              <form onSubmit={handleSubmit}>
                <div className="bg-[#0B0E14] px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg leading-6 font-medium text-slate-100" id="modal-title">
                    {isModalOpen === 'INGRESO' ? 'Registrar Nuevo Cobro' : 'Registrar Nuevo Pago'}
                  </h3>
                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300">Categoría</label>
                      <select 
                        required 
                        value={formData.categoria} 
                        onChange={e => setFormData({...formData, categoria: e.target.value})} 
                        className="mt-1 block w-full border border-slate-700 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-[#0B0E14] text-slate-100"
                      >
                        {formData.tipo === 'INGRESO' ? (
                          <>
                            <option value="CONSUMO">Cobro por Consumo de Energía</option>
                            <option value="APORTE">Aporte de Socio</option>
                            <option value="MULTA">Pago de Multa</option>
                            <option value="OTROS">Otros Ingresos</option>
                          </>
                        ) : (
                          <>
                            <option value="MANTENIMIENTO">Mantenimiento de Planta</option>
                            <option value="MATERIALES">Compra de Materiales</option>
                            <option value="SUELDOS">Pago de Sueldos</option>
                            <option value="EQUIPOS">Compra de Equipos</option>
                            <option value="ADMINISTRATIVOS">Gastos Administrativos</option>
                            <option value="OTROS">Otros Egresos</option>
                          </>
                        )}
                      </select>
                    </div>
                    {isModalOpen === 'EGRESO' && (
                      <div>
                        <label className="block text-sm font-medium text-slate-300">A quién se paga (Nombres y Apellidos)</label>
                        <input 
                          type="text" 
                          required 
                          value={formData.destinatario} 
                          onChange={e => setFormData({...formData, destinatario: e.target.value})} 
                          className="mt-1 block w-full border border-slate-700 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-[#0B0E14] text-slate-100" 
                        />
                      </div>
                    )}
                    {isModalOpen === 'INGRESO' && ['CONSUMO', 'MULTA', 'APORTE'].includes(formData.categoria) && (
                        <div>
                          <label className="block text-sm font-medium text-slate-300">Buscar Cliente (Suministro, DNI o Nombre)</label>
                          <div className="relative mt-1">
                            <input 
                              type="text" 
                              placeholder="Ingrese términos de búsqueda..."
                              value={clientSearch}
                              onChange={(e) => {
                                setClientSearch(e.target.value);
                                setSelectedClientId('');
                              }}
                              className="block w-full border border-slate-700 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-[#0B0E14] text-slate-100"
                            />
                            {clientSearch && !selectedClientId && searchedClients.length > 0 && (
                              <ul className="absolute z-10 mt-1 w-full bg-slate-800 border border-slate-700 rounded-md shadow-lg max-h-48 overflow-auto">
                                {searchedClients.map(c => (
                                  <li 
                                    key={c.id} 
                                    className="px-3 py-2 text-sm text-slate-200 hover:bg-blue-600 cursor-pointer"
                                    onClick={() => {
                                      setSelectedClientId(c.id);
                                      setClientSearch(c.nombre ? c.nombre : `${c.nombres} ${c.apellidos}`);
                                    }}
                                  >
                                    <div className="font-medium">{c.codigoSuministro} - {c.nombre ? c.nombre : `${c.nombres} ${c.apellidos}`}</div>
                                    <div className="text-xs text-slate-400">DNI: {c.dni}</div>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                    )}
                    
                    {['CONSUMO', 'MULTA'].includes(formData.categoria) && isModalOpen === 'INGRESO' ? (
                      <div className="space-y-4">
                        {selectedClientId && (
                          <div className="bg-slate-800/50 p-4 rounded-md border border-slate-700">
                            <h4 className="text-sm font-medium text-slate-200 mb-2">Estado de Cuenta</h4>
                            
                            <div className="mb-4">
                              <h5 className="text-xs font-semibold text-slate-400 uppercase mb-2">Por Consumo de Energía</h5>
                              {pendingConsumptions.length > 0 ? (
                                <ul className="space-y-2 mb-3">
                                  {pendingConsumptions.map(c => (
                                    <li key={c.id} className="flex justify-between items-center text-sm">
                                      <span className="text-slate-300">{c.mes} ({c.kwh} kWh)</span>
                                      <div className="flex items-center space-x-3">
                                        <span className="text-slate-200 font-medium">{formatCurrency(c.montoCalculado)}</span>
                                        <Button size="sm" type="button" onClick={() => {
                                          payConsumption(c.id);
                                        }}>Cobrar</Button>
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-sm text-slate-400 mb-2">No tiene deudas por consumo pendientes.</p>
                              )}
                            </div>

                            <div className="mb-4 pt-4 border-t border-slate-700">
                              <h5 className="text-xs font-semibold text-slate-400 uppercase mb-2">Por Multas (Faltas a Reuniones, etc)</h5>
                              {pendingFines.length > 0 ? (
                                <ul className="space-y-2 mb-3">
                                  {pendingFines.map(f => (
                                    <li key={f.id} className="flex justify-between items-center text-sm gap-4">
                                      <span className="text-slate-300 flex-1 truncate" title={f.motivo}>{f.motivo}</span>
                                      <div className="flex items-center space-x-3 flex-shrink-0">
                                        <span className="text-slate-200 font-medium">{formatCurrency(f.monto)}</span>
                                        <Button size="sm" type="button" onClick={() => {
                                          payFine(f.id);
                                        }}>Cobrar</Button>
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-sm text-slate-400 mb-2">No tiene multas pendientes registradas.</p>
                              )}
                            </div>

                            <div className="pt-2 border-t border-slate-700 flex justify-between">
                              <span className="font-semibold text-slate-300">Deuda Total:</span>
                              <span className="font-bold text-red-500">{formatCurrency(totalDeuda)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-slate-300">Monto (S/)</label>
                          <input 
                            type="number" 
                            min="0.01" 
                            step="0.01"
                            required 
                            value={formData.monto} 
                            onChange={e => setFormData({...formData, monto: e.target.value})} 
                            className="mt-1 block w-full border border-slate-700 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-[#0B0E14] text-slate-100" 
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-300">Descripción / Motivo</label>
                          <textarea 
                            required
                            rows={3}
                            value={formData.descripcion} 
                            onChange={e => setFormData({...formData, descripcion: e.target.value})} 
                            className="mt-1 block w-full border border-slate-700 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-[#0B0E14] text-slate-100" 
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="bg-slate-800/50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  {!['CONSUMO', 'MULTA'].includes(formData.categoria) && (
                    <Button type="submit" className="w-full sm:ml-3 sm:w-auto">Guardar Transacción</Button>
                  )}
                  <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="mt-3 w-full sm:mt-0 sm:w-auto">Cerrar</Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
