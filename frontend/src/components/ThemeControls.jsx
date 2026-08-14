import { useTheme } from '../hooks/useTheme';

// Controles de acessibilidade: tema claro/escuro (lado a lado) e alto
// contraste (independente do tema). Usa useTheme diretamente, então basta
// renderizar <ThemeControls /> em qualquer tela — hoje só o Perfil usa.
export default function ThemeControls() {
  const { tema, setTema, altoContraste, setAltoContraste } = useTheme();

  return (
    <div style={containerStyle}>
      <div style={rowStyle}>
        <span style={rowLabelStyle}>Tema</span>
        <div style={optionsRowStyle}>
          <button
            type="button"
            onClick={() => setTema('light')}
            aria-pressed={tema === 'light'}
            style={tema === 'light' ? optionButtonActiveStyle : optionButtonStyle}
          >
            ☀️ Claro
          </button>
          <button
            type="button"
            onClick={() => setTema('dark')}
            aria-pressed={tema === 'dark'}
            style={tema === 'dark' ? optionButtonActiveStyle : optionButtonStyle}
          >
            🌙 Escuro
          </button>
        </div>
      </div>

      <div style={rowStyle}>
        <label htmlFor="toggle-alto-contraste" style={rowLabelStyle}>
          Alto contraste
        </label>
        <button
          id="toggle-alto-contraste"
          type="button"
          role="switch"
          aria-checked={altoContraste}
          onClick={() => setAltoContraste(!altoContraste)}
          style={altoContraste ? switchTrackActiveStyle : switchTrackStyle}
        >
          <span style={altoContraste ? switchKnobActiveStyle : switchKnobStyle} />
        </button>
      </div>
    </div>
  );
}

/* ===== ESTILOS ===== */
const containerStyle = {
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  backgroundColor: 'var(--color-bg-card-alt)',
  border: `var(--border-width-base) solid var(--color-border-alt)`,
  borderRadius: 14,
  padding: '14px 16px',
  marginBottom: 15,
  boxSizing: 'border-box'
};

const rowStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10
};

const rowLabelStyle = {
  fontSize: 14,
  fontWeight: 'bold',
  color: 'var(--color-text-main)'
};

const optionsRowStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8
};

const optionButtonStyle = {
  padding: '8px 14px',
  borderRadius: 10,
  border: `var(--border-width-base) solid var(--color-border-alt)`,
  backgroundColor: 'var(--color-bg-card)',
  color: 'var(--color-text-muted)',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 'bold'
};

const optionButtonActiveStyle = {
  ...optionButtonStyle,
  backgroundColor: 'var(--color-primary)',
  border: `var(--border-width-base) solid var(--color-primary)`,
  color: 'var(--color-text-on-primary)'
};

const switchTrackStyle = {
  position: 'relative',
  width: 46,
  height: 26,
  borderRadius: 999,
  border: `var(--border-width-base) solid var(--color-border-alt)`,
  backgroundColor: 'var(--color-border-alt)',
  cursor: 'pointer',
  padding: 0,
  flexShrink: 0
};

const switchTrackActiveStyle = {
  ...switchTrackStyle,
  backgroundColor: 'var(--color-primary)',
  border: `var(--border-width-base) solid var(--color-primary)`
};

const switchKnobStyle = {
  position: 'absolute',
  top: 2,
  left: 2,
  width: 20,
  height: 20,
  borderRadius: '50%',
  backgroundColor: 'var(--color-bg-card)',
  transition: 'left 0.15s ease'
};

const switchKnobActiveStyle = {
  ...switchKnobStyle,
  left: 22
};
