import { useCallback, useEffect, useState } from 'react';

const TEMA_STORAGE_KEY = 'tema';
const CONTRASTE_STORAGE_KEY = 'altoContraste';

function lerTemaArmazenado() {
  return localStorage.getItem(TEMA_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
}

function lerContrasteArmazenado() {
  return localStorage.getItem(CONTRASTE_STORAGE_KEY) === 'true';
}

function aplicarNoDocumento(tema, altoContraste) {
  document.documentElement.setAttribute('data-theme', tema);
  document.documentElement.setAttribute('data-contrast', altoContraste ? 'alto' : 'normal');
}

// Tema (claro/escuro) e alto contraste — independentes entre si, persistidos
// em localStorage e aplicados via atributos data-theme/data-contrast em
// <html>, que o CSS em styles/theme.css usa para trocar as variáveis de cor.
// O mesmo valor já é lido antes do React montar (script inline em
// index.html), então aqui não há flash de tema errado no primeiro paint.
export function useTheme() {
  const [tema, setTemaState] = useState(lerTemaArmazenado);
  const [altoContraste, setAltoContrasteState] = useState(lerContrasteArmazenado);

  useEffect(() => {
    aplicarNoDocumento(tema, altoContraste);
  }, [tema, altoContraste]);

  const setTema = useCallback((novoTema) => {
    localStorage.setItem(TEMA_STORAGE_KEY, novoTema);
    setTemaState(novoTema);
  }, []);

  const setAltoContraste = useCallback((valor) => {
    localStorage.setItem(CONTRASTE_STORAGE_KEY, String(valor));
    setAltoContrasteState(valor);
  }, []);

  const alternarAltoContraste = useCallback(() => {
    setAltoContraste(!altoContraste);
  }, [altoContraste, setAltoContraste]);

  return { tema, setTema, altoContraste, setAltoContraste, alternarAltoContraste };
}
