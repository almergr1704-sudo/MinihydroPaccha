import { jsPDF } from 'jspdf';
import { Transaction, Client } from '../store/types';

/**
 * Generates and downloads a standardized payment receipt in 80mm ticket format.
 * Applied for:
 * - Venta de nuevos servicios
 * - Transferencia de suministros
 * - Cuotas de socio
 * - Pagos extraordinarios
 * - Reconexiones
 * - Multas o penalidades
 * - Otros conceptos de cobranza
 */
export function generateGeneralPaymentReceiptPDF(transaction: Transaction, client: Client | undefined) {
  try {
    // Ticket format width 80mm, height 160mm is ideal for thermal printer layout
    const doc = new jsPDF({
      unit: 'mm',
      format: [80, 160]
    });

    const centerX = 40;

    // --- ENCABEZADO ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('COMPROBANTE DE PAGO', centerX, 12, { align: 'center' });
    
    doc.setFontSize(10);
    doc.text('Mini Central Hidroeléctrica Paccha', centerX, 17, { align: 'center' });
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Mini Central Hidroeléctrica Paccha - Chota', centerX, 21, { align: 'center' });
    doc.text('RUC: 20608945231 (Referencial)', centerX, 25, { align: 'center' });
    
    // Separator line
    doc.setLineWidth(0.25);
    doc.setDrawColor(100, 116, 139);
    doc.line(5, 28, 75, 28);
    
    // --- DATOS DEL COMPROBANTE ---
    doc.setFont('helvetica', 'bold');
    doc.text('DATOS DEL COMPROBANTE:', 5, 32);
    
    doc.setFont('helvetica', 'normal');
    const compNo = transaction.comprobante || `B-${transaction.id?.slice(-6).toUpperCase() || 'N/A'}`;
    doc.text(`Nro Comprobante: ${compNo}`, 5, 37);
    
    const fechaFormatted = transaction.fecha 
      ? new Date(transaction.fecha).toLocaleString('es-PE') 
      : new Date().toLocaleString('es-PE');
    doc.text(`Fecha Emisión: ${fechaFormatted}`, 5, 42);
    doc.text(`Registrado por: ${transaction.createdBy || 'Caja Central'}`, 5, 47);
    
    doc.line(5, 50, 75, 50);

    // --- CLIENTE ---
    doc.setFont('helvetica', 'bold');
    doc.text('DATOS DEL CLIENTE:', 5, 54);
    
    doc.setFont('helvetica', 'normal');
    if (client) {
      const clientName = `${client.nombres} ${client.apellidos}`;
      const clientNameLines = doc.splitTextToSize(clientName, 68);
      doc.text(clientNameLines, 5, 59);
      
      const textOffset = (clientNameLines.length - 1) * 4;
      doc.text(`DNI / RUC: ${client.dni || 'N/A'}`, 5, 64 + textOffset);
      
      const tipoLabel = client.tipo === 'SOCIO' ? 'Socio (Con Derechos)' : 'Usuario (Regular)';
      doc.text(`Condición: ${tipoLabel}`, 5, 69 + textOffset);
      
      if (client.direccion) {
        const dirText = doc.splitTextToSize(`Dirección: ${client.direccion}`, 68);
        doc.text(dirText, 5, 74 + textOffset);
      }
    } else {
      doc.text('Cliente: Público General', 5, 59);
    }
    
    doc.line(5, 84, 75, 84);

    // --- DETALLE DE PAGO / CONCEPTO ---
    doc.setFont('helvetica', 'bold');
    doc.text('CONCEPTO / DETALLE:', 5, 88);
    doc.text('IMPORTE', 60, 88);
    
    // Map categories to clear display names
    const cat = transaction.categoria;
    let categoryDisplay = 'OTROS CONCEPTOS DE COBRANZA';
    if (cat === 'APORTE') categoryDisplay = 'CUOTAS DE SOCIO';
    else if (cat === 'MULTA') categoryDisplay = 'MULTAS O PENALIDADES';
    else if (cat === 'RECONEXION') categoryDisplay = 'RECONEXIÓN DE SERVICIO';
    else if (cat === 'TRANSFERENCIA') categoryDisplay = 'TRANSFERENCIA DE SUMINISTRO';
    else if (cat === 'VENTA_SERVICIO') categoryDisplay = 'VENTA DE NUEVOS SERVICIOS';
    else if (cat === 'CONSUMO') categoryDisplay = 'CONSUMO DE ENERGÍA ELECTRICA';
    
    doc.setFont('text', 'bold');
    doc.setFontSize(8);
    doc.text(categoryDisplay, 5, 93);
    
    doc.setFont('helvetica', 'normal');
    const cleanDesc = transaction.descripcion || transaction.referencia || 'Concepto de cobro';
    const splitDesc = doc.splitTextToSize(cleanDesc, 52);
    doc.text(splitDesc, 5, 98);
    
    const finalAmountStr = `S/ ${(transaction.monto || 0).toFixed(2)}`;
    doc.setFont('helvetica', 'bold');
    doc.text(finalAmountStr, 60, 98);
    
    // Bottom lines and totalizer
    const descHeight = (splitDesc.length - 1) * 4;
    const finalTableY = 104 + descHeight;
    doc.line(5, finalTableY, 75, finalTableY);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('TOTAL COBRADO:', 5, finalTableY + 5);
    doc.text(`S/ ${(transaction.monto || 0).toFixed(2)}`, 60, finalTableY + 5);
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text('¡Gracias por su puntualidad en el pago!', centerX, finalTableY + 14, { align: 'center' });
    doc.text('Mini Central Hidroeléctrica Paccha ERP', centerX, finalTableY + 18, { align: 'center' });

    doc.save(`Recibo_Pago_${compNo}.pdf`);
    return true;
  } catch (error) {
    console.error('Error generating general unified receipt:', error);
    return false;
  }
}
