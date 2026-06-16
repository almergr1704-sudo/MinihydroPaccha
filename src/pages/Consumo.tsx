import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, Check, FileText, Download, Upload, AlertCircle, Zap, Receipt } from 'lucide-react';
import { useAppContext } from '../store/AppContext';
import { Button, Card, CardContent, Badge, Pagination } from '../components/ui';
import { formatCurrency, normalizeSearchText } from '../lib/utils';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Consumption } from '../store/types';
import { toast } from 'react-hot-toast';
import Recibos from './Recibos';

export default function Consumo() {
  const navigate = useNavigate();
  const location = useLocation();
  const { confirm } = useConfirm();
  const { clients, consumptions, addConsumption, deleteConsumption, settings, userRole, suppliesInfo } = useAppContext();
  const [historyClientSuministro, setHistoryClientSuministro] = useState<{ clientId: string, codigoSuministro: string, clientName: string } | null>(null);

  const [mainView, setMainView] = useState<'FACTURACION' | 'BUSCAR_RECIBO'>(() => {
    const params = new URLSearchParams(location.search);
    return params.get('tab') === 'recibos' || params.has('clientId') || params.has('supplyCode') ? 'BUSCAR_RECIBO' : 'FACTURACION';
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('tab') === 'recibos' || params.has('clientId') || params.has('supplyCode')) {
      setMainView('BUSCAR_RECIBO');
    } else {
      setMainView('FACTURACION');
    }
  }, [location.search]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMes, setSelectedMes] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 7);
  });
  
  const handleAnularRecibo = (cons: Consumption) => {
    if (cons.estadoPago !== 'PENDIENTE') {
      toast.error('Solo se pueden anular recibos en estado PENDIENTE.');
      return;
    }
    const motivo = window.prompt("Ingrese el motivo de la anulación (Mecanismo de Auditoría):");
    if (motivo) {
      if (motivo.length < 5) {
        toast.error('El motivo debe ser más detallado y descriptivo.');
        return;
      }
      deleteConsumption(cons.id, motivo).then(() => {
        toast.success('Facturación anulada y lectura eliminada.');
      });
    }
  };

  const [clientSearch, setClientSearch] = useState('');
  const [showSuministroDropdown, setShowSuministroDropdown] = useState(false);

  const [formData, setFormData] = useState({
    clientAndSuministro: '',
    lecturaAnterior: '',
    lecturaActual: ''
  });

  const selectedClient = formData.clientAndSuministro ? clients.find(c => c.id === formData.clientAndSuministro.split('|')[0]) : undefined;
  const selectedClientConsumptions = selectedClient 
    ? consumptions.filter(c => c.clientId === selectedClient.id && c.codigoSuministro === formData.clientAndSuministro.split('|')[1]).sort((a,b) => a.mes.localeCompare(b.mes))
    : [];
  
  const isFirstReading = selectedClientConsumptions.length === 0;
  let previousAccumulated = 0;
  if (!isFirstReading) {
    const sumKwh = selectedClientConsumptions.reduce((a, b) => a + (b.kwh || 0), 0);
    const initialLAnterior = selectedClientConsumptions[0].lecturaAnterior || 0;
    previousAccumulated = initialLAnterior + sumKwh;
  }
  
  const currentLecturaAnterior = isFirstReading ? formData.lecturaAnterior : previousAccumulated.toString();
  const currentKwh = Math.max(0, Number(formData.lecturaActual) - Number(currentLecturaAnterior));

  let averageKwh = 0;
  if (selectedClientConsumptions.length > 0) {
    const pastKwhs = selectedClientConsumptions.map(c => c.kwh).filter(kwh => kwh != null) as number[];
    if (pastKwhs.length > 0) {
      averageKwh = pastKwhs.reduce((a, b) => a + b, 0) / pastKwhs.length;
    }
  }

  const ultimaLectura = selectedClientConsumptions.length > 0 ? selectedClientConsumptions[selectedClientConsumptions.length - 1] : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clientAndSuministro || !formData.lecturaActual || (isFirstReading && !formData.lecturaAnterior)) return;

    if (Number(formData.lecturaActual) < Number(currentLecturaAnterior)) {
      toast.error('La lectura actual no puede ser menor a la lectura anterior.');
      return;
    }

    let observacion = undefined;
    if (averageKwh > 0 && currentKwh > averageKwh * 2 && currentKwh > 20) {
      const isConfirmed = await confirm({
        title: 'Alerta de Consumo Excesivo',
        message: `El consumo calculado de ${currentKwh} kWh es significativamente mayor a su promedio histórico (${averageKwh.toFixed(1)} kWh).\n\n¿Estás seguro de registrar esta lectura?`,
        type: 'warning',
        confirmLabel: 'Registrar Lectura'
      });
      if (!isConfirmed) return;
      observacion = 'Posible Consumo Excesivo';
    }

    const [clientId, codigoSuministro] = formData.clientAndSuministro.split('|');

    if (selectedMes >= new Date().toISOString().slice(0, 7)) {
      toast.error('El periodo de lectura debe ser un mes anterior al actual.');
      return;
    }

    const hasLaterReading = consumptions.some(c => c.codigoSuministro === codigoSuministro && c.mes > selectedMes);
    if (hasLaterReading) {
      toast.error(`No puede registrar una lectura para ${selectedMes} porque ya existe una lectura registrada en un mes posterior para el suministro ${codigoSuministro}.`);
      return;
    }

    const exists = consumptions.some(c => c.codigoSuministro === codigoSuministro && c.mes === selectedMes);
    if (exists) {
      toast.error(`Ya existe una lectura para el suministro ${codigoSuministro} en el mes ${selectedMes}.`);
      return;
    }

    const saveConfirmed = await confirm({
      title: 'Guardar Lectura',
      message: `¿Está seguro de guardar la lectura para el periodo ${selectedMes}?\nConsumo calculado: ${currentKwh} kWh`,
      type: 'confirm',
      confirmLabel: 'Guardar'
    });
    if (!saveConfirmed) return;

    try {
      await addConsumption({
        clientId,
        codigoSuministro,
        kwh: currentKwh,
        lecturaAnterior: Number(currentLecturaAnterior),
        lecturaActual: Number(formData.lecturaActual),
        fechaLectura: new Date().toISOString(),
        mes: selectedMes,
        ...(observacion ? { observacion } : {})
      });
      
      toast.success('Lectura registrada con éxito.');
      setFormData({ clientAndSuministro: '', lecturaAnterior: '', lecturaActual: '' });
      setClientSearch('');
      setShowSuministroDropdown(false);
      setTimeout(() => {
        if (searchInputRef.current) searchInputRef.current.focus();
      }, 100);
    } catch(err) {
      toast.error('Ocurrió un error al registrar la lectura.');
    }
  };

    const getDebtInfo = (clientId: string, codigoSuministro: string, currentMes: string, hasPendingCurrent: boolean = false) => {
    const previousUnpaid = consumptions.filter(c => 
      c.clientId === clientId && 
      c.codigoSuministro === codigoSuministro && 
      c.estadoPago === 'PENDIENTE' &&
      c.mes !== currentMes
    );
    const totalDeuda = previousUnpaid.reduce((acc, c) => acc + c.montoCalculado, 0);
    const monthsOwned = previousUnpaid.length + (hasPendingCurrent ? 1 : 0);
    const settingsCostoReconexion = settings?.costoReconexion || 0;
    return {
      totalDeuda,
      monthsOwned,
      previousUnpaid,
      warning: monthsOwned >= 3 
        ? `AVISO DE CORTE: EL SERVICIO SE ENCUENTRA APTO PARA CORTE POR DEUDA DE 3 MESES O MÁS.${settingsCostoReconexion > 0 ? `\nCosto por reconexión: S/ ${settingsCostoReconexion.toFixed(2)}` : ''}` 
        : ''
    };
  };

  const handleExportConsumosExcel = (consumptionsList: Consumption[]) => {
    if (consumptionsList.length === 0) return;
    const exportData = consumptionsList.map(cons => {
      const client = clients.find(c => c.id === cons.clientId);
      const clientName = client?.nombre ? client.nombre : `${client?.nombres || ''} ${client?.apellidos || ''}`;
      const [yearPart, monthPart] = cons.mes.split('-');
      const displayReciboNo = cons.reciboNo || `REC-${yearPart}-${monthPart}-${cons.id.slice(-4).toUpperCase()}`;
      return {
        'Nro Recibo': displayReciboNo,
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
    if (consumptionsList.length === 0) {
      toast.error('No existen datos disponibles para generar el PDF.');
      return;
    }
    const toastId = toast.loading('Generando PDF...');
    try {
      const doc = new jsPDF();
    doc.text(`Reporte de Consumos - ${selectedMes}`, 14, 20);
    
    const tableData = consumptionsList.map(cons => {
      const client = clients.find(c => c.id === cons.clientId);
      const clientName = client?.nombre ? client.nombre : `${client?.nombres || ''} ${client?.apellidos || ''}`;
      const [yearPart, monthPart] = cons.mes.split('-');
      const displayReciboNo = cons.reciboNo || `REC-${yearPart}-${monthPart}-${cons.id.slice(-4).toUpperCase()}`;
      return [
        displayReciboNo,
        clientName,
        cons.codigoSuministro || '',
        cons.kwh?.toString() || '0',
        cons.montoCalculado.toFixed(2),
        cons.estadoPago
      ];
    });

    autoTable(doc, {
      startY: 30,
      head: [['Nro Recibo', 'Cliente', 'Suministro', 'kWh', 'Monto', 'Estado']],
      body: tableData,
    });

      doc.save(`Reporte_Consumos_${selectedMes}.pdf`);
      toast.success('PDF generado y descargado con éxito.', { id: toastId });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Error al generar el PDF.', { id: toastId });
    }
  };

  const handleGenerateMassReceipts = () => {
    const toastId = toast.loading('Generando PDF masivo...');
    try {
      const suppliesToInvoice: any[] = [];
    
    clients.forEach(client => {
      if (client.estado !== 'ACTIVO' && client.estado !== 'CORTADO') return;
      
      const supplies = client.suministros?.length ? client.suministros : [client.codigoSuministro].filter(Boolean);
      
      supplies.forEach((sup) => {
        if (!sup) return;
        const currentReading = consumptions.find(c => c.clientId === client.id && c.codigoSuministro === sup && c.mes === selectedMes);
        const hasPendingCurrent = currentReading ? currentReading.estadoPago === 'PENDIENTE' : false;
        const debtInfo = getDebtInfo(client.id, sup, selectedMes, hasPendingCurrent);
        
        if (hasPendingCurrent || debtInfo.previousUnpaid.length > 0) {
          suppliesToInvoice.push({
            client,
            codigoSuministro: sup,
            currentReading,
            debtInfo
          });
        }
      });
    });

    if (suppliesToInvoice.length === 0) {
      toast.error('No existen datos disponibles para generar el PDF.');
      return;
    }

    // Sort by codigoSuministro
    suppliesToInvoice.sort((a, b) => a.codigoSuministro.localeCompare(b.codigoSuministro));

    const doc = new jsPDF({ format: 'a4' });
    let yOffset = 10;
    const maxH = 297;

    const formatCurrencyStr = (val: number) => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(val);

    suppliesToInvoice.forEach((item, index) => {
      const { client, codigoSuministro, currentReading, debtInfo } = item;
      
      // -- CALCULATE DYNAMIC HEIGHT --
      const testDoc = new jsPDF({ format: 'a4' });
      const testTableBody: any[][] = [];
      if (currentReading && currentReading.estadoPago === 'PENDIENTE') {
        const isSocio = suppliesInfo?.find(s => s.codigo === codigoSuministro)?.isSocio ?? (client.tipo === 'SOCIO');
        const tarifaAplicada = client.faseSuministro === 'TRIFASICO' && (settings?.costoTrifasico || 0) > 0 
          ? (settings?.costoTrifasico || 0) 
          : isSocio ? (settings?.costoSocio || 0.2) : (settings?.costoUsuario || 0.3);
        const kwh = currentReading.kwh || 0;
        const minimoAplica = settings?.consumoMinimo !== undefined ? settings.consumoMinimo : 6;
        const esMinimo = kwh * tarifaAplicada < minimoAplica;
        testTableBody.push([
          'Consumo Eléctrico' + (esMinimo ? ` (Mín. S/ ${minimoAplica.toFixed(2)})` : ''),
          kwh.toString(), tarifaAplicada.toFixed(2), formatCurrencyStr(currentReading.montoCalculado)
        ]);
      }
      if (debtInfo.previousUnpaid && debtInfo.previousUnpaid.length > 0) {
        const numMeses = debtInfo.previousUnpaid.length;
        const textoDeuda = `Deuda Anterior (${numMeses} mes${numMeses === 1 ? '' : 'es'})`;
        testTableBody.push([
          { content: textoDeuda, styles: { fontStyle: 'bold', textColor: [220, 38, 38] } },
          '-',
          '-', 
          { content: formatCurrencyStr(debtInfo.previousUnpaid.reduce((acc: any, unpaid: any) => acc + unpaid.montoCalculado, 0)), styles: { fontStyle: 'bold', textColor: [220, 38, 38] } }
        ]);
      }
      
      autoTable(testDoc, {
        startY: 39,
        head: [['Descripción', 'Cantidad (kWh)', 'Precio (S/)', 'Subtotal']],
        body: testTableBody,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 1 },
        margin: { left: 14, right: 14 }
      });
      const estimatedHeight = ((testDoc as any).lastAutoTable?.finalY || 43) + 14; 
      // --------------------------------

      if (yOffset + estimatedHeight > maxH - 5) {
        doc.addPage();
        yOffset = 10;
      }

      const clientName = client.nombre ? client.nombre : `${client.nombres} ${client.apellidos}`;

      // Header
      doc.setFontSize(16);
      doc.text('Mini Central Hidroeléctrica Paccha', 14, yOffset + 6);

      if (debtInfo.warning) {
        doc.setFontSize(9);
        doc.setTextColor(220, 38, 38); // Red
        const extReconexion = (settings?.costoReconexion || 0).toFixed(2);
        doc.text('SERVICIO PARA CORTE', 196, yOffset + 6, { align: 'right' });
        doc.text(`Reconexión S/ ${extReconexion}`, 196, yOffset + 10, { align: 'right' });
        doc.setTextColor(0, 0, 0); // Reset
      }

      const [yearPart, monthPart] = selectedMes.split('-');
      const displayReciboNo = currentReading?.reciboNo || `REC-${yearPart}-${monthPart}-${currentReading?.id ? currentReading.id.slice(-4).toUpperCase() : '0000'}`;

      doc.setFontSize(10);
      doc.text(`Recibo: ${displayReciboNo} | Suministro: ${codigoSuministro} | Tipo: ${client.tipo}`, 14, yOffset + 12);
      
      const docState = currentReading ? currentReading.estadoPago : 'PENDIENTE';
      doc.setFontSize(9);
      doc.text(`Fecha Emisión: ${format(new Date(), 'dd MMM yyyy')} | Periodo: ${selectedMes} | Estado: ${docState}`, 14, yOffset + 18);

      // Client Info
      doc.setFontSize(10);
      const clientDniText = client.tipoPersona === 'EMPRESA' ? ` (RUC: ${client.dni})` : '';
      doc.text(`Cliente: ${clientName}${clientDniText}`, 14, yOffset + 23);
      doc.text(`Dirección: ${client.direccion} ${client.numeroDireccion ? `N° ${client.numeroDireccion}` : ''}`, 14, yOffset + 28);
      
      // Consumos
      const allCons = consumptions
        .filter(c => c.clientId === client.id && c.codigoSuministro === codigoSuministro)
        .sort((a,b) => a.mes.localeCompare(b.mes));
      
      let calcLecturaAnterior = 0;
      let calcLecturaActual = 0;
      const currentKwh = currentReading ? currentReading.kwh || 0 : 0;
      
      if (currentReading) {
        if (currentReading.lecturaAnterior !== undefined && currentReading.lecturaActual !== undefined) {
           calcLecturaAnterior = currentReading.lecturaAnterior;
           calcLecturaActual = currentReading.lecturaActual;
        } else {
           const pastCons = allCons.filter(c => c.mes < selectedMes);
           const initialL = allCons.length > 0 && allCons[0].lecturaAnterior !== undefined ? allCons[0].lecturaAnterior : 0;
           calcLecturaAnterior = initialL + pastCons.reduce((acc, c) => acc + (c.kwh || 0), 0);
           calcLecturaActual = calcLecturaAnterior + currentKwh;
        }
      }

      doc.text(`Lectura actual: ${calcLecturaActual} kWh | Lectura anterior: ${calcLecturaAnterior} kWh`, 14, yOffset + 34);
      doc.text(`Consumo del mes: ${currentKwh} kWh`, 14, yOffset + 39);

      // Draw Chart
      const historyCons = consumptions
        .filter(c => c.clientId === client.id && c.codigoSuministro === codigoSuministro && c.mes <= selectedMes)
        .sort((a,b) => b.mes.localeCompare(a.mes))
        .slice(0, 6)
        .reverse();
      
      const chartX = 135;
      const chartY = yOffset + 18;
      const chartW = 60;
      const chartH = 18;
      
      doc.setFontSize(8);
      doc.text('Historial de Pagos (S/)', chartX, chartY - 2);
      doc.setDrawColor(200);
      doc.line(chartX, chartY + chartH, chartX + chartW, chartY + chartH); // x-axis
      
      if (historyCons.length > 0) {
        const maxK = Math.max(...historyCons.map(c => c.montoCalculado || 0), 10);
        const barW = 6;
        const spacing = (chartW - (historyCons.length * barW)) / (historyCons.length + 1);
        
        const colors = [
          [59,130,246], [16,185,129], [245,158,11], [239,68,68],
          [139,92,246], [236,72,153], [6,182,212], [249,115,22],
          [168,85,247], [20,184,166], [234,179,8], [244,63,94]
        ];
        
        historyCons.forEach((hc, i) => {
          const x = chartX + spacing + i * (barW + spacing);
          const barH = ((hc.montoCalculado || 0) / maxK) * chartH;
          const y = chartY + chartH - barH;
          
          let mIndex = 0;
          if (hc.mes) {
            const parts = hc.mes.split('-');
            if (parts.length > 1) {
              mIndex = parseInt(parts[1], 10) - 1;
            }
          }
          const color = colors[mIndex] || [15, 23, 42];
          
          doc.setFillColor(color[0], color[1], color[2]);
          doc.rect(x, y, barW, barH, 'F');
          
          doc.setFontSize(6);
          doc.text((hc.montoCalculado || 0).toFixed(0).toString(), x + barW/2, y - 1, { align: 'center' });
          const mShort = hc.mes ? new Date(`${hc.mes}-02`).toLocaleDateString('es', {month:'short'}).substring(0,3) : '';
          doc.text(mShort, x + barW/2, chartY + chartH + 3, { align: 'center' });
        });
      }

      // Table
      const tableBody: any[][] = [];
      let totalMontoCalculado = 0;

      if (currentReading && currentReading.estadoPago === 'PENDIENTE') {
        const isSocio = suppliesInfo?.find(s => s.codigo === codigoSuministro)?.isSocio ?? (client.tipo === 'SOCIO');
        const tarifaAplicada = client.faseSuministro === 'TRIFASICO' && (settings?.costoTrifasico || 0) > 0 
          ? (settings?.costoTrifasico || 0) 
          : isSocio ? (settings?.costoSocio || 0.2) : (settings?.costoUsuario || 0.3);
        const kwh = currentReading.kwh || 0;
        const minimoAplica = settings?.consumoMinimo !== undefined ? settings.consumoMinimo : 6;
        const esMinimo = kwh * tarifaAplicada < minimoAplica;
        tableBody.push([
          'Consumo Eléctrico' + (esMinimo ? ` (Mín. S/ ${minimoAplica.toFixed(2)})` : ''),
          kwh.toString(),
          tarifaAplicada.toFixed(2),
          formatCurrencyStr(currentReading.montoCalculado)
        ]);
        totalMontoCalculado += currentReading.montoCalculado;
      }

      if (debtInfo.previousUnpaid && debtInfo.previousUnpaid.length > 0) {
        const totalDeudaAnterior = debtInfo.previousUnpaid.reduce((acc: any, unpaid: any) => acc + unpaid.montoCalculado, 0);
        const numMeses = debtInfo.previousUnpaid.length;
        const textoDeuda = `Deuda Anterior (${numMeses} mes${numMeses === 1 ? '' : 'es'})`;
        tableBody.push([
          { content: textoDeuda, styles: { fontStyle: 'bold', textColor: [220, 38, 38] } },
          '-',
          '-',
          { content: formatCurrencyStr(totalDeudaAnterior), styles: { fontStyle: 'bold', textColor: [220, 38, 38] } }
        ]);
      }

      const totalAPagar = totalMontoCalculado + debtInfo.totalDeuda;

      autoTable(doc, {
        startY: yOffset + 44,
        head: [['Descripción', 'Cantidad (kWh)', 'Precio (S/)', 'Subtotal']],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42] },
        styles: { fontSize: 8, cellPadding: 1 },
        margin: { left: 14, right: 14 }
      });

      const finalY = (doc as any).lastAutoTable?.finalY || yOffset + 43;
      doc.setFontSize(16);
      doc.text(`Total a Pagar: ${formatCurrencyStr(totalAPagar)}`, 196, finalY + 6, { align: 'right' });
      
      const [yearStr, monthStr] = selectedMes.split('-');
      const lastDay = new Date(parseInt(yearStr), parseInt(monthStr), 0).getDate();
      const monthName = new Date(`${selectedMes}-02`).toLocaleDateString('es', { month: 'long' });
      const fechaVencimiento = `${lastDay} de ${monthName} del ${yearStr}`;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`Fecha de Vencimiento: ${fechaVencimiento}`, 14, finalY + 5);
      doc.setFont('helvetica', 'normal');

      const currentReceiptBottom = finalY + 10;

      // Draw a cut line
      doc.setLineDashPattern([2, 2], 0);
      doc.line(10, currentReceiptBottom, 200, currentReceiptBottom);
      doc.setLineDashPattern([], 0); // reset

      yOffset = currentReceiptBottom + 4;
    });

      doc.save(`Recibos_Masivos_${selectedMes}.pdf`);
      toast.success('Recibos generados y descargados con éxito.', { id: toastId });
    } catch (error) {
      console.error('Error generating mass receipts PDF:', error);
      toast.error('Error al generar los recibos.', { id: toastId });
    }
  };

  const handleGenerateReceipt = (cons: Consumption) => {
    const toastId = toast.loading('Generando recibo...');
    try {
      const client = clients.find(c => c.id === cons.clientId);
    if (!client) return;

    const clientName = client.nombre ? client.nombre : `${client.nombres} ${client.apellidos}`;

    const codSuministro = cons.codigoSuministro || client.codigoSuministro;
    const debtInfo = getDebtInfo(client.id, codSuministro || '', cons.mes, cons.estadoPago === 'PENDIENTE');

    // --- CALCULATE DYNAMIC HEIGHT ---
    const testDoc = new jsPDF({ format: 'a4' });
    const testTableBody: any[][] = [];
    const isSocio = suppliesInfo?.find(s => s.codigo === cons.codigoSuministro)?.isSocio ?? (client.tipo === 'SOCIO');
    const testTarifaAplicada = client.faseSuministro === 'TRIFASICO' && (settings?.costoTrifasico || 0) > 0 
      ? (settings?.costoTrifasico || 0) 
      : isSocio ? (settings?.costoSocio || 0.2) : (settings?.costoUsuario || 0.3);
    const testKwh = cons.kwh || 0;
    const testMinimoAplica = settings?.consumoMinimo !== undefined ? settings.consumoMinimo : 6;
    const testEsMinimo = testKwh * testTarifaAplicada < testMinimoAplica;
    const calcFormatCurrencyStr = (val: number) => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(val);
    testTableBody.push([
      'Consumo Eléctrico' + (testEsMinimo ? ` (Mín. S/ ${testMinimoAplica.toFixed(2)})` : ''),
      testKwh.toString(), testTarifaAplicada.toFixed(2), calcFormatCurrencyStr(cons.montoCalculado)
    ]);
    if (debtInfo.previousUnpaid && debtInfo.previousUnpaid.length > 0) {
      const numMeses = debtInfo.previousUnpaid.length;
      const textoDeuda = `Deuda Anterior (${numMeses} mes${numMeses === 1 ? '' : 'es'})`;
      testTableBody.push([
        { content: textoDeuda, styles: { fontStyle: 'bold', textColor: [220, 38, 38] } },
        '-',
        '-', 
        { content: calcFormatCurrencyStr(debtInfo.previousUnpaid.reduce((acc: any, unpaid: any) => acc + unpaid.montoCalculado, 0)), styles: { fontStyle: 'bold', textColor: [220, 38, 38] } }
      ]);
    }
    autoTable(testDoc, {
      startY: 39,
      head: [['Descripción', 'Cantidad (kWh)', 'Precio (S/)', 'Subtotal']],
      body: testTableBody,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1 },
      margin: { left: 14, right: 14 }
    });
    const estimatedHeight = ((testDoc as any).lastAutoTable?.finalY || 43) + 14; 
    // --------------------------------

    const doc = new jsPDF({ format: 'a4' });
    const maxH = 297;
    let yOffset = 10;
    
    // Auto page break just in case
    if (yOffset + estimatedHeight > maxH - 5) {
      doc.addPage();
      yOffset = 10;
    }

    // Header
    doc.setFontSize(16);
    doc.text('Mini Central Hidroeléctrica Paccha', 14, yOffset + 6);

    if (debtInfo.warning) {
      doc.setFontSize(9);
      doc.setTextColor(220, 38, 38); // Red
      const extReconexion = (settings?.costoReconexion || 0).toFixed(2);
      doc.text('SERVICIO PARA CORTE', 196, yOffset + 6, { align: 'right' });
      doc.text(`Reconexión S/ ${extReconexion}`, 196, yOffset + 10, { align: 'right' });
      doc.setTextColor(0, 0, 0); // Reset
    }

    const [yearPart, monthPart] = cons.mes.split('-');
    const displayReciboNo = cons.reciboNo || `REC-${yearPart}-${monthPart}-${cons.id.slice(-4).toUpperCase()}`;

    doc.setFontSize(10);
    doc.text(`Recibo: ${displayReciboNo} | Suministro: ${codSuministro} | Tipo: ${client.tipo}`, 14, yOffset + 12);
    
    doc.setFontSize(9);
    doc.text(`Fecha Emisión: ${format(new Date(), 'dd MMM yyyy')} | Periodo: ${cons.mes} | Estado: ${cons.estadoPago}`, 14, yOffset + 18);

    // Client Info
    doc.setFontSize(10);
    const clientDniText = client.tipoPersona === 'EMPRESA' ? ` (RUC: ${client.dni})` : '';
    doc.text(`Cliente: ${clientName}${clientDniText}`, 14, yOffset + 23);
    doc.text(`Dirección: ${client.direccion} ${client.numeroDireccion ? `N° ${client.numeroDireccion}` : ''}`, 14, yOffset + 28);

    // Consumos
    const allCons = consumptions
      .filter(c => c.clientId === client.id && c.codigoSuministro === codSuministro)
      .sort((a,b) => a.mes.localeCompare(b.mes));
    
    let calcLecturaAnterior = 0;
    let calcLecturaActual = 0;
    const currentKwh = cons.kwh || 0;
    
    if (cons.lecturaAnterior !== undefined && cons.lecturaActual !== undefined) {
      calcLecturaAnterior = cons.lecturaAnterior;
      calcLecturaActual = cons.lecturaActual;
    } else {
      const pastCons = allCons.filter(c => c.mes < cons.mes);
      const initialL = allCons.length > 0 && allCons[0].lecturaAnterior !== undefined ? allCons[0].lecturaAnterior : 0;
      calcLecturaAnterior = initialL + pastCons.reduce((acc, c) => acc + (c.kwh || 0), 0);
      calcLecturaActual = calcLecturaAnterior + currentKwh;
    }

    doc.text(`Lectura actual: ${calcLecturaActual} kWh | Lectura anterior: ${calcLecturaAnterior} kWh`, 14, yOffset + 34);
    doc.text(`Consumo del mes: ${currentKwh} kWh`, 14, yOffset + 39);

    // Draw Chart
    const historyCons = consumptions
      .filter(c => c.clientId === client.id && c.codigoSuministro === codSuministro && c.mes <= cons.mes)
      .sort((a,b) => b.mes.localeCompare(a.mes))
      .slice(0, 6)
      .reverse();
    
    const chartX = 135;
    const chartY = yOffset + 18;
    const chartW = 60;
    const chartH = 18;
    
    doc.setFontSize(8);
    doc.text('Historial de Pagos (S/)', chartX, chartY - 2);
    doc.setDrawColor(200);
    doc.line(chartX, chartY + chartH, chartX + chartW, chartY + chartH); // x-axis
    
    if (historyCons.length > 0) {
      const maxK = Math.max(...historyCons.map(c => c.montoCalculado || 0), 10);
      const barW = 6;
      const spacing = (chartW - (historyCons.length * barW)) / (historyCons.length + 1);
      
        const colors = [
          [59,130,246], [16,185,129], [245,158,11], [239,68,68],
          [139,92,246], [236,72,153], [6,182,212], [249,115,22],
          [168,85,247], [20,184,166], [234,179,8], [244,63,94]
        ];
        
        historyCons.forEach((hc, i) => {
          const x = chartX + spacing + i * (barW + spacing);
          const barH = ((hc.montoCalculado || 0) / maxK) * chartH;
          const y = chartY + chartH - barH;
          
          let mIndex = 0;
          if (hc.mes) {
            const parts = hc.mes.split('-');
            if (parts.length > 1) {
              mIndex = parseInt(parts[1], 10) - 1;
            }
          }
          const color = colors[mIndex] || [15, 23, 42];
          
          doc.setFillColor(color[0], color[1], color[2]);
          doc.rect(x, y, barW, barH, 'F');
        
        doc.setFontSize(6);
        doc.text((hc.montoCalculado || 0).toFixed(0).toString(), x + barW/2, y - 1, { align: 'center' });
        const mShort = hc.mes ? new Date(`${hc.mes}-02`).toLocaleDateString('es', {month:'short'}).substring(0,3) : '';
        doc.text(mShort, x + barW/2, chartY + chartH + 3, { align: 'center' });
      });
    }

    // Table
    const tableBody: any[][] = [];
    let totalMontoCalculado = 0;

    if (cons && cons.estadoPago === 'PENDIENTE') {
      tableBody.push([
        'Consumo Eléctrico' + (testEsMinimo ? ` (Mín. S/ ${testMinimoAplica.toFixed(2)})` : ''),
        currentKwh.toString(), testTarifaAplicada.toFixed(2), calcFormatCurrencyStr(cons.montoCalculado)
      ]);
      totalMontoCalculado += cons.montoCalculado;
    }

    if (debtInfo.previousUnpaid && debtInfo.previousUnpaid.length > 0) {
      const totalDeudaAnterior = debtInfo.previousUnpaid.reduce((acc, unpaid) => acc + unpaid.montoCalculado, 0);
      const numMeses = debtInfo.previousUnpaid.length;
      const textoDeuda = `Deuda Anterior (${numMeses} mes${numMeses === 1 ? '' : 'es'})`;
      tableBody.push([
        { content: textoDeuda, styles: { fontStyle: 'bold', textColor: [220, 38, 38] } },
        '-',
        '-',
        { content: calcFormatCurrencyStr(totalDeudaAnterior), styles: { fontStyle: 'bold', textColor: [220, 38, 38] } }
      ]);
    }

    const totalAPagar = totalMontoCalculado + debtInfo.totalDeuda;

    autoTable(doc, {
      startY: yOffset + 44,
      head: [['Descripción', 'Cantidad (kWh)', 'Precio (S/)', 'Subtotal']],
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42] },
      styles: { fontSize: 8, cellPadding: 1 },
      margin: { left: 14, right: 14 }
    });

    const finalY = (doc as any).lastAutoTable?.finalY || yOffset + 43;
    doc.setFontSize(16);
    doc.text(`Total a Pagar: ${calcFormatCurrencyStr(totalAPagar)}`, 196, finalY + 6, { align: 'right' });
    
    const [yearStr, monthStr] = cons.mes.split('-');
    const lastDay = new Date(parseInt(yearStr), parseInt(monthStr), 0).getDate();
    const monthName = new Date(`${cons.mes}-02`).toLocaleDateString('es', { month: 'long' });
    const fechaVencimiento = `${lastDay} de ${monthName} del ${yearStr}`;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Fecha de Vencimiento: ${fechaVencimiento}`, 14, finalY + 5);
    doc.setFont('helvetica', 'normal');

      doc.save(`Recibo_${clientName.replace(/\s+/g, '_')}_${cons.mes}.pdf`);
      toast.success('Recibo generado y descargado con éxito.', { id: toastId });
    } catch (error) {
      console.error('Error generating receipt PDF:', error);
      toast.error('Error al generar el recibo.', { id: toastId });
    }
  };

  const [activeTab, setActiveTab] = useState<'LECTURAS' | 'DEUDAS'>('LECTURAS');

  // Filter consumptions by selected month
  const [tableSearch, setTableSearch] = useState('');

  const filteredConsumptions = consumptions.filter(c => {
    if (c.mes !== selectedMes) return false;
    if (!tableSearch) return true;
    const client = clients.find(cl => cl.id === c.clientId);
    if (!client) return false;
    const searchNormalized = normalizeSearchText(tableSearch);
    const rawFullName = client.nombre ? client.nombre : `${client.nombres || ''} ${client.apellidos || ''}`;
    const fullName = normalizeSearchText(rawFullName);
    const dni = normalizeSearchText(client.dni || '');
    const suministro = normalizeSearchText(c.codigoSuministro || '');

    return suministro.includes(searchNormalized) ||
           dni.includes(searchNormalized) ||
           fullName.includes(searchNormalized);
  });
  
  // All pending debts
  const pendingDebts = consumptions.filter(c => {
    if (c.estadoPago !== 'PENDIENTE') return false;
    if (!tableSearch) return true;
    const client = clients.find(cl => cl.id === c.clientId);
    if (!client) return false;
    const searchNormalized = normalizeSearchText(tableSearch);
    const rawFullName = client.nombre ? client.nombre : `${client.nombres || ''} ${client.apellidos || ''}`;
    const fullName = normalizeSearchText(rawFullName);
    const dni = normalizeSearchText(client.dni || '');
    const suministro = normalizeSearchText(c.codigoSuministro || '');
    
    return suministro.includes(searchNormalized) ||
           dni.includes(searchNormalized) ||
           fullName.includes(searchNormalized);
  }).sort((a,b) => new Date(b.fechaLectura).getTime() - new Date(a.fechaLectura).getTime());

  const searchedClients = clients.filter(c => {
    if (!clientSearch) return true;
    const searchNormalized = normalizeSearchText(clientSearch);
    const rawFullName = c.nombre ? c.nombre : `${c.nombres || ''} ${c.apellidos || ''}`;
    const fullName = normalizeSearchText(rawFullName);
    const dni = normalizeSearchText(c.dni || '');
    const clientSupplies = c.suministros?.length ? c.suministros : [c.codigoSuministro];
    const allSuppliesStr = normalizeSearchText(clientSupplies.join(' '));

    return dni.includes(searchNormalized) || fullName.includes(searchNormalized) || allSuppliesStr.includes(searchNormalized);
  }).filter(c => c.estado === 'ACTIVO' || c.estado === 'CORTADO');

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
       setFormData(prev => ({ ...prev, clientAndSuministro: `${availableSupplies[0].id}|${availableSupplies[0].sup}` }));
       setShowSuministroDropdown(false);
    }
  }, [clientSearch, availableSupplies]);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const currentList = activeTab === 'LECTURAS' ? filteredConsumptions : pendingDebts;
  const totalPages = Math.ceil(currentList.length / itemsPerPage);
  
  const currentItems = currentList.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  React.useEffect(() => {
    setCurrentPage(1);
  }, [selectedMes, tableSearch, activeTab]);

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
        {mainView === 'FACTURACION' && (
          <div className="mt-4 sm:mt-0 flex items-center space-x-2">
            {userRole !== 'FISCALIZADOR' && (
              <Button onClick={() => setIsModalOpen(true)}>
                <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                Registrar Lectura
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Sub-navigation tabs for switching views inside the Consumo module */}
      <div className="border-b border-slate-800">
        <nav className="flex space-x-6" aria-label="Views">
          <button
            onClick={() => {
              setMainView('FACTURACION');
              navigate('/consumo', { replace: true });
            }}
            className={`pb-4 px-1 border-b-2 font-medium text-sm transition-all duration-150 flex items-center gap-2 ${
              mainView === 'FACTURACION'
                ? 'border-blue-500 text-blue-500 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-300'
            }`}
          >
            <Zap className="h-4 w-4" />
            Lecturas y Facturación
          </button>
          <button
            onClick={() => {
              setMainView('BUSCAR_RECIBO');
              navigate('/consumo?tab=recibos', { replace: true });
            }}
            className={`pb-4 px-1 border-b-2 font-medium text-sm transition-all duration-150 flex items-center gap-2 ${
              mainView === 'BUSCAR_RECIBO'
                ? 'border-blue-500 text-blue-500 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-300'
            }`}
          >
            <Receipt className="h-4 w-4" />
            Buscar Recibo
          </button>
        </nav>
      </div>

      {mainView === 'BUSCAR_RECIBO' ? (
        <Recibos />
      ) : (
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

          <div className="p-4 border-b border-slate-800 bg-[#0B0E14]">
            <input 
              type="text" 
              placeholder="Buscar recibos por cliente, DNI o suministro..." 
              value={tableSearch}
              onChange={e => setTableSearch(e.target.value)}
              className="block w-full max-w-md border border-slate-700 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-[#0B0E14] text-slate-100 placeholder-slate-500"
            />
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
                  onClick={() => handleGenerateMassReceipts()}
                  className="flex items-center"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Imprimir Recibos Masivos
                </Button>
              </div>
            </div>
          )}

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={currentList.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={(items) => { setItemsPerPage(items); setCurrentPage(1); }}
            disableTopBorder={true}
          />

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800">
              <thead className="bg-slate-800/50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Cliente</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Consumo</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Monto Calculado</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Observación</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Estado</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-[#0B0E14] divide-y divide-slate-800">
                {currentItems.length > 0 ? currentItems.map((cons) => {
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
                        <div className="text-xs text-amber-400 font-mono font-semibold">
                          {cons.reciboNo || `REC-${cons.mes.split('-')[0]}-${cons.mes.split('-')[1]}-${cons.id.slice(-4).toUpperCase()}`}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {cons.mes} • {format(parseISO(cons.fechaLectura), 'dd MMM yyyy', { locale: es })}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-slate-100">{formatCurrency(cons.montoCalculado)}</div>
                        <div className="text-xs text-slate-400">Tarifa: S/ {
                            (() => {
                               const isSocio = suppliesInfo?.find(s => s.codigo === cons.codigoSuministro)?.isSocio ?? (client?.tipo === 'SOCIO');
                               return client?.faseSuministro === 'TRIFASICO' && settings.costoTrifasico > 0 ? settings.costoTrifasico.toFixed(2) : 
                               isSocio ? settings.costoSocio.toFixed(2) : settings.costoUsuario.toFixed(2);
                            })()
                          }/kWh</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-xs text-slate-400 max-w-[150px] truncate" title={cons.observacion || ''}>{cons.observacion || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={cons.estadoPago === 'PAGADO' ? 'success' : 'warning'}>
                          {cons.estadoPago}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2 flex items-center justify-end">
                        {userRole !== 'OPERATOR' && cons.estadoPago === 'PENDIENTE' && (
                          <Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-500/10 hover:text-red-400 mr-2" onClick={() => handleAnularRecibo(cons)}>
                            Anular
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="hover:text-amber-400 text-amber-500/95" onClick={() => navigate(`/consumo?tab=recibos&supplyCode=${cons.codigoSuministro || client?.codigoSuministro}`)}>
                          Buscador
                        </Button>
                        <Button size="sm" variant="ghost" className="text-blue-600" onClick={() => handleGenerateReceipt(cons)}>
                          <Download className="h-4 w-4 mr-1" /> Imprimir Recibo
                        </Button>
                        <Button size="sm" variant="outline" className="ml-2 border-slate-700 text-slate-300" 
                          onClick={() => setHistoryClientSuministro({ clientId: cons.clientId, codigoSuministro: cons.codigoSuministro || (client?.codigoSuministro || ''), clientName })}>
                          Ver Historial
                        </Button>
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
            
            {/* Pagination Controls */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={currentList.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={(items) => { setItemsPerPage(items); setCurrentPage(1); }}
            />
          </div>
        </CardContent>
      </Card>
      )}

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
                      <label className="block text-sm font-medium text-slate-300">Buscar Suministro (Suministro, DNI o Nombre)</label>
                      <div className="relative">
                        <input 
                          ref={searchInputRef}
                          type="text"
                          required={!formData.clientAndSuministro}
                          placeholder="Buscar por código de suministro, DNI o Nombre..."
                          value={clientSearch}
                          onChange={(e) => {
                            setClientSearch(e.target.value);
                            setShowSuministroDropdown(true);
                            if (formData.clientAndSuministro) {
                              setFormData({ ...formData, clientAndSuministro: '' });
                            }
                          }}
                          onFocus={() => setShowSuministroDropdown(true)}
                          onBlur={() => {
                            // Delay hiding so clicks register
                            setTimeout(() => setShowSuministroDropdown(false), 200);
                          }}
                          className="mt-1 block w-full border border-slate-700 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-[#0B0E14] text-slate-100"
                        />
                        {showSuministroDropdown && (
                          <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-slate-800 py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm border border-slate-700">
                            {availableSupplies.length > 0 ? (
                              availableSupplies.map(s => (
                                <li
                                  key={`${s.id}|${s.sup}`}
                                  className="relative cursor-pointer select-none py-2 pl-3 pr-9 text-slate-100 hover:bg-slate-700 hover:text-white border-b border-slate-700/50"
                                  onClick={() => {
                                    setFormData({ ...formData, clientAndSuministro: `${s.id}|${s.sup}` });
                                    setClientSearch(s.label);
                                    setShowSuministroDropdown(false);
                                  }}
                                >
                                  <div className="font-medium text-purple-300 mb-0.5">{s.label}</div>
                                  <div className="text-xs text-slate-400">{s.desc}</div>
                                </li>
                              ))
                            ) : (
                              <li className="relative cursor-default select-none py-2 pl-3 pr-9 text-slate-400">
                                No se encontraron resultados.
                              </li>
                            )}
                          </ul>
                        )}
                      </div>
                      {ultimaLectura && (
                        <div className="mt-2 p-2 bg-slate-800 rounded-md border border-slate-700 text-xs text-slate-300">
                          <strong className="text-emerald-400 block mb-1">Última lectura registrada:</strong>
                          {ultimaLectura.mes} - {ultimaLectura.kwh} kWh ({formatCurrency(ultimaLectura.montoCalculado)}) • Estado: <span className={ultimaLectura.estadoPago === 'PAGADO' ? 'text-emerald-400' : 'text-yellow-400'}>{ultimaLectura.estadoPago}</span>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-300">Lectura Anterior (kWh)</label>
                        <input 
                          type="number" 
                          min="0" 
                          step="1"
                          readOnly={!isFirstReading}
                          required 
                          value={isFirstReading ? formData.lecturaAnterior : previousAccumulated} 
                          onChange={e => setFormData({...formData, lecturaAnterior: e.target.value})} 
                          className="mt-1 block w-full border border-slate-700 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-slate-800 text-slate-300" 
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300">Lectura Actual (kWh)</label>
                        <input 
                          type="number" 
                          min="0" 
                          step="1"
                          required 
                          value={formData.lecturaActual} 
                          onChange={e => setFormData({...formData, lecturaActual: e.target.value})} 
                          className={`mt-1 block w-full border rounded-md shadow-sm py-2 px-3 focus:outline-none sm:text-sm bg-[#0B0E14] text-slate-100 transition-colors duration-200 border-slate-700 focus:ring-blue-500 focus:border-blue-500`}
                        />
                        {currentKwh > averageKwh * 2 && currentKwh > 20 && formData.lecturaActual !== '' && averageKwh > 0 && (
                          <p className="mt-1 flex items-center text-xs text-amber-500 text-left">
                            <AlertCircle className="w-3 h-3 mr-1 inline" />
                            Advertencia: mayor al promedio habitual.
                          </p>
                        )}
                      </div>
                    </div>
                    {formData.clientAndSuministro && formData.lecturaActual && (
                      <p className="mt-2 text-sm text-slate-400 font-medium">
                        Consumo: {currentKwh} kWh | Monto: {formatCurrency(Math.max((currentKwh) * (
                          (() => {
                             const selClient = clients.find(c => c.id === formData.clientAndSuministro.split('|')[0]);
                             const isSocio = suppliesInfo?.find(s => s.codigo === formData.clientAndSuministro.split('|')[1])?.isSocio ?? (selClient?.tipo === 'SOCIO');
                             return selClient?.faseSuministro === 'TRIFASICO' && (settings?.costoTrifasico || 0) > 0
                               ? (settings?.costoTrifasico || 0)
                               : isSocio 
                                 ? (settings?.costoSocio || 0.20)
                                 : (settings?.costoUsuario || 0.30);
                          })()
                        ), settings?.consumoMinimo !== undefined ? settings.consumoMinimo : 6))}
                      </p>
                    )}
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

      {/* Modal Historial de Facturación */}
      {historyClientSuministro && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-slate-900 bg-opacity-75 transition-opacity" onClick={() => setHistoryClientSuministro(null)}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="relative z-10 inline-block align-bottom bg-[#0B0E14] rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full border border-slate-800">
              <div className="px-4 py-4 border-b border-slate-800 flex justify-between items-center sticky top-0 bg-[#0B0E14] z-20">
                <div>
                  <h3 className="text-lg font-medium text-slate-100 flex items-center">
                    Historial de Facturación
                  </h3>
                  <p className="text-sm text-slate-400 mt-1">
                    Cliente: {historyClientSuministro.clientName} | Suministro: {historyClientSuministro.codigoSuministro}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setHistoryClientSuministro(null)}>
                  Cerrar
                </Button>
              </div>
              <div className="p-4 max-h-[60vh] overflow-y-auto">
                <table className="min-w-full divide-y divide-slate-800 border border-slate-800 rounded-lg overflow-hidden">
                  <thead className="bg-slate-900/50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Período</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Lectura (kWh)</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Consumo</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Monto</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="bg-[#0B0E14] divide-y divide-slate-800">
                    {consumptions
                      .filter(c => c.clientId === historyClientSuministro.clientId && c.codigoSuministro === historyClientSuministro.codigoSuministro)
                      .sort((a,b) => b.mes.localeCompare(a.mes))
                      .map((hc, idx) => (
                      <tr key={hc.id} className={idx % 2 === 0 ? 'bg-[#0B0E14]' : 'bg-slate-900/20'}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300 font-medium">{hc.mes}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">{hc.lecturaActual || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">{hc.kwh} kWh</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-200 uppercase">{formatCurrency(hc.montoCalculado)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <Badge variant={hc.estadoPago === 'PAGADO' ? 'success' : 'warning'}>
                            {hc.estadoPago}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                    {consumptions.filter(c => c.clientId === historyClientSuministro.clientId && c.codigoSuministro === historyClientSuministro.codigoSuministro).length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                          No hay historial de consumos para este suministro.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
