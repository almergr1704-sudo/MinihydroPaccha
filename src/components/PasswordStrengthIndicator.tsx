import React from 'react';
import { Shield, ShieldAlert, ShieldCheck, Info } from 'lucide-react';

export function evaluatePasswordStrength(password: string): {
  score: number;
  label: string;
  color: string;
  recommendations: string[];
} {
  let score = 0;
  const recommendations: string[] = [];

  if (!password) {
    return { score: 0, label: 'Ninguna', color: 'bg-slate-700', recommendations: [] };
  }

  // Length check
  if (password.length >= 8) {
    score += 1;
  } else {
    recommendations.push('Usa al menos 8 caracteres mínimos.');
  }

  // Cases check
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) {
    score += 1;
  } else {
    recommendations.push('Combina letras mayúsculas y minúsculas.');
  }

  // Numbers check
  if (/[0-9]/.test(password)) {
    score += 1;
  } else {
    recommendations.push('Incluye al menos un número numérico.');
  }

  // Special chars check
  if (/[^A-Za-z0-9]/.test(password)) {
    score += 1;
  } else {
    recommendations.push('Usa caracteres especiales (ej. !@#$%).');
  }

  let label = 'Débil';
  let color = 'bg-red-500';

  if (score === 2) {
    label = 'Media';
    color = 'bg-yellow-500';
  } else if (score === 3) {
    label = 'Segura';
    color = 'bg-blue-500';
  } else if (score === 4) {
    label = 'Muy segura';
    color = 'bg-emerald-500';
  }

  return { score, label, color, recommendations };
}

interface Props {
  password?: string;
  className?: string;
}

export function PasswordStrengthIndicator({ passwordStr, className = '' }: { passwordStr: string, className?: string }) {
  if (!passwordStr) return null;
  
  const { score, label, color, recommendations } = evaluatePasswordStrength(passwordStr);
  
  return (
    <div className={`mt-2 ${className}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-slate-400">Seguridad de la contraseña:</span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          score <= 1 ? 'bg-red-500/10 text-red-500' : 
          score === 2 ? 'bg-yellow-500/10 text-yellow-500' : 
          score === 3 ? 'bg-blue-500/10 text-blue-500' : 
          'bg-emerald-500/10 text-emerald-500'
        }`}>
          {label}
        </span>
      </div>
      <div className="w-full bg-slate-800 rounded-full h-1.5 mb-2 overflow-hidden flex">
        <div className={`h-1.5 transition-all duration-300 ${color}`} style={{ width: `${(Math.max(1, score) / 4) * 100}%` }}></div>
      </div>
      
      {recommendations.length > 0 && (
        <div className="bg-slate-800/50 rounded p-2 text-xs text-slate-400 space-y-1">
          <p className="flex items-center text-slate-300 font-medium mb-1"><Info className="w-3 h-3 mr-1" /> Recomendaciones:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            {recommendations.map((rec, i) => (
              <li key={i}>{rec}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
