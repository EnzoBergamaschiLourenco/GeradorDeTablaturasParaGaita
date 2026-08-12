import { useState } from 'react';

const ESTADO_INICIAL = {
  isOpen: false,
  title: '',
  message: '',
  type: 'info',
  onConfirm: null
};

// Unifica o padrão modalConfig/showAlert duplicado em várias páginas, além
// da variante de confirmação (com onConfirm) usada em Menu/VisualizarTabs.
// Repassar modalConfig direto para <CustomModal {...modalConfig} onClose={closeModal} />.
export function useModal() {
  const [modalConfig, setModalConfig] = useState(ESTADO_INICIAL);

  const showAlert = (message, title = 'Aviso', type = 'info') => {
    setModalConfig({ isOpen: true, title, message, type, onConfirm: null });
  };

  const showConfirm = (message, { title = 'Confirmação', type = 'warning', onConfirm } = {}) => {
    setModalConfig({ isOpen: true, title, message, type, onConfirm });
  };

  const closeModal = () => {
    setModalConfig((prev) => ({ ...prev, isOpen: false }));
  };

  return { modalConfig, showAlert, showConfirm, closeModal };
}
