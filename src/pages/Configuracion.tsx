import React, { useState, useEffect, useRef } from 'react';
import { Settings, Save, KeyRound, Database, BookOpen, Download } from 'lucide-react';
import { useAppContext } from '../store/AppContext';
import { Card, CardContent, CardTitle, Button } from '../components/ui';
import bcrypt from 'bcryptjs';
import { toast } from 'react-hot-toast';
import { jsPDF } from 'jspdf';

export default function Configuracion() {
  const { settings, updateSettings, userRole, user, updateAdmin, admins } = useAppContext();
  const [formData, setFormData] = useState({
    costoSocio: 0.20,
    costoUsuario: 0.30,
    costoTrifasico: 0.00,
    multaReunion: 40,
    costoReconexion: 0.00,
    consumoMinimo: 6.00
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (userRole === 'OPERATOR' || userRole === 'FISCALIZADOR') {
      toast.error('No tiene permisos para modificar la configuración.');
      return;
    }
    updateSettings(formData);
    toast.success('Configuración guardada correctamente.');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('No se pudo identificar al usuario actual.');
      return;
    }

    const currentAdmin = admins.find(a => a.email === user.email);
    if (!currentAdmin) {
      toast.error('Usuario no encontrado en la base de datos.');
      return;
    }

    let isMatch = false;
    try {
      isMatch = bcrypt.compareSync(passwordForm.currentPassword, currentAdmin.password) || currentAdmin.password === passwordForm.currentPassword;
    } catch {
      isMatch = currentAdmin.password === passwordForm.currentPassword;
    }

    if (!isMatch) {
      toast.error('La contraseña actual es incorrecta.');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('Las contraseñas no coinciden.');
      return;
    }

    const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/;
    if (!passwordPattern.test(passwordForm.newPassword)) {
      toast.error('La nueva contraseña debe tener al menos 6 caracteres, incluir una letra mayúscula, una minúscula, un número y un carácter especial.');
      return;
    }

    const hashedPassword = bcrypt.hashSync(passwordForm.newPassword, 10);
    await updateAdmin(currentAdmin.id, { password: hashedPassword });
    toast.success('Contraseña actualizada correctamente.');
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
  };

  const backupInputRef = React.useRef<HTMLInputElement>(null);

  const handleExportBackup = () => {
    const data = localStorage.getItem('erp_data');
    if (!data) {
      toast.error('No hay datos para exportar.');
      return;
    }
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Backup_Sistema_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Copia de seguridad descargada.');
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm('¿ESTÁS SEGURO? Importar una copia de seguridad sobrescribirá TODOS los datos actuales del sistema. Esta acción no se puede deshacer.')) {
      if(backupInputRef.current) backupInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const jsonStr = evt.target?.result as string;
        JSON.parse(jsonStr); // Validate JSON
        localStorage.setItem('erp_data', jsonStr);
        toast.success('Base de datos restaurada correctamente. Recargando sistema...');
        setTimeout(() => window.location.reload(), 1500);
      } catch (error) {
        toast.error('El archivo de respaldo no es válido o está dañado.');
      }
    };
    reader.readAsText(file);
  };

  const handleDownloadManual = (roleType: string) => {
    const doc = new jsPDF();
    let yOffset = 20;
    
    // Helper to add page if needed
    const checkPage = (addedHeight: number) => {
      if (yOffset + addedHeight > 280) {
        doc.addPage();
        yOffset = 20;
      }
    };
    
    // Header
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 210, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text(`Manual de Usuario - Perfil: ${roleType}`, 105, 20, { align: 'center' });
    
    // Content
    yOffset = 45;
    
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text('Descripción General y Permisos:', 14, yOffset);
    yOffset += 8;
    
    doc.setFontSize(11);
    doc.setTextColor(50, 50, 50);
    
    let description = '';
    if (roleType === 'ADMIN') {
      description = 'El Administrador tiene acceso total al sistema. Puede gestionar clientes, ver y procesar cobros, aplicar consumos y multas, configurar tarifas, administrar cuentas de usuario, realizar exportaciones/importaciones (Backups) y visualizar finanzas.';
    } else if (roleType === 'TESORERO') {
      description = 'El Tesorero se encarga principalmente de recaudar ingresos. Tiene acceso al cobro de recibos (Consumos y Multas) y puede visualizar el estado de deuda de los clientes. No puede alterar lecturas ni reportar egresos.';
    } else if (roleType === 'OPERATOR') {
      description = 'El Operador (Digitador) es responsable del trabajo de campo o digitación. Puede registrar nuevos clientes, actualizar direcciones e ingresar mensualmente las lecturas de los medidores de agua.';
    } else if (roleType === 'FISCALIZADOR') {
      description = 'El Fiscalizador realiza tareas de auditoría. Tiene acceso de solo lectura a los movimientos financieros, listado de clientes y consumos, permitiendo monitorear las métricas de la asociación sin alterar datos.';
    }
    
    const descLines = doc.splitTextToSize(description, 180);
    doc.text(descLines, 14, yOffset);
    yOffset += (descLines.length * 6) + 10;
    
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text('Módulos Habilitados y Funcionalidades:', 14, yOffset);
    yOffset += 10;
    
    const writeSection = (title: string, desc: string, steps: string[], mockType: 'dashboard' | 'table' | 'form') => {
      checkPage(30);
      
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(30, 64, 175); // blue-800
      doc.text(`Módulo: ${title}`, 14, yOffset);
      yOffset += 7;
      
      doc.setFontSize(11);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(50, 50, 50);
      const textLines = doc.splitTextToSize(desc, 180);
      doc.text(textLines, 14, yOffset);
      yOffset += (textLines.length * 6) + 4;
      
      if (steps && steps.length > 0) {
        checkPage(steps.length * 7 + 10);
        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.text('Guía Paso a Paso:', 14, yOffset);
        yOffset += 6;
        doc.setFontSize(11);
        doc.setFont(undefined, 'normal');
        steps.forEach((step, idx) => {
          const stepLines = doc.splitTextToSize(`Paso ${idx + 1}: ${step}`, 175);
          doc.text(stepLines, 18, yOffset);
          yOffset += (stepLines.length * 5) + 2;
        });
        yOffset += 7;
      }
      
      checkPage(75);
      
      // Draw a highly detailed mock screenshot
      doc.setDrawColor(200, 200, 200);
      doc.setFillColor(248, 250, 252); // slate-50 background
      doc.roundedRect(14, yOffset, 182, 60, 2, 2, 'FD');
      
      // Window header (browser like)
      doc.setFillColor(226, 232, 240);
      doc.rect(14, yOffset, 182, 8, 'F');
      doc.setFillColor(241, 245, 249);
      doc.circle(20, yOffset + 4, 1.5, 'F');
      doc.circle(25, yOffset + 4, 1.5, 'F');
      doc.circle(30, yOffset + 4, 1.5, 'F');
      
      // Sidebar
      doc.setFillColor(15, 23, 42);
      doc.rect(14, yOffset + 8, 30, 52, 'F');
      
      doc.setFillColor(51, 65, 85);
      for(let i=0; i<4; i++) {
        doc.rect(17, yOffset + 15 + (i * 6), 24, 3, 'F');
      }

      // Content area
      if (mockType === 'dashboard') {
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(48, yOffset + 12, 40, 20, 1, 1, 'F');
        doc.roundedRect(92, yOffset + 12, 40, 20, 1, 1, 'F');
        doc.roundedRect(136, yOffset + 12, 40, 20, 1, 1, 'F');
        
        doc.setFillColor(226, 232, 240);
        doc.roundedRect(48, yOffset + 36, 128, 20, 1, 1, 'F');
      } else if (mockType === 'table') {
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(48, yOffset + 12, 128, 44, 1, 1, 'F');
        doc.setFillColor(226, 232, 240);
        doc.rect(48, yOffset + 12, 128, 6, 'F'); // headers
        for(let i=0; i<4; i++) {
          doc.rect(50, yOffset + 22 + (i*8), 124, 4, 'F'); // rows
        }
      } else if (mockType === 'form') {
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(48, yOffset + 12, 128, 44, 1, 1, 'F');
        doc.setFillColor(226, 232, 240);
        doc.rect(52, yOffset + 20, 50, 4, 'F'); // label
        doc.rect(52, yOffset + 26, 120, 6, 'F'); // input
        doc.rect(52, yOffset + 36, 50, 4, 'F'); // label
        doc.rect(52, yOffset + 42, 120, 6, 'F'); // input
        doc.setFillColor(59, 130, 246);
        doc.roundedRect(142, yOffset + 50, 30, 6, 1, 1, 'F'); // primary button
      }
      
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(`Captura ilustrativa: Sistema ERP - ${title}`, 105, yOffset + 65, { align: 'center' });
      
      yOffset += 75; // 60 for img + padding
    };

    if (roleType === 'ADMIN') {
      writeSection(
        'Panel Principal (Dashboard)', 
        'Proporciona una vista rápida de las métricas principales del sistema: ingresos, egresos, balance total, así como la cantidad de clientes morosos y aquellos con reconexiones pendientes.',
        ['Visualizar un resumen de las métricas en tarjetas superiores.', 'Revisar la tabla de distribución de clientes por sector y tipo.', 'Ver el gráfico de los ingresos del mes.'],
        'dashboard'
      );
      writeSection(
        'Clientes', 
        'Gestión completa del padrón de pobladores (Socios y Usuarios). Permite administrar datos, cortes de servicio y verificar deudas.',
        ['Hacer clic en "Nuevo Cliente" para agregar usuarios o socios.', 'En la tabla, buscar mediante código de suministro o nombre.', 'Seleccionar "D" o "M" en los botones de acción para gestionar Deudas o Multas.', 'Editar la información desde el botón Lápiz o activar CORTADO/ACTIVO.'],
        'table'
      );
      writeSection(
        'Consumos Anuales', 
        'Módulo para procesar lecturas de medidores mensualmente. Genera masivamente los comprobantes en base al rango de consumo y la tarifa establecida.',
        ['Elegir el Mes y Año para habilitar la planilla de registro.', 'Ingresar la lectura actual para cada cliente que no cuente con una.', 'Hacer clic en "Generar Recibo" o "Generar Recibos Faltantes" para emitir la deuda.', 'Usar los botones "PAGAR" para liquidar el recibo generado.'],
        'form'
      );
      writeSection(
        'Reuniones / Asambleas', 
        'Registra reuniones comunitarias o asambleas para el control de asistencia. Calcula quórum y asigna multas para quienes no justifiquen su inasistencia.',
        ['Crear una nueva reunión indicando fecha, hora general y hora límite (Fin de Tolerancia).', 'Marcar la asistencia de cada socio mediante los botones Asistió (Verde) o Justificó.', 'Cerrar el padrón y presionar "Asignar Multas" para que los inasistentes adquieran una deuda automática.', 'Imprimir el reporte de citados.'],
        'table'
      );
      writeSection(
        'Finanzas', 
        'Lleva el registro de caja de toda la asociación, consolidando ingresos de multas y consumos. Permite asentar salidas (egresos) monetarias justificadas.',
        ['Visualizar el listado en tiempo real de transacciones (Cobros y Egresos).', 'Filtrar por tipo (Recibo, Multa, Egreso, Reingreso, Devolución) y mes.', 'Hacer clic en "Generar Detalle de Ingresos PDF" para reportes por operador en fechas elegidas.', 'Ingresar "Nuevo Egreso" con su concepto (p. ej. reparación tuberías) y monto.'],
        'table'
      );
      writeSection(
        'Usuarios (Gestión de Roles)', 
        'Administra los perfiles de acceso. Permite dar de alta a miembros de mesa directiva y/o digitadores.',
        ['Abrir el módulo Usuarios (ícono de Escudo).', 'Crear un usuario nuevo llenando nombres, DNI, correo temporal (opcional), rol a desempeñar y contraseña.', 'Revocar accesos eliminando o editando cuentas existentes.'],
        'form'
      );
      writeSection(
        'Configuración del Sistema', 
        'Parámetros centrales de tarifas de agua, costos de multa por defecto y exportación de copias de seguridad de los datos.',
        ['Revisar "Tarifas de Agua"; cambiar el rango, el costo de las cuotas familiares, y cuotas base de agua.', 'En la sección Bases Administrativas configurar Multa de Asamblea (ej. 50 MXN/PEN), Asignación de Socio y Reconexiones de Servicio.', 'Exportar copia de Sistema (JSON) a escritorio como archivo de respaldo diario.', 'Descargar este manual PDF.'],
        'form'
      );
      
    } else if (roleType === 'TESORERO') {
      writeSection(
        'Panel Principal', 
        'Brinda lectura rápida del desempeño de las recaudaciones y nivel de deuda de los clientes.',
        ['Seleccionar Panel Inferior para ver tarjetas informativas.', 'El sistema detalla el número de morosos para realizar notificaciones físicas.'],
        'dashboard'
      );
      writeSection(
        'Cobro de Consumos', 
        'Recaudación por recibos de suministro de agua correspondientes al consumo capturado (mensual).',
        ['Navegar a Consumos.', 'Seleccionar el Mes activo a liquidar.', 'Hacer clic en el botón verde "PAGAR" al lado del cliente en la lista, lo que transfiere el dinero al sistema contable.', 'Hacer clic en el icono "PDF (Recibo)" para imprimir el comprobante térmico/A4.'],
        'table'
      );
      writeSection(
        'Cobro de Multas y Asistencia', 
        'Recaudación por faltas o reuniones de inasistencia, garantizando el control del libro de asambleas.',
        ['Navegar al apartado Clientes, pulsar en Icono Naranja Escudo (Ver Multas). Alternativamente entrar a padrón.', 'Buscar a un cliente específico, y cobrar las deudas listadas y generadas previamente.', 'El estado cambiará automáticamente a PAGADO.'],
        'form'
      );
      
    } else if (roleType === 'OPERATOR') {
      writeSection(
        'Clientes', 
        'Registro digital del libro padrón. Actualización de censos y altas de servicios.',
        ['Entrar a "Clientes" e ingresar "Crear Cliente".', 'Completar Nombres, DNI, Código de suministro asignado, Sexo, Categoría (Socio/Usuario) y Sector.', 'Hacer clic en guardar. Los datos estarán automáticamente en el sistema para la toma de lecturas diarias.'],
        'form'
      );
      writeSection(
        'Consumos (Lecturas Médicas)', 
        'Toma de lecturas mensuales del medidor de agua correspondiente a cada cliente.',
        ['Ir a Consumos y seleccionar el mes activo.', 'Caminar a los domicilios, e identificar por número de suministro y titular.', 'Digitar en "Lectura Actual" los m3 del hidrómetro y apretar "Enter".', 'El sistema mostrará en amarillo cambios anormalmente altos del consumo anterior.'],
        'table'
      );
      writeSection(
        'Reuniones (Toma de Lista)', 
        'Apoyo perimetral para registrar asistencia a la hora del evento general.',
        ['Para facilitar la entrada al local, dar check a Asistió o Falto en la tabla en el módulo Reuniones para la asamblea ACTIVA.', 'Puede buscar en campo de texto con las primeras letras de los apellidos del socio en la puerta.'],
        'table'
      );

    } else if (roleType === 'FISCALIZADOR') {
      writeSection(
        'Panel y Dashboard', 
        'Vista de métricas operativas del desempeño de Tesoreria y Directiva de Operaciones.',
        ['Supervisar la recaudación en tiempo real (ingresos vs. egresos).', 'Revisar la alerta de desconexiones pendientes por acumulación.', 'Visualizar evolución mes a mensual en gráficos de barra.'],
        'dashboard'
      );
      writeSection(
        'Auditoría y Reportes (Finanzas)', 
        'Extractos y comprobantes consolidados de cada mes emitidos por el secretario.',
        ['Navegar a la pestaña "Finanzas".', 'Generar Exportación a "Excel" del flujo de caja, o presionar "Exportar a PDF" para imprimir extracto certificado del registro de actividades.', 'Comparar lecturas y cobros para verificar validez y exactitud de información guardada.'],
        'table'
      );
    }

    doc.save(`Manual_Paccha_${roleType}.pdf`);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold leading-7 text-slate-100 sm:truncate sm:text-3xl sm:tracking-tight flex items-center">
            <Settings className="h-8 w-8 mr-3 text-blue-500" />
            Configuración del Sistema
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Administre las tarifas, multas y costos operativos generales.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700/50">
                <h3 className="text-lg font-medium text-slate-200 mb-4 border-b border-slate-700 pb-2">Tarifas de Consumo (S/ por kWh)</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300">Costo para Socios</label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-slate-500 sm:text-sm">S/</span>
                      </div>
                      <input 
                        type="number" 
                        name="costoSocio"
                        step="0.01"
                        min="0"
                        value={formData.costoSocio} 
                        onChange={handleChange} 
                        className="block w-full pl-8 bg-[#0B0E14] border border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-slate-100" 
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300">Costo para Demás Clientes (Usuarios)</label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-slate-500 sm:text-sm">S/</span>
                      </div>
                      <input 
                        type="number" 
                        name="costoUsuario"
                        step="0.01"
                        min="0"
                        value={formData.costoUsuario} 
                        onChange={handleChange} 
                        className="block w-full pl-8 bg-[#0B0E14] border border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-slate-100" 
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300">Costo para Suministro Trifásico</label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-slate-500 sm:text-sm">S/</span>
                      </div>
                      <input 
                        type="number" 
                        name="costoTrifasico"
                        step="0.01"
                        min="0"
                        value={formData.costoTrifasico} 
                        onChange={handleChange} 
                        className="block w-full pl-8 bg-[#0B0E14] border border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-slate-100" 
                      />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Deje en 0 para no aplicar tarifa especial.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300">Consumo Mínimo (Monto a pagar)</label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-slate-500 sm:text-sm">S/</span>
                      </div>
                      <input 
                        type="number" 
                        name="consumoMinimo"
                        step="0.01"
                        min="0"
                        value={formData.consumoMinimo} 
                        onChange={handleChange} 
                        className="block w-full pl-8 bg-[#0B0E14] border border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-slate-100" 
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700/50">
                <h3 className="text-lg font-medium text-slate-200 mb-4 border-b border-slate-700 pb-2">Multas y Otros Pagos</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300">Multa por Inasistencia a Reuniones</label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-slate-500 sm:text-sm">S/</span>
                      </div>
                      <input 
                        type="number" 
                        name="multaReunion"
                        step="1"
                        min="0"
                        value={formData.multaReunion} 
                        onChange={handleChange} 
                        className="block w-full pl-8 bg-[#0B0E14] border border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-slate-100" 
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300">Pago por Reconexión</label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-slate-500 sm:text-sm">S/</span>
                      </div>
                      <input 
                        type="number" 
                        name="costoReconexion"
                        step="1"
                        min="0"
                        value={formData.costoReconexion} 
                        onChange={handleChange} 
                        className="block w-full pl-8 bg-[#0B0E14] border border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-slate-100" 
                      />
                    </div>
                  </div>
                </div>
              </div>

            </div>

            <div className="flex justify-end pt-4 border-t border-slate-800">
              {userRole !== 'FISCALIZADOR' && userRole !== 'OPERATOR' && (
                <Button type="submit">
                  <Save className="w-4 h-4 mr-2" />
                  Guardar Configuración
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <form onSubmit={handlePasswordChange} className="space-y-6">
            <h3 className="text-lg font-medium text-slate-200 border-b border-slate-700 pb-2 flex items-center">
              <KeyRound className="w-5 h-5 mr-2 text-slate-400" />
              Cambiar mi Contraseña
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-300">Contraseña Actual</label>
                <div className="mt-1">
                  <input 
                    type="password"
                    required
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                    className="block w-full max-w-md bg-[#0B0E14] border border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-slate-100 placeholder-slate-500" 
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">Nueva Contraseña</label>
                <div className="mt-1">
                  <input 
                    type="password"
                    required
                    minLength={6}
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                    className="block w-full bg-[#0B0E14] border border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-slate-100 placeholder-slate-500" 
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
                <p className="mt-1 text-xs text-slate-400">Debe incluir mayúscula, minúscula, número y carácter especial (@$!%*?&).</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">Confirmar Contraseña</label>
                <div className="mt-1">
                  <input 
                    type="password"
                    required
                    minLength={6}
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    className="block w-full bg-[#0B0E14] border border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-slate-100 placeholder-slate-500" 
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end pt-4 border-t border-slate-800">
              <Button type="submit" className="bg-slate-700 hover:bg-slate-600 text-white border-0">
                Actualizar Contraseña
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-6">
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-slate-200 border-b border-slate-700 pb-2 flex items-center">
              <Database className="w-5 h-5 mr-2 text-slate-400" />
              Respaldo y Recuperación (Backups)
            </h3>
            <p className="text-sm text-slate-400">
              Crea copias de seguridad de toda la información del sistema (clientes, consumos, multas, configuración). Guárdalas en un lugar seguro.
            </p>
            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
              <Button type="button" onClick={handleExportBackup} variant="outline" className="text-blue-400 border-blue-500/30 hover:bg-blue-500/10">
                Descargar Copia de Seguridad
              </Button>
              
              <input 
                type="file" 
                ref={backupInputRef} 
                onChange={handleImportBackup} 
                className="hidden" 
                accept=".json" 
              />
              <Button type="button" variant="danger" onClick={() => backupInputRef.current?.click()}>
                Restaurar desde Respaldo
              </Button>
            </div>
            <p className="text-xs text-red-400 mt-2">
              <strong>Atención:</strong> Restaurar una base de datos sobrescribirá toda la información actual y no se podrá deshacer.
            </p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-6">
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-slate-200 border-b border-slate-700 pb-2 flex items-center">
              <BookOpen className="w-5 h-5 mr-2 text-slate-400" />
              Manuales de Usuario y Capacitación
            </h3>
            <p className="text-sm text-slate-400">
              Descargue los manuales detallados de uso del sistema según el rol del usuario, incluye descripciones de módulos e imágenes de referencia.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <Button type="button" onClick={() => handleDownloadManual('ADMIN')} variant="outline" className="text-slate-300 border-slate-700 hover:bg-slate-800 flex justify-center">
                <Download className="w-4 h-4 mr-2" /> Manual Admin
              </Button>
              <Button type="button" onClick={() => handleDownloadManual('TESORERO')} variant="outline" className="text-slate-300 border-slate-700 hover:bg-slate-800 flex justify-center">
                <Download className="w-4 h-4 mr-2" /> Manual Tesorero
              </Button>
              <Button type="button" onClick={() => handleDownloadManual('OPERATOR')} variant="outline" className="text-slate-300 border-slate-700 hover:bg-slate-800 flex justify-center">
                <Download className="w-4 h-4 mr-2" /> Manual Operador
              </Button>
              <Button type="button" onClick={() => handleDownloadManual('FISCALIZADOR')} variant="outline" className="text-slate-300 border-slate-700 hover:bg-slate-800 flex justify-center">
                <Download className="w-4 h-4 mr-2" /> Manual Fiscalizador
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
