import { useState } from 'react';

const STORAGE_KEY = 'usuarioLogado';

function lerUsuarioArmazenado() {
  const dadosSalvos = localStorage.getItem(STORAGE_KEY);
  return dadosSalvos ? JSON.parse(dadosSalvos) : null;
}

// Lê/escreve o usuário logado (armazenado em localStorage, já que o app não
// usa Supabase Auth). Antes, cada página reimplementava esse
// getItem/JSON.parse num useEffect próprio.
export function useAuthUser() {
  const [usuario, setUsuarioState] = useState(lerUsuarioArmazenado);

  const setUsuario = (dadosUsuario) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dadosUsuario));
    setUsuarioState(dadosUsuario);
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setUsuarioState(null);
  };

  return { usuario, setUsuario, logout };
}
