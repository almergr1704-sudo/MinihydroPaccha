import React, { useState, useEffect } from 'react';
import { Zap } from 'lucide-react';
import { useAppContext } from '../store/AppContext';
import { useNavigate } from 'react-router-dom';
import CryptoJS from 'crypto-js';

export default function Login() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { user, loadingAuth, login } = useAppContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !loadingAuth) {
      navigate('/');
    }
  }, [user, loadingAuth, navigate]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    try {
      setLoading(true);
      setError('');
      
      // Local setup for Admin / Admin
      if (email.toLowerCase() === 'admin' && password.toLowerCase() === 'admin') {
        login('admin@paccha.local');
        return;
      }
      
      // Check local configuration
      const storedData = JSON.parse(localStorage.getItem('erp_data') || '{"admins":[]}');
      const admins = storedData.admins || [];
      const userMatched = admins.find((a: any) => 
        (a.username?.toLowerCase() === email.toLowerCase() || a.email?.toLowerCase() === email.toLowerCase()) && 
        (a.password === password || a.password === CryptoJS.SHA256(password).toString())
      );

      if (userMatched) {
        // Log in with matched user using email or username
        login(userMatched.email || userMatched.username);
        return;
      }

      setError('Para usuario local usa "admin" y contraseña "admin".');
      setLoading(false);
    } catch (err: any) {
      console.error("Login attempt failed:", err);
      setError('Credenciales incorrectas o error al iniciar sesión.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="bg-blue-600 p-3 rounded-lg shadow-lg">
            <Zap className="h-10 w-10 text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-100">
          MiniHydro PACCHA
        </h2>
        <p className="mt-2 text-center text-sm text-slate-400">
          Gestión de Central Hidroeléctrica (Modo Local)
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-[#0B0E14] py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-slate-800">
          <form className="space-y-6" onSubmit={handleEmailLogin}>
            <div>
              <label className="block text-sm font-medium text-slate-300">Usuario o Correo Electrónico</label>
              <input
                type="text"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="mt-1 block w-full border border-slate-700 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-[#0B0E14] text-slate-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300">Contraseña</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="mt-1 block w-full border border-slate-700 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-[#0B0E14] text-slate-100"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Iniciando sesión...' : 'Ingresar'}
            </button>
            {error && (
              <div className="text-red-500 text-sm text-center bg-red-900/20 p-3 rounded">
                {error}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
