// src/components/CustomModal.jsx
export default function CustomModal({ isOpen, title, message, type = 'info', onConfirm, onClose }) {
  if (!isOpen) return null;

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h3 style={{ color: type === 'error' || type === 'warning' ? '#dc3545' : '#007bff', marginBottom: '10px' }}>
          {title || 'Confirmação'}
        </h3>
        <p style={{ color: '#333', marginBottom: '20px', fontSize: '15px' }}>
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
              backgroundColor: type === 'warning' ? '#dc3545' : '#007bff' 
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
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 1000
};

const modalStyle = {
  backgroundColor: 'white',
  padding: '24px',
  borderRadius: '16px',
  width: '100%',
  maxWidth: '380px',
  boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
  textAlign: 'left'
};

const confirmButtonStyle = {
  padding: '10px 20px',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 'bold'
};

const cancelButtonStyle = {
  padding: '10px 20px',
  backgroundColor: '#e2e8f0',
  color: '#333',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 'bold'
};