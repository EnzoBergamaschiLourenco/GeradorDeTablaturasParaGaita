// URL do backend FastAPI responsável por ler/traduzir arquivos MIDI.
// Configurável via VITE_API_BASE_URL; mantém o mesmo padrão de dev
// (localhost:8000) quando a variável não está definida.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

export function urlTocarParte(midiPath, parteId) {
  return `${API_BASE_URL}/midi/play/${midiPath}?partes=${parteId}&_t=${Date.now()}`;
}

export async function buscarPartesMidi(midiPath) {
  const res = await fetch(`${API_BASE_URL}/midi/partes/${midiPath}`);
  return res.json();
}

export async function traduzirTablatura(payload) {
  const response = await fetch(`${API_BASE_URL}/midi/traduzir`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const resData = await response.json();

  if (!response.ok) {
    throw new Error(resData.detail || resData.error || `Erro: ${response.status}`);
  }

  return resData;
}
