import { supabase } from '../supabaseClient';

// Busca tablaturas para a tela de pesquisa (Menu).
//
// Os campos de texto (nome/autor da música, autor da tab) NÃO são filtrados
// aqui: o Menu resolve esses termos no cliente (acento-insensível, com
// ranking) e passa apenas as listas de ids que casaram — `musicaIds` e/ou
// `usuarioIds`. `null` = sem restrição naquele eixo; `[]` = nada casou, então
// devolve vazio sem ir ao banco. Tom/tipo continuam sendo filtro exato no
// servidor.
export async function buscarTablaturas({ musicaIds = null, usuarioIds = null, tom = '', tipo = '' } = {}) {
  if ((Array.isArray(musicaIds) && musicaIds.length === 0) ||
      (Array.isArray(usuarioIds) && usuarioIds.length === 0)) {
    return { data: [], error: null };
  }

  // Filtrar por coluna de recurso embutido só funciona com !inner.
  const joinGaita = (tom || tipo) ? '!inner' : '';

  let query = supabase.from('tablaturas').select(`
    id,
    tablatura,
    data,
    usuario_id,
    musica_id,
    midi_id,
    gaita_id,
    musicas (
      id,
      nome,
      autor
    ),
    usuarios (
      id,
      nome
    ),
    layouts_gaita${joinGaita} (
      id,
      tom,
      tipo
    ),
    arquivos_midi (
      id,
      arquivo_midi
    ),
    curtidas (
      id,
      bool_curtida
    )
  `);

  if (Array.isArray(musicaIds)) query = query.in('musica_id', musicaIds);
  if (Array.isArray(usuarioIds)) query = query.in('usuario_id', usuarioIds);
  if (tom) query = query.eq('layouts_gaita.tom', tom);
  if (tipo) query = query.eq('layouts_gaita.tipo', tipo);

  return query;
}

// Busca UMA tablatura pelo id, com os mesmos joins da pesquisa — usado pelo
// link compartilhável (/VisualizarTabs?id=123), que abre a tela sem passar
// pelo state de navegação.
export async function buscarTablaturaPorId(id) {
  return supabase
    .from('tablaturas')
    .select(`
      id,
      tablatura,
      data,
      usuario_id,
      musica_id,
      midi_id,
      gaita_id,
      musicas ( id, nome, autor ),
      usuarios ( id, nome ),
      layouts_gaita ( id, tom, tipo ),
      arquivos_midi ( id, arquivo_midi )
    `)
    .eq('id', id)
    .maybeSingle();
}

export async function contarCurtidas(tablaturaId) {
  return supabase
    .from('curtidas')
    .select('*', { count: 'exact', head: true })
    .eq('tablatura_id', tablaturaId)
    .eq('bool_curtida', true);
}

// Retorna { data: boolean } — se o usuário já curtiu esta tablatura. Não usa
// .maybeSingle() de propósito: se por algum motivo existir mais de uma linha
// pra (usuario, tablatura), .maybeSingle() lançaria erro e a tela trataria
// como "não curtiu", deixando curtir de novo (contador subindo sem parar).
export async function usuarioCurtiu({ tablaturaId, usuarioId }) {
  const { data, error } = await supabase
    .from('curtidas')
    .select('id')
    .eq('tablatura_id', tablaturaId)
    .eq('usuario_id', usuarioId)
    .eq('bool_curtida', true)
    .limit(1);

  return { data: Array.isArray(data) && data.length > 0, error };
}

// Remove a curtida do usuário nesta tablatura. .match() apaga TODAS as linhas
// que casarem — então também limpa eventuais duplicatas antigas.
export async function removerCurtida({ usuarioId, tablaturaId }) {
  return supabase
    .from('curtidas')
    .delete()
    .match({ usuario_id: usuarioId, tablatura_id: tablaturaId });
}

// Curtir é idempotente: apaga qualquer curtida já existente desse usuário
// nesta tablatura antes de inserir uma. Garante no máximo 1 linha por
// (usuario, tablatura) mesmo sem constraint UNIQUE no banco — e conserta na
// hora qualquer duplicata que já existisse pra esse usuário.
export async function adicionarCurtida({ usuarioId, tablaturaId }) {
  await supabase
    .from('curtidas')
    .delete()
    .match({ usuario_id: usuarioId, tablatura_id: tablaturaId });

  return supabase
    .from('curtidas')
    .insert({ usuario_id: usuarioId, tablatura_id: tablaturaId, bool_curtida: true });
}

export async function atualizarTextoTablatura({ id, tablatura }) {
  return supabase.from('tablaturas').update({ tablatura }).eq('id', id);
}

// O schema não tem ON DELETE CASCADE entre curtidas e tablaturas: as
// curtidas vinculadas precisam ser apagadas antes da tablatura.
export async function excluirTablatura(id) {
  await supabase.from('curtidas').delete().eq('tablatura_id', id);
  return supabase.from('tablaturas').delete().eq('id', id);
}

// .select().single() traz de volta a linha recém-criada (id incluso) — o
// MontarTablatura usa isso pra levar o usuário direto pra tela de
// visualização da tablatura que acabou de criar.
export async function salvarNovaTablatura({ tablatura, data, usuarioId, midiId, musicaId, gaitaId }) {
  return supabase
    .from('tablaturas')
    .insert({
      tablatura,
      data,
      usuario_id: usuarioId,
      midi_id: midiId,
      musica_id: musicaId,
      gaita_id: gaitaId
    })
    .select()
    .single();
}

export async function avaliarMidi({ usuarioId, midiId, nota }) {
  return supabase
    .from('avaliacoes_midi')
    .insert({ usuario_id: usuarioId, midi_id: midiId, nota });
}
