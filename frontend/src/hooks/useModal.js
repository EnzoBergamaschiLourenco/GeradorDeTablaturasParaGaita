import { useState } from 'react';

const ESTADO_INICIAL = {
  isOpen: false,
  title: '',
  message: '',
  type: 'info',
  onConfirm: null,
  confirmLabel: undefined
};

// Unifica o padrão modalConfig/showAlert duplicado em várias páginas, além
// da variante de confirmação (com onConfirm) usada em Menu/VisualizarTabs.
// Repassar modalConfig direto para <CustomModal {...modalConfig} onClose={closeModal} />.
export function useModal() {
  const [modalConfig, setModalConfig] = useState(ESTADO_INICIAL);

  const showAlert = (message, title = 'Aviso', type = 'info') => {
    setModalConfig({ isOpen: true, title, message, type, onConfirm: null, confirmLabel: undefined });
  };

  // confirmLabel: sobrescreve o texto padrão ("Confirmar") do botão de
  // confirmação — útil quando a ação precisa deixar bem claro o que vai
  // acontecer (ex.: "Sim, excluir todos os meus dados").
  const showConfirm = (message, { title = 'Confirmação', type = 'warning', onConfirm, confirmLabel } = {}) => {
    setModalConfig({ isOpen: true, title, message, type, onConfirm, confirmLabel });
  };

  const closeModal = () => {
    setModalConfig((prev) => ({ ...prev, isOpen: false }));
  };

  return { modalConfig, showAlert, showConfirm, closeModal };
}
