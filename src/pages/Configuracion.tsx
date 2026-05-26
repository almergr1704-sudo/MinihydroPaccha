import React, { useState, useEffect } from 'react';
import { Settings, Save, KeyRound, Database } from 'lucide-react';
import { useAppContext } from '../store/AppContext';
import { Card, CardContent, CardTitle, Button } from '../components/ui';
import bcrypt from 'bcryptjs';
import { toast } from 'react-hot-toast';

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
    </div>
  );
}
