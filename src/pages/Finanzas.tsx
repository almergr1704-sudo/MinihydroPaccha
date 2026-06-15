import React, { useState, useRef, useEffect } from 'react';
import { Plus, ArrowUpRight, ArrowDownRight, Filter, Download, FileText, FileWarning, PowerOff, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAppContext } from '../store/AppContext';
import { Button, Card, CardContent, Badge, CardHeader, CardTitle, Pagination } from '../components/ui';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { formatCurrency, render3DPieChartToDataURL, normalizeSearchText } from '../lib/utils';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { TransactionType, Transaction } from '../store/types';
import { toast } from 'react-hot-toast';
import { generateGeneralPaymentReceiptPDF, generatePayrollReceiptPDF } from '../lib/receipts';
import { Briefcase } from 'lucide-react';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function Finanzas() {
  const { confirm } = useConfirm();
  const { 
    transactions, 
    addTransaction, 
    clients, 
    consumptions, 
    payConsumption, 
    fines, 
    payFine, 
    settings, 
    updateClient, 
    userRole, 
    toggleTransactionConciliado,
    trabajadores = [],
    pagosSueldos = [],
    addPagoSueldo
  } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState<false | 'INGRESO' | 'EGRESO' | 'APTOS_CORTE' | 'PAGO_SUELDO'>(false);
  const [filterType, setFilterType] = useState<TransactionType | 'TODOS'>('INGRESO');
  const [selectedMes, setSelectedMes] = useState(''); // Empty means All time
  const [clientSearch, setClientSearch] = useState('');
  const [showOnlyAptForCut, setShowOnlyAptForCut] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedSupplyCode, setSelectedSupplyCode] = useState('');
  const [showSuministroDropdown, setShowSuministroDropdown] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    tipo: 'INGRESO' as TransactionType,
    categoria: 'OTROS',
    monto: '',
    descripcion: '',
    destinatario: ''
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  const handleGenerateEgresoPDF = (t: Transaction) => {
    const toastId = toast.loading('Generando PDF...');
    try {
      const success = generateGeneralPaymentReceiptPDF(t, undefined);
      if (success) {
        toast.success('Comprobante generado y descargado con éxito.', { id: toastId });
      } else {
        toast.error('Error al generar comprobante.', { id: toastId });
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Error al generar comprobante.', { id: toastId });
    }
  };

  const [sueldoForm, setSueldoForm] = useState({
    trabajadorId: '',
    trabajadorNombreCompleto: '',
    trabajadorDni: '',
    trabajadorCargo: '',
    mesPagado: (() => {
      const today = new Date();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      return `${today.getFullYear()}-${mm}`;
    })(),
    monto: 0,
    observaciones: ''
  });

  const closeModal = () => {
    setIsModalOpen(false);
    setShowOnlyAptForCut(false);
    setFormData({ tipo: 'INGRESO', categoria: 'OTROS', monto: '', descripcion: '', destinatario: '' });
    setSelectedClientId('');
    setClientSearch('');
    setSueldoForm({
      trabajadorId: '',
      trabajadorNombreCompleto: '',
      trabajadorDni: '',
      trabajadorCargo: '',
      mesPagado: (() => {
        const today = new Date();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        return `${today.getFullYear()}-${mm}`;
      })(),
      monto: 0,
      observaciones: ''
    });
  };

  const handleSueldoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sueldoForm.trabajadorId) {
      toast.error('Por favor, seleccione un trabajador de planta.');
      return;
    }
    if (sueldoForm.monto <= 0) {
      toast.error('Monto de remuneración inválido.');
      return;
    }
    if (!sueldoForm.mesPagado) {
      toast.error('Seleccione el mes remunerado.');
      return;
    }

    const confirmTx = await confirm({
      title: 'Confirmar Pago de Planilla',
      message: `¿Está seguro de registrar este pago de sueldo por S/ ${sueldoForm.monto.toFixed(2)} a ${sueldoForm.trabajadorNombreCompleto} por el mes de ${sueldoForm.mesPagado}?`,
      type: 'confirm',
      confirmLabel: 'Registrar y Emitir',
      cancelLabel: 'Cancelar'
    });
    if (!confirmTx) return;

    try {
      const nPago = await addPagoSueldo(sueldoForm);
      // Trigger PDF Receipt boleta de pago
      generatePayrollReceiptPDF(nPago);
      toast.success('Pago de sueldo registrado y boleta descargada exitosamente.');
      closeModal();
    } catch (err: any) {
      toast.error(err.message || 'Error al registrar remuneración.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isModalOpen === 'INGRESO' && ['CONSUMO', 'MULTA'].includes(formData.categoria)) {
      return;
    }
    
    if (!formData.monto) return;
    const confirmTx = await confirm({
      title: 'Registrar Transacción',
      message: '¿Está seguro de registrar esta transacción?',
      type: 'confirm',
      confirmLabel: 'Registrar',
      cancelLabel: 'Cancelar'
    });
    if (!confirmTx) return;
    
    const newTx = {
      tipo: formData.tipo,
      categoria: formData.categoria as any,
      monto: Number(formData.monto),
      descripcion: formData.descripcion,
      destinatario: formData.tipo === 'EGRESO' ? formData.destinatario : undefined,
      clientId: selectedClientId || undefined,
      codigoSuministro: selectedSupplyCode || undefined
    };
    
    await addTransaction(newTx);
    
    if (formData.tipo === 'EGRESO') {
      // Create a dummy transaction object to pass to the PDF generator
      handleGenerateEgresoPDF({ ...newTx, id: 'temp', fecha: new Date().toISOString() });
    }
    
    closeModal();
  };

  const handleGenerateReportPDFDetailed = (type: 'INGRESO' | 'EGRESO') => {
    const toastId = toast.loading(`Generando reporte de ${type.toLowerCase()}...`);
    try {
      const doc = new jsPDF();
    doc.text(`Reporte Detallado de Transacciones - ${type}`, 14, 20);
    
    if (selectedMes) {
      doc.setFontSize(10);
      doc.text(`Mes: ${selectedMes}`, 14, 26);
    }
    
    let tableData: any[][] = [];
    let headParams: string[][] = [];

    // Filter by type, and selected month if any
    const txForReport = transactions
      .filter(t => t.tipo === type)
      .filter(t => selectedMes ? t.fecha.startsWith(selectedMes) : true)
      .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

    if (txForReport.length === 0) {
      toast.error('No existen datos disponibles para generar el PDF.');
      return;
    }

    const totalAmount = txForReport.reduce((acc, t) => acc + t.monto, 0);

    tableData = txForReport.map(t => {
      const client = clients.find(c => c.id === t.clientId);
      const clientName = client ? `${client.apellidos}, ${client.nombres.slice(0, 8)}.` : '';
      let supplyCode = t.codigoSuministro || '';
      if (!supplyCode && t.referencia) {
        const match = t.referencia.match(/SUM-\d+/i);
        if (match) supplyCode = match[0].toUpperCase();
      }
      if (!supplyCode && t.descripcion) {
        const match = t.descripcion.match(/SUM-\d+/i);
        if (match) supplyCode = match[0].toUpperCase();
      }
      const clientAndSupply = [supplyCode, clientName].filter(Boolean).join(' - ');
      return [
        format(parseISO(t.fecha), 'dd/MM/yyyy HH:mm'),
        t.categoria.replace('_', ' '),
        clientAndSupply || t.destinatario || 'N/A',
        t.descripcion,
        formatCurrency(t.monto)
      ];
    });
    tableData.push(['TOTAL GENERAL', '', '', '', formatCurrency(totalAmount)]);
    headParams = [['Fecha', 'Categoría', 'Cliente / Suministro', 'Descripción', type === 'INGRESO' ? 'Monto Ingreso' : 'Monto Egreso']];

    autoTable(doc, {
      startY: selectedMes ? 35 : 30,
      head: headParams,
      body: tableData,
      didParseCell: function(data: any) {
        if (data.row.index === tableData.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [240, 240, 240];
        }
      }
    });

    const finalY = (doc as any).lastAutoTable?.finalY + 10 || 40;
    doc.setFontSize(12);
    doc.text(`Total ${type === 'INGRESO' ? 'Ingresos' : 'Egresos'}: ${formatCurrency(totalAmount)}`, 14, finalY);

    // Add 3D Pie Chart
    const catMap: Record<string, number> = {};
    txForReport.forEach(t => {
      catMap[t.categoria.replace('_', ' ')] = (catMap[t.categoria.replace('_', ' ')] || 0) + t.monto;
    });
    
    const chartData = Object.entries(catMap).map(([name, value], i) => ({
      name,
      value,
      color: COLORS[i % COLORS.length]
    }));

    if (chartData.length > 0) {
       let finalChartY = finalY + 10;
       if (finalChartY + 85 > 290) {
          doc.addPage();
          finalChartY = 20;
       }
       const imgData = render3DPieChartToDataURL(chartData, `Gráfico de ${type === 'INGRESO' ? 'Ingresos' : 'Egresos'}`);
       if (imgData) {
          doc.addImage(imgData, 'PNG', 45, finalChartY, 120, 84);
       }
    }

      doc.save(`Reporte_Detallado_${type}_${selectedMes || 'Historico'}.pdf`);
      toast.success('Reporte generado y descargado con éxito.', { id: toastId });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Error al generar el PDF.', { id: toastId });
    }
  };

  const handleGenerateReportExcel = () => {
    let exportData: any[] = [];
    const reportIngresos = filteredTransactions.filter(t => t.tipo === 'INGRESO').reduce((acc, t) => acc + t.monto, 0);
    const reportEgresos = filteredTransactions.filter(t => t.tipo === 'EGRESO').reduce((acc, t) => acc + t.monto, 0);

    if (filterType === 'TODOS') {
      exportData = filteredTransactions.map(t => {
        const client = clients.find(c => c.id === t.clientId);
        const clientName = client ? `${client.apellidos}, ${client.nombres}` : '';
        let supplyCode = t.codigoSuministro || '';
        if (!supplyCode && t.referencia) {
          const match = t.referencia.match(/SUM-\d+/i);
          if (match) supplyCode = match[0].toUpperCase();
        }
        if (!supplyCode && t.descripcion) {
          const match = t.descripcion.match(/SUM-\d+/i);
          if (match) supplyCode = match[0].toUpperCase();
        }
        return {
          Fecha: format(parseISO(t.fecha), 'dd/MM/yyyy HH:mm'),
          Comprobante: t.comprobante || '',
          Suministro: supplyCode || 'N/A',
          Cliente: clientName || t.destinatario || 'General',
          Categoría: t.categoria.replace('_', ' '),
          Descripción: t.descripcion,
          'Ingreso (S/)': t.tipo === 'INGRESO' ? t.monto : 0,
          'Egreso (S/)': t.tipo === 'EGRESO' ? t.monto : 0
        };
      });
      exportData.push({
        Fecha: 'TOTAL GENERAL',
        Comprobante: '',
        Suministro: '',
        Cliente: '',
        Categoría: '',
        Descripción: '',
        'Ingreso (S/)': reportIngresos,
        'Egreso (S/)': reportEgresos
      });
    } else {
      exportData = filteredTransactions.map(t => {
        const client = clients.find(c => c.id === t.clientId);
        const clientName = client ? `${client.apellidos}, ${client.nombres}` : '';
        let supplyCode = t.codigoSuministro || '';
        if (!supplyCode && t.referencia) {
          const match = t.referencia.match(/SUM-\d+/i);
          if (match) supplyCode = match[0].toUpperCase();
        }
        if (!supplyCode && t.descripcion) {
          const match = t.descripcion.match(/SUM-\d+/i);
          if (match) supplyCode = match[0].toUpperCase();
        }
        return {
          Fecha: format(parseISO(t.fecha), 'dd/MM/yyyy HH:mm'),
          Comprobante: t.comprobante || '',
          Suministro: supplyCode || 'N/A',
          Cliente: clientName || t.destinatario || 'General',
          Categoría: t.categoria.replace('_', ' '),
          Descripción: t.descripcion,
          [filterType === 'INGRESO' ? 'Monto Ingreso (S/)' : 'Monto Egreso (S/)']: t.monto
        };
      });
      exportData.push({
        Fecha: 'TOTAL GENERAL',
        Comprobante: '',
        Suministro: '',
        Cliente: '',
        Categoría: '',
        Descripción: '',
        [filterType === 'INGRESO' ? 'Monto Ingreso (S/)' : 'Monto Egreso (S/)']: filterType === 'INGRESO' ? reportIngresos : reportEgresos
      });
    }

    let totalesData: any[] = [];
    if (filterType === 'TODOS') {
      totalesData = [{
        'Total Ingresos': reportIngresos,
        'Total Egresos': reportEgresos,
        'Balance Final': reportIngresos - reportEgresos
      }];
    } else if (filterType === 'INGRESO') {
      totalesData = [{ 'Total Ingresos': reportIngresos }];
    } else if (filterType === 'EGRESO') {
      totalesData = [{ 'Total Egresos': reportEgresos }];
    }

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wsTotales = XLSX.utils.json_to_sheet(totalesData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transacciones");
    XLSX.utils.book_append_sheet(wb, wsTotales, "Totales");
    XLSX.writeFile(wb, `Reporte_Transacciones_${filterType}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  const filteredTransactions = transactions
    .filter(t => filterType === 'TODOS' || t.tipo === filterType)
    .filter(t => selectedMes ? t.fecha.startsWith(selectedMes) : true)
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const currentTransactions = filteredTransactions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [filterType, selectedMes]);

  // Quick stats
  const totalIngresos = (selectedMes ? transactions.filter(t => t.fecha.startsWith(selectedMes)) : transactions).filter(t => t.tipo === 'INGRESO').reduce((acc, t) => acc + t.monto, 0);
  const totalEgresos = (selectedMes ? transactions.filter(t => t.fecha.startsWith(selectedMes)) : transactions).filter(t => t.tipo === 'EGRESO').reduce((acc, t) => acc + t.monto, 0);
  const balance = totalIngresos - totalEgresos;

  const searchedClients = clients.filter(c => {
    const isActivoOrCortado = c.estado === 'ACTIVO' || c.estado === 'CORTADO';
    if (!isActivoOrCortado) return false;

    if (showOnlyAptForCut) {
        const pendingDebtsCount = consumptions.filter(cons => cons.clientId === c.id && cons.estadoPago === 'PENDIENTE').length;
        if (!(pendingDebtsCount >= 3 && c.estado !== 'CORTADO')) return false;
    }

    if (!clientSearch) return true;
    const searchNormalized = normalizeSearchText(clientSearch);
    const rawFullName = c.nombre ? c.nombre : `${c.nombres || ''} ${c.apellidos || ''}`;
    const fullName = normalizeSearchText(rawFullName);
    const dni = normalizeSearchText(c.dni || '');
    const clientSupplies = c.suministros?.length ? c.suministros : [c.codigoSuministro];
    const allSuppliesStr = normalizeSearchText(clientSupplies.join(' '));
    return allSuppliesStr.includes(searchNormalized) ||
           dni.includes(searchNormalized) ||
           fullName.includes(searchNormalized);
  });

  const availableSupplies = React.useMemo(() => {
     let supplies: { id: string, sup: string, label: string, desc: string }[] = [];
     searchedClients.forEach(c => {
        const clientSupplies = c.suministros?.length ? c.suministros : [c.codigoSuministro];
        clientSupplies.forEach(sup => {
           if (!sup) return;
           supplies.push({
              id: c.id,
              sup: sup,
              label: `${sup} - ${c.nombre ? c.nombre : `${c.nombres || ''} ${c.apellidos || ''}`}`,
              desc: `DNI/RUC: ${c.dni} | Direcc: ${c.direccion || '-'} | Tipo: ${c.tipo} | Est: ${c.estado}`
           });
        });
     });
     return supplies;
  }, [searchedClients]);

  useEffect(() => {
    if (clientSearch && availableSupplies.length === 1 && availableSupplies[0].sup === clientSearch.trim()) {
       setSelectedClientId(availableSupplies[0].id);
       setSelectedSupplyCode(availableSupplies[0].sup);
       setShowSuministroDropdown(false);
    }
  }, [clientSearch, availableSupplies]);

  const pendingConsumptions = consumptions.filter(c => c.clientId === selectedClientId && (!selectedSupplyCode || c.codigoSuministro === selectedSupplyCode) && c.estadoPago === 'PENDIENTE');
  const pendingFines = (fines || []).filter(c => c.clientId === selectedClientId && c.estadoPago === 'PENDIENTE');
  
  const selectedClientObj = clients.find(c => c.id === selectedClientId);
  const isCortado = selectedClientObj?.estado === 'CORTADO';
  const reconexionFee = settings?.costoReconexion || 0;
  
  const totalDeuda = pendingConsumptions.reduce((acc, c) => acc + c.montoCalculado, 0) + pendingFines.reduce((acc, f) => acc + f.monto, 0) + (isCortado ? reconexionFee : 0);

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
        <div className="mt-4 sm:mt-0 space-x-3 flex items-center">
          <Button 
            onClick={() => { 
                setShowOnlyAptForCut(true); 
                setIsModalOpen('APTOS_CORTE'); 
            }} 
            className="bg-transparent border border-red-500/50 text-red-500 hover:bg-red-900/20"
          >
            <FileWarning className="-ml-1 mr-2 h-4 w-4" />
            Aptos para corte
          </Button>
          {userRole !== 'FISCALIZADOR' && (
            <>
              <Button onClick={() => { setIsModalOpen('PAGO_SUELDO'); }} className="bg-blue-600 hover:bg-blue-500 text-white border-0">
                <Briefcase className="-ml-1 mr-2 h-4 w-4" aria-hidden="true" />
                Pago de Sueldos
              </Button>
              <Button onClick={() => { setFormData({...formData, tipo: 'INGRESO', categoria: 'OTROS'}); setIsModalOpen('INGRESO'); }} className="bg-emerald-600 hover:bg-emerald-500 text-white border-0">
                <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                Nuevo Cobro
              </Button>
              <Button onClick={() => { setFormData({...formData, tipo: 'EGRESO', categoria: 'MANTENIMIENTO'}); setIsModalOpen('EGRESO'); }} className="bg-red-600 hover:bg-red-500 text-white border-0">
                <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                Nuevo Pago
              </Button>
            </>
          )}
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
          <div className="border-b border-slate-800 flex flex-col sm:flex-row justify-between items-center sm:pr-4">
            <nav className="flex -mb-px w-full sm:w-2/3" aria-label="Tabs">
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
            <div className="flex flex-wrap items-center space-x-2 py-3 px-4 sm:p-0">
               <input 
                 type="month" 
                 value={selectedMes}
                 onChange={(e) => setSelectedMes(e.target.value)}
                 className="block border-slate-700 rounded-md shadow-sm py-1.5 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm border bg-[#0B0E14] text-slate-100"
               />
               <Button variant="outline" size="sm" onClick={() => handleGenerateReportPDFDetailed('INGRESO')}>
                 <FileText className="-ml-1 mr-2 h-4 w-4" />
                 PDF Ingresos
               </Button>
               <Button variant="outline" size="sm" onClick={() => handleGenerateReportPDFDetailed('EGRESO')}>
                 <FileText className="-ml-1 mr-2 h-4 w-4" />
                 PDF Egresos
               </Button>
               <Button variant="outline" size="sm" onClick={handleGenerateReportExcel} className="hidden lg:inline-flex">
                 <Download className="-ml-1 mr-2 h-4 w-4" />
                 Excel
               </Button>
            </div>
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredTransactions.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={(items) => { setItemsPerPage(items); setCurrentPage(1); }}
            disableTopBorder={true}
          />

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800">
              <thead className="bg-slate-800/80">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-200 uppercase tracking-wider">Fecha</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-200 uppercase tracking-wider">Categoría</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-200 uppercase tracking-wider">Descripción</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-200 uppercase tracking-wider">Monto</th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-slate-200 uppercase tracking-wider">Conciliado</th>
                </tr>
              </thead>
              <tbody className="bg-[#0B0E14] divide-y divide-slate-800">
                {currentTransactions.length > 0 ? currentTransactions.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/60 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-200">
                      {format(parseISO(t.fecha), 'dd MMM yyyy, HH:mm', { locale: es })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-200">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        t.tipo === 'INGRESO' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {t.categoria.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-white max-w-xs truncate">
                      {t.tipo === 'EGRESO' && t.destinatario && <div className="text-xs text-slate-300 mb-0.5">Para: {t.destinatario}</div>}
                      {t.descripcion}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold text-right ${
                      t.tipo === 'INGRESO' ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {t.tipo === 'INGRESO' ? '+' : '-'}{formatCurrency(t.monto)}
                      {t.tipo === 'EGRESO' && (
                        <Button variant="ghost" size="sm" onClick={() => handleGenerateEgresoPDF(t)} className="ml-2 px-2 text-slate-300 hover:text-white" title="Descargar comprobante de egreso">
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                      {t.tipo === 'INGRESO' && (
                        <Button variant="ghost" size="sm" onClick={() => {
                          const client = clients.find(c => c.id === t.clientId);
                          generateGeneralPaymentReceiptPDF(t, client);
                        }} className="ml-2 px-2 text-slate-300 hover:text-white" title="Descargar recibo de pago">
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button 
                        onClick={() => {
                          if (userRole === 'ADMIN' || userRole === 'TESORERO') {
                            toggleTransactionConciliado(t.id);
                            toast.success(`Transacción ${t.conciliado ? 'desmarcada' : 'marcada'} como conciliada.`);
                          } else {
                            toast.error('No tiene permisos para conciliar movimientos.');
                          }
                        }}
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
                          t.conciliado 
                            ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' 
                            : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-200'
                        }`}
                        title={t.conciliado ? "Conciliado (haga clic para deshacer)" : "Marcar como conciliado"}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-slate-300">
                      No hay transacciones en esta sección.
                    </td>
                  </tr>
                )}
              </tbody>

            </table>
            
            {/* Pagination Controls */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredTransactions.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={(items) => { setItemsPerPage(items); setCurrentPage(1); }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Modal Add Transaction */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-slate-900 bg-opacity-75 transition-opacity" onClick={closeModal}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="relative z-10 inline-block align-bottom bg-[#0B0E14] rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full">
              <form onSubmit={handleSubmit}>
                <div className="bg-[#0B0E14] px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg leading-6 font-medium text-slate-100" id="modal-title">
                    {isModalOpen === 'INGRESO' ? 'Registrar Nuevo Cobro' : isModalOpen === 'EGRESO' ? 'Registrar Nuevo Pago' : 'Usuarios Aptos para Corte'}
                  </h3>
                  {isModalOpen === 'APTOS_CORTE' ? (
                    <div className="mt-4 max-h-96 overflow-y-auto space-y-2">
                      {clients.filter(c => {
                        const pendingDebtsCount = consumptions.filter(cons => cons.clientId === c.id && cons.estadoPago === 'PENDIENTE').length;
                        return pendingDebtsCount >= 3 && c.estado !== 'CORTADO';
                      }).length === 0 ? (
                        <p className="text-sm text-slate-400 p-4text-center">No hay usuarios aptos para corte.</p>
                      ) : (
                        clients.filter(c => {
                          const pendingDebtsCount = consumptions.filter(cons => cons.clientId === c.id && cons.estadoPago === 'PENDIENTE').length;
                          return pendingDebtsCount >= 3 && c.estado !== 'CORTADO';
                        }).map(c => (
                          <div key={c.id} className="flex justify-between items-center p-3 bg-slate-800/50 rounded-md border border-slate-700">
                            <div>
                              <div className="text-sm font-medium text-slate-200">{c.codigoSuministro} - {c.nombre ? c.nombre : `${c.nombres} ${c.apellidos}`}</div>
                              <div className="text-xs font-semibold text-red-500 mt-1">{consumptions.filter(cons => cons.clientId === c.id && cons.estadoPago === 'PENDIENTE').length} meses adeudados</div>
                            </div>
                            {userRole !== 'FISCALIZADOR' && (
                              <Button size="sm" variant="destructive" className="bg-red-600 hover:bg-red-700 font-semibold" type="button" onClick={async () => {
                                const confirmChange = await confirm({
                                  title: 'Cortar Servicio',
                                  message: `¿Está seguro de cambiar el estado de ${c.codigoSuministro} a CORTADO?`,
                                  type: 'danger',
                                  confirmLabel: 'Sí, cortar'
                                });
                                if (confirmChange) {
                                  updateClient(c.id, { estado: 'CORTADO' });
                                }
                              }}>
                                <PowerOff className="w-4 h-4 mr-2" />
                                Cortar servicio
                              </Button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  ) : (
                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300">Categoría</label>
                      <select 
                        required 
                        value={formData.categoria} 
                        onChange={e => {
                          const val = e.target.value;
                          setFormData({
                            ...formData, 
                            categoria: val,
                            monto: val === 'RECONEXION' ? '20' : formData.monto,
                            descripcion: val === 'RECONEXION' ? 'Cobro por reconexión de servicio' : formData.descripcion
                          });
                        }} 
                        className="mt-1 block w-full border border-slate-700 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-[#0B0E14] text-slate-100"
                      >
                        {formData.tipo === 'INGRESO' ? (
                          <>
                            <option value="CONSUMO">Cobro por Consumo de Energía</option>
                            <option value="APORTE">Aporte de Socio</option>
                            <option value="MULTA">Pago de Multa</option>
                            <option value="RECONEXION">Cobro por Reconexión de Servicio (S/ 20.00)</option>
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
                    {isModalOpen === 'INGRESO' && ['CONSUMO', 'MULTA', 'APORTE', 'RECONEXION'].includes(formData.categoria) && (
                        <div>
                          <label className="block text-sm font-medium text-slate-300">Buscar Cliente (Suministro, DNI o Nombre)</label>
                          <div className="relative mt-1 flex gap-2">
                            <div className="relative w-full">
                              <input 
                                ref={searchInputRef}
                                type="text" 
                                placeholder="Ingrese términos de búsqueda por suministro o cliente..."
                                value={clientSearch}
                                onChange={(e) => {
                                  setClientSearch(e.target.value);
                                  setShowSuministroDropdown(true);
                                  if (selectedClientId) {
                                    setSelectedClientId('');
                                    setSelectedSupplyCode('');
                                  }
                                }}
                                onFocus={() => setShowSuministroDropdown(true)}
                                onBlur={() => {
                                  setTimeout(() => setShowSuministroDropdown(false), 200);
                                }}
                                className="block w-full border border-slate-700 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-[#0B0E14] text-slate-100"
                              />
                              {showSuministroDropdown && availableSupplies.length > 0 && (
                                <ul className="absolute z-10 mt-1 w-full bg-slate-800 border border-slate-700 rounded-md shadow-lg max-h-48 overflow-auto">
                                  {availableSupplies.map(s => (
                                    <li 
                                      key={`${s.id}|${s.sup}`} 
                                      className="px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 cursor-pointer border-b border-slate-700/50"
                                      onClick={() => {
                                        setSelectedClientId(s.id);
                                        setSelectedSupplyCode(s.sup);
                                        setClientSearch(s.label);
                                        setShowSuministroDropdown(false);
                                      }}
                                    >
                                      <div className="font-medium text-purple-300 mb-0.5">{s.label}</div>
                                      <div className="text-xs text-slate-400">{s.desc}</div>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => setShowOnlyAptForCut(!showOnlyAptForCut)}
                              className={`flex px-3 py-2 text-sm font-medium rounded-md border items-center gap-2 transition-colors flex-shrink-0 ${showOnlyAptForCut ? 'bg-red-900/50 text-red-500 border-red-500/50' : 'bg-[#0B0E14] text-slate-400 border-slate-700 hover:text-slate-200'}`}
                              title="Filtrar clientes con riesgo de corte"
                            >
                              <FileWarning className="h-4 w-4" />
                              <span className="hidden sm:inline">Aptos para corte</span>
                            </button>
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
                                      <span className="text-slate-300">{c.mes} ({c.kwh} kWh) - Suministro {c.codigoSuministro}</span>
                                      <div className="flex items-center space-x-3">
                                        <span className="text-slate-200 font-medium">{formatCurrency(c.montoCalculado)}</span>
                                        <Button size="sm" type="button" onClick={async () => {
                                          const confirmCobro = await confirm({
                                            title: 'Cobrar Recibo',
                                            message: '¿Está seguro de cobrar este recibo por consumo?',
                                            type: 'confirm',
                                            confirmLabel: 'Cobrar'
                                          });
                                          if (confirmCobro) {
                                             try {
                                                await payConsumption(c.id);
                                                setClientSearch('');
                                                setSelectedClientId('');
                                                setSelectedSupplyCode('');
                                                if (searchInputRef.current) searchInputRef.current.focus();
                                                toast.success('Cobro registrado correctamente');
                                              } catch (err) {
                                                toast.error('Error al registrar cobro');
                                              }
                                          }
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
                                        <Button size="sm" type="button" onClick={async () => {
                                          const confirmMulta = await confirm({
                                            title: 'Cobrar Multa',
                                            message: '¿Está seguro de cobrar esta multa?',
                                            type: 'confirm',
                                            confirmLabel: 'Cobrar'
                                          });
                                          if (confirmMulta) {
                                             try {
                                                await payFine(f.id);
                                                setClientSearch('');
                                                setSelectedClientId('');
                                                setSelectedSupplyCode('');
                                                if (searchInputRef.current) searchInputRef.current.focus();
                                                toast.success('Cobro de multa registrado correctamente');
                                              } catch (err) {
                                                toast.error('Error al registrar pago de multa');
                                              }
                                          }
                                        }}>Cobrar</Button>
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-sm text-slate-400 mb-2">No tiene multas pendientes registradas.</p>
                              )}
                            </div>
                            
                            {isCortado && (
                              <div className="mb-4 pt-4 border-t border-slate-700">
                                <h5 className="text-xs font-semibold text-slate-400 uppercase mb-2">Por Reconexión de Servicio</h5>
                                <div className="flex justify-between items-center text-sm gap-4">
                                  <span className="text-slate-300 flex-1 truncate">
                                    Cargo por reactivación del servicio cortado
                                  </span>
                                  <div className="flex items-center space-x-3 flex-shrink-0">
                                    <span className="text-slate-200 font-medium">{formatCurrency(reconexionFee)}</span>
                                    <Button size="sm" type="button" onClick={async () => {
                                      if (pendingConsumptions.length > 2) {
                                        toast.error('No se puede reconectar el servicio. El cliente tiene deuda de 3 o más recibos pendientes. Debe regularizar la deuda de consumo primero.');
                                        return;
                                      }
                                      const confirmReconexion = await confirm({
                                        title: 'Cobrar Reconexión',
                                        message: `¿Está seguro de cobrar S/ ${reconexionFee.toFixed(2)} por reconexión y reactivar el servicio?`,
                                        type: 'confirm',
                                        confirmLabel: 'Recaudar y Reactivar'
                                      });
                                      if (confirmReconexion) {
                                        await addTransaction({
                                          tipo: 'INGRESO',
                                          categoria: 'RECONEXION',
                                          monto: reconexionFee,
                                          descripcion: 'Cobro y pago por reconexión de servicio',
                                          clientId: selectedClientId,
                                          codigoSuministro: selectedSupplyCode || undefined
                                        });
                                        await updateClient(selectedClientId, { estado: 'ACTIVO' });
                                        toast.success('Cobro realizado y servicio reactivado exitosamente.');
                                        closeModal();
                                      }
                                    }}>Cobrar y Reactivar</Button>
                                  </div>
                                </div>
                              </div>
                            )}

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
                  )}
                </div>
                <div className="bg-slate-800/50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  {!['CONSUMO', 'MULTA'].includes(formData.categoria) && (
                    <Button type="submit" className="w-full sm:ml-3 sm:w-auto">Guardar Transacción</Button>
                  )}
                  <Button type="button" variant="outline" onClick={closeModal} className="mt-3 w-full sm:mt-0 sm:w-auto">Cerrar</Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {isModalOpen === 'PAGO_SUELDO' && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-[#07090E] bg-opacity-80 transition-opacity" aria-hidden="true" onClick={closeModal}></div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="relative z-10 inline-block align-bottom bg-[#111622] rounded-xl border border-slate-800 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleSueldoSubmit}>
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                      <Briefcase className="h-5 w-5 text-blue-500" />
                      Registrar Pago de Sueldo
                    </h3>
                    <span className="text-[10px] text-slate-500">Módulo de Planillas</span>
                  </div>

                  {/* Worker Select */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300">Seleccionar Trabajador de Planta <span className="text-red-500">*</span></label>
                    <select
                      required
                      className="mt-1 block w-full py-2 px-3 border border-slate-800 bg-[#0C101A] rounded-lg text-xs text-slate-100 outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      value={sueldoForm.trabajadorId}
                      onChange={(e) => {
                        const tId = e.target.value;
                        const t = trabajadores.find((item: any) => item.id === tId);
                        if (t) {
                          setSueldoForm({
                            ...sueldoForm,
                            trabajadorId: tId,
                            trabajadorNombreCompleto: `${t.apellidos}, ${t.nombres}`,
                            trabajadorDni: t.dni,
                            trabajadorCargo: t.cargo,
                            monto: t.sueldoMensual
                          });
                        } else {
                          setSueldoForm({
                            ...sueldoForm,
                            trabajadorId: '',
                            trabajadorNombreCompleto: '',
                            trabajadorDni: '',
                            trabajadorCargo: '',
                            monto: 0
                          });
                        }
                      }}
                    >
                      <option value="">-- Seleccionar Trabajador Activo --</option>
                      {(trabajadores || []).filter((t: any) => t && t.estado === 'ACTIVO').map((t: any) => (
                        <option key={t.id} value={t.id}>
                          {t.apellidos || ''}, {t.nombres || ''} - {t.cargo || ''} (S/ {Number(t.sueldoMensual || 0).toFixed(2)})
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-500 mt-1">Solo se enumeran los trabajadores con estado Activo.</p>
                  </div>

                  {sueldoForm.trabajadorId && (
                    <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-500 block">DNI</span>
                        <span className="text-slate-200 font-semibold">{sueldoForm.trabajadorDni}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Cargo</span>
                        <span className="text-slate-200 font-semibold">{sueldoForm.trabajadorCargo}</span>
                      </div>
                    </div>
                  )}

                  {/* Month input selector */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300">Mes a Remunerar <span className="text-red-500">*</span></label>
                    <input
                      type="month"
                      required
                      className="mt-1 block w-full py-2 px-3 border border-slate-800 bg-[#0C101A] rounded-lg text-xs text-slate-100 outline-none focus:ring-1 focus:ring-blue-500"
                      value={sueldoForm.mesPagado}
                      onChange={(e) => setSueldoForm({ ...sueldoForm, mesPagado: e.target.value })}
                    />
                  </div>

                  {/* Wages Amount */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 font-sans">Monto del Sueldo (S/)</label>
                    <input
                      type="number"
                      required
                      disabled
                      className="mt-1 block w-full py-2 px-3 border border-slate-800 bg-slate-900 rounded-lg text-xs text-emerald-400 font-bold outline-none cursor-not-allowed"
                      placeholder="Carga automática"
                      value={sueldoForm.monto || ''}
                    />
                    <p className="text-[10px] text-slate-500 mt-1">El monto se carga de manera fija según las condiciones contractuales.</p>
                  </div>

                  {/* Observations */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300">Observaciones o Notas del Pago</label>
                    <textarea
                      rows={2}
                      className="mt-1 block w-full py-2 px-3 border border-slate-800 bg-[#0C101A] rounded-lg text-xs text-slate-100 outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Ej. Planilla regular del mes..."
                      value={sueldoForm.observaciones}
                      onChange={(e) => setSueldoForm({ ...sueldoForm, observaciones: e.target.value })}
                    />
                  </div>
                </div>

                <div className="bg-slate-900/60 px-6 py-3 sm:flex sm:flex-row-reverse sm:gap-2 border-t border-slate-800">
                  <Button
                    type="submit"
                    className="w-full inline-flex justify-center bg-blue-600 hover:bg-blue-500 text-white sm:w-auto border-0"
                  >
                    Registrar y Emitir Boleta
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeModal}
                    className="mt-3 w-full sm:mt-0 sm:w-auto"
                  >
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
