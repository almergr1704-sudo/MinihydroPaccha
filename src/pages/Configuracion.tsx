import React, { useState, useEffect } from 'react';
import { Settings, Save } from 'lucide-react';
import { useAppContext } from '../store/AppContext';
import { Card, CardContent, CardTitle, Button } from '../components/ui';

export default function Configuracion() {
  const { settings, updateSettings, userRole } = useAppContext();
  const [formData, setFormData] = useState({
    costoSocio: 0.20,
    costoUsuario: 0.30,
    costoTrifasico: 0.00,
    multaReunion: 40,
    costoReconexion: 0.00
  });

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (userRole === 'LECTURISTA') {
      alert('No tiene permisos para modificar la configuración.');
      return;
    }
    updateSettings(formData);
    alert('Configuración guardada correctamente.');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
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
              <Button type="submit" disabled={userRole === 'LECTURISTA'}>
                <Save className="w-4 h-4 mr-2" />
                Guardar Configuración
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
