import { useEffect, useRef, useState } from 'react';
import { useAuthUser } from '../hooks/useAuthUser';
import { useTheme } from '../hooks/useTheme';

// Duração de cada etapa da animação (em ms), usada tanto no CSS abaixo quanto
// por quem dispara uma navegação animada (useAnimatedNavigate) — mantendo os
// dois em sincronia num único lugar caso o tempo precise ser ajustado depois.
export const COVER_WIDTH_MS = 350;
export const TITLE_FADE_IN_MS = 250;
export const TITLE_FADE_OUT_MS = 150;
// Expandindo: o fundo cresce primeiro, o título só começa a aparecer quando termina.
export const BAR_EXPAND_MS = COVER_WIDTH_MS + TITLE_FADE_IN_MS;
// Encolhendo: o título some primeiro, o fundo só encolhe depois que ele sumiu.
export const BAR_COLLAPSE_MS = TITLE_FADE_OUT_MS + COVER_WIDTH_MS;

// Altura total reservada no topo da página (offset da barra + sua altura + um
// respiro embaixo, simétrico ao de cima). As páginas devem aplicar esse valor
// como paddingTop/top de sticky para o conteúdo não ficar colado nem passar
// por baixo da barra.
export const TOPBAR_CLEARANCE = 110;

// Máscara: cobre o vão entre o topo da viewport e a barra (e o respiro logo
// abaixo dela) com a cor de fundo da página, para conteúdo que rola por trás
// não vazar pelas bordas/cantos da barra enquanto ela não é opaca ali.
export function TopBarMask() {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: `${TOPBAR_CLEARANCE}px`,
        backgroundColor: 'var(--color-bg-page)',
        zIndex: 9,
        pointerEvents: 'none'
      }}
    />
  );
}

// Barra de menu com dois estados animáveis:
// - encolhida: só o chip de perfil/login, no canto superior direito.
// - expandida: um fundo cresce para a esquerda "recobrindo" a linha inteira, e
//   o título "HarmonicaTabs" aparece com fade só depois que o fundo termina de
//   crescer (e some com fade antes do fundo começar a encolher de volta).
// O chip de perfil é um elemento à parte, sempre na mesma posição — nunca se
// move, esteja a barra expandida ou não.
export default function AnimatedMenuBar({ expanded, onTitleClick, onProfileClick, onLoginClick }) {
  const { usuario } = useAuthUser();
  const { tema, setTema, altoContraste, setAltoContraste } = useTheme();

  const perfilChipRef = useRef(null);
  const [perfilChipWidth, setPerfilChipWidth] = useState(null);

  useEffect(() => {
    if (perfilChipRef.current) {
      setPerfilChipWidth(perfilChipRef.current.getBoundingClientRect().width);
    }
  }, [usuario]);

  return (
    <>
      <TopBarMask />

      {/* Fundo/cartão que expande para a esquerda. Elemento independente do
          chip de perfil — só a forma/largura dele anima. */}
      <div
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 10,
          height: '70px',
          width: expanded ? 'calc(100vw - 40px)' : (perfilChipWidth ? `${perfilChipWidth + 40}px` : 'auto'),
          backgroundColor: 'var(--color-bg-card)',
          borderRadius: '12px',
          boxShadow: '0 4px 12px var(--shadow-card)',
          boxSizing: 'border-box',
          overflow: 'hidden',
          transition: expanded ? `width ${COVER_WIDTH_MS}ms ease` : `width ${COVER_WIDTH_MS}ms ease ${TITLE_FADE_OUT_MS}ms`
        }}
      >
        <button
          onClick={onTitleClick}
          style={{
            position: 'absolute',
            top: 0,
            left: '20px',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            background: 'none',
            border: 'none',
            padding: 0,
            margin: 0,
            cursor: 'pointer',
            color: 'var(--color-primary)',
            fontSize: '22px',
            fontWeight: 'bold',
            fontFamily: 'inherit',
            whiteSpace: 'nowrap',
            opacity: expanded ? 1 : 0,
            pointerEvents: expanded ? 'auto' : 'none',
            transition: (expanded
              ? `opacity ${TITLE_FADE_IN_MS}ms ease ${COVER_WIDTH_MS}ms`
              : `opacity ${TITLE_FADE_OUT_MS}ms ease`) + ', transform 0.2s ease'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          HarmonicaTabs
        </button>
      </div>

      {/* Chip de perfil/login - fica sempre no mesmo lugar (canto superior
          direito), independente do fundo acima estar expandido ou encolhido. */}
      <div
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 11,
          height: '70px',
          display: 'flex',
          alignItems: 'center',
          padding: '0 20px',
          boxSizing: 'border-box'
        }}
      >
        <div ref={perfilChipRef} style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          {/* Tema claro/escuro: um único botão alternando o ícone conforme o
              tema atual (sol amarelo = claro, lua azul-escura = escuro). */}
          <button
            type="button"
            onClick={() => setTema(tema === 'light' ? 'dark' : 'light')}
            style={iconToggleButtonStyle}
            aria-label={tema === 'light' ? 'Ativar tema escuro' : 'Ativar tema claro'}
            title={tema === 'light' ? 'Ativar tema escuro' : 'Ativar tema claro'}
          >
            {tema === 'light' ? (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#f5b301" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" fill="#f5b301" stroke="none" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="#1e3a8a" stroke="none">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>

          {/* Alto contraste: ícone oficial de acessibilidade (círculo dividido ao meio). */}
          <button
            type="button"
            role="switch"
            aria-checked={altoContraste}
            onClick={() => setAltoContraste(!altoContraste)}
            style={{
              ...iconToggleButtonStyle,
              borderColor: altoContraste ? 'var(--color-primary)' : 'var(--color-border-alt)'
            }}
            aria-label="Alternar alto contraste"
            title="Alternar alto contraste"
          >
            <svg viewBox="0 0 24 24" width="20" height="20">
              <circle cx="12" cy="12" r="9" fill="none" stroke={altoContraste ? 'var(--color-primary)' : 'var(--color-text-muted)'} strokeWidth="2" />
              <path d="M12,3 A9,9 0 0 1 12,21 Z" fill={altoContraste ? 'var(--color-primary)' : 'var(--color-text-muted)'} />
            </svg>
          </button>

          {usuario ? (
            <div
              onClick={onProfileClick}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
            >
              {usuario.foto_perfil ? (
                <img
                  src={usuario.foto_perfil}
                  alt="Perfil"
                  style={{
                    width: '50px',
                    height: '50px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '2px solid var(--color-primary)',
                    boxSizing: 'border-box'
                  }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              ) : (
                <svg viewBox="0 0 24 24" width="30" height="30" fill="var(--color-text-slate-2)">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              )}

              <span
                style={{
                  fontWeight: 'bold',
                  fontSize: '14px',
                  color: 'var(--color-text-main)'
                }}
              >
                {usuario.nome}
              </span>
            </div>
          ) : (
            <button
              onClick={onLoginClick}
              style={{
                padding: '12px 24px',
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-text-on-primary)',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                fontWeight: 'bold',
                boxShadow: '0 4px 12px var(--shadow-button-primary-alt)',
                whiteSpace: 'nowrap'
              }}
            >
              Login / Sign-In
            </button>
          )}
        </div>
      </div>
    </>
  );
}

const iconToggleButtonStyle = {
  width: '40px',
  height: '40px',
  borderRadius: '50%',
  border: 'var(--border-width-base) solid var(--color-border-alt)',
  backgroundColor: 'var(--color-bg-card)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  flexShrink: 0,
  padding: 0,
  boxSizing: 'border-box'
};
