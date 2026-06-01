import React, { useState, useEffect } from 'react';
import { Zap } from 'lucide-react';
import { useAppContext } from '../store/AppContext';
import { useNavigate } from 'react-router-dom';
import bcrypt from 'bcryptjs';

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
      
      const emailLower = email.toLowerCase();
      const loginAttemptsStr = localStorage.getItem('erp_login_attempts') || '{}';
      const loginAttempts = JSON.parse(loginAttemptsStr);
      
      const userAttemptInfo = loginAttempts[emailLower] || { count: 0, lockedUntil: null };
      
      if (userAttemptInfo.lockedUntil && Date.now() < userAttemptInfo.lockedUntil) {
        const remainingMinutes = Math.ceil((userAttemptInfo.lockedUntil - Date.now()) / 60000);
        setError(`Cuenta bloqueada temporalmente por demasiados intentos fallidos. Intente nuevamente en ${remainingMinutes} minuto(s).`);
        setLoading(false);
        return;
      }
      
      // Check local configuration
      const storedData = JSON.parse(localStorage.getItem('erp_data') || '{"admins":[]}');
      const admins = storedData.admins || [];
      const userMatched = admins.find((a: any) => {
        const isEmailMatch = a.username?.toLowerCase() === emailLower || a.email?.toLowerCase() === emailLower;
        if (!isEmailMatch) return false;
        
        // Ensure backward compatibility with sha256 or plain fallback if not bcrypt
        try {
          return bcrypt.compareSync(password, a.password) || a.password === password;
        } catch (e) {
           return a.password === password; // fallback
        }
      });

      if (userMatched) {
        if (userMatched.estado === 'INACTIVO') {
          setError('El usuario se encuentra inactivo. Consulte con un administrador.');
          setLoading(false);
          return;
        }
        
        // Reset attempts on successful log in
        loginAttempts[emailLower] = { count: 0, lockedUntil: null };
        localStorage.setItem('erp_login_attempts', JSON.stringify(loginAttempts));
        
        // Log in with matched user using email or username
        login(userMatched.email || userMatched.username);
        return;
      }

      // Handle failed attempt
      userAttemptInfo.count = (userAttemptInfo.count || 0) + 1;
      let errorMsg = 'Credenciales incorrectas.';
      
      if (userAttemptInfo.count >= 5) {
        userAttemptInfo.lockedUntil = Date.now() + 15 * 60 * 1000; // Lock for 15 minutes
        errorMsg = 'Cuenta bloqueada temporalmente por demasiados intentos fallidos. Intente nuevamente en 15 minutos.';
      } else if (userAttemptInfo.count >= 3) {
        errorMsg = `Credenciales incorrectas. Le quedan ${5 - userAttemptInfo.count} intentos antes de ser bloqueado.`;
      }
      
      loginAttempts[emailLower] = userAttemptInfo;
      localStorage.setItem('erp_login_attempts', JSON.stringify(loginAttempts));

      setError(errorMsg);
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
