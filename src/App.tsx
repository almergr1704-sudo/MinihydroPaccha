import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useAppContext } from './store/AppContext';
import { AppLayout } from './components/layout/AppLayout';

import Dashboard from './pages/Dashboard';
import Clientes from './pages/Clientes';
import Consumo from './pages/Consumo';
import Finanzas from './pages/Finanzas';
import Reuniones from './pages/Reuniones';
import Reportes from './pages/Reportes';
import Usuarios from './pages/Usuarios';
import Login from './pages/Login';

const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const { user, loadingAuth } = useAppContext();
  
  if (loadingAuth) {
    return <div className="h-screen flex items-center justify-center bg-slate-900 text-white">Cargando...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<AuthGuard><AppLayout /></AuthGuard>}>
            <Route index element={<Dashboard />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="consumo" element={<Consumo />} />
            <Route path="finanzas" element={<Finanzas />} />
            <Route path="reuniones" element={<Reuniones />} />
            <Route path="reportes" element={<Reportes />} />
            <Route path="usuarios" element={<Usuarios />} />
            <Route path="*" element={
              <div className="flex flex-col items-center justify-center h-full">
                <h2 className="text-2xl font-bold text-slate-100">Módulo no encontrado</h2>
                <p className="text-slate-400 mt-2">La ruta solicitada no existe.</p>
              </div>
            } />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
