import { supabase } from '../supabaseClient';
import { normalizar } from '../utils/busca';

// Listas leves (só id + nome/autor) de músicas e usuários, usadas para
// resolver os campos de texto da busca no cliente, acento-insensível.
// Cacheadas em sessionStorage com TTL curto; chamadas concorrentes são
// deduplicadas via a promise em voo.

const TTL_MS = 5 * 60 * 1000;

function cacheSessao(chave) {
  return {
    ler() {
      try {
        const bruto = sessionStorage.getItem(chave);
        if (!bruto) return null;
        const { em, dados } = JSON.parse(bruto);
        if (!Array.isArray(dados) || Date.now() - em > TTL_MS) return null;
        return dados;
      } catch {
        return null;
      }
    },
    escrever(dados) {
      try {
        sessionStorage.setItem(chave, JSON.stringify({ em: Date.now(), dados }));
      } catch {
        // sessionStorage indisponível — segue sem cache
      }
    },
    limpar() {
      try {
        sessionStorage.removeItem(chave);
      } catch {
        // ignore
      }
    }
  };
}

const CACHE_MUSICAS = cacheSessao('harmonicaTabs:musicasBusca');
const CACHE_USUARIOS = cacheSessao('harmonicaTabs:usuariosBusca');

let musicasEmVoo = null;
let usuariosEmVoo = null;

// [{ id, nome, autor, nomeNorm, autorNorm }] — todas as músicas.
export async function listarMusicasParaBusca() {
  const cache = CACHE_MUSICAS.ler();
  if (cache) return cache;
  if (musicasEmVoo) return musicasEmVoo;

  musicasEmVoo = (async () => {
    try {
      const { data, error } = await supabase.from('musicas').select('id, nome, autor');
      if (error) throw error;
      const lista = (data || []).map((m) => ({
        id: m.id,
        nome: m.nome || '',
        autor: m.autor || '',
        nomeNorm: normalizar(m.nome),
        autorNorm: normalizar(m.autor)
      }));
      CACHE_MUSICAS.escrever(lista);
      return lista;
    } finally {
      musicasEmVoo = null;
    }
  })();

  return musicasEmVoo;
}

// [{ id, nome, nomeNorm }] — todos os usuários (só id e nome).
export async function listarUsuariosParaBusca() {
  const cache = CACHE_USUARIOS.ler();
  if (cache) return cache;
  if (usuariosEmVoo) return usuariosEmVoo;

  usuariosEmVoo = (async () => {
    try {
      const { data, error } = await supabase.from('usuarios').select('id, nome');
      if (error) throw error;
      const lista = (data || []).map((u) => ({
        id: u.id,
        nome: u.nome || '',
        nomeNorm: normalizar(u.nome)
      }));
      CACHE_USUARIOS.escrever(lista);
      return lista;
    } finally {
      usuariosEmVoo = null;
    }
  })();

  return usuariosEmVoo;
}

// Chamar depois de criar/editar uma música, para o cache não ficar velho.
export function invalidarCacheMusicasBusca() {
  CACHE_MUSICAS.limpar();
}
