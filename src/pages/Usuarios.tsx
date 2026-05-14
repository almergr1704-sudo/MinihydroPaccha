import React, { useState } from 'react';
import { Shield, ShieldAlert, UserCheck, Plus, X } from 'lucide-react';
import { useAppContext } from '../store/AppContext';
import { Card, CardContent, Badge, Button } from '../components/ui';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import firebaseConfig from '../../firebase-applet-config.json';

export default function Usuarios() {
  const { admins, updateAdmin, user } = useAppContext();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<'ADMIN' | 'OPERATOR' | 'SUPERVISOR'>('OPERATOR');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newNombres, setNewNombres] = useState('');
  const [newApellidos, setNewApellidos] = useState('');
  const [newDni, setNewDni] = useState('');
  const [newRole, setNewRole] = useState<'ADMIN' | 'OPERATOR' | 'SUPERVISOR'>('OPERATOR');
  const [creatingUser, setCreatingUser] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleUpdateRole = (id: string) => {
    updateAdmin(id, { role: selectedRole });
    setEditingId(null);
  };

  const handleCreateLocalUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newPassword) return;
    
    setCreatingUser(true);
    setErrorMsg('');
    
    let tempApp;
    try {
      tempApp = initializeApp(firebaseConfig, `TempApp-${Date.now()}`);
      const tempAuth = getAuth(tempApp);
      
      const userCredential = await createUserWithEmailAndPassword(tempAuth, newEmail, newPassword);
      
      // Store in admins collection
      await setDoc(doc(db, 'admins', userCredential.user.uid), {
        email: newEmail,
        nombres: newNombres,
        apellidos: newApellidos,
        dni: newDni,
        role: newRole,
        createdAt: serverTimestamp()
      });
      
      setIsModalOpen(false);
      setNewEmail('');
      setNewPassword('');
      setNewNombres('');
      setNewApellidos('');
      setNewDni('');
      setNewRole('OPERATOR');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Error al crear usuario local');
    } finally {
      if (tempApp) {
        await deleteApp(tempApp);
      }
      setCreatingUser(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold leading-7 text-slate-100 sm:truncate sm:text-3xl sm:tracking-tight">
            Usuarios del Sistema
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Administra los perfiles y roles de los usuarios que pueden acceder al sistema.
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <Button onClick={() => setIsModalOpen(true)} className="flex items-center">
            <Plus className="mr-2 h-4 w-4" />
            Crear Usuario Local
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="bg-yellow-500/10 p-4 border-b border-yellow-500/20 flex items-start space-x-3">
             <ShieldAlert className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
             <p className="text-sm text-yellow-200/80">
               Solo los usuarios con rol <strong className="text-yellow-500">ADMIN</strong> pueden modificar los roles del sistema. Un usuario de Google nuevo debe ingresar primero al sistema para aparecer en esta lista.
             </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800">
              <thead className="bg-slate-800/50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Usuario
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Rol Actual
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-[#0B0E14] divide-y divide-slate-800">
                {admins.map((admin) => (
                  <tr key={admin.id} className="hover:bg-slate-800/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-slate-800 flex items-center justify-center rounded-full">
                          <UserCheck className="h-5 w-5 text-slate-400" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-slate-100">
                            {admin.nombres ? `${admin.nombres} ${admin.apellidos}` : admin.email}
                          </div>
                          <div className="text-xs text-slate-400">
                            {admin.nombres ? admin.email : ''} {admin.dni ? `• DNI: ${admin.dni}` : ''}
                          </div>
                          {admin.id === user?.uid && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mt-1">
                              Tú
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingId === admin.id ? (
                        <select
                          value={selectedRole}
                          onChange={(e) => setSelectedRole(e.target.value as any)}
                          className="mt-1 block max-w-[150px] bg-[#0B0E14] text-slate-100 border border-slate-700 rounded-md shadow-sm py-1.5 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        >
                          <option value="ADMIN">Administrador</option>
                          <option value="SUPERVISOR">Supervisor</option>
                          <option value="OPERATOR">Operador</option>
                        </select>
                      ) : (
                        <Badge variant={admin.role === 'ADMIN' ? 'danger' : admin.role === 'SUPERVISOR' ? 'warning' : 'info'}>
                          {admin.role}
                        </Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      {editingId === admin.id ? (
                        <>
                          <Button size="sm" onClick={() => handleUpdateRole(admin.id)}>
                            Guardar
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                            Cancelar
                          </Button>
                        </>
                      ) : (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => {
                            setEditingId(admin.id);
                            setSelectedRole(admin.role);
                          }}
                          disabled={admin.id === user?.uid} // Mismo usuario no se quita permisos solo
                        >
                          Cambiar Rol
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {admins.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-6 py-10 text-center text-slate-400">
                      No hay usuarios registrados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal Crear Usuario */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" onClick={() => setIsModalOpen(false)}>
              <div className="absolute inset-0 bg-slate-900/75 backdrop-blur-sm"></div>
            </div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

            <div className="inline-block align-bottom bg-[#0B0E14] border border-slate-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full relative z-10">
              <div className="px-4 pt-5 pb-4 sm:p-6 sm:pb-4 border-b border-slate-800">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg leading-6 font-medium text-slate-100">Crear Usuario Local</h3>
                  <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                    <span className="sr-only">Cerrar</span>
                    <X className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>
              </div>
              <form onSubmit={handleCreateLocalUser}>
                <div className="px-4 py-5 sm:p-6 space-y-4">
                  
                  {errorMsg && (
                    <div className="p-3 bg-red-900/20 text-red-500 rounded text-sm">
                      {errorMsg}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300">Nombres</label>
                      <input 
                        type="text" 
                        required 
                        value={newNombres} 
                        onChange={e => setNewNombres(e.target.value)} 
                        className="mt-1 block w-full border border-slate-700 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-[#0B0E14] text-slate-100" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300">Apellidos</label>
                      <input 
                        type="text" 
                        required 
                        value={newApellidos} 
                        onChange={e => setNewApellidos(e.target.value)} 
                        className="mt-1 block w-full border border-slate-700 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-[#0B0E14] text-slate-100" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300">DNI</label>
                      <input 
                        type="text" 
                        required 
                        value={newDni} 
                        onChange={e => setNewDni(e.target.value)} 
                        className="mt-1 block w-full border border-slate-700 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-[#0B0E14] text-slate-100" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300">Rol Inicial</label>
                      <select 
                        value={newRole} 
                        onChange={e => setNewRole(e.target.value as any)} 
                        className="mt-1 block w-full border border-slate-700 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-[#0B0E14] text-slate-100"
                      >
                        <option value="OPERATOR">Operador</option>
                        <option value="SUPERVISOR">Supervisor</option>
                        <option value="ADMIN">Administrador</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300">Correo Electrónico</label>
                    <input 
                      type="email" 
                      required 
                      value={newEmail} 
                      onChange={e => setNewEmail(e.target.value)} 
                      className="mt-1 block w-full border border-slate-700 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-[#0B0E14] text-slate-100" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300">Contraseña</label>
                    <input 
                      type="password" 
                      required 
                      minLength={6}
                      value={newPassword} 
                      onChange={e => setNewPassword(e.target.value)} 
                      className="mt-1 block w-full border border-slate-700 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-[#0B0E14] text-slate-100" 
                    />
                    <p className="text-xs text-slate-500 mt-1">Mínimo 6 caracteres.</p>
                  </div>
                </div>
                <div className="px-4 py-3 bg-slate-800/30 sm:px-6 sm:flex sm:flex-row-reverse border-t border-slate-800">
                  <Button type="submit" disabled={creatingUser} className="w-full sm:ml-3 sm:w-auto">
                    {creatingUser ? 'Creando...' : 'Crear Usuario'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="mt-3 w-full sm:mt-0 sm:ml-3 sm:w-auto">
                    Cancelar
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
