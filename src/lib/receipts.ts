import { jsPDF } from 'jspdf';
import { Transaction, Client, PagoSueldo } from '../store/types';

/**
 * Generates and downloads a standardized payment receipt in 80mm ticket format.
 * Applied for:
 * - Venta de nuevos suministros
 * - Transferencia de titularidad de suministros
 * - Cuotas de socio
 * - Derechos de conexión
 * - Reconexiones
 * - Multas y penalidades
 * - Aportes extraordinarios
 * - Pagos administrativos
 * - Certificados y constancias
 * - Otros conceptos de cobranza
 */
export function generateGeneralPaymentReceiptPDF(transaction: Transaction, client: Client | undefined): boolean {
  try {
    // Ticket format width 80mm, with dynamic length or a tall 175mm default to fit details & QR
    const doc = new jsPDF({
      unit: 'mm',
      format: [80, 175]
    });

    const centerX = 40;

    // --- ENCABEZADO INSTITUCIONAL UNIFORME ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('COMPROBANTE DE PAGO', centerX, 12, { align: 'center' });
    
    doc.setFontSize(9);
    doc.text('Mini Central Hidroeléctrica Paccha', centerX, 17, { align: 'center' });
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Servicio de Energía Eléctrica Autogestionado', centerX, 21, { align: 'center' });
    doc.text('Asoc. de Usuarios de la Microcuenca Paccha', centerX, 25, { align: 'center' });
    doc.text('Chota, Cajamarca - RUC: 20608945231', centerX, 29, { align: 'center' });
    
    // Separator line
    doc.setLineWidth(0.2);
    doc.setDrawColor(100, 116, 139);
    doc.line(5, 32, 75, 32);
    
    // --- DATOS DEL COMPROBANTE ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('DATOS DE LA OPERACIÓN:', 5, 36);
    
    doc.setFont('helvetica', 'normal');
    const compNo = transaction.comprobante || `B-${transaction.id?.slice(-6).toUpperCase() || Math.random().toString(36).slice(-5).toUpperCase()}`;
    doc.text(`Nro Comprobante: ${compNo}`, 5, 41);
    
    const fechaFormatted = transaction.fecha 
      ? new Date(transaction.fecha).toLocaleString('es-PE') 
      : new Date().toLocaleString('es-PE');
    doc.text(`Fecha Emisión: ${fechaFormatted}`, 5, 46);
    
    // Operator/User who recorded this
    const registradoPor = transaction.createdBy || 'Caja Central';
    doc.text(`Registrado por: ${registradoPor}`, 5, 51);

    // Payment state
    doc.setFont('helvetica', 'bold');
    doc.text('Estado del Pago:', 5, 56);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(16, 185, 129); // Emerald-500 style
    doc.text('PAGADO / CONFORME', 31, 56);
    doc.setTextColor(0, 0, 0); // Reset color
    
    doc.setLineWidth(0.2);
    doc.line(5, 59, 75, 59);

    // --- DATOS DEL CLIENTE ---
    doc.setFont('helvetica', 'bold');
    doc.text('DATOS DEL CLIENTE:', 5, 63);
    
    doc.setFont('helvetica', 'normal');
    if (client) {
      const clientName = `${client.apellidos}, ${client.nombres}`;
      const clientNameLines = doc.splitTextToSize(clientName, 68);
      doc.text(clientNameLines, 5, 68);
      
      const clientLinesOffset = (clientNameLines.length - 1) * 4;
      const nextY = 73 + clientLinesOffset;
      
      doc.text(`DNI / RUC: ${client.dni || 'No Registrado'}`, 5, nextY);
      
      const isSocio = client.tipo === 'SOCIO' ? 'Socio (Propietario / Comunitario)' : 'Usuario Regular (No Socio)';
      doc.text(`Condición: ${isSocio}`, 5, nextY + 4);
      
      // Handle Address
      const addressVal = client.direccion || 'Sin dirección registrada';
      const addressLines = doc.splitTextToSize(`Dirección: ${addressVal}`, 68);
      doc.text(addressLines, 5, nextY + 8);

      const addressLinesOffset = (addressLines.length - 1) * 4;
      const supplyY = nextY + 12 + addressLinesOffset;

      // Código de suministro (cuando corresponda, check if client has any)
      let supplyCode = 'No aplica';
      if (client.suministros && client.suministros.length > 0) {
        supplyCode = client.suministros.join(', ');
      } else if (client.codigoSuministro) {
        supplyCode = client.codigoSuministro;
      } else if (transaction.referencia && (transaction.referencia.includes('SUM-') || transaction.referencia.includes('Suministro'))) {
        const match = transaction.referencia.match(/SUM-\d+/i);
        if (match) supplyCode = match[0].toUpperCase();
      }
      
      doc.setFont('helvetica', 'bold');
      doc.text(`Código Suministro: ${supplyCode}`, 5, supplyY);
      doc.setFont('helvetica', 'normal');

      doc.line(5, supplyY + 3, 75, supplyY + 3);
    } else {
      doc.text('Cliente: Público General (No especificado)', 5, 68);
      doc.line(5, 72, 75, 72);
    }
    
    // Determine dynamic concept mapping y table offset
    let preConceptY = client ? 78 + ((doc as any).internal.getFontSize() || 8) : 76;
    // Let's safe-check a reliable starting position for payment details
    const finalInfoStartY = client ? Math.max(92, 70 + (client.direccion ? 20 : 10)) : 76;

    doc.line(5, finalInfoStartY, 75, finalInfoStartY);

    // --- DETALLE DE PAGO / CONCEPTO ---
    doc.setFont('helvetica', 'bold');
    doc.text('CONCEPTO / DETALLE:', 5, finalInfoStartY + 4);
    doc.text('TOTAL', 65, finalInfoStartY + 4);
    
    // Categorize
    const cat = transaction.categoria;
    const desc = (transaction.descripcion || transaction.referencia || '').toUpperCase();
    
    let categoryDisplay = 'OTROS CONCEPTOS DE COBRANZA';
    
    if (cat === 'VENTA_SERVICIO') {
      categoryDisplay = 'VENTA DE NUEVO SUMINISTRO';
    } else if (cat === 'TRANSFERENCIA' || desc.includes('TRANSFERENCIA') || desc.includes('TITULARIDAD')) {
      categoryDisplay = 'TRANSFERENCIA DE TITULARIDAD';
    } else if (cat === 'APORTE') {
      categoryDisplay = 'CUOTAS DE SOCIO';
    } else if (desc.includes('DERECHO DE CONEXION') || desc.includes('DERECHOS DE CONEXION') || desc.includes('CONEXION')) {
      categoryDisplay = 'DERECHOS DE CONEXIÓN';
    } else if (cat === 'RECONEXION' || desc.includes('RECONEXION')) {
      categoryDisplay = 'RECONEXIÓN DE SUMINISTRO';
    } else if (cat === 'MULTA' || desc.includes('MULTA')) {
      categoryDisplay = 'MULTAS Y PENALIDADES';
    } else if (cat === 'PAGO_EXTRAORDINARIO' || desc.includes('APORTE EXTRAORDINARIO') || desc.includes('EXTRAORDINARIO')) {
      categoryDisplay = 'APORTES EXTRAORDINARIOS';
    } else if (desc.includes('CERTIFICADO') || desc.includes('CONSTANCIA')) {
      categoryDisplay = 'CERTIFICADOS Y CONSTANCIAS';
    } else if (desc.includes('ADMINISTRATIVO')) {
      categoryDisplay = 'PAGOS ADMINISTRATIVOS';
    } else if (cat === 'CONSUMO') {
      categoryDisplay = 'CONSUMO DE ENERGÍA';
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(categoryDisplay, 5, finalInfoStartY + 9);
    
    doc.setFont('helvetica', 'normal');
    const cleanDesc = transaction.descripcion || transaction.referencia || 'Pago regular por servicios administrativos';
    const splitDesc = doc.splitTextToSize(cleanDesc, 56);
    doc.text(splitDesc, 5, finalInfoStartY + 14);
    
    const finalAmountStr = `S/ ${(transaction.monto || 0).toFixed(2)}`;
    doc.setFont('helvetica', 'bold');
    doc.text(finalAmountStr, 62, finalInfoStartY + 14);
    
    const descHeight = (splitDesc.length - 1) * 4;
    const finalTableY = finalInfoStartY + 18 + descHeight;
    
    doc.line(5, finalTableY, 75, finalTableY);
    
    // Total block
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('TOTAL COBRADO:', 5, finalTableY + 5);
    doc.text(`S/ ${(transaction.monto || 0).toFixed(2)}`, 62, finalTableY + 5);
    
    // --- ESTADO Y DETALLES DEL SISTEMA ERP ---
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('* Este recibo es conforme gracias a la autogestión de la comunidad.', 5, finalTableY + 11);
    
    // Draw an elegant vector simulated QR code
    const qrX = centerX - 12;
    const qrY = finalTableY + 14;
    const qrSize = 24;
    
    // Draw outer boundary and standard alignment corners for genuine look
    doc.setDrawColor(30, 41, 59);
    doc.setLineWidth(0.4);
    doc.rect(qrX, qrY, qrSize, qrSize);
    
    // Draw QR finders
    doc.setFillColor(0, 0, 0);
    // Top-left
    doc.rect(qrX + 1, qrY + 1, 6, 6);
    doc.setFillColor(255, 255, 255);
    doc.rect(qrX + 2, qrY + 2, 4, 4);
    doc.setFillColor(0, 0, 0);
    doc.rect(qrX + 3, qrY + 3, 2, 2);

    // Top-right
    doc.rect(qrX + qrSize - 7, qrY + 1, 6, 6);
    doc.setFillColor(255, 255, 255);
    doc.rect(qrX + qrSize - 6, qrY + 2, 4, 4);
    doc.setFillColor(0, 0, 0);
    doc.rect(qrX + qrSize - 5, qrY + 3, 2, 2);

    // Bottom-left
    doc.rect(qrX + 1, qrY + qrSize - 7, 6, 6);
    doc.setFillColor(255, 255, 255);
    doc.rect(qrX + 2, qrY + qrSize - 6, 4, 4);
    doc.setFillColor(0, 0, 0);
    doc.rect(qrX + 3, qrY + qrSize - 5, 2, 2);
    
    // Draw randomly styled code lines to realistically stand in for pixels
    doc.rect(qrX + 9, qrY + 2, 2, 1, 'F');
    doc.rect(qrX + 13, qrY + 3, 1, 2, 'F');
    doc.rect(qrX + 11, qrY + 6, 2, 1, 'F');
    doc.rect(qrX + 8, qrY + 10, 3, 1, 'F');
    doc.rect(qrX + 14, qrY + 9, 2, 2, 'F');
    doc.rect(qrX + 9, qrY + 14, 1, 3, 'F');
    doc.rect(qrX + 12, qrY + 13, 3, 1, 'F');
    doc.rect(qrX + 18, qrY + 10, 1, 4, 'F');
    doc.rect(qrX + 16, qrY + 16, 4, 2, 'F');
    doc.rect(qrX + 8, qrY + 19, 2, 1, 'F');
    doc.rect(qrX + 12, qrY + 21, 3, 1, 'F');
    doc.rect(qrX + 18, qrY + 20, 2, 2, 'F');
    doc.rect(qrX + 5, qrY + 11, 1, 1, 'F');
    doc.rect(qrX + 21, qrY + 5, 1, 2, 'F');
    doc.rect(qrX + 2, qrY + 9, 2, 1, 'F');

    // Footers
    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    doc.text('¡Gracias por apoyar el mantenimiento de la central!', centerX, qrY + qrSize + 5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.text('MiniCentral Hidroeléctrica Paccha ERP - Sistema de Impresión', centerX, qrY + qrSize + 9, { align: 'center' });

    doc.save(`Comprobante_Pago_${compNo}.pdf`);
    return true;
  } catch (error) {
    console.error('Error generating general unified receipt:', error);
    return false;
  }
}

export function generatePayrollReceiptPDF(payment: PagoSueldo): boolean {
  try {
    const doc = new jsPDF({
      unit: 'mm',
      format: [80, 165]
    });

    const centerX = 40;

    // --- ENCABEZADO INSTITUCIONAL UNIFORME ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('BOLETA DE PAGO DE SUELDO', centerX, 12, { align: 'center' });
    
    doc.setFontSize(9);
    doc.text('Mini Central Hidroeléctrica Paccha', centerX, 17, { align: 'center' });
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Servicio de Energía Eléctrica Autogestionado', centerX, 21, { align: 'center' });
    doc.text('Asoc. de Usuarios de la Microcuenca Paccha', centerX, 25, { align: 'center' });
    doc.text('Chota, Cajamarca - RUC: 20608945231', centerX, 29, { align: 'center' });
    
    // Separator line
    doc.setLineWidth(0.2);
    doc.setDrawColor(100, 116, 139);
    doc.line(5, 32, 75, 32);
    
    // --- DATOS DEL COMPROBANTE ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('DATOS DE LA OPERACIÓN:', 5, 36);
    
    doc.setFont('helvetica', 'normal');
    doc.text(`Nro Recibo Planilla: ${payment.comprobante}`, 5, 41);
    
    const fechaFormatted = payment.fechaPago 
      ? new Date(payment.fechaPago).toLocaleString('es-PE') 
      : new Date().toLocaleString('es-PE');
    doc.text(`Fecha Emisión: ${fechaFormatted}`, 5, 46);
    
    const registradoPor = payment.createdBy || 'Caja Central';
    doc.text(`Registrado por: ${registradoPor}`, 5, 51);

    // Payment state
    doc.setFont('helvetica', 'bold');
    doc.text('Estado del Pago:', 5, 56);
    doc.setTextColor(16, 185, 129); // Emerald-500 style
    doc.text('PAGADO / CONFORME', 31, 56);
    doc.setTextColor(0, 0, 0); // Reset color
    
    doc.setLineWidth(0.2);
    doc.line(5, 59, 75, 59);

    // --- DATOS DEL TRABAJADOR ---
    doc.setFont('helvetica', 'bold');
    doc.text('DATOS DEL TRABAJADOR:', 5, 63);
    
    doc.setFont('helvetica', 'normal');
    const workerName = payment.trabajadorNombreCompleto;
    const workerLines = doc.splitTextToSize(workerName, 68);
    doc.text(workerLines, 5, 68);
    
    const workerLinesOffset = (workerLines.length - 1) * 4;
    const nextY = 73 + workerLinesOffset;
    
    doc.text(`DNI: ${payment.trabajadorDni}`, 5, nextY);
    doc.text(`Cargo / Puesto: ${payment.trabajadorCargo}`, 5, nextY + 4);

    // Format billing month
    const [year, month] = payment.mesPagado.split('-');
    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    const monthName = monthNames[parseInt(month, 10) - 1] || month;
    doc.setFont('helvetica', 'bold');
    doc.text(`Mes Remunerado: ${monthName} / ${year}`, 5, nextY + 8);
    doc.setFont('helvetica', 'normal');

    doc.line(5, nextY + 11, 75, nextY + 11);

    const finalInfoStartY = nextY + 11;

    // --- DETALLE DE PAGO / CONCEPTO ---
    doc.setFont('helvetica', 'bold');
    doc.text('CONCEPTO / DETALLE:', 5, finalInfoStartY + 4);
    doc.text('TOTAL', 65, finalInfoStartY + 4);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('PAGO DE REMUNERACIÓN', 5, finalInfoStartY + 9);
    
    doc.setFont('helvetica', 'normal');
    const cleanDesc = payment.observaciones || `Sueldo básico correspondiente al mes de ${monthName} ${year}`;
    const splitDesc = doc.splitTextToSize(cleanDesc, 56);
    doc.text(splitDesc, 5, finalInfoStartY + 14);
    
    const finalAmountStr = `S/ ${(payment.monto || 0).toFixed(2)}`;
    doc.setFont('helvetica', 'bold');
    doc.text(finalAmountStr, 62, finalInfoStartY + 14);
    
    const descHeight = (splitDesc.length - 1) * 4;
    const finalTableY = finalInfoStartY + 18 + descHeight;
    
    doc.line(5, finalTableY, 75, finalTableY);
    
    // Total block
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('TOTAL DEVENGO:', 5, finalTableY + 5);
    doc.text(`S/ ${(payment.monto || 0).toFixed(2)}`, 62, finalTableY + 5);
    
    // --- ESTADO Y DETALLES DEL SISTEMA ERP ---
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('* Boleta electrónica provista por el módulo de planillas.', 5, finalTableY + 11);
    
    // Draw an elegant vector simulated QR code
    const qrX = centerX - 11;
    const qrY = finalTableY + 14;
    const qrSize = 22;
    
    // Draw outer boundary and standard alignment corners for genuine look
    doc.setDrawColor(30, 41, 59);
    doc.setLineWidth(0.4);
    doc.rect(qrX, qrY, qrSize, qrSize);
    
    // Draw QR finders
    doc.setFillColor(0, 0, 0);
    // Top-left
    doc.rect(qrX + 1, qrY + 1, 5, 5);
    doc.setFillColor(255, 255, 255);
    doc.rect(qrX + 1.8, qrY + 1.8, 3.4, 3.4);
    doc.setFillColor(0, 0, 0);
    doc.rect(qrX + 2.5, qrY + 2.5, 2, 2);

    // Top-right
    doc.rect(qrX + qrSize - 6, qrY + 1, 5, 5);
    doc.setFillColor(255, 255, 255);
    doc.rect(qrX + qrSize - 5.2, qrY + 1.8, 3.4, 3.4);
    doc.setFillColor(0, 0, 0);
    doc.rect(qrX + qrSize - 4.5, qrY + 2.5, 2, 2);

    // Bottom-left
    doc.rect(qrX + 1, qrY + qrSize - 6, 5, 5);
    doc.setFillColor(255, 255, 255);
    doc.rect(qrX + 1.8, qrY + qrSize - 5.2, 3.4, 3.4);
    doc.setFillColor(0, 0, 0);
    doc.rect(qrX + 2.5, qrY + qrSize - 4.5, 2, 2);
    
    // Draw randomly styled code lines to realistically stand in for pixels
    doc.rect(qrX + 8, qrY + 2, 2, 1, 'F');
    doc.rect(qrX + 12, qrY + 3, 1, 2, 'F');
    doc.rect(qrX + 10, qrY + 6, 2, 1, 'F');
    doc.rect(qrX + 8, qrY + 9, 3, 1, 'F');
    doc.rect(qrX + 13, qrY + 8, 2, 2, 'F');
    doc.rect(qrX + 9, qrY + 12, 1, 3, 'F');
    doc.rect(qrX + 11, qrY + 11, 3, 1, 'F');
    doc.rect(qrX + 16, qrY + 9, 1, 4, 'F');
    doc.rect(qrX + 14, qrY + 14, 4, 2, 'F');
    doc.rect(qrX + 8, qrY + 17, 2, 1, 'F');
    doc.rect(qrX + 11, qrY + 18, 3, 1, 'F');
    doc.rect(qrX + 16, qrY + 17, 2, 2, 'F');

    // Footers
    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    doc.text('¡Gracias por su valioso servicio para la comunidad!', centerX, qrY + qrSize + 5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.text('MiniCentral Hidroeléctrica Paccha ERP - Planillas', centerX, qrY + qrSize + 9, { align: 'center' });

    doc.save(`Boleta_Pago_${payment.comprobante}.pdf`);
    return true;
  } catch (error) {
    console.error('Error generating payroll paycheck print:', error);
    return false;
  }
}
