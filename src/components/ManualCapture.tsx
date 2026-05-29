import React from 'react';
import Dashboard from '../pages/Dashboard';
import Clientes from '../pages/Clientes';
import Consumo from '../pages/Consumo';
import Finanzas from '../pages/Finanzas';
import Reuniones from '../pages/Reuniones';
import Reportes from '../pages/Reportes';
import Usuarios from '../pages/Usuarios';

export default function ManualCapture({ roleType }: { roleType: string }) {
  return (
    <div id="manual-capture-container" style={{ position: 'absolute', top: -20000, left: -20000, width: 1280, height: 10000, background: '#0B0E14', color: 'white', zIndex: -9999, overflow: 'hidden' }}>
      {/* Container is far off-screen so opacity can remain 1 for perfect captures */}
      {['ADMIN', 'TESORERO', 'FISCALIZADOR'].includes(roleType) && (
        <div id="capture-dashboard" className="p-8 mb-8"><Dashboard /></div>
      )}
      {['ADMIN', 'TESORERO', 'FISCALIZADOR'].includes(roleType) && (
        <div id="capture-clientes" className="p-8 mb-8"><Clientes /></div>
      )}
      {['ADMIN', 'TESORERO', 'FISCALIZADOR', 'OPERATOR'].includes(roleType) && (
        <div id="capture-consumo" className="p-8 mb-8"><Consumo /></div>
      )}
      {['ADMIN', 'TESORERO', 'FISCALIZADOR'].includes(roleType) && (
        <div id="capture-finanzas" className="p-8 mb-8"><Finanzas /></div>
      )}
      {['ADMIN', 'TESORERO', 'FISCALIZADOR'].includes(roleType) && (
        <div id="capture-reuniones" className="p-8 mb-8"><Reuniones /></div>
      )}
      {['ADMIN', 'TESORERO', 'FISCALIZADOR'].includes(roleType) && (
        <div id="capture-reportes" className="p-8 mb-8"><Reportes /></div>
      )}
      {['ADMIN'].includes(roleType) && (
        <div id="capture-usuarios" className="p-8 mb-8"><Usuarios /></div>
      )}
    </div>
  );
}
