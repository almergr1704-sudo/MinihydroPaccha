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
import Configuracion from './pages/Configuracion';
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

const RoleGuard = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles: string[] }) => {
  const { userRole } = useAppContext();
  if (!allowedRoles.includes(userRole)) {
    return <Navigate to={userRole === 'OPERATOR' ? '/consumo' : '/'} replace />;
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
            <Route index element={<RoleGuard allowedRoles={['ADMIN', 'FISCALIZADOR']}><Dashboard /></RoleGuard>} />
            <Route path="clientes" element={<RoleGuard allowedRoles={['ADMIN', 'FISCALIZADOR']}><Clientes /></RoleGuard>} />
            <Route path="consumo" element={<RoleGuard allowedRoles={['ADMIN', 'FISCALIZADOR', 'OPERATOR']}><Consumo /></RoleGuard>} />
            <Route path="finanzas" element={<RoleGuard allowedRoles={['ADMIN', 'FISCALIZADOR']}><Finanzas /></RoleGuard>} />
            <Route path="reuniones" element={<RoleGuard allowedRoles={['ADMIN', 'FISCALIZADOR']}><Reuniones /></RoleGuard>} />
            <Route path="reportes" element={<RoleGuard allowedRoles={['ADMIN', 'FISCALIZADOR']}><Reportes /></RoleGuard>} />
            <Route path="usuarios" element={<RoleGuard allowedRoles={['ADMIN', 'FISCALIZADOR']}><Usuarios /></RoleGuard>} />
            <Route path="config" element={<RoleGuard allowedRoles={['ADMIN', 'FISCALIZADOR']}><Configuracion /></RoleGuard>} />
            <Route path="*" element={
              <div className="flex flex-col items-center justify-center h-full">
                <h2 className="text-2xl font-bold text-slate-100">Módulo no encontrado</h2>
                <p className="text-slate-400 mt-2">La ruta solicitada no existe o no tiene permisos para acceder.</p>
              </div>
            } />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
