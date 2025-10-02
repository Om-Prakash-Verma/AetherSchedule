import React, { createContext, useState, useCallback, ReactNode } from 'react';
import { ConfirmModal } from '../components/ConfirmModal';

interface ConfirmOptions {
  title: string;
  description: string;
}

type ConfirmContextType = (options: ConfirmOptions) => Promise<boolean>;

export const ConfirmContext = createContext<ConfirmContextType | null>(null);

export const ConfirmProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [resolve, setResolve] = useState<(value: boolean) => void>(() => {});

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setOptions(options);
      setResolve(() => resolve);
    });
  }, []);

  const handleClose = () => {
    resolve(false);
    setOptions(null);
  };

  const handleConfirm = () => {
    resolve(true);
    setOptions(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && (
        <ConfirmModal
          isOpen={!!options}
          onClose={handleClose}
          onConfirm={handleConfirm}
          title={options.title}
          description={options.description}
        />
      )}
    </ConfirmContext.Provider>
  );
};