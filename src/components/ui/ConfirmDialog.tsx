import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from './index';
import { AlertTriangle, CheckCircle, Info, XCircle, HelpCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

export type ConfirmType = 'success' | 'warning' | 'error' | 'info' | 'confirm' | 'danger';

export interface ConfirmOptions {
  title?: string;
  message: string | ReactNode;
  type?: ConfirmType;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
};

export const ConfirmProvider = ({ children }: { children: ReactNode }) => {
  const [currentConfirm, setCurrentConfirm] = useState<(ConfirmOptions & { resolve: (value: boolean) => void }) | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setCurrentConfirm({ ...options, resolve });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (currentConfirm) {
      currentConfirm.resolve(true);
      setCurrentConfirm(null);
    }
  }, [currentConfirm]);

  const handleCancel = useCallback(() => {
    if (currentConfirm) {
      currentConfirm.resolve(false);
      setCurrentConfirm(null);
    }
  }, [currentConfirm]);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <AnimatePresence>
        {currentConfirm && (
          <ConfirmModal
            options={currentConfirm}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
          />
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  );
};

const ConfirmModal = ({ options, onConfirm, onCancel }: { options: ConfirmOptions, onConfirm: () => void, onCancel: () => void }) => {
  const { title, message, type = 'confirm', confirmLabel = 'Confirmar', cancelLabel = 'Cancelar' } = options;

  const iconMap = {
    success: <CheckCircle className="w-10 h-10 text-emerald-500" />,
    warning: <AlertTriangle className="w-10 h-10 text-orange-500" />,
    error: <XCircle className="w-10 h-10 text-red-500" />,
    info: <Info className="w-10 h-10 text-blue-500" />,
    confirm: <HelpCircle className="w-10 h-10 text-blue-500" />,
    danger: <AlertTriangle className="w-10 h-10 text-red-500" />
  };

  const colorMap = {
    success: 'bg-emerald-500/10 border-emerald-500/20',
    warning: 'bg-orange-500/10 border-orange-500/20',
    error: 'bg-red-500/10 border-red-500/20',
    info: 'bg-blue-500/10 border-blue-500/20',
    confirm: 'bg-blue-500/10 border-blue-500/20',
    danger: 'bg-red-500/10 border-red-500/20'
  };

  const confirmBtnClasses = {
    success: "bg-emerald-600 hover:bg-emerald-500 hover:shadow-emerald-500/20 shadow-lg text-white",
    warning: "bg-orange-600 hover:bg-orange-500 hover:shadow-orange-500/20 shadow-lg text-white",
    error: "bg-red-600 hover:bg-red-500 hover:shadow-red-500/20 shadow-lg text-white",
    info: "bg-blue-600 hover:bg-blue-500 hover:shadow-blue-500/20 shadow-lg text-white",
    confirm: "bg-blue-600 hover:bg-blue-500 hover:shadow-blue-500/20 shadow-lg text-white",
    danger: "bg-red-600 hover:bg-red-500 hover:shadow-red-500/20 shadow-lg text-white"
  };

  const defaultTitleMap = {
    success: 'Éxito',
    warning: 'Advertencia',
    error: 'Error',
    info: 'Información',
    confirm: 'Confirmación',
    danger: 'Atención'
  };

  const displayTitle = title || defaultTitleMap[type];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 transition-opacity bg-[#0B0E14]/80 backdrop-blur-[2px]"
        onClick={onCancel}
      />
      <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="inline-block px-4 pt-5 pb-4 overflow-hidden text-left align-bottom transition-all transform bg-slate-900 border border-slate-700/50 rounded-xl shadow-2xl sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6"
      >
        <div className="sm:flex sm:items-start text-center sm:text-left">
          <div className={cn("flex flex-shrink-0 items-center justify-center w-12 h-12 mx-auto sm:mx-0 sm:h-16 sm:w-16 rounded-full border", colorMap[type])}>
            {iconMap[type]}
          </div>
          <div className="mt-3 sm:mt-0 sm:ml-5 flex-1">
            <h3 className="text-xl font-medium leading-6 text-slate-100 mb-2 mt-1">
              {displayTitle}
            </h3>
            <div className="mt-3">
              <p className="text-sm text-slate-300 max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                {message}
              </p>
            </div>
          </div>
        </div>
        <div className="mt-6 sm:mt-8 sm:flex sm:flex-row-reverse gap-3 flex-col-reverse justify-start">
          <button
            type="button"
            className={cn("w-full inline-flex justify-center rounded-lg border border-transparent shadow-sm px-6 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 sm:w-auto transition-all", confirmBtnClasses[type])}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
          <Button
            type="button"
            variant="ghost"
            className="w-full mt-3 sm:mt-0 sm:w-auto text-sm bg-transparent hover:bg-slate-800"
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
        </div>
      </motion.div>
    </div>
  );
};
