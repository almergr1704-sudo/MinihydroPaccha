import React, { useState, useMemo } from 'react';
import { Download, FileText, TrendingUp, Users, Calendar } from 'lucide-react';
import { useAppContext } from '../store/AppContext';
import { Card, CardContent, CardHeader, CardTitle, Button } from '../components/ui';
import { formatCurrency } from '../lib/utils';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function Reportes() {
  const { clients, transactions, consumptions } = useAppContext();

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (!t.fecha) return true;
      const tDate = t.fecha.split('T')[0];
      if (startDate && tDate < startDate) return false;
      if (endDate && tDate > endDate) return false;
      return true;
    });
  }, [transactions, startDate, endDate]);

  // Ingresos por categoría
  const ingresosPorCategoria = filteredTransactions
    .filter(t => t.tipo === 'INGRESO')
    .reduce((acc, t) => {
      acc[t.categoria] = (acc[t.categoria] || 0) + t.monto;
      return acc;
    }, {} as Record<string, number>);

  const pieDataIngresos = Object.keys(ingresosPorCategoria).map(key => ({
    name: key,
    value: ingresosPorCategoria[key]
  }));

  // Egresos por categoría
  const egresosPorCategoria = filteredTransactions
    .filter(t => t.tipo === 'EGRESO')
    .reduce((acc, t) => {
      acc[t.categoria] = (acc[t.categoria] || 0) + t.monto;
      return acc;
    }, {} as Record<string, number>);

  const pieDataEgresos = Object.keys(egresosPorCategoria).map(key => ({
    name: key,
    value: egresosPorCategoria[key]
  }));

  const pendingDebts = consumptions.filter(c => c.estadoPago === 'PENDIENTE');

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold leading-7 text-slate-100 sm:truncate sm:text-3xl sm:tracking-tight">
            Reportes y Estadísticas
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Análisis financiero y de recaudación.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex space-x-3">
          <Button variant="outline">
            <FileText className="-ml-1 mr-2 h-5 w-5" />
            Exportar PDF
          </Button>
          <Button>
            <Download className="-ml-1 mr-2 h-5 w-5" />
            Exportar Excel
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 bg-slate-800/30 border-b border-slate-800 flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Fecha Inicio</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Calendar className="h-4 w-4 text-slate-500" />
              </div>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-slate-700 rounded-md bg-[#0B0E14] text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Fecha Fin</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Calendar className="h-4 w-4 text-slate-500" />
              </div>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-slate-700 rounded-md bg-[#0B0E14] text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
              />
            </div>
          </div>
          {(startDate || endDate) && (
            <Button variant="outline" onClick={() => { setStartDate(''); setEndDate(''); }}>
              Limpiar Filtros
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Distribución de Ingresos</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            {pieDataIngresos.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieDataIngresos}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {pieDataIngresos.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value) => formatCurrency(value as number)}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#0F172A', color: '#E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3)' }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
                <div className="h-64 flex items-center justify-center text-slate-500">
                    Sin datos de ingresos
                </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribución de Egresos</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            {pieDataEgresos.length > 0 ? (
               <div className="h-64 w-full">
                 <ResponsiveContainer width="100%" height="100%">
                   <PieChart>
                     <Pie
                       data={pieDataEgresos}
                       cx="50%"
                       cy="50%"
                       labelLine={false}
                       outerRadius={80}
                       fill="#8884d8"
                       dataKey="value"
                       label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                     >
                       {pieDataEgresos.map((entry, index) => (
                         <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                       ))}
                     </Pie>
                     <Tooltip 
                       formatter={(value) => formatCurrency(value as number)}
                       contentStyle={{ borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#0F172A', color: '#E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3)' }}
                     />
                     <Legend />
                   </PieChart>
                 </ResponsiveContainer>
               </div>
            ) : (
                 <div className="h-64 flex items-center justify-center text-slate-500">
                     Sin datos de egresos
                 </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resumen de Morosidad</CardTitle>
        </CardHeader>
        <CardContent>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <div className="bg-red-500/10 p-4 rounded-xl border border-red-500/20">
                     <p className="text-sm font-medium text-red-400">Recibos Vencidos</p>
                     <p className="text-2xl font-bold text-red-300 mt-1">{pendingDebts.length}</p>
                 </div>
                 <div className="bg-red-500/10 p-4 rounded-xl border border-red-500/20">
                     <p className="text-sm font-medium text-red-400">Monto Total en Deuda</p>
                     <p className="text-2xl font-bold text-red-300 mt-1">
                         {formatCurrency(pendingDebts.reduce((sum, d) => sum + d.montoCalculado, 0))}
                     </p>
                 </div>
                 <div className="bg-blue-500/10 p-4 rounded-xl border border-blue-500/20">
                     <p className="text-sm font-medium text-blue-400">Índice de Morosidad</p>
                     <p className="text-2xl font-bold text-blue-300 mt-1">
                         {consumptions.length > 0 ? ((pendingDebts.length / consumptions.length) * 100).toFixed(1) : 0}%
                     </p>
                 </div>
             </div>
        </CardContent>
      </Card>
    </div>
  );
}
