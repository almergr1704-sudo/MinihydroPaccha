import React, { useState } from 'react';
import { Plus, Check, FileText, Download } from 'lucide-react';
import { useAppContext } from '../store/AppContext';
import { Button, Card, CardContent, Badge } from '../components/ui';
import { formatCurrency } from '../lib/utils';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Consumption } from '../store/types';

export default function Consumo() {
  const { clients, consumptions, addConsumption, settings } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMes, setSelectedMes] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 7);
  });
  
  const [clientSearch, setClientSearch] = useState('');

  const [formData, setFormData] = useState({
    clientAndSuministro: '',
    kwh: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clientAndSuministro || !formData.kwh) return;
    
    const [clientId, codigoSuministro] = formData.clientAndSuministro.split('|');

    if (selectedMes >= new Date().toISOString().slice(0, 7)) {
      alert('El periodo de lectura debe ser un mes anterior al actual.');
      return;
    }

    const exists = consumptions.some(c => c.codigoSuministro === codigoSuministro && c.mes === selectedMes);
    if (exists) {
      alert(`Ya existe una lectura para el suministro ${codigoSuministro} en el mes ${selectedMes}.`);
      return;
    }

    if (!window.confirm(`¿Está seguro de guardar la lectura para el periodo ${selectedMes}?`)) return;

    addConsumption({
      clientId,
      codigoSuministro,
      kwh: Number(formData.kwh),
      fechaLectura: new Date().toISOString(),
      mes: selectedMes,
    });
    
    setIsModalOpen(false);
    setFormData({ clientAndSuministro: '', kwh: '' });
  };

    const getDebtInfo = (clientId: string, codigoSuministro: string, currentMes: string) => {
    const previousUnpaid = consumptions.filter(c => 
      c.clientId === clientId && 
      c.codigoSuministro === codigoSuministro && 
      c.estadoPago === 'PENDIENTE' &&
      c.mes < currentMes
    );
    const totalDeuda = previousUnpaid.reduce((acc, c) => acc + c.montoCalculado, 0);
    const monthsOwned = previousUnpaid.length;
    const settingsCostoReconexion = settings?.costoReconexion || 0;
    return {
      totalDeuda,
      monthsOwned,
      previousUnpaid,
      warning: monthsOwned >= 3 
        ? `AVISO: SERVICIO PROGRAMADO PARA CORTE POR DEUDA DE 3 MESES O MÁS.${settingsCostoReconexion > 0 ? `\nCosto por reconexión: S/ ${settingsCostoReconexion.toFixed(2)}` : ''}` 
        : ''
    };
  };

  const handleExportConsumosExcel = (consumptionsList: Consumption[]) => {
    if (consumptionsList.length === 0) return;
    const exportData = consumptionsList.map(cons => {
      const client = clients.find(c => c.id === cons.clientId);
      const clientName = client?.nombre ? client.nombre : `${client?.nombres || ''} ${client?.apellidos || ''}`;
      return {
        Periodo: cons.mes,
        Cliente: clientName,
        DNI: client?.dni,
        'Tipo Cliente': client?.tipo,
        Suministro: cons.codigoSuministro,
        'Consumo (kWh)': cons.kwh,
        'Monto a Pagar (S/)': cons.montoCalculado,
        Estado: cons.estadoPago
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Consumos");
    XLSX.writeFile(wb, `Reporte_Consumos_${selectedMes}.xlsx`);
  };

  const handleExportConsumosPDF = (consumptionsList: Consumption[]) => {
    if (consumptionsList.length === 0) return;
    const doc = new jsPDF();
    doc.text(`Reporte de Consumos - ${selectedMes}`, 14, 20);
    
    const tableData = consumptionsList.map(cons => {
      const client = clients.find(c => c.id === cons.clientId);
      const clientName = client?.nombre ? client.nombre : `${client?.nombres || ''} ${client?.apellidos || ''}`;
      return [
        clientName,
        cons.codigoSuministro || '',
        cons.kwh?.toString() || '0',
        cons.montoCalculado.toFixed(2),
        cons.estadoPago
      ];
    });

    autoTable(doc, {
      startY: 30,
      head: [['Cliente', 'Suministro', 'kWh', 'Monto', 'Estado']],
      body: tableData,
    });

    doc.save(`Reporte_Consumos_${selectedMes}.pdf`);
  };

  const handleGenerateMassReceipts = (consumptionsList: Consumption[]) => {
    if (consumptionsList.length === 0) return;

    // Sort by codigoSuministro
    const sortedConsumptions = [...consumptionsList].sort((a, b) => {
      const sumA = a.codigoSuministro || '';
      const sumB = b.codigoSuministro || '';
      return sumA.localeCompare(sumB);
    });

    const doc = new jsPDF({ format: 'a4' });
    let yOffset = 10;
    const maxH = 297;
    const receiptHeight = 95; // 3 receipts per page

    const formatCurrencyStr = (val: number) => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(val);

    sortedConsumptions.forEach((cons, index) => {
      const client = clients.find(c => c.id === cons.clientId);
      if (!client) return;

      if (yOffset + receiptHeight > maxH) {
        doc.addPage();
        yOffset = 10;
      }

      const clientName = client.nombre ? client.nombre : `${client.nombres} ${client.apellidos}`;

      // Header
      doc.setFontSize(16);
      doc.text('Central Hidroeléctrica PACCHA - Recibo de Consumo', 14, yOffset + 10);
      
      doc.setFontSize(9);
      doc.text(`Fecha Emisión: ${format(new Date(), 'dd MMM yyyy')} | Periodo: ${cons.mes} | Estado: ${cons.estadoPago}`, 14, yOffset + 18);

      // Client Info
      doc.setFontSize(10);
      doc.text(`Cliente: ${clientName} (DNI/RUC: ${client.dni})`, 14, yOffset + 26);
      doc.text(`Dirección: ${client.direccion} ${client.numeroDireccion ? `N° ${client.numeroDireccion}` : ''}`, 14, yOffset + 31);
      doc.text(`Tipo: ${client.tipo} | Suministro: ${cons.codigoSuministro || client.codigoSuministro}`, 14, yOffset + 36);

      // Table
      const tarifaAplicada = client.faseSuministro === 'TRIFASICO' && settings.costoTrifasico > 0 
        ? settings.costoTrifasico 
        : client.tipo === 'SOCIO' ? settings.costoSocio : settings.costoUsuario;
      const kwhFacturado = Math.max(cons.kwh || 0, 6);
      const debtInfo = getDebtInfo(client.id, cons.codigoSuministro || '', cons.mes);

      const tableBody: any[][] = [
        [
          'Consumo Eléctrico' + (cons.kwh < 6 ? ' (Mín.)' : ''),
          kwhFacturado.toString(),
          tarifaAplicada.toFixed(2),
          formatCurrencyStr(cons.montoCalculado)
        ]
      ];

      if (debtInfo.previousUnpaid && debtInfo.previousUnpaid.length > 0) {
        const remainingUnpaid = debtInfo.previousUnpaid.slice(0, 3); // display up to 3 to avoid overflow
        remainingUnpaid.forEach(unpaid => {
          tableBody.push([
            `Deuda anterior: ${unpaid.mes}`,
            '-',
            '-',
            formatCurrencyStr(unpaid.montoCalculado)
          ]);
        });
        if (debtInfo.previousUnpaid.length > 3) {
           const hiddenDebts = debtInfo.previousUnpaid.slice(3);
           const hiddenSum = hiddenDebts.reduce((acc, c) => acc + c.montoCalculado, 0);
           tableBody.push([
            `...y ${debtInfo.previousUnpaid.length - 3} mes(es) más`,
            '-',
            '-',
            formatCurrencyStr(hiddenSum)
          ]);
        }
      }

      const totalAPagar = cons.montoCalculado + debtInfo.totalDeuda;

      autoTable(doc, {
        startY: yOffset + 40,
        head: [['Descripción', 'Cantidad (kWh)', 'Precio (S/)', 'Subtotal']],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42] },
        styles: { fontSize: 8 },
        margin: { left: 14, right: 14 }
      });

      const finalY = (doc as any).lastAutoTable.finalY || yOffset + 50;
      doc.setFontSize(12);
      doc.text(`Total a Pagar: ${formatCurrencyStr(totalAPagar)}`, 196, finalY + 10, { align: 'right' });

      if (debtInfo.warning) {
        doc.setFontSize(10);
        doc.setTextColor(220, 38, 38); // Red
        const splitText = doc.splitTextToSize(debtInfo.warning, 160); // Adjusted for margins
        const textH = splitText.length * 5;
        doc.setDrawColor(220, 38, 38);
        doc.rect(14, finalY + 14, 182, textH + 4);
        doc.text(splitText, 16, finalY + 18);
        doc.setTextColor(0, 0, 0); // Reset
        doc.setDrawColor(0, 0, 0); // Reset
      }
      
      // Draw a cut line
      doc.setLineDashPattern([2, 2], 0);
      doc.line(10, yOffset + receiptHeight - 1, 200, yOffset + receiptHeight - 1);
      doc.setLineDashPattern([], 0); // reset

      yOffset = yOffset + receiptHeight;
    });

    doc.save(`Recibos_Masivos_${selectedMes}.pdf`);
  };

  const handleGenerateReceipt = (cons: Consumption) => {
    const client = clients.find(c => c.id === cons.clientId);
    if (!client) return;

    const clientName = client.nombre ? client.nombre : `${client.nombres} ${client.apellidos}`;

    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.text('Central Hidroeléctrica', 14, 22);
    doc.setFontSize(12);
    doc.text('Recibo de Consumo Eléctrico', 14, 30);
    
    doc.setFontSize(10);
    doc.text(`Fecha de Emisión: ${format(new Date(), 'dd MMM yyyy')}`, 14, 40);
    doc.text(`Periodo Facturado: ${cons.mes}`, 14, 45);
    doc.text(`Estado: ${cons.estadoPago}`, 14, 50);

    // Client Info
    doc.text('Datos del Cliente:', 14, 60);
    doc.text(`Nombre: ${clientName}`, 14, 65);
    doc.text(`${client.tipoPersona === 'EMPRESA' ? 'RUC' : 'DNI'}: ${client.dni}`, 14, 70);
    doc.text(`Dirección: ${client.direccion} ${client.numeroDireccion ? `N° ${client.numeroDireccion}` : ''}`, 14, 75);
    doc.text(`Tipo de Cliente: ${client.tipo}`, 14, 80);
    doc.text(`Suministro: ${cons.codigoSuministro || client.codigoSuministro}`, 14, 85);

    // Table
    const tarifaAplicada = client.faseSuministro === 'TRIFASICO' && settings.costoTrifasico > 0 
      ? settings.costoTrifasico 
      : client.tipo === 'SOCIO' ? settings.costoSocio : settings.costoUsuario;
    const kwhFacturado = Math.max(cons.kwh || 0, 6);
    const debtInfo = getDebtInfo(client.id, cons.codigoSuministro || '', cons.mes);

    const formatCurrencyStr = (val: number) => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(val);

    const tableBody: any[][] = [
      [
        'Consumo Eléctrico' + (cons.kwh < 6 ? ' (Mínimo aplicado)' : ''),
        kwhFacturado.toString(),
        tarifaAplicada.toFixed(2),
        formatCurrencyStr(cons.montoCalculado)
      ]
    ];

    if (debtInfo.previousUnpaid && debtInfo.previousUnpaid.length > 0) {
      const remainingUnpaid = debtInfo.previousUnpaid.slice(0, 3);
      remainingUnpaid.forEach(unpaid => {
        tableBody.push([
          `Deuda anterior: ${unpaid.mes}`,
          '-',
          '-',
          formatCurrencyStr(unpaid.montoCalculado)
        ]);
      });
      if (debtInfo.previousUnpaid.length > 3) {
        const hiddenDebts = debtInfo.previousUnpaid.slice(3);
        const hiddenSum = hiddenDebts.reduce((acc, c) => acc + c.montoCalculado, 0);
        tableBody.push([
          `...y ${debtInfo.previousUnpaid.length - 3} mes(es) más`,
          '-',
          '-',
          formatCurrencyStr(hiddenSum)
        ]);
      }
    }

    const totalAPagar = cons.montoCalculado + debtInfo.totalDeuda;

    autoTable(doc, {
      startY: 95,
      head: [['Descripción', 'Cantidad (kWh)', 'Precio Unitario (S/)', 'Subtotal']],
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42] }
    });

    const finalY = (doc as any).lastAutoTable.finalY || 120;
    doc.setFontSize(14);
    doc.text(`Total a Pagar: ${formatCurrencyStr(totalAPagar)}`, 196, finalY + 10, { align: 'right' });

    if (debtInfo.warning) {
      doc.setFontSize(12);
      doc.setTextColor(220, 38, 38);
      const splitText = doc.splitTextToSize(debtInfo.warning, 160);
      const textH = splitText.length * 6;
      doc.setDrawColor(220, 38, 38);
      doc.rect(14, finalY + 16, 182, textH + 4);
      doc.text(splitText, 16, finalY + 22);
      doc.setTextColor(0, 0, 0);
      doc.setDrawColor(0, 0, 0);
    }

    doc.save(`Recibo_${client.codigoSuministro}_${cons.mes}.pdf`);
  };

  const [activeTab, setActiveTab] = useState<'LECTURAS' | 'DEUDAS'>('LECTURAS');

  // Filter consumptions by selected month
  const filteredConsumptions = consumptions.filter(c => c.mes === selectedMes);
  
  // All pending debts
  const pendingDebts = consumptions.filter(c => c.estadoPago === 'PENDIENTE').sort((a,b) => new Date(b.fechaLectura).getTime() - new Date(a.fechaLectura).getTime());

  const searchedClients = clients.filter(c => {
    if (!clientSearch) return true;
    const searchLower = clientSearch.toLowerCase();
    const fullName = c.nombre ? c.nombre.toLowerCase() : `${c.nombres || ''} ${c.apellidos || ''}`.toLowerCase();
    return c.codigoSuministro.toLowerCase().includes(searchLower) ||
           c.dni.includes(searchLower) ||
           fullName.includes(searchLower);
  }).filter(c => c.estado === 'ACTIVO');

  const selectedClient = formData.clientAndSuministro ? clients.find(c => c.id === formData.clientAndSuministro.split('|')[0]) : undefined;
  const selectedClientConsumptions = selectedClient 
    ? consumptions.filter(c => c.clientId === selectedClient.id && c.codigoSuministro === formData.clientAndSuministro.split('|')[1]).sort((a,b) => new Date(b.fechaLectura).getTime() - new Date(a.fechaLectura).getTime())
    : [];
  const ultimaLectura = selectedClientConsumptions.length > 0 ? selectedClientConsumptions[0] : null;

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold leading-7 text-slate-100 sm:truncate sm:text-3xl sm:tracking-tight">
            Consumo & Facturación
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Registro de lecturas de medidor y control de pagos.
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
            Registrar Lectura
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="border-b border-slate-800">
            <nav className="flex -mb-px" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('LECTURAS')}
                className={`w-1/2 py-4 px-1 text-center border-b-2 font-medium text-sm ${
                  activeTab === 'LECTURAS'
                    ? 'border-blue-500 text-blue-500'
                    : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-300'
                }`}
              >
                Lecturas del Mes
              </button>
              <button
                onClick={() => setActiveTab('DEUDAS')}
                className={`w-1/2 py-4 px-1 text-center border-b-2 font-medium text-sm ${
                  activeTab === 'DEUDAS'
                    ? 'border-red-500 text-red-500'
                    : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-300'
                }`}
              >
                Todas las Deudas Pendientes
              </button>
            </nav>
          </div>

          {activeTab === 'LECTURAS' && (
            <div className="p-4 border-b border-slate-800 bg-slate-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-4">
                 <label className="text-sm font-medium text-slate-300">Periodo de Facturación:</label>
                 <input 
                   type="month" 
                   value={selectedMes}
                   onChange={(e) => setSelectedMes(e.target.value)}
                   className="block border-slate-700 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm border bg-[#0B0E14] text-slate-100"
                 />
              </div>
              <div className="flex items-center space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => handleExportConsumosExcel(filteredConsumptions)}
                  disabled={filteredConsumptions.length === 0}
                  className="hidden sm:inline-flex"
                >
                  Excel
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => handleExportConsumosPDF(filteredConsumptions)}
                  disabled={filteredConsumptions.length === 0}
                  className="hidden sm:inline-flex"
                >
                  PDF
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => handleGenerateMassReceipts(filteredConsumptions)}
                  disabled={filteredConsumptions.length === 0}
                  className="flex items-center"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Imprimir Recibos Masivos
                </Button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800">
              <thead className="bg-slate-800/50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Cliente</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Consumo</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Monto Calculado</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Estado</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-[#0B0E14] divide-y divide-slate-800">
                {(activeTab === 'LECTURAS' ? filteredConsumptions : pendingDebts).length > 0 ? (activeTab === 'LECTURAS' ? filteredConsumptions : pendingDebts).map((cons) => {
                  const client = clients.find(c => c.id === cons.clientId);
                  const clientName = client?.nombre ? client.nombre : `${client?.nombres || ''} ${client?.apellidos || ''}`;
                  return (
                    <tr key={cons.id} className="hover:bg-slate-800/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-slate-100">{clientName}</div>
                        <div className="text-xs text-slate-400">{cons.codigoSuministro || client?.codigoSuministro} • {client?.tipo}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-100 font-semibold">{cons.kwh} kWh</div>
                        <div className="text-xs text-slate-400 text-emerald-400">
                          {cons.mes} • {format(parseISO(cons.fechaLectura), 'dd MMM yyyy', { locale: es })}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-slate-100">{formatCurrency(cons.montoCalculado)}</div>
                        <div className="text-xs text-slate-400">Tarifa: S/ {
                            client?.faseSuministro === 'TRIFASICO' && settings.costoTrifasico > 0 ? settings.costoTrifasico.toFixed(2) : 
                            client?.tipo === 'SOCIO' ? settings.costoSocio.toFixed(2) : settings.costoUsuario.toFixed(2)
                          }/kWh</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={cons.estadoPago === 'PAGADO' ? 'success' : 'warning'}>
                          {cons.estadoPago}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                        {cons.estadoPago === 'PAGADO' && (
                          <Button size="sm" variant="ghost" className="text-blue-600" onClick={() => handleGenerateReceipt(cons)}>
                            <Download className="h-4 w-4 mr-1" /> Recibo
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-slate-400">
                      {activeTab === 'LECTURAS' ? `No hay lecturas registradas para el periodo ${selectedMes}.` : 'No hay deudas pendientes registradas.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal Add Consumption */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-slate-900 bg-opacity-75 transition-opacity" onClick={() => setIsModalOpen(false)}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="relative z-10 inline-block align-bottom bg-[#0B0E14] rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full">
              <form onSubmit={handleSubmit}>
                <div className="bg-[#0B0E14] px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg leading-6 font-medium text-slate-100" id="modal-title">
                    Registrar Lectura Mensual
                  </h3>
                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300">Periodo</label>
                      <input 
                        type="month" 
                        required 
                        value={selectedMes} 
                        onChange={e => setSelectedMes(e.target.value)} 
                        className="mt-1 block w-full border border-slate-700 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-[#0B0E14] text-slate-100" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300">Buscar Cliente (Suministro, DNI o Nombre)</label>
                      <input 
                        type="text" 
                        placeholder="Buscar..."
                        value={clientSearch}
                        onChange={(e) => setClientSearch(e.target.value)}
                        className="mt-1 mb-2 block w-full border border-slate-700 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-slate-800/50 text-slate-100"
                      />
                      <label className="block text-sm font-medium text-slate-300">Seleccionar Cliente / Suministro</label>
                      <select 
                        required 
                        size={clientSearch ? 4 : 1}
                        value={formData.clientAndSuministro} 
                        onChange={e => setFormData({...formData, clientAndSuministro: e.target.value})} 
                        className="mt-1 block w-full border border-slate-700 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-[#0B0E14] text-slate-100"
                      >
                        <option value="">Seleccione un suministro...</option>
                        {searchedClients.flatMap(c => {
                          const supplies = c.suministros?.length ? c.suministros : [c.codigoSuministro];
                          return supplies.map(sup => (
                            <option key={`${c.id}|${sup}`} value={`${c.id}|${sup}`}>
                              {sup} - {c.nombre ? c.nombre : `${c.nombres} ${c.apellidos}`.trim()} ({c.tipo}) - {c.tipoPersona === 'EMPRESA' ? 'RUC' : 'DNI'}: {c.dni}
                            </option>
                          ));
                        })}
                      </select>
                      {ultimaLectura && (
                        <div className="mt-2 p-2 bg-slate-800 rounded-md border border-slate-700 text-xs text-slate-300">
                          <strong className="text-emerald-400 block mb-1">Última lectura registrada:</strong>
                          {ultimaLectura.mes} - {ultimaLectura.kwh} kWh ({formatCurrency(ultimaLectura.montoCalculado)}) • Estado: <span className={ultimaLectura.estadoPago === 'PAGADO' ? 'text-emerald-400' : 'text-yellow-400'}>{ultimaLectura.estadoPago}</span>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300">Consumo (kWh)</label>
                      <input 
                        type="number" 
                        min="0" 
                        step="1"
                        required 
                        value={formData.kwh} 
                        onChange={e => setFormData({...formData, kwh: e.target.value})} 
                        className="mt-1 block w-full border border-slate-700 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-[#0B0E14] text-slate-100" 
                      />
                      {formData.clientAndSuministro && formData.kwh && (
                        <p className="mt-2 text-sm text-slate-400 font-medium">
                          Monto estimado: {formatCurrency(Number(formData.kwh) * (
                            clients.find(c => c.id === formData.clientAndSuministro.split('|')[0])?.faseSuministro === 'TRIFASICO' && settings.costoTrifasico > 0
                              ? settings.costoTrifasico
                              : clients.find(c => c.id === formData.clientAndSuministro.split('|')[0])?.tipo === 'SOCIO' 
                                ? settings.costoSocio 
                                : settings.costoUsuario
                          ))}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="bg-slate-800/50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <Button type="submit" className="w-full sm:ml-3 sm:w-auto">Guardar Lectura</Button>
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
