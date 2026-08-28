import { usePontinhos } from '../hooks/useCarregamento';

// Overlay de carregamento em tela cheia, com "..." animado.
// Use com useCarregamentoMinimo para garantir o tempo mínimo em tela.
export default function LoadingOverlay({ visivel, texto = 'Carregando' }) {
  const pontos = usePontinhos(visivel);

  if (!visivel) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'var(--color-overlay-loading)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--color-bg-card)',
          padding: '20px 40px',
          borderRadius: '8px',
          fontSize: '18px',
          color: 'var(--color-text-main)',
          fontFamily: 'Arial, sans-serif',
          minWidth: '180px',
          textAlign: 'center'
        }}
      >
        {texto}
        {/* largura fixa pros pontos não fazerem o texto "pular" */}
        <span style={{ display: 'inline-block', width: '1.4em', textAlign: 'left' }}>{pontos}</span>
      </div>
    </div>
  );
}
