import React, { useState, useMemo } from 'react';
import { 
  Shield, UserCheck, Calendar, Award, History, UserX, Zap, ZapOff, Check, 
  Trash, Plus, Search, AlertCircle, FileText, Download, Edit2, AlertTriangle, RefreshCw
} from 'lucide-react';
import { useAppContext } from '../store/AppContext';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from './ui';
import { toast } from 'react-hot-toast';
import { useConfirm } from './ui/ConfirmDialog';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface MemberFormState {
  clientId: string;
  supplyCodeExonerado: string;
}

export default function ComiteDirectivo() {
  const { 
    clients, comites, addCommittee, updateCommittee, deleteCommittee, 
    toggleCommitteeStatus, suppliesInfo, userRole, admins 
  } = useAppContext();
  
  const { confirm } = useConfirm();
  const [activeTab, setActiveTab] = useState<'vigente' | 'registrar' | 'historial' | 'reportes'>('vigente');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nombrePeriodo, setNombrePeriodo] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [activo, setActivo] = useState(false);
  
  const [presidente, setPresidente] = useState<MemberFormState>({ clientId: '', supplyCodeExonerado: '' });
  const [secretario, setSecretario] = useState<MemberFormState>({ clientId: '', supplyCodeExonerado: '' });
  const [tesorero, setTesorero] = useState<MemberFormState>({ clientId: '', supplyCodeExonerado: '' });
  const [fiscalizador, setFiscalizador] = useState<MemberFormState>({ clientId: '', supplyCodeExonerado: '' });

  // Get eligible partners (Socios Only)
  const sociosHabilitados = useMemo(() => {
    return clients.filter(client => {
      const isSocioCategory = client.tipo === 'SOCIO';
      const ownsSocioSupply = (client.suministros || (client.codigoSuministro ? [client.codigoSuministro] : [])).some(code => {
        const info = suppliesInfo.find(s => s.codigo === code);
        return info?.isSocio === true;
      });
      return (isSocioCategory || ownsSocioSupply) && client.estado === 'ACTIVO';
    });
  }, [clients, suppliesInfo]);

  // Find active committee
  const comiteVigente = useMemo(() => {
    return comites?.find(c => c.activo) || null;
  }, [comites]);

  // Get client's supplies
  const getClientSupplies = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return [];
    return client.suministros || (client.codigoSuministro ? [client.codigoSuministro] : []);
  };

  const resetForm = () => {
    setEditingId(null);
    setNombrePeriodo('');
    setFechaInicio('');
    setFechaFin('');
    setActivo(false);
    setPresidente({ clientId: '', supplyCodeExonerado: '' });
    setSecretario({ clientId: '', supplyCodeExonerado: '' });
    setTesorero({ clientId: '', supplyCodeExonerado: '' });
    setFiscalizador({ clientId: '', supplyCodeExonerado: '' });
  };

  const handleEdit = (comite: any) => {
    setEditingId(comite.id);
    setNombrePeriodo(comite.nombrePeriodo);
    setFechaInicio(comite.fechaInicio);
    setFechaFin(comite.fechaFin);
    setActivo(comite.activo);
    setPresidente({ clientId: comite.presidente.clientId, supplyCodeExonerado: comite.presidente.supplyCodeExonerado || '' });
    setSecretario({ clientId: comite.secretario.clientId, supplyCodeExonerado: comite.secretario.supplyCodeExonerado || '' });
    setTesorero({ clientId: comite.tesorero.clientId, supplyCodeExonerado: comite.tesorero.supplyCodeExonerado || '' });
    setFiscalizador({ clientId: comite.fiscalizador.clientId, supplyCodeExonerado: comite.fiscalizador.supplyCodeExonerado || '' });
    setActiveTab('registrar');
  };

  const handleToggleActive = async (id: string, name: string) => {
    const comite = comites.find(c => c.id === id);
    if (!comite) return;

    const willBeActive = !comite.activo;
    const isConfirmed = await confirm({
      title: willBeActive ? 'Activar Comité Directivo' : 'Desactivar Comité',
      message: willBeActive 
        ? `¿Está seguro de activar el comité "${name}"?\nEsto otorgará automáticamente permisos y revocará los accesos del anterior comité.` 
        : `¿Está seguro de desactivar el comité "${name}"?\nEsto suspenderá las exoneraciones y desactivará las cuentas de acceso de sus miembros.`,
      type: willBeActive ? 'confirm' : 'warning',
      confirmLabel: willBeActive ? 'Activar' : 'Desactivar'
    });

    if (!isConfirmed) return;

    try {
      await toggleCommitteeStatus(id);
      toast.success(willBeActive ? 'Comité activado y permisos sincronizados.' : 'Comité desactivado correctamente.');
    } catch (err: any) {
      toast.error(err.message || 'Error al modificar estado del comité.');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const isConfirmed = await confirm({
      title: 'Eliminar Comité',
      message: `¿Está seguro de eliminar permanentemente el registro del comité "${name}"?\nEsta acción no se puede deshacer.`,
      type: 'danger',
      confirmLabel: 'Eliminar'
    });

    if (!isConfirmed) return;

    try {
      await deleteCommittee(id);
      toast.success('Comité eliminado correctamente.');
    } catch (err: any) {
      toast.error(err.message || 'Error al eliminar el comité.');
    }
  };

  const validateForm = () => {
    if (!nombrePeriodo.trim()) {
      toast.error('Debe ingresar un nombre o descripción para el periodo.');
      return false;
    }
    if (!fechaInicio || !fechaFin) {
      toast.error('Debe seleccionar las fechas de inicio y fin.');
      return false;
    }
    if (new Date(fechaInicio) >= new Date(fechaFin)) {
      toast.error('La fecha de inicio debe ser anterior a la fecha de finalización.');
      return false;
    }

    const roles = { presidente, secretario, tesorero, fiscalizador };
    const selectedIds = [presidente.clientId, secretario.clientId, tesorero.clientId, fiscalizador.clientId].filter(Boolean);
    
    // Check if any role is empty
    if (!presidente.clientId || !secretario.clientId || !tesorero.clientId || !fiscalizador.clientId) {
      toast.error('Todos los cargos del comité deben tener un socio asignado.');
      return false;
    }

    // Check unique members in same period
    const uniqueIds = new Set(selectedIds);
    if (uniqueIds.size !== 4) {
      toast.error('No se pueden asignar múltiples cargos a la misma persona en un mismo período.');
      return false;
    }

    // Ensure supply designation
    for (const [key, value] of Object.entries(roles)) {
      const clientSupplies = getClientSupplies(value.clientId);
      if (clientSupplies.length > 0 && !value.supplyCodeExonerado) {
        toast.error(`Debe seleccionar el suministro a exonerar para el cargo de ${key.toUpperCase()}.`);
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userRole === 'OPERATOR' || userRole === 'FISCALIZADOR') {
      toast.error('No tiene permisos para modificar el comité directivo.');
      return;
    }

    if (!validateForm()) return;

    const buildMemberObj = (roleForm: MemberFormState) => {
      const client = clients.find(c => c.id === roleForm.clientId);
      return {
        clientId: roleForm.clientId,
        nombreCompleto: client ? `${client.nombres} ${client.apellidos}` : '',
        supplyCodeExonerado: roleForm.supplyCodeExonerado
      };
    };

    const payload = {
      nombrePeriodo: nombrePeriodo.trim(),
      fechaInicio,
      fechaFin,
      presidente: buildMemberObj(presidente),
      secretario: buildMemberObj(secretario),
      tesorero: buildMemberObj(tesorero),
      fiscalizador: buildMemberObj(fiscalizador),
      activo
    };

    try {
      if (editingId) {
        await updateCommittee(editingId, payload);
        toast.success('Comité directivo actualizado correctamente.');
      } else {
        await addCommittee(payload);
        toast.success('Nuevo comité directivo guardado correctamente. Los accesos del sistema se han sincronizado.');
      }
      resetForm();
      setActiveTab('vigente');
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar comité directivo.');
    }
  };

  const exportPDFReport = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFillColor(15, 23, 42); 
    doc.rect(0, 0, 210, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text('REPORTE OFICIAL - COMITÉ DIRECTIVO DE LA CENTRAL', 105, 15, { align: 'center' });
    doc.setFontSize(10);
    doc.text('Mini Central Hidroeléctrica Paccha', 105, 24, { align: 'center' });

    let yOffset = 40;

    // Active block
    if (comiteVigente) {
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(14);
      doc.text(`Comité Directivo Vigente: ${comiteVigente.nombrePeriodo}`, 14, yOffset);
      doc.setFontSize(10);
      doc.text(`Vigencia: Desde ${comiteVigente.fechaInicio} hasta ${comiteVigente.fechaFin}`, 14, yOffset + 6);
      
      const tableData = [
        ['PRESIDENTE', comiteVigente.presidente.nombreCompleto, comiteVigente.presidente.supplyCodeExonerado || 'Ninguno', 'Acceso Total (ADMIN)'],
        ['SECRETARIO', comiteVigente.secretario.nombreCompleto, comiteVigente.secretario.supplyCodeExonerado || 'Ninguno', 'Control Reuniones (SECRETARIO)'],
        ['TESORERO', comiteVigente.tesorero.nombreCompleto, comiteVigente.tesorero.supplyCodeExonerado || 'Ninguno', 'Cobros & Finanzas (TESORERO)'],
        ['FISCALIZADOR', comiteVigente.fiscalizador.nombreCompleto, comiteVigente.fiscalizador.supplyCodeExonerado || 'Ninguno', 'Solo Consulta (FISCALIZADOR)']
      ];

      autoTable(doc, {
        startY: yOffset + 12,
        head: [['CARGO', 'NOMBRE COMPLETO', 'SUMINISTRO EXONERADO', 'ROL ASIGNADO']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [30, 41, 59] },
        styles: { fontSize: 9 }
      });
      
      yOffset = (doc as any).lastAutoTable.finalY + 15;
    } else {
      doc.setTextColor(220, 38, 38);
      doc.setFontSize(12);
      doc.text('NO HAY COMITÉ DIRECTIVO ACTUALMENTE ACTIVO EN EL SISTEMA', 14, yOffset);
      yOffset += 15;
    }

    // Historical list
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(14);
    doc.text('Historial de Gestión de Comités Directivos', 14, yOffset);
    
    const historyRows = (comites || []).map(c => [
      c.nombrePeriodo,
      `${c.fechaInicio} a ${c.fechaFin}`,
      c.presidente.nombreCompleto,
      c.secretario.nombreCompleto,
      c.tesorero.nombreCompleto,
      c.fiscalizador.nombreCompleto,
      c.activo ? 'ACTIVO' : 'INACTIVO'
    ]);

    autoTable(doc, {
      startY: yOffset + 6,
      head: [['Gestión', 'Periodo', 'Presidente', 'Secretario', 'Tesorero', 'Fiscalizador', 'Estado']],
      body: historyRows,
      theme: 'grid',
      headStyles: { fillColor: [71, 85, 105] },
      styles: { fontSize: 8 }
    });

    // Signature/Date stamps
    const finalY = (doc as any).lastAutoTable.finalY + 25;
    doc.setFontSize(9);
    doc.text('________________________________', 105, finalY, { align: 'center' });
    doc.text('Firma Certificada', 105, finalY + 5, { align: 'center' });
    doc.text(`Fecha de Impresión: ${new Date().toLocaleDateString()} - Sistema MiniHydro Paccha ERP`, 105, finalY + 12, { align: 'center' });

    doc.save(`Reporte_Comite_Directivo_${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success('Reporte PDF descargado con éxito.');
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigation header */}
      <div className="bg-slate-800/20 p-1 rounded-lg border border-slate-700/50 flex space-x-1">
        <button 
          onClick={() => setActiveTab('vigente')}
          className={`flex-1 py-2 px-3 text-xs md:text-sm font-medium rounded-md transition-colors flex items-center justify-center ${
            activeTab === 'vigente' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Award className="w-4 h-4 mr-1.5" />
          Comité Vigente
        </button>
        <button 
          onClick={() => setActiveTab('registrar')}
          className={`flex-1 py-2 px-3 text-xs md:text-sm font-medium rounded-md transition-colors flex items-center justify-center ${
            activeTab === 'registrar' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Plus className="w-4 h-4 mr-1.5" />
          {editingId ? 'Editar Comité' : 'Nueva Elección'}
        </button>
        <button 
          onClick={() => setActiveTab('historial')}
          className={`flex-1 py-2 px-3 text-xs md:text-sm font-medium rounded-md transition-colors flex items-center justify-center ${
            activeTab === 'historial' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <History className="w-4 h-4 mr-1.5" />
          Historial
        </button>
        <button 
          onClick={() => setActiveTab('reportes')}
          className={`flex-1 py-2 px-3 text-xs md:text-sm font-medium rounded-md transition-colors flex items-center justify-center ${
            activeTab === 'reportes' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <FileText className="w-4 h-4 mr-1.5" />
          Reportes & Exoneraciones
        </button>
      </div>

      {/* 1. COMITÉ DIRECTIVO VIGENTE BARNER */}
      {activeTab === 'vigente' && (
        <div className="space-y-6">
          {comiteVigente ? (
            <div className="grid grid-cols-1 gap-6">
              <div className="bg-gradient-to-r from-blue-900/40 to-slate-950 p-6 rounded-2xl border border-blue-500/30 shadow-lg">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
                  <div>
                    <span className="bg-blue-500/20 text-blue-400 text-xs px-3 py-1 rounded-full border border-blue-500/30 font-semibold uppercase tracking-wider">
                      Gestion Actual Activa
                    </span>
                    <h3 className="text-2xl font-bold text-white mt-2 leading-tight">
                      {comiteVigente.nombrePeriodo}
                    </h3>
                    <p className="text-slate-400 text-xs md:text-sm mt-1 flex items-center">
                      <Calendar className="w-4 h-4 mr-1 text-slate-500" />
                      Desde: <span className="text-slate-200 font-medium mx-1">{comiteVigente.fechaInicio}</span> hasta: <span className="text-slate-200 font-medium ml-1">{comiteVigente.fechaFin}</span>
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => handleEdit(comiteVigente)} className="text-blue-400 hover:bg-blue-500/10 border-blue-500/20">
                    <Edit2 className="w-3.5 h-3.5 mr-1" /> Editar Comité Vigente
                  </Button>
                </div>
              </div>

              {/* Members Bento Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Presidente */}
                <div className="bg-slate-800/20 p-5 rounded-2xl border border-slate-700/50 hover:border-slate-600 transition-all">
                  <div className="flex justify-between items-start">
                    <div className="bg-blue-500/10 p-3 rounded-xl border border-blue-500/20 text-blue-400">
                      <Shield className="w-6 h-6" />
                    </div>
                    <Badge variant="success">PRESIDENTE</Badge>
                  </div>
                  <h4 className="text-lg font-semibold text-slate-100 mt-4 truncate">
                    {comiteVigente.presidente.nombreCompleto}
                  </h4>
                  <div className="mt-4 pt-4 border-t border-slate-800/60 space-y-2 text-xs text-slate-400">
                    <p className="flex justify-between items-center bg-slate-900/40 p-2 rounded">
                      <span>Acceso del Sistema:</span>
                      <strong className="text-slate-200 font-medium">ADMIN (Control Total)</strong>
                    </p>
                    <p className="flex justify-between items-center bg-emerald-500/5 p-2 rounded border border-emerald-500/10">
                      <span className="flex items-center text-emerald-400 font-medium">
                        <Zap className="w-3 h-3 mr-1 text-emerald-500" /> Suministro Exonerado:
                      </span>
                      <strong className="text-slate-100 font-mono tracking-wider">{comiteVigente.presidente.supplyCodeExonerado || 'No Asignado'}</strong>
                    </p>
                  </div>
                </div>

                {/* Secretario */}
                <div className="bg-slate-800/20 p-5 rounded-2xl border border-slate-700/50 hover:border-slate-600 transition-all">
                  <div className="flex justify-between items-start">
                    <div className="bg-indigo-500/10 p-3 rounded-xl border border-indigo-500/20 text-indigo-400">
                      <FileText className="w-6 h-6" />
                    </div>
                    <Badge variant="info">SECRETARIO</Badge>
                  </div>
                  <h4 className="text-lg font-semibold text-slate-100 mt-4 truncate">
                    {comiteVigente.secretario.nombreCompleto}
                  </h4>
                  <div className="mt-4 pt-4 border-t border-slate-800/60 space-y-2 text-xs text-slate-400">
                    <p className="flex justify-between items-center bg-slate-900/40 p-2 rounded">
                      <span>Acceso del Sistema:</span>
                      <strong className="text-slate-200 font-medium">SECRETARIO (Reuniones)</strong>
                    </p>
                    <p className="flex justify-between items-center bg-emerald-500/5 p-2 rounded border border-emerald-500/10">
                      <span className="flex items-center text-emerald-400 font-medium">
                        <Zap className="w-3 h-3 mr-1 text-emerald-500" /> Suministro Exonerado:
                      </span>
                      <strong className="text-slate-100 font-mono tracking-wider">{comiteVigente.secretario.supplyCodeExonerado || 'No Asignado'}</strong>
                    </p>
                  </div>
                </div>

                {/* Tesorero */}
                <div className="bg-slate-800/20 p-5 rounded-2xl border border-slate-700/50 hover:border-slate-600 transition-all">
                  <div className="flex justify-between items-start">
                    <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-500/20 text-amber-400">
                      <UserCheck className="w-6 h-6" />
                    </div>
                    <Badge variant="warning">TESORERO</Badge>
                  </div>
                  <h4 className="text-lg font-semibold text-slate-100 mt-4 truncate">
                    {comiteVigente.tesorero.nombreCompleto}
                  </h4>
                  <div className="mt-4 pt-4 border-t border-slate-800/60 space-y-2 text-xs text-slate-400">
                    <p className="flex justify-between items-center bg-slate-900/40 p-2 rounded">
                      <span>Acceso del Sistema:</span>
                      <strong className="text-slate-200 font-medium">TESORERO (Finanzas)</strong>
                    </p>
                    <p className="flex justify-between items-center bg-emerald-500/5 p-2 rounded border border-emerald-500/10">
                      <span className="flex items-center text-emerald-400 font-medium">
                        <Zap className="w-3 h-3 mr-1 text-emerald-500" /> Suministro Exonerado:
                      </span>
                      <strong className="text-slate-100 font-mono tracking-wider">{comiteVigente.tesorero.supplyCodeExonerado || 'No Asignado'}</strong>
                    </p>
                  </div>
                </div>

                {/* Fiscalizador */}
                <div className="bg-slate-800/20 p-5 rounded-2xl border border-slate-700/50 hover:border-slate-600 transition-all">
                  <div className="flex justify-between items-start">
                    <div className="bg-purple-500/10 p-3 rounded-xl border border-purple-500/20 text-purple-400">
                      <RefreshCw className="w-6 h-6" />
                    </div>
                    <Badge variant="default">FISCALIZADOR</Badge>
                  </div>
                  <h4 className="text-lg font-semibold text-slate-100 mt-4 truncate">
                    {comiteVigente.fiscalizador.nombreCompleto}
                  </h4>
                  <div className="mt-4 pt-4 border-t border-slate-800/60 space-y-2 text-xs text-slate-400">
                    <p className="flex justify-between items-center bg-slate-900/40 p-2 rounded">
                      <span>Acceso del Sistema:</span>
                      <strong className="text-slate-200 font-medium">FISCALIZADOR (Solo Consulta)</strong>
                    </p>
                    <p className="flex justify-between items-center bg-emerald-500/5 p-2 rounded border border-emerald-500/10">
                      <span className="flex items-center text-emerald-400 font-medium">
                        <Zap className="w-3 h-3 mr-1 text-emerald-500" /> Suministro Exonerado:
                      </span>
                      <strong className="text-slate-100 font-mono tracking-wider">{comiteVigente.fiscalizador.supplyCodeExonerado || 'No Asignado'}</strong>
                    </p>
                  </div>
                </div>

              </div>
            </div>
          ) : (
            <div className="bg-slate-800/20 border border-slate-700/50 rounded-2xl p-12 text-center max-w-lg mx-auto">
              <Award className="w-16 h-16 text-slate-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-100">Sin Comité Directivo Activo</h3>
              <p className="text-slate-400 text-sm mt-2">
                No hay ningún comité vigente en funciones. Ingrese a la pestaña "Nueva Elección" para designar un nuevo Comité Directivo y habilitar las facultades correspondientes del sistema.
              </p>
              <Button onClick={() => setActiveTab('registrar')} className="mt-6" size="sm">
                <Plus className="w-4 h-4 mr-1.5" /> Crear Primer Comité
              </Button>
            </div>
          )}
        </div>
      )}

      {/* 2. REGISTRAR / EDITAR PERIODO FORM */}
      {activeTab === 'registrar' && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Editar Periodo del Comité Directivo' : 'Registrar Nueva Elección de Comité Directivo'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Period Fields */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-slate-300">Nombre de la Gestión o Periodo</label>
                  <input
                    type="text"
                    required
                    value={nombrePeriodo}
                    onChange={(e) => setNombrePeriodo(e.target.value)}
                    className="mt-1 block w-full bg-[#0B0E14] border border-slate-600 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-slate-100 sm:text-sm"
                    placeholder="Ej. Junta Directiva General Paccha 2026-2027"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300">Fecha de Inicio de Gestión</label>
                  <input
                    type="date"
                    required
                    value={fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                    className="mt-1 block w-full bg-[#0B0E14] border border-slate-600 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-slate-100 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300">Fecha de Finalización</label>
                  <input
                    type="date"
                    required
                    value={fechaFin}
                    onChange={(e) => setFechaFin(e.target.value)}
                    className="mt-1 block w-full bg-[#0B0E14] border border-slate-600 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-slate-100 sm:text-sm"
                  />
                </div>
                <div className="flex items-center pt-8">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activo}
                      onChange={(e) => setActivo(e.target.checked)}
                      className="h-4.5 w-4.5 text-blue-600 focus:ring-blue-500 border-slate-600 bg-slate-900 rounded"
                    />
                    <span className="text-sm font-medium text-slate-300">Activar de inmediato</span>
                  </label>
                </div>
              </div>

              {/* Roles Designation Block */}
              <div className="bg-slate-900/30 p-5 rounded-xl border border-slate-700/50 space-y-6">
                <h3 className="text-sm font-bold text-slate-300 border-b border-slate-700 pb-2 uppercase tracking-wide">
                  Designación de Directivos y Asignación de Suministro Exonerado
                </h3>
                
                {/* 1. PRESIDENTE SELECT */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4 border-b border-slate-800/40">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 flex items-center">
                      <Shield className="w-4 h-4 text-blue-400 mr-1" /> Presidente (Rol ADMIN)
                    </label>
                    <select
                      required
                      value={presidente.clientId}
                      onChange={(e) => setPresidente({ clientId: e.target.value, supplyCodeExonerado: '' })}
                      className="mt-1 block w-full bg-[#0B0E14] border border-slate-600 rounded-md py-2 px-3 focus:outline-none text-slate-100 sm:text-sm"
                    >
                      <option value="">-- Seleccionar Socio --</option>
                      {sociosHabilitados.map(s => (
                        <option key={s.id} value={s.id}>{s.nombres} {s.apellidos} (DNI: {s.dni})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300">Suministro para Exoneración Eléctrica</label>
                    <select
                      required={!!presidente.clientId}
                      disabled={!presidente.clientId}
                      value={presidente.supplyCodeExonerado}
                      onChange={(e) => setPresidente(prev => ({ ...prev, supplyCodeExonerado: e.target.value }))}
                      className="mt-1 block w-full bg-[#0B0E14] border border-slate-600 rounded-md py-2 px-3 focus:outline-none text-slate-100 sm:text-sm disabled:opacity-50"
                    >
                      <option value="">-- Seleccionar Suministro --</option>
                      {getClientSupplies(presidente.clientId).map(code => (
                        <option key={code} value={code}>Suministro: {code}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 2. SECRETARIO SELECT */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4 border-b border-slate-800/40">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 flex items-center">
                      <FileText className="w-4 h-4 text-indigo-400 mr-1" /> Secretario (Rol REUNIONES)
                    </label>
                    <select
                      required
                      value={secretario.clientId}
                      onChange={(e) => setSecretario({ clientId: e.target.value, supplyCodeExonerado: '' })}
                      className="mt-1 block w-full bg-[#0B0E14] border border-slate-600 rounded-md py-2 px-3 focus:outline-none text-slate-100 sm:text-sm"
                    >
                      <option value="">-- Seleccionar Socio --</option>
                      {sociosHabilitados.map(s => (
                        <option key={s.id} value={s.id}>{s.nombres} {s.apellidos} (DNI: {s.dni})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300">Suministro para Exoneración Eléctrica</label>
                    <select
                      required={!!secretario.clientId}
                      disabled={!secretario.clientId}
                      value={secretario.supplyCodeExonerado}
                      onChange={(e) => setSecretario(prev => ({ ...prev, supplyCodeExonerado: e.target.value }))}
                      className="mt-1 block w-full bg-[#0B0E14] border border-slate-600 rounded-md py-2 px-3 focus:outline-none text-slate-100 sm:text-sm disabled:opacity-50"
                    >
                      <option value="">-- Seleccionar Suministro --</option>
                      {getClientSupplies(secretario.clientId).map(code => (
                        <option key={code} value={code}>Suministro: {code}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 3. TESORERO SELECT */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4 border-b border-slate-800/40">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 flex items-center">
                      <UserCheck className="w-4 h-4 text-amber-400 mr-1" /> Tesorero (Rol FINANZAS)
                    </label>
                    <select
                      required
                      value={tesorero.clientId}
                      onChange={(e) => setTesorero({ clientId: e.target.value, supplyCodeExonerado: '' })}
                      className="mt-1 block w-full bg-[#0B0E14] border border-slate-600 rounded-md py-2 px-3 focus:outline-none text-slate-100 sm:text-sm"
                    >
                      <option value="">-- Seleccionar Socio --</option>
                      {sociosHabilitados.map(s => (
                        <option key={s.id} value={s.id}>{s.nombres} {s.apellidos} (DNI: {s.dni})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300">Suministro para Exoneración Eléctrica</label>
                    <select
                      required={!!tesorero.clientId}
                      disabled={!tesorero.clientId}
                      value={tesorero.supplyCodeExonerado}
                      onChange={(e) => setTesorero(prev => ({ ...prev, supplyCodeExonerado: e.target.value }))}
                      className="mt-1 block w-full bg-[#0B0E14] border border-slate-600 rounded-md py-2 px-3 focus:outline-none text-slate-100 sm:text-sm disabled:opacity-50"
                    >
                      <option value="">-- Seleccionar Suministro --</option>
                      {getClientSupplies(tesorero.clientId).map(code => (
                        <option key={code} value={code}>Suministro: {code}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 4. FISCALIZADOR SELECT */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 flex items-center">
                      <RefreshCw className="w-4 h-4 text-purple-400 mr-1" /> Fiscalizador (Rol CONSULTAS)
                    </label>
                    <select
                      required
                      value={fiscalizador.clientId}
                      onChange={(e) => setFiscalizador({ clientId: e.target.value, supplyCodeExonerado: '' })}
                      className="mt-1 block w-full bg-[#0B0E14] border border-slate-600 rounded-md py-2 px-3 focus:outline-none text-slate-100 sm:text-sm"
                    >
                      <option value="">-- Seleccionar Socio --</option>
                      {sociosHabilitados.map(s => (
                        <option key={s.id} value={s.id}>{s.nombres} {s.apellidos} (DNI: {s.dni})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300">Suministro para Exoneración Eléctrica</label>
                    <select
                      required={!!fiscalizador.clientId}
                      disabled={!fiscalizador.clientId}
                      value={fiscalizador.supplyCodeExonerado}
                      onChange={(e) => setFiscalizador(prev => ({ ...prev, supplyCodeExonerado: e.target.value }))}
                      className="mt-1 block w-full bg-[#0B0E14] border border-slate-600 rounded-md py-2 px-3 focus:outline-none text-slate-100 sm:text-sm disabled:opacity-50"
                    >
                      <option value="">-- Seleccionar Suministro --</option>
                      {getClientSupplies(fiscalizador.clientId).map(code => (
                        <option key={code} value={code}>Suministro: {code}</option>
                      ))}
                    </select>
                  </div>
                </div>

              </div>

              {/* Alert policy */}
              <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-lg flex space-x-3">
                <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0" />
                <p className="text-xs text-blue-300 leading-normal">
                  <strong>Nota Importante de Accesos y Exoneración:</strong> Activar un comité generará o habilitará de inmediato las credenciales de los socios elegidos con la contraseña por defecto <strong>Comite2026#</strong> (se les solicitará cambiarla en su primer login). Al mismo tiempo, sus consumos de energía en el suministro indicado pasará a ser S/ 0 automáticamente para las facturas comprendidas dentro del periodo indicado.
                </p>
              </div>

              {/* Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
                <Button type="button" variant="outline" onClick={() => { resetForm(); setActiveTab('vigente'); }}>
                  Cancelar
                </Button>
                <Button type="submit">
                  Guardar Comité Directivo
                </Button>
              </div>

            </form>
          </CardContent>
        </Card>
      )}

      {/* 3. HISTORIAL DE GESTION DE COMITES DIRECTIVOS */}
      {activeTab === 'historial' && (
        <Card>
          <CardHeader className="flex justify-between items-center sm:flex-row flex-col space-y-2 sm:space-y-0">
            <CardTitle>Histórico de Comités Directivos</CardTitle>
            <div className="relative w-full max-w-xs">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-500" />
              </span>
              <input
                type="text"
                placeholder="Buscar comités..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-9 pr-3 py-1.5 bg-[#0B0E14] border border-slate-700 rounded-md text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </CardHeader>
          <CardContent>
            {comites && comites.length > 0 ? (
              <div className="overflow-x-auto border border-slate-800 rounded-lg">
                <table className="min-w-full divide-y divide-slate-800">
                  <thead className="bg-slate-900/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">Gestión / Período</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">Vigencia</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">Dirigentes Designados</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">Suministros Exonerados</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">Estado</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 bg-slate-950/20">
                    {comites
                      .filter(com => com.nombrePeriodo.toLowerCase().includes(searchTerm.toLowerCase()))
                      .map((com) => (
                        <tr key={com.id} className="hover:bg-slate-900/40">
                          <td className="px-4 py-4 text-sm font-semibold text-slate-150">
                            {com.nombrePeriodo}
                          </td>
                          <td className="px-4 py-4 text-xs text-slate-400 whitespace-nowrap">
                            Del {com.fechaInicio}<br />al {com.fechaFin}
                          </td>
                          <td className="px-4 py-4 text-xs text-slate-300 max-w-xs">
                            <div className="space-y-1">
                              <p>👑 <span className="font-semibold text-slate-200">Pres:</span> {com.presidente.nombreCompleto}</p>
                              <p>✍️ <span className="font-semibold text-slate-200">Sec:</span> {com.secretario.nombreCompleto}</p>
                              <p>💰 <span className="font-semibold text-slate-200">Tes:</span> {com.tesorero.nombreCompleto}</p>
                              <p>🔍 <span className="font-semibold text-slate-200">Fisc:</span> {com.fiscalizador.nombreCompleto}</p>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-xs text-slate-400 font-mono">
                            <div className="space-y-1">
                              <p>P: {com.presidente.supplyCodeExonerado || '---'}</p>
                              <p>S: {com.secretario.supplyCodeExonerado || '---'}</p>
                              <p>T: {com.tesorero.supplyCodeExonerado || '---'}</p>
                              <p>F: {com.fiscalizador.supplyCodeExonerado || '---'}</p>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-xs whitespace-nowrap">
                            <Badge variant={com.activo ? 'success' : 'default'}>
                              {com.activo ? 'ACTIVO VIGENTE' : 'FINALIZADO'}
                            </Badge>
                          </td>
                          <td className="px-4 py-4 text-right text-xs whitespace-nowrap">
                            <div className="flex justify-end space-x-2">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleToggleActive(com.id, com.nombrePeriodo)} 
                                className={`text-${com.activo ? 'orange' : 'emerald'}-400 border-${com.activo ? 'orange' : 'emerald'}-500/20 hover:bg-${com.activo ? 'orange' : 'emerald'}-500/10`}
                              >
                                {com.activo ? 'Desactivar' : 'Activar'}
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => handleEdit(com)} className="text-blue-400 border-blue-500/20">
                                <Edit2 className="w-3 h-3" />
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => handleDelete(com.id, com.nombrePeriodo)} className="text-red-400 border-red-500/20 hover:bg-red-500/10">
                                <Trash className="w-3 h-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500">
                Aún no existen comités históricos registrados.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 4. SECCION REPORTES DE COMITE */}
      {activeTab === 'reportes' && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex justify-between items-center sm:flex-row flex-col space-y-2 sm:space-y-0">
              <CardTitle>Reportes Consolidados de la Central</CardTitle>
              <Button onClick={exportPDFReport} size="sm">
                <Download className="w-4 h-4 mr-1.5" /> Descargar Reporte Completo (PDF)
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* Summary Indicators */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-900/30 p-4 rounded-xl border border-slate-700/50">
                  <span className="text-xs text-slate-400">Total Comités Registrados</span>
                  <p className="text-2xl font-bold text-slate-100 mt-1">{comites?.length || 0}</p>
                </div>
                <div className="bg-slate-900/30 p-4 rounded-xl border border-slate-700/50">
                  <span className="text-xs text-slate-400">Socio-Clientes Elegibles</span>
                  <p className="text-2xl font-bold text-green-400 mt-1">{sociosHabilitados.length}</p>
                </div>
                <div className="bg-slate-900/30 p-4 rounded-xl border border-slate-700/50">
                  <span className="text-xs text-slate-400">Suministros Exonerados Activos</span>
                  <p className="text-2xl font-bold text-emerald-400 mt-1">
                    {comiteVigente ? 4 : 0}
                  </p>
                </div>
              </div>

              {/* Active Exonerations Subtable */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-300 flex items-center">
                  <Zap className="w-4 h-4 text-emerald-400 mr-1.5" /> Padrón de Suministros con Exoneraciones Activas
                </h3>
                {comiteVigente ? (
                  <div className="border border-slate-800 rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-slate-800 text-xs">
                      <thead className="bg-slate-900">
                        <tr>
                          <th className="px-4 py-2.5 text-left text-slate-300">Suministro</th>
                          <th className="px-4 py-2.5 text-left text-slate-300">Socio Directivo</th>
                          <th className="px-4 py-2.5 text-left text-slate-300">Cargo</th>
                          <th className="px-4 py-2.5 text-left text-slate-300">Periodo Vigencia</th>
                          <th className="px-4 py-2.5 text-left text-slate-300">Exención Cobertura</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 bg-slate-950/20">
                        {[
                          { role: 'Presidente', m: comiteVigente.presidente },
                          { role: 'Secretario', m: comiteVigente.secretario },
                          { role: 'Tesorero', m: comiteVigente.tesorero },
                          { role: 'Fiscalizador', m: comiteVigente.fiscalizador },
                        ].map(({ role, m }) => (
                          <tr key={role} className="hover:bg-slate-900/30">
                            <td className="px-4 py-3 font-mono text-emerald-400 font-bold">{m.supplyCodeExonerado || '---'}</td>
                            <td className="px-4 py-3 text-slate-100 font-semibold">{m.nombreCompleto}</td>
                            <td className="px-4 py-3 text-slate-300">{role}</td>
                            <td className="px-4 py-3 text-slate-400">{comiteVigente.fechaInicio} a {comiteVigente.fechaFin}</td>
                            <td className="px-4 py-3 text-emerald-500 font-medium whitespace-nowrap">
                              ✓ 100% Consumo Eléctrico
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 bg-slate-900/20 p-4 border border-slate-800 rounded">
                    No hay suministros exonerados actualmente porque no existe un comité directivo en vigencia.
                  </p>
                )}
              </div>

            </CardContent>
          </Card>
        </div>
      )}

    </div>
  );
}
