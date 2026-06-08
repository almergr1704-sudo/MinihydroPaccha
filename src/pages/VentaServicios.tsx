import React, { useState, useMemo } from 'react';
import { PlusCircle, Search, UserCheck, UserPlus, CreditCard, CheckCircle, Receipt, Download } from 'lucide-react';
import { useAppContext } from '../store/AppContext';
import { Button, Card, CardContent } from '../components/ui';
import { normalizeSupplyCode } from '../lib/utils';
import { Client, Transaction } from '../store/types';
import { toast } from 'react-hot-toast';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function VentaServicios() {
  const { clients, settings, addClient, updateClient, addTransaction, generateId, transactions } = useAppContext();
  const [modalOpen, setModalOpen] = useState(false);
  
  // Sale Type: new client vs existing client
  const [saleType, setSaleType] = useState<'NEW_CLIENT' | 'EXISTING_CLIENT'>('NEW_CLIENT');
  
  // Existing client selection
  const [selectedClientId, setSelectedClientId] = useState('');
  
  // Form State
  const [formData, setFormData] = useState({
    nombres: '',
    apellidos: '',
    dni: '',
    direccion: '',
    sector: '',
    referenciaDireccion: '',
    telefono: '',
    codigoSuministro: '',
    numeroMedidor: '',
    tipo: 'USUARIO' as 'USUARIO' | 'SOCIO',
    categoria: 'MONOFASICO' as 'MONOFASICO' | 'TRIFASICO',
    montoPagado: settings?.ventaNuevoServicio || 0,
    observacionPago: 'Venta de Nuevo Servicio de Energía',
  });

  // Calculate Next Suministro ID automatically
  const handleAutoGenerateSuministro = () => {
    let maxNum = 0;
    clients.forEach(c => {
      const sups = c.suministros?.length ? c.suministros : [c.codigoSuministro].filter(Boolean);
      sups.forEach(s => {
        if (!s) return;
        const norm = normalizeSupplyCode(s as string);
        const match = norm.match(/SUM-(\d+)/);
        if (match && match[1]) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      });
    });
    const nextCode = `SUM-${String(maxNum + 1).padStart(4, '0')}`;
    setFormData(prev => ({ ...prev, codigoSuministro: nextCode }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.codigoSuministro) {
      toast.error('Debe ingresar o generar un código de suministro');
      return;
    }
    
    try {
      let finalClientId = '';
      
      if (saleType === 'NEW_CLIENT') {
        if (!formData.nombres || !formData.apellidos) {
          toast.error('Los nombres y apellidos son obligatorios para un nuevo cliente');
          return;
        }
        
        const newClient = await addClient({
          nombres: formData.nombres,
          apellidos: formData.apellidos,
          tipoPersona: 'PERSONA',
          dni: formData.dni,
          direccion: formData.direccion,
          numeroDireccion: '',
          referenciaDireccion: formData.sector ? `Sector: ${formData.sector} - ${formData.referenciaDireccion}` : formData.referenciaDireccion,
          telefono: formData.telefono,
          correo: '',
          codigoSuministro: formData.codigoSuministro,
          suministros: [formData.codigoSuministro],
          numeroMedidor: formData.numeroMedidor || undefined,
          tipo: formData.tipo,
          faseSuministro: formData.categoria,
          estado: 'ACTIVO'
        });
        finalClientId = newClient.id;
      } else {
        if (!selectedClientId) {
          toast.error('Debe seleccionar un cliente existente');
          return;
        }
        await updateClient(selectedClientId, {
          suministros: [...(clients.find(c => c.id === selectedClientId)?.suministros || []), formData.codigoSuministro] as string[],
          numeroMedidor: formData.numeroMedidor || undefined
        });
        finalClientId = selectedClientId;
      }

      // Add a transaction for the sale
      if (formData.montoPagado > 0) {
        await addTransaction({
          tipo: 'INGRESO',
          categoria: 'OTROS',
          monto: Number(formData.montoPagado),
          descripcion: formData.observacionPago,
          fecha: new Date().toISOString(),
          clientId: finalClientId,
          referencia: `Venta Suministro: ${normalizeSupplyCode(formData.codigoSuministro)}`,
          comprobante: `VS-${Date.now().toString().slice(-6)}`,
          metodoPago: 'EFECTIVO'
        });
      }

      toast.success('Venta de nuevo servicio registrada con éxito');
      setModalOpen(false);
      resetForm();
    } catch (error: any) {
      toast.error(error.message || 'Error al registrar la venta');
    }
  };

  const resetForm = () => {
    setFormData({
      nombres: '',
      apellidos: '',
      dni: '',
      direccion: '',
      sector: '',
      referenciaDireccion: '',
      telefono: '',
      codigoSuministro: '',
      numeroMedidor: '',
      tipo: 'USUARIO',
      categoria: 'MONOFASICO',
      montoPagado: settings?.ventaNuevoServicio || 0,
      observacionPago: 'Venta de Nuevo Servicio de Energía',
    });
    setSaleType('NEW_CLIENT');
    setSelectedClientId('');
  };

  // Get sales history (transactions related to new supply sales)
  const salesHistory = useMemo(() => {
    return transactions
      .filter(t => t.referencia?.startsWith('Venta Suministro:'))
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }, [transactions]);

  const handlePrintReceipt = (sale: Transaction, client: Client | undefined) => {
    try {
      const doc = new jsPDF({
        unit: 'mm',
        format: [80, 150] // Ticket format
      });

      // Ticket Header
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('COMPROBANTE DE PAGO', 40, 15, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('MiniCentral Hidroeléctrica Paccha', 40, 22, { align: 'center' });
      doc.text('RUC: 20123456789 (Referencial)', 40, 27, { align: 'center' });
      
      doc.line(5, 30, 75, 30);
      
      // Ticket Body
      doc.setFontSize(9);
      doc.text(`Nro: ${sale.comprobante || 'N/A'}`, 5, 35);
      doc.text(`Fecha: ${new Date(sale.fecha).toLocaleString()}`, 5, 40);
      
      doc.line(5, 43, 75, 43);

      doc.setFont('helvetica', 'bold');
      doc.text('CLIENTE:', 5, 48);
      doc.setFont('helvetica', 'normal');
      if (client) {
        doc.text(`${client.nombres} ${client.apellidos}`, 5, 53);
        if (client.dni) doc.text(`DNI: ${client.dni}`, 5, 58);
      } else {
        doc.text(`Cliente Eliminado`, 5, 53);
      }

      const isSocio = client?.tipo === 'SOCIO' ? 'Socio' : 'Usuario';
      doc.text(`Condición: ${isSocio}`, 5, 63);
      
      doc.line(5, 66, 75, 66);
      
      doc.setFont('helvetica', 'bold');
      doc.text('DESCRIPCION', 5, 71);
      doc.text('TOTAL', 60, 71);
      
      doc.setFont('helvetica', 'normal');
      const textLines = doc.splitTextToSize(sale.descripcion || sale.referencia || 'Venta', 50);
      doc.text(textLines, 5, 77);
      doc.text(`S/ ${sale.monto.toFixed(2)}`, 60, 77);
      
      let finalY = 77 + (textLines.length * 4) + 5;
      
      doc.line(5, finalY, 75, finalY);
      
      doc.setFont('helvetica', 'bold');
      doc.text('TOTAL PAGADO:', 15, finalY + 5);
      doc.text(`S/ ${sale.monto.toFixed(2)}`, 60, finalY + 5);
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.text('¡Gracias por su pago!', 40, finalY + 15, { align: 'center' });
      doc.text('Este documento es un comprobante interno.', 40, finalY + 19, { align: 'center' });

      doc.save(`Comprobante_${sale.comprobante || 'Servicio'}.pdf`);
      toast.success('Comprobante generado con éxito');
    } catch (e) {
      console.error(e);
      toast.error('Error al generar el comprobante');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#0B0E14] p-4 rounded-lg border border-slate-800 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <PlusCircle className="text-blue-500" /> Venta de Nuevos Servicios
          </h1>
          <p className="text-slate-400 text-sm mt-1">Gestione las solicitudes, cobros y activaciones de nuevos suministros.</p>
        </div>
        <Button onClick={() => { resetForm(); setModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-900/20 w-full sm:w-auto">
          <PlusCircle className="w-4 h-4 mr-2" />
          Nueva Venta
        </Button>
      </div>

      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-blue-500" /> Historial de Ventas
          </h2>
          {salesHistory.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <PlusCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>No se han registrado ventas de servicios aún.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-800">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Fecha</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Cliente</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Suministro</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Costo S/</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Comprobante</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {salesHistory.map(sale => {
                    const client = clients.find(c => c.id === sale.clientId);
                    return (
                      <tr key={sale.id} className="hover:bg-slate-800/50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-300">
                          {new Date(sale.fecha).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-white font-medium">
                          {client ? `${client.nombres} ${client.apellidos}` : 'Cliente Eliminado'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-300">
                          <span className="bg-slate-800 px-2 py-1 rounded text-xs font-mono border border-slate-700">
                            {sale.referencia?.replace('Venta Suministro: ', '')}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-emerald-400 text-right">
                          S/ {sale.monto.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-400 flex items-center justify-between">
                          <span>{sale.comprobante}</span>
                          <button
                            type="button"
                            onClick={() => handlePrintReceipt(sale, client)}
                            className="ml-2 text-slate-400 hover:text-blue-500 transition-colors p-1 rounded hover:bg-blue-500/10"
                            title="Imprimir Comprobante"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {modalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-slate-900/80 backdrop-blur-sm" onClick={() => setModalOpen(false)}></div>
            <div className="relative z-10 inline-block w-full max-w-2xl text-left align-middle transition-all transform bg-[#0B0E14] border border-slate-800 rounded-lg shadow-xl sm:my-8 text-slate-200">
              <form onSubmit={handleSubmit}>
                <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                  <h3 className="text-lg font-medium text-white flex items-center gap-2">
                    <PlusCircle className="w-5 h-5 text-blue-500" />
                    Registrar Venta de Suministro
                  </h3>
                </div>
                
                <div className="px-6 py-4 space-y-6 max-h-[70vh] overflow-y-auto">
                  {/* TIPO DE CLIENTE */}
                  <div className="flex border border-slate-700 rounded-md overflow-hidden">
                    <button 
                      type="button" 
                      onClick={() => setSaleType('NEW_CLIENT')}
                      className={`flex-1 py-2 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${saleType === 'NEW_CLIENT' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                    >
                      <UserPlus className="w-4 h-4" /> Cliente Nuevo
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setSaleType('EXISTING_CLIENT')}
                      className={`flex-1 py-2 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${saleType === 'EXISTING_CLIENT' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                    >
                      <UserCheck className="w-4 h-4" /> Cliente Existente
                    </button>
                  </div>

                  {saleType === 'EXISTING_CLIENT' ? (
                     <div>
                       <label className="block text-sm font-medium text-slate-300">Seleccionar Cliente Existente</label>
                       <select 
                          required 
                          value={selectedClientId} 
                          onChange={(e) => setSelectedClientId(e.target.value)}
                          className="mt-1 block w-full bg-[#0B0E14] border border-slate-700 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">-- Seleccione un cliente --</option>
                          {clients.map(c => (
                            <option key={c.id} value={c.id}>{c.apellidos}, {c.nombres} - DNI: {c.dni}</option>
                          ))}
                        </select>
                     </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-800/30 p-4 rounded-md border border-slate-800/50">
                      <div className="sm:col-span-2 text-sm font-semibold text-blue-400 border-b border-slate-800 pb-2 mb-2">Datos del Nuevo Cliente</div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400">Nombres *</label>
                        <input type="text" required value={formData.nombres} onChange={e => setFormData({...formData, nombres: e.target.value})} className="mt-1 block w-full bg-[#0B0E14] border border-slate-700 rounded-md py-1.5 px-3 text-sm focus:outline-none focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400">Apellidos *</label>
                        <input type="text" required value={formData.apellidos} onChange={e => setFormData({...formData, apellidos: e.target.value})} className="mt-1 block w-full bg-[#0B0E14] border border-slate-700 rounded-md py-1.5 px-3 text-sm focus:outline-none focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400">DNI</label>
                        <input type="text" value={formData.dni} onChange={e => setFormData({...formData, dni: e.target.value})} className="mt-1 block w-full bg-[#0B0E14] border border-slate-700 rounded-md py-1.5 px-3 text-sm focus:outline-none focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400">Teléfono</label>
                        <input type="text" value={formData.telefono} onChange={e => setFormData({...formData, telefono: e.target.value})} className="mt-1 block w-full bg-[#0B0E14] border border-slate-700 rounded-md py-1.5 px-3 text-sm focus:outline-none focus:ring-blue-500" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-slate-400">Dirección</label>
                        <input type="text" value={formData.direccion} onChange={e => setFormData({...formData, direccion: e.target.value})} className="mt-1 block w-full bg-[#0B0E14] border border-slate-700 rounded-md py-1.5 px-3 text-sm focus:outline-none focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400">Sector / Barrio</label>
                        <input type="text" value={formData.sector} onChange={e => setFormData({...formData, sector: e.target.value})} className="mt-1 block w-full bg-[#0B0E14] border border-slate-700 rounded-md py-1.5 px-3 text-sm focus:outline-none focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400">Referencia de Dirección</label>
                        <input type="text" value={formData.referenciaDireccion} onChange={e => setFormData({...formData, referenciaDireccion: e.target.value})} className="mt-1 block w-full bg-[#0B0E14] border border-slate-700 rounded-md py-1.5 px-3 text-sm focus:outline-none focus:ring-blue-500" />
                      </div>
                    </div>
                  )}

                  {/* Suministro y Medidor */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-emerald-900/10 p-4 rounded-md border border-emerald-900/30">
                    <div className="sm:col-span-2 text-sm font-semibold text-emerald-400 border-b border-slate-800 pb-2 mb-2">Datos Técnicos del Servicio</div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300">Código Suministro *</label>
                      <div className="flex mt-1">
                        <input 
                          type="text" 
                          required 
                          value={formData.codigoSuministro} 
                          onChange={e => setFormData({...formData, codigoSuministro: e.target.value})} 
                          className="block w-full bg-[#0B0E14] border border-slate-700 rounded-l-md py-2 px-3 focus:outline-none focus:ring-blue-500 placeholder:text-slate-600" 
                          placeholder="Ej: SUM-0001"
                        />
                        <button type="button" onClick={handleAutoGenerateSuministro} className="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-r-md text-slate-200 text-sm whitespace-nowrap border border-l-0 border-slate-700 transition">
                          Generar
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300">Número de Medidor</label>
                      <input type="text" value={formData.numeroMedidor} onChange={e => setFormData({...formData, numeroMedidor: e.target.value})} placeholder="Opcional" className="mt-1 block w-full bg-[#0B0E14] border border-slate-700 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 placeholder:text-slate-600" />
                    </div>
                    {saleType === 'NEW_CLIENT' && (
                       <div className="pt-2">
                         <label className="block text-sm font-medium text-slate-300 mb-2">Condición Inicial</label>
                         <select value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value as any})} className="block w-full bg-[#0B0E14] border border-slate-700 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500">
                           <option value="USUARIO">Solo Usuario (Regular)</option>
                           <option value="SOCIO">Socio (Con Derechos)</option>
                         </select>
                       </div>
                    )}
                    {saleType === 'NEW_CLIENT' && (
                       <div className="pt-2">
                         <label className="block text-sm font-medium text-slate-300 mb-2">Categoría (Fase)</label>
                         <select value={formData.categoria} onChange={e => setFormData({...formData, categoria: e.target.value as any})} className="block w-full bg-[#0B0E14] border border-slate-700 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500">
                           <option value="MONOFASICO">Monofásico (Doméstico)</option>
                           <option value="TRIFASICO">Trifásico (Comercial/Industrial)</option>
                         </select>
                       </div>
                    )}
                  </div>

                  {/* Cobro */}
                  <div className="bg-slate-800/30 p-4 rounded-md border border-slate-800/50">
                     <div className="text-sm font-semibold text-slate-300 border-b border-slate-800 pb-2 mb-3">Detalles de Cobro (Instalación / Trámite)</div>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-slate-400">Monto Cobrado (S/)</label>
                          <input type="number" step="0.10" min="0" value={formData.montoPagado} onChange={e => setFormData({...formData, montoPagado: Number(e.target.value)})} className="mt-1 block w-full bg-[#0B0E14] border border-slate-700 rounded-md py-2 px-3 text-lg font-bold text-emerald-400 focus:outline-none focus:ring-blue-500" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-400">Concepto Referencial</label>
                          <input type="text" value={formData.observacionPago} onChange={e => setFormData({...formData, observacionPago: e.target.value})} className="mt-1 block w-full bg-[#0B0E14] border border-slate-700 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-blue-500" />
                        </div>
                     </div>
                  </div>

                </div>
                
                <div className="px-6 py-4 border-t border-slate-800 flex justify-end gap-3 bg-slate-900/50 rounded-b-lg">
                  <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-900/20 shadow-sm">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Registrar Venta
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
