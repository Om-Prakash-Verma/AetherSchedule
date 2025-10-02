import React from 'react';
import { Modal } from './ui/Modal';
import { GlassButton } from './GlassButton';
import { AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, onClose, onConfirm, title, description }) => {
  const footer = (
    <>
      <GlassButton variant="secondary" onClick={onClose}>
        Cancel
      </GlassButton>
      <GlassButton
        onClick={onConfirm}
        className="bg-red-600 hover:bg-red-700 border-transparent text-[var(--text-white)]"
      >
        Confirm
      </GlassButton>
    </>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} footer={footer}>
      <div className="flex items-start gap-4">
        <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-500/10 sm:mx-0 sm:h-10 sm:w-10">
          <AlertTriangle className="h-6 w-6 text-[var(--red-400)]" aria-hidden="true" />
        </div>
        <div className="mt-1 text-left">
          <p className="text-sm text-[var(--text-muted)]">{description}</p>
        </div>
      </div>
    </Modal>
  );
};