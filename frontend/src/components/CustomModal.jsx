// src/components/CustomModal.jsx
export default function CustomModal({ isOpen, title, message, type = 'info', onConfirm, onClose }) {
  if (!isOpen) return null;

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h3 style={{ color: type === 'error' || type === 'warning' ? 'var(--color-danger-strong)' : 'var(--color-primary)', marginBottom: '10px' }}>
          {title || 'Confirmação'}
        </h3>
        <p style={{ color: 'var(--color-text-main)', marginBottom: '20px', fontSize: '15px' }}>
          {message}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          {/* Se houver onConfirm, exibe o botão de cancelar/não */}
          {onConfirm && (
            <button style={cancelButtonStyle} onClick={onClose}>
              Cancelar
            </button>
          )}
          <button
            style={{
              ...confirmButtonStyle,
              backgroundColor: type === 'warning' ? 'var(--color-danger-strong)' : 'var(--color-primary)'
            }}
            onClick={onConfirm || onClose}
          >
            Confirmar
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
  zIndex: 1000
};

const modalStyle = {
  backgroundColor: 'var(--color-bg-card)',
  padding: '24px',
  borderRadius: '16px',
  width: '100%',
  maxWidth: '380px',
  boxShadow: '0 10px 25px var(--shadow-note-default)',
  textAlign: 'left'
};

const confirmButtonStyle = {
  padding: '10px 20px',
  color: 'var(--color-text-on-primary)',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 'bold'
};

const cancelButtonStyle = {
  padding: '10px 20px',
  backgroundColor: 'var(--color-border-alt)',
  color: 'var(--color-text-main)',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 'bold'
};