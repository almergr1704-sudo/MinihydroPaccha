import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AppProvider, useAppContext } from './store/AppContext';
import { AppLayout } from './components/layout/AppLayout';

import Dashboard from './pages/Dashboard';
import Clientes from './pages/Clientes';
import Consumo from './pages/Consumo';
import Finanzas from './pages/Finanzas';
import Reuniones from './pages/Reuniones';
import Reportes from './pages/Reportes';
import Usuarios from './pages/Usuarios';
import Auditoria from './pages/Auditoria';
import Configuracion from './pages/Configuracion';
import Login from './pages/Login';

import { FileText, Download } from 'lucide-react';
import { PdfViewer } from './components/PdfViewer';

const GlobalPdfPreview = () => {
  const { pdfPreviewUrl, pdfPreviewName, setPdfPreview } = useAppContext();

  if (!pdfPreviewUrl) return null;

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" onClick={() => setPdfPreview(null)}>
          <div className="absolute inset-0 bg-slate-900/75 backdrop-blur-sm"></div>
        </div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

        <div className="inline-block align-bottom bg-[#0B0E14] border border-slate-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle w-full mx-4 sm:max-w-5xl relative z-10 flex flex-col" style={{ height: '90vh', maxHeight: '90vh' }}>
          <div className="px-4 py-3 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 shrink-0">
            <h3 className="text-lg font-medium text-slate-100 flex items-center">
              <FileText className="w-5 h-5 mr-2 text-blue-400" />
              Vista Previa del Documento
            </h3>
            <div className="flex space-x-2">
              <button 
                className="inline-flex items-center px-3 py-1.5 border border-slate-600 rounded-md text-sm font-medium text-slate-200 bg-transparent hover:bg-slate-800"
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = pdfPreviewUrl;
                  link.download = pdfPreviewName || 'documento.pdf';
                  link.click();
                }}
              >
                <Download className="w-4 h-4 mr-2" />
                Descargar
              </button>
              <button 
                className="inline-flex items-center px-3 py-1.5 border border-transparent rounded-md text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700" 
                onClick={() => setPdfPreview(null)}
              >
                Cerrar
              </button>
            </div>
          </div>
          <div className="flex-1 w-full bg-slate-200 relative overflow-hidden">
            <PdfViewer url={pdfPreviewUrl} />
          </div>
        </div>
      </div>
    </div>
  );
};

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
  const { userRole } = useAppContext();
  if (!allowedRoles.includes(userRole)) {
    return <Navigate to={userRole === 'OPERATOR' ? '/consumo' : '/'} replace />;
  }
  return <>{children}</>;
};

export default function App() {
  return (
    <AppProvider>
      <Toaster position="bottom-right" toastOptions={{ className: 'bg-slate-800 text-slate-100 border border-slate-700' }} />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<AuthGuard><AppLayout /></AuthGuard>}>
            <Route index element={<RoleGuard allowedRoles={['ADMIN', 'TESORERO', 'FISCALIZADOR']}><Dashboard /></RoleGuard>} />
            <Route path="clientes" element={<RoleGuard allowedRoles={['ADMIN', 'TESORERO', 'FISCALIZADOR']}><Clientes /></RoleGuard>} />
            <Route path="consumo" element={<RoleGuard allowedRoles={['ADMIN', 'TESORERO', 'FISCALIZADOR', 'OPERATOR']}><Consumo /></RoleGuard>} />
            <Route path="finanzas" element={<RoleGuard allowedRoles={['ADMIN', 'TESORERO', 'FISCALIZADOR']}><Finanzas /></RoleGuard>} />
            <Route path="reuniones" element={<RoleGuard allowedRoles={['ADMIN', 'TESORERO', 'FISCALIZADOR']}><Reuniones /></RoleGuard>} />
            <Route path="reportes" element={<RoleGuard allowedRoles={['ADMIN', 'TESORERO', 'FISCALIZADOR']}><Reportes /></RoleGuard>} />
            <Route path="usuarios" element={<RoleGuard allowedRoles={['ADMIN', 'FISCALIZADOR']}><Usuarios /></RoleGuard>} />
            <Route path="auditoria" element={<RoleGuard allowedRoles={['ADMIN', 'FISCALIZADOR']}><Auditoria /></RoleGuard>} />
            <Route path="config" element={<RoleGuard allowedRoles={['ADMIN', 'TESORERO', 'FISCALIZADOR', 'OPERATOR']}><Configuracion /></RoleGuard>} />
            <Route path="*" element={
              <div className="flex flex-col items-center justify-center h-full">
                <h2 className="text-2xl font-bold text-slate-100">Módulo no encontrado</h2>
                <p className="text-slate-400 mt-2">La ruta solicitada no existe o no tiene permisos para acceder.</p>
              </div>
            } />
          </Route>
        </Routes>
      </BrowserRouter>
      <GlobalPdfPreview />
    </AppProvider>
  );
}
