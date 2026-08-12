import { supabase } from '../supabaseClient';

export async function buscarSugestoesMusicas(termo) {
  return supabase
    .from('musicas')
    .select('id, nome, autor, letra')
    .ilike('nome', `%${termo}%`)
    .limit(5);
}

export async function buscarMusicaExata({ nome, autor }) {
  return supabase
    .from('musicas')
    .select('id, letra')
    .eq('nome', nome)
    .eq('autor', autor)
    .maybeSingle();
}

export async function criarMusica({ nome, autor, letra }) {
  return supabase
    .from('musicas')
    .insert([{ nome, autor, letra }])
    .select('id')
    .single();
}

export async function buscarArquivosMidiPorMusica(musicaId) {
  return supabase
    .from('arquivos_midi')
    .select('id, arquivo_midi, path')
    .eq('musica_id', musicaId);
}

export async function buscarAvaliacoesMidi(midiIds) {
  return supabase
    .from('avaliacoes_midi')
    .select('midi_id, nota')
    .in('midi_id', midiIds);
}

export async function uploadArquivoMidi({ filePath, file }) {
  return supabase.storage.from('Arquivos MIDI').upload(filePath, file);
}

export async function registrarArquivoMidi({ arquivoMidi, musicaId, path }) {
  return supabase
    .from('arquivos_midi')
    .insert([{ arquivo_midi: arquivoMidi, musica_id: musicaId, path }])
    .select()
    .single();
}
