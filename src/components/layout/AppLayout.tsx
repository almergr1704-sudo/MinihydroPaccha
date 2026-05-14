import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { 
  Menu, X, Home, Users, Zap, DollarSign, Calendar, Settings, FileText, Activity, LogOut
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAppContext } from '../../store/AppContext';

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Socios & Usuarios', href: '/clientes', icon: Users },
  { name: 'Consumo & Facturación', href: '/consumo', icon: Zap },
  { name: 'Finanzas', href: '/finanzas', icon: DollarSign },
  { name: 'Reuniones', href: '/reuniones', icon: Calendar },
  { name: 'Reportes', href: '/reportes', icon: FileText },
  { name: 'Usuarios del Sist.', href: '/usuarios', icon: Settings },
];

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAppContext();

  const handleLogout = () => {
    logout();
  }

  const userInitial = user?.email ? user.email.charAt(0).toUpperCase() : 'U';

  return (
    <div className="h-screen flex overflow-hidden bg-[#0B0E14] font-sans">
      {/* Mobile sidebar */}
      <div className={cn("fixed inset-0 flex z-40 lg:hidden", sidebarOpen ? "visible" : "invisible")}>
        <div 
          className={cn("fixed inset-0 bg-gray-600 bg-opacity-75 transition-opacity duration-300 ease-linear", sidebarOpen ? "opacity-100" : "opacity-0")}
          onClick={() => setSidebarOpen(false)}
        />
        
        <div className={cn("relative flex-1 flex flex-col max-w-xs w-full bg-[#0B0E14] border-r border-slate-800 transition ease-in-out duration-300 transform", sidebarOpen ? "translate-x-0" : "-translate-x-full")}>
          <div className="absolute top-0 right-0 -mr-12 pt-2">
            <button
              className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
              onClick={() => setSidebarOpen(false)}
            >
              <span className="sr-only">Close sidebar</span>
              <X className="h-6 w-6 text-white" aria-hidden="true" />
            </button>
          </div>
          <div className="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
            <div className="flex-shrink-0 flex items-center px-4">
              <Activity className="h-8 w-8 text-blue-500 mr-2" />
              <span className="text-2xl font-bold text-white tracking-tight">Mini<span className="text-blue-500">Hydro</span></span>
            </div>
            <nav className="mt-8 px-2 space-y-1">
              {navigation.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={({ isActive }) => cn(
                    isActive ? 'bg-blue-500/20 text-blue-500 border-l-4 border-blue-500 pl-1 rounded-r-lg' : 'text-slate-300 hover:bg-blue-500/10 hover:text-blue-500 border-l-4 border-transparent pl-1 rounded-lg',
                    'group flex items-center px-2 py-2 text-base font-medium transition-colors'
                  )}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className={cn(
                    "mr-4 flex-shrink-0 h-6 w-6 transition-colors group-hover:text-blue-500",
                  )} aria-hidden="true" />
                  {item.name}
                </NavLink>
              ))}
              <div className="mt-8 px-2 border-t border-slate-800 pt-4">
                <button
                  onClick={handleLogout}
                  className="w-full text-left text-slate-300 hover:bg-slate-800 hover:text-white group flex items-center px-2 py-2 text-base font-medium transition-colors rounded-lg"
                >
                  <LogOut className="mr-4 flex-shrink-0 h-6 w-6 transition-colors group-hover:text-white" />
                  Cerrar Sesión
                </button>
              </div>
            </nav>
          </div>
        </div>
        <div className="flex-shrink-0 w-14" aria-hidden="true"></div>
      </div>

      {/* Static sidebar for desktop */}
      <div className="hidden lg:flex lg:flex-shrink-0">
        <div className="flex flex-col w-64">
          <div className="flex-1 flex flex-col min-h-0 bg-[#0B0E14] border-r border-slate-800">
            <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
              <div className="flex items-center flex-shrink-0 px-6 mb-8">
                <Activity className="h-8 w-8 text-blue-500 mr-2" />
                <span className="text-2xl font-bold text-white tracking-tight">Mini<span className="text-blue-500">Hydro</span></span>
              </div>
              <nav className="mt-5 flex-1 px-3 space-y-1">
                {navigation.map((item) => (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    className={({ isActive }) => cn(
                      isActive ? 'bg-blue-500/20 text-blue-500 border-l-4 border-blue-500 pl-2 rounded-r-lg' : 'text-slate-300 hover:bg-blue-500/10 hover:text-blue-500 border-l-4 border-transparent pl-2 rounded-lg',
                      'group flex items-center pr-3 py-2.5 text-sm font-medium transition-all duration-200'
                    )}
                  >
                    <item.icon className={cn(
                      "mr-3 flex-shrink-0 h-5 w-5 transition-colors group-hover:text-blue-500",
                    )} aria-hidden="true" />
                    {item.name}
                  </NavLink>
                ))}
              </nav>
            </div>
            <div className="flex-shrink-0 flex flex-col bg-[#0B0E14] border-t border-slate-800 p-4">
              <div className="flex items-center w-full group mb-4">
                <div className="flex items-center">
                  <div>
                    <div className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-blue-600 text-white font-bold">
                      {userInitial}
                    </div>
                  </div>
                  <div className="ml-3 truncate max-w-[150px]">
                    <p className="text-sm font-medium text-white truncate" title={user?.email || 'Usuario'}>{user?.email || 'Admin User'}</p>
                    <p className="text-xs font-medium text-slate-400 group-hover:text-slate-300">Administrador</p>
                  </div>
                </div>
              </div>
              <button 
                onClick={handleLogout}
                className="w-full flex items-center justify-center py-2 px-4 border border-slate-700 rounded-md shadow-sm text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
               >
                 <LogOut className="mr-2 h-4 w-4" />
                 Cerrar Sesión
               </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Column */}
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        <div className="lg:hidden pt-1 pb-1 pr-1 pl-1 bg-[#0B0E14] border-b border-slate-800 sm:pl-3 sm:pt-3 sm:pb-3 flex justify-between items-center shadow-sm z-10">
          <div className="flex items-center px-4">
             <Activity className="h-6 w-6 text-blue-500 mr-2" />
             <span className="text-xl font-bold text-white">Mini<span className="text-blue-500">Hydro</span></span>
          </div>
          <button
            type="button"
            className="-ml-0.5 -mt-0.5 h-12 w-12 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
            onClick={() => setSidebarOpen(true)}
          >
            <span className="sr-only">Open sidebar</span>
            <Menu className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>
        <main className="flex-1 relative z-0 overflow-y-auto focus:outline-none bg-[#0B0E14]">
          <div className="py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto min-h-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
