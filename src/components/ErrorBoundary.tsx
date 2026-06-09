import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, Home } from 'lucide-react';
import { Button } from './ui';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error in component tree:", error, errorInfo);
    // @ts-ignore
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    // @ts-ignore
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  }

  public render() {
    // @ts-ignore
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center bg-[#0B0E14] text-slate-200">
          <div className="bg-red-500/10 p-4 rounded-full mb-6 border border-red-500/20">
            <AlertTriangle className="w-12 h-12 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Algo salió mal</h1>
          <p className="text-slate-400 max-w-md mb-6">
            Ocurrió un error inesperado al cargar este módulo. Por favor, intente recargar o vuelva al inicio.
          </p>
          
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 max-w-3xl w-full mb-8 overflow-auto text-left">
            <p className="font-mono text-sm text-red-400 mb-2 truncate">
              {/* @ts-ignore */}
              {this.state.error?.message || 'Error desconocido'}
            </p>
          </div>

          <Button onClick={this.handleReset} className="flex items-center gap-2">
            <Home className="w-4 h-4" />
            Volver al Inicio
          </Button>
        </div>
      );
    }

    // @ts-ignore
    return this.props.children;
  }
}
