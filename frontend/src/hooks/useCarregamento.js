import { useEffect, useRef, useState } from 'react';

// Tempo mínimo que qualquer indicador de carregamento fica visível, mesmo que
// a operação termine antes — evita "telas piscando" quando algo carrega rápido.
export const CARREGAMENTO_MINIMO_MS = 500;

// Anima os "..." (., .., ...) enquanto `ativo` for verdadeiro.
export function usePontinhos(ativo, intervaloMs = 350) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!ativo) return undefined;
    const id = setInterval(() => setTick((n) => n + 1), intervaloMs);
    return () => clearInterval(id);
  }, [ativo, intervaloMs]);

  return ativo ? '.'.repeat((tick % 3) + 1) : '';
}

// Recebe o estado real de carregamento e devolve um estado "esticado": quando
// vira true, permanece true por pelo menos `minMs` — mesmo que o original já
// tenha voltado a false. Assim a tela não pisca em cargas rápidas.
export function useCarregamentoMinimo(carregando, minMs = CARREGAMENTO_MINIMO_MS) {
  const [visivel, setVisivel] = useState(Boolean(carregando));
  const inicioRef = useRef(0);

  useEffect(() => {
    if (carregando) {
      inicioRef.current = Date.now();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza com a prop
      setVisivel(true);
      return undefined;
    }
    // Terminou: só some depois de cumprir o tempo mínimo.
    const restante = Math.max(0, minMs - (Date.now() - inicioRef.current));
    const id = setTimeout(() => setVisivel(false), restante);
    return () => clearTimeout(id);
  }, [carregando, minMs]);

  return visivel;
}
