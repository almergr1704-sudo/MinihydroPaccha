import React, { useMemo } from 'react';
import { Users, Zap, Search, Activity, ArrowUpRight, ArrowDownRight, UsersRound, FileWarning, WalletCards } from 'lucide-react';
import { useAppContext } from '../store/AppContext';
import { Card, CardContent, CardHeader, CardTitle, Badge } from '../components/ui';
import { formatCurrency } from '../lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function Dashboard() {
  const { clients, consumptions, transactions, fines } = useAppContext();

  // Metrics calculations
  const totalSocios = clients.filter(c => c.tipo === 'SOCIO').length;
  const totalUsuarios = clients.filter(c => c.tipo === 'USUARIO').length;
  
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  
  const ingresosMes = transactions
    .filter(t => t.tipo === 'INGRESO' && t.fecha.startsWith(currentMonth))
    .reduce((sum, t) => sum + t.monto, 0);
    
  const egresosMes = transactions
    .filter(t => t.tipo === 'EGRESO' && t.fecha.startsWith(currentMonth))
    .reduce((sum, t) => sum + t.monto, 0);

  const balance = ingresosMes - egresosMes;

  const consumoTotalMes = consumptions
    .filter(c => c.mes === currentMonth)
    .reduce((sum, c) => sum + c.kwh, 0);

  const pendingDebtsConsumptions = consumptions.filter(c => c.estadoPago === 'PENDIENTE').map(c => ({...c, type: 'CONSUMO' as const}));
  const pendingDebtsFines = (fines || []).filter(c => c.estadoPago === 'PENDIENTE').map(f => ({...f, type: 'MULTA' as const, montoCalculado: f.monto, kwh: null, mes: f.fecha.split('-').slice(0,2).join('-')}));
  
  const pendingDebts = [...pendingDebtsConsumptions, ...pendingDebtsFines].sort((a,b) => new Date(b.mes).getTime() - new Date(a.mes).getTime());

  const aptForCutClientsCount = clients.filter(c => 
    c.estado !== 'CORTADO' && 
    consumptions.filter(cons => cons.clientId === c.id && cons.estadoPago === 'PENDIENTE').length >= 3
  ).length;

  // Multi-month chart data (mocking a bit or calculating if we have data)
  // Grouping transactions by month
  const chartData = useMemo(() => {
    const monthlyData: Record<string, { name: string; ingresos: number; egresos: number }> = {};
    
    // Initialize last 6 months
    for(let i=5; i>=0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const m = d.toISOString().slice(0, 7); // YYYY-MM
      monthlyData[m] = { name: m, ingresos: 0, egresos: 0 };
    }

    transactions.forEach(t => {
      const m = t.fecha.slice(0, 7);
      if (monthlyData[m]) {
        if (t.tipo === 'INGRESO') monthlyData[m].ingresos += t.monto;
        if (t.tipo === 'EGRESO') monthlyData[m].egresos += t.monto;
      }
    });

    return Object.values(monthlyData);
  }, [transactions]);


  return (
    <div className="space-y-6">
      <div className="md:flex md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold leading-7 text-slate-100 sm:truncate sm:text-3xl sm:tracking-tight">
            Panel Principal
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Resumen estadístico del periodo {currentMonth}
          </p>
        </div>
      </div>

      {aptForCutClientsCount > 0 && (
        <div className="bg-red-500/10 border-l-4 border-red-500 p-4 rounded-md flex items-start gap-4">
          <FileWarning className="h-6 w-6 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-red-400">Atención Requerida</h3>
            <p className="text-sm text-red-300 mt-1">
              Hay {aptForCutClientsCount} {aptForCutClientsCount === 1 ? 'cliente' : 'clientes'} con 3 o más deudas pendientes. Sus servicios están aptos para corte. Revise la sección de Clientes para marcarlos en corte.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5 flex items-center">
            <div className="flex-shrink-0 bg-blue-500/10 rounded-md p-3">
              <UsersRound className="h-6 w-6 text-blue-500" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-slate-400 truncate">Total Clientes</dt>
                <dd>
                  <div className="text-lg font-medium text-slate-100">{clients.length}</div>
                  <div className="text-xs text-slate-400">{totalSocios} Socios | {totalUsuarios} Usr.</div>
                </dd>
              </dl>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center">
            <div className="flex-shrink-0 bg-emerald-500/10 rounded-md p-3">
              <ArrowUpRight className="h-6 w-6 text-emerald-500" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-slate-400 truncate">Ingresos Mes</dt>
                <dd className="text-lg font-medium text-slate-100">
                  {formatCurrency(ingresosMes)}
                </dd>
              </dl>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center">
            <div className="flex-shrink-0 bg-red-500/10 rounded-md p-3">
              <ArrowDownRight className="h-6 w-6 text-red-500" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-slate-400 truncate">Egresos Mes</dt>
                <dd className="text-lg font-medium text-slate-100">
                  {formatCurrency(egresosMes)}
                </dd>
              </dl>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center">
            <div className="flex-shrink-0 bg-amber-500/10 rounded-md p-3">
              <Zap className="h-6 w-6 text-amber-500" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-slate-400 truncate">Consumo Energía (Mes)</dt>
                <dd className="text-lg font-medium text-slate-100">
                  {consumoTotalMes} kWh
                </dd>
              </dl>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Flujo Financiero (Últimos 6 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 12 }} tickFormatter={(val) => `S/ ${val}`} />
                  <Tooltip 
                    formatter={(value) => formatCurrency(value as number)}
                    cursor={{ fill: '#1E293B' }}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#0F172A', color: '#E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3)' }}
                  />
                  <Legend iconType="circle" />
                  <Bar dataKey="ingresos" name="Ingresos" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="egresos" name="Egresos" fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1 border-red-500/20">
          <CardHeader className="bg-red-500/5 border-b border-red-500/10 flex justify-between items-center">
            <div className="flex items-center">
               <FileWarning className="w-5 h-5 text-red-500 mr-2" />
               <CardTitle className="text-red-400">Deudas Pendientes de Cobro</CardTitle>
            </div>
            <Badge variant="danger">{pendingDebts.length} recibos</Badge>
          </CardHeader>
          <CardContent className="p-0">
             {pendingDebts.length > 0 ? (
                <ul className="divide-y divide-slate-800 h-72 overflow-y-auto">
                  {pendingDebts.slice(0, 5).map(debt => {
                    const client = clients.find(c => c.id === debt.clientId);
                    return (
                      <li key={debt.id} className="p-4 hover:bg-slate-800/50 flex justify-between items-center">
                        <div>
                          <p className="text-sm font-medium text-slate-100">{client?.nombres ? `${client.nombres} ${client.apellidos}` : client?.nombre || 'Desconocido'}</p>
                          <p className="text-xs text-slate-400">Periodo/Fecha: {debt.mes}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-red-400">{formatCurrency(debt.montoCalculado)}</p>
                          <p className="text-xs text-slate-400">{debt.type === 'CONSUMO' ? `${debt.kwh} kWh` : debt.motivo} ({client?.tipo})</p>
                        </div>
                      </li>
                    )
                  })}
                  {pendingDebts.length > 5 && (
                    <li className="p-3 text-center border-t">
                      <a href="/consumo" className="text-sm font-medium text-blue-600 hover:text-blue-500">Ver todas las deudas ({pendingDebts.length - 5} más)</a>
                    </li>
                  )}
                </ul>
             ) : (
                <div className="h-72 flex flex-col justify-center items-center text-slate-400">
                   <WalletCards className="h-10 w-10 text-slate-600 mb-2" />
                   <p>No hay deudas pendientes</p>
                </div>
             )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
