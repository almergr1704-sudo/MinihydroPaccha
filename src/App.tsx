import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AppProvider, useAppContext } from './store/AppContext';
import { AppLayout } from './components/layout/AppLayout';
import { ConfirmProvider } from './components/ui/ConfirmDialog';

import Dashboard from './pages/Dashboard';
import Clientes from './pages/Clientes';
import Trabajadores from './pages/Trabajadores';
import VentaServicios from './pages/VentaServicios';
import Consumo from './pages/Consumo';
import Finanzas from './pages/Finanzas';
import Reuniones from './pages/Reuniones';
import Reportes from './pages/Reportes';
import Usuarios from './pages/Usuarios';
import Auditoria from './pages/Auditoria';
import Configuracion from './pages/Configuracion';
import Login from './pages/Login';

import { FileText, Download } from 'lucide-react';

const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const { user, loadingAuth, mustChangePassword, logout } = useAppContext();
  const location = useLocation();
  const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

  React.useEffect(() => {
    if (!user) return;

    let lastActivity = Date.now();
    let intervalId: any;

    const resetTimer = () => {
      lastActivity = Date.now();
    };

    const checkInactivity = () => {
      if (Date.now() - lastActivity > INACTIVITY_TIMEOUT_MS) {
        logout();
      }
    };

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => document.addEventListener(event, resetTimer));

    intervalId = setInterval(checkInactivity, 60000); // Check every minute

    return () => {
      events.forEach(event => document.removeEventListener(event, resetTimer));
      clearInterval(intervalId);
    };
  }, [user, logout]);
  
  if (loadingAuth) {
    return <div className="h-screen flex items-center justify-center bg-slate-900 text-white">Cargando...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  if (mustChangePassword && location.pathname !== '/config') {
    return <Navigate to="/config" replace />;
  }
  
  return <>{children}</>;
};

const RoleGuard = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles: string[] }) => {
  const { userRole, mustChangePassword } = useAppContext();
  const location = useLocation();

  if (!allowedRoles.includes(userRole)) {
    let fallbackPath = '/';
    if (userRole === 'OPERATOR') {
      fallbackPath = '/consumo';
    } else if (userRole === 'SECRETARIO') {
      fallbackPath = '/reuniones';
    } else if (userRole === 'VOCAL') {
      fallbackPath = '/reportes';
    }
    return <Navigate to={fallbackPath} replace />;
  }
  return <>{children}</>;
};

const RecibosRedirect = () => {
  const location = useLocation();
  const search = location.search ? `&${location.search.slice(1)}` : '';
  return <Navigate to={`/consumo?tab=recibos${search}`} replace />;
};

export default function App() {
  return (
    <AppProvider>
      <ConfirmProvider>
        <Toaster position="bottom-right" toastOptions={{ className: 'bg-slate-800 text-slate-100 border border-slate-700' }} />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<AuthGuard><AppLayout /></AuthGuard>}>
              <Route index element={<RoleGuard allowedRoles={['ADMIN', 'TESORERO', 'FISCALIZADOR']}><Dashboard /></RoleGuard>} />
              <Route path="clientes" element={<RoleGuard allowedRoles={['ADMIN', 'TESORERO', 'FISCALIZADOR']}><Clientes /></RoleGuard>} />
              <Route path="trabajadores" element={<RoleGuard allowedRoles={['ADMIN', 'TESORERO', 'FISCALIZADOR']}><Trabajadores /></RoleGuard>} />
              <Route path="servicios" element={<RoleGuard allowedRoles={['ADMIN', 'TESORERO', 'FISCALIZADOR']}><VentaServicios /></RoleGuard>} />
              <Route path="consumo" element={<RoleGuard allowedRoles={['ADMIN', 'TESORERO', 'FISCALIZADOR', 'OPERATOR']}><Consumo /></RoleGuard>} />
              <Route path="recibos" element={<RoleGuard allowedRoles={['ADMIN', 'TESORERO', 'FISCALIZADOR']}><RecibosRedirect /></RoleGuard>} />
              <Route path="finanzas" element={<RoleGuard allowedRoles={['ADMIN', 'TESORERO', 'FISCALIZADOR']}><Finanzas /></RoleGuard>} />
              <Route path="reuniones" element={<RoleGuard allowedRoles={['ADMIN', 'TESORERO', 'FISCALIZADOR', 'SECRETARIO']}><Reuniones /></RoleGuard>} />
              <Route path="reportes" element={<RoleGuard allowedRoles={['ADMIN', 'TESORERO', 'FISCALIZADOR', 'VOCAL']}><Reportes /></RoleGuard>} />
              <Route path="usuarios" element={<RoleGuard allowedRoles={['ADMIN', 'FISCALIZADOR']}><Usuarios /></RoleGuard>} />
              <Route path="auditoria" element={<RoleGuard allowedRoles={['ADMIN', 'FISCALIZADOR']}><Auditoria /></RoleGuard>} />
              <Route path="config" element={<RoleGuard allowedRoles={['ADMIN', 'TESORERO', 'FISCALIZADOR', 'OPERATOR', 'SECRETARIO', 'VOCAL']}><Configuracion /></RoleGuard>} />
              <Route path="*" element={
                <div className="flex flex-col items-center justify-center h-full">
                  <h2 className="text-2xl font-bold text-slate-100">Módulo no encontrado</h2>
                  <p className="text-slate-400 mt-2">La ruta solicitada no existe o no tiene permisos para acceder.</p>
                </div>
              } />
            </Route>
          </Routes>
        </BrowserRouter>
      </ConfirmProvider>
    </AppProvider>
  );
}
