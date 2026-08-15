import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BAR_EXPAND_MS, BAR_COLLAPSE_MS } from '../components/AnimatedMenuBar';

// Duração do fade do conteúdo da página: some ao navegar para outra tela,
// aparece ao montar. Mais curta que a animação da barra (BAR_EXPAND_MS /
// BAR_COLLAPSE_MS) para o conteúdo já estar totalmente invisível quando a
// troca de rota de fato acontece, evitando o "pop" abrupto de uma tela pra
// outra.
export const CONTENT_FADE_MS = 250;

// Estilo pronto para aplicar (via spread) no elemento de conteúdo de cada
// página: `style={{ ...meuEstilo, ...fadeStyle(contentVisible) }}`.
export const fadeStyle = (visible) => ({
  opacity: visible ? 1 : 0,
  transition: `opacity ${CONTENT_FADE_MS}ms ease`
});

// Controla o estado (expandida/encolhida) da <AnimatedMenuBar /> e o
// fade-in/fade-out do conteúdo da página, e só troca de rota depois que a
// animação da barra termina de tocar — para a transição entre a tela inicial
// e as outras páginas parecer contínua em vez de cortar tudo no meio do
// movimento.
export function useAnimatedNavigate(initialExpanded) {
  const navigate = useNavigate();
  const location = useLocation();
  const [expanded, setExpanded] = useState(initialExpanded);
  const [contentVisible, setContentVisible] = useState(false);
  const timeoutRef = useRef(null);

  // Fade-in do conteúdo assim que a página monta. Precisa de um frame de
  // diferença entre opacity:0 (primeira pintura) e opacity:1 para o navegador
  // realmente animar a transição — setar direto opacity:1 não anima nada.
  useEffect(() => {
    const id = requestAnimationFrame(() => setContentVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  const navigateAnimated = (path, { expand, state } = {}) => {
    // Ignora navegação pra rota em que já se está (ex.: clicar no chip de
    // perfil estando já na tela de Perfil). Como a rota não muda, o React
    // Router não remonta a página — e o fade-in só roda no mount, então o
    // fade-out disparado abaixo nunca reverteria, travando a tela com o
    // conteúdo invisível.
    if (path.toLowerCase() === location.pathname.toLowerCase()) return;

    setExpanded(expand);
    setContentVisible(false);
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(
      () => navigate(path, state ? { state } : undefined),
      expand ? BAR_EXPAND_MS : BAR_COLLAPSE_MS
    );
  };

  return { expanded, setExpanded, contentVisible, navigateAnimated };
}
