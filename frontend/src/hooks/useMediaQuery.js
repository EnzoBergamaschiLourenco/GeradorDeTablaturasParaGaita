import { useCallback, useSyncExternalStore } from 'react';

// Breakpoints orientados ao conteúdo, não a dispositivos específicos.
// - BP_STACK: abaixo disso as telas de 2 colunas (VisualizarTabs,
//   MontarTablatura, CriarTabs) empilham numa coluna só.
// - BP_MOBILE: abaixo disso paddings/tipografia ficam mais compactos.
export const BP_STACK = 900;
export const BP_MOBILE = 520;

const podeUsarMatchMedia = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function';

// Hook genérico: assina uma media query e re-renderiza quando ela muda.
// getSnapshot roda no cliente já com o valor real (sem "flash" no primeiro
// paint). Além do evento 'change' do MediaQueryList, também ouve 'resize' da
// janela — em alguns ambientes (viewport emulado, rotação de tela em certos
// navegadores) o 'change' não dispara mas matchMedia().matches já reflete o
// novo valor.
export function useMediaQuery(query) {
  const subscribe = useCallback(
    (callback) => {
      if (!podeUsarMatchMedia()) return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener('change', callback);
      window.addEventListener('resize', callback);
      return () => {
        mql.removeEventListener('change', callback);
        window.removeEventListener('resize', callback);
      };
    },
    [query]
  );

  const getSnapshot = () => (podeUsarMatchMedia() ? window.matchMedia(query).matches : false);
  const getServerSnapshot = () => false;

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// Abaixo de BP_STACK: telas de 2 colunas viram 1 coluna e a página passa a
// rolar no fluxo normal.
export function useIsStacked() {
  return useMediaQuery(`(max-width: ${BP_STACK}px)`);
}

// Abaixo de BP_MOBILE: paddings/tipografia compactos (uso pontual).
export function useIsMobile() {
  return useMediaQuery(`(max-width: ${BP_MOBILE}px)`);
}

// Barra de menu: reduz os elementos internos em telas bem estreitas, sem
// mexer na geometria em telas maiores.
export function useIsCompactBar() {
  return useMediaQuery('(max-width: 600px)');
}

// Ponteiro grosso (toque): habilita tap-to-place, botões de ação de linha
// sempre visíveis (não só no hover) e alvos de toque maiores.
export function useIsCoarsePointer() {
  return useMediaQuery('(pointer: coarse)');
}
