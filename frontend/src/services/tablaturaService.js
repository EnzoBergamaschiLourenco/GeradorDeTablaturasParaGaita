import { supabase } from '../supabaseClient';

// Busca tablaturas com os joins/filtros usados na tela de pesquisa (Menu).
export async function buscarTablaturas({ nome, autorMusica, autorTab, tom, tipo } = {}) {
  const joinMusicas = (nome || autorMusica) ? '!inner' : '';
  const joinUsuarios = autorTab ? '!inner' : '';
  const joinGaita = (tom || tipo) ? '!inner' : '';

  let query = supabase.from('tablaturas').select(`
    id,
    tablatura,
    data,
    usuario_id,
    musica_id,
    midi_id,
    gaita_id,
    musicas${joinMusicas} (
      id,
      nome,
      autor
    ),
    usuarios${joinUsuarios} (
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

  if (nome) query = query.ilike('musicas.nome', `%${nome}%`);
  if (autorMusica) query = query.ilike('musicas.autor', `%${autorMusica}%`);
  if (autorTab) query = query.ilike('usuarios.nome', `%${autorTab}%`);
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

export async function usuarioCurtiu({ tablaturaId, usuarioId }) {
  return supabase
    .from('curtidas')
    .select('id')
    .eq('tablatura_id', tablaturaId)
    .eq('usuario_id', usuarioId)
    .eq('bool_curtida', true)
    .maybeSingle();
}

export async function removerCurtida({ usuarioId, tablaturaId }) {
  return supabase
    .from('curtidas')
    .delete()
    .match({ usuario_id: usuarioId, tablatura_id: tablaturaId });
}

export async function adicionarCurtida({ usuarioId, tablaturaId }) {
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
