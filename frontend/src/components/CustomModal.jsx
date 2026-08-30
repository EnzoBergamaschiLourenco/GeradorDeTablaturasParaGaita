// src/components/CustomModal.jsx
export default function CustomModal({ isOpen, title, message, type = 'info', onConfirm, onClose, confirmLabel, onSecondary, secondaryLabel }) {
  if (!isOpen) return null;

  const isDanger = type === 'error' || type === 'warning';

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        {/* Fechar/cancelar fica só no ✕ do topo — não há mais botão "Cancelar"
            na fileira de ações. */}
        <button style={closeButtonStyle} onClick={onClose} aria-label="Fechar" title="Fechar">
          ✕
        </button>

        <h3 style={{ color: isDanger ? 'var(--color-danger-strong)' : 'var(--color-primary)', margin: '0 0 10px', paddingRight: '28px' }}>
          {title || 'Confirmação'}
        </h3>
        <p style={{ color: 'var(--color-text-main)', marginBottom: '20px', fontSize: '15px' }}>
          {message}
        </p>

        {/* Ações lado a lado, cada uma ocupando a mesma fração da largura. */}
        <div style={{ display: 'flex', gap: '10px' }}>
          {onSecondary && (
            <button style={{ ...secondaryButtonStyle, flex: 1 }} onClick={onSecondary}>
              {secondaryLabel || 'Descartar'}
            </button>
          )}
          <button
            style={{
              ...confirmButtonStyle,
              flex: 1,
              backgroundColor: type === 'warning' ? 'var(--color-danger-strong)' : 'var(--color-primary)'
            }}
            onClick={onConfirm || onClose}
          >
            {confirmLabel || 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Estilos mantidos do exemplo anterior
const overlayStyle = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'var(--color-overlay-modal)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  padding: '16px',
  boxSizing: 'border-box',
  zIndex: 1000
};

const modalStyle = {
  position: 'relative',
  backgroundColor: 'var(--color-bg-card)',
  padding: '24px',
  borderRadius: '16px',
  width: '100%',
  maxWidth: '380px',
  boxShadow: '0 10px 25px var(--shadow-note-default)',
  textAlign: 'left'
};

const closeButtonStyle = {
  position: 'absolute',
  top: '12px',
  right: '12px',
  width: '30px',
  height: '30px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  background: 'none',
  border: 'none',
  borderRadius: '8px',
  fontSize: '15px',
  lineHeight: 1,
  color: 'var(--color-text-muted)',
  cursor: 'pointer'
};

const confirmButtonStyle = {
  padding: '10px 20px',
  color: 'var(--color-text-on-primary)',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 'bold'
};

const secondaryButtonStyle = {
  padding: '10px 20px',
  backgroundColor: 'transparent',
  color: 'var(--color-danger-strong)',
  border: '2px solid var(--color-danger-strong)',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 'bold'
};
