import os

import mido

from core.errors import ErroDeNegocio
from core.paths import ARQUIVOS_PATH, _garantir_dentro_da_raiz, resolver_caminho_seguro
from core.supabase_client import supabase

# ==========================================================
# LISTAGEM DE PARTES (tracks para tipo 1, canais para tipo 0)
# ==========================================================
def baixar_e_extrair_partes(caminho_completo: str):
    caminho_local = resolver_caminho_seguro(caminho_completo)
    os.makedirs(os.path.dirname(caminho_local), exist_ok=True)
    if not os.path.exists(caminho_local):
        try:
            response = supabase.storage.from_("Arquivos MIDI").download(caminho_completo)
            with open(caminho_local, "wb") as f:
                f.write(response)
        except Exception as e:
            raise ErroDeNegocio(f"Erro ao baixar '{caminho_completo}' do Supabase: {str(e)}")

    mid = mido.MidiFile(caminho_local, clip=True)
    partes = []

    if mid.type == 0:
        # MIDI tipo 0: uma só track com vários canais → listar canais distintos
        canais = set()
        for track in mid.tracks:
            for msg in track:
                if hasattr(msg, 'channel') and msg.type == 'note_on' and msg.velocity > 0:
                    canais.add(msg.channel)
        for canal in sorted(canais):
            partes.append({"id": f"channel_{canal}", "nome": f"Canal MIDI {canal + 1}"})
    else:
        # MIDI tipo 1 ou 2: listar tracks que contenham notas
        for i, track in enumerate(mid.tracks):
            possui_notas = any(msg.type == "note_on" and msg.velocity > 0 for msg in track)
            if possui_notas:
                nome = next((msg.name.strip() for msg in track if msg.type == "track_name" and msg.name.strip()), f"Trilha {i}")
                partes.append({"id": f"track_{i}", "nome": nome})

    return partes

# ==========================================================
# EXTRAÇÃO DE EVENTOS DE UM CANAL (para MIDI tipo 0)
# Observação: não é chamada por nenhuma rota hoje (assim como
# construir_midi_canal, abaixo). Mantidas como estavam para não mudar
# comportamento nesta etapa de reorganização; candidatas a remoção numa
# limpeza futura, se confirmado que não são mais necessárias.
# ==========================================================
def extrair_canal_midi(caminho_completo: str, canal: int):
    """Retorna lista de eventos (notas + config) para o canal fornecido."""
    from services.gaita_translation_service import _build_tempo_map

    caminho_local = resolver_caminho_seguro(caminho_completo)
    mid = mido.MidiFile(caminho_local, clip=True)
    tpb = mid.ticks_per_beat
    tempo_map = _build_tempo_map(mid)

    eventos_notas = []
    eventos_config = []

    for track in mid.tracks:
        abs_tick = 0
        notas_abertas = {}
        for msg in track:
            abs_tick += msg.time
            if not hasattr(msg, 'channel') or msg.channel != canal:
                continue

            if msg.type == 'note_on' and msg.velocity > 0:
                notas_abertas[msg.note] = abs_tick
            elif msg.type == 'note_off' or (msg.type == 'note_on' and msg.velocity == 0):
                if msg.note in notas_abertas:
                    inicio_tick = notas_abertas.pop(msg.note)
                    eventos_notas.append({
                        'nota': msg.note,
                        'velocity': msg.velocity if msg.type == 'note_on' else 64,
                        'inicio_tick': inicio_tick,
                        'fim_tick': abs_tick,
                        'canal': canal
                    })
            elif msg.type in ('program_change', 'control_change'):
                eventos_config.append((abs_tick, msg.copy()))

    return eventos_notas, eventos_config, tpb, tempo_map


def construir_midi_canal(eventos_notas, eventos_config, tpb, tempo_map, nome_saida):
    """Cria um MIDI tipo 0 com os eventos do canal."""
    mensagens = []

    # Notas
    for ev in eventos_notas:
        mensagens.append((ev['inicio_tick'], mido.Message('note_on',
                                                         note=ev['nota'],
                                                         velocity=ev['velocity'],
                                                         channel=ev['canal'])))
        mensagens.append((ev['fim_tick'], mido.Message('note_off',
                                                       note=ev['nota'],
                                                       velocity=0,
                                                       channel=ev['canal'])))

    # Configurações
    for tick, msg in eventos_config:
        mensagens.append((tick, msg))

    # Meta‑eventos de andamento
    for abs_tick, tempo in tempo_map:
        mensagens.append((abs_tick, mido.MetaMessage('set_tempo', tempo=tempo)))

    mensagens.sort(key=lambda x: x[0])

    nova_track = mido.MidiTrack()
    ultimo_tick = 0
    for tick, msg in mensagens:
        delta = tick - ultimo_tick
        if delta < 0:
            delta = 0
        msg.time = delta
        nova_track.append(msg)
        ultimo_tick = tick

    mid = mido.MidiFile(type=0, ticks_per_beat=tpb, clip=True)  # tipo 0, uma única track
    mid.tracks.append(nova_track)
    mid.save(nome_saida)


# ==========================================================
# EXPORTAÇÃO DE MIDI LIMPO (suporta track e channel)
# ==========================================================
def exportar_filtro_midi(caminho_completo: str, partes_ids: list):
    caminho_origem = resolver_caminho_seguro(caminho_completo)
    pasta_base = os.path.dirname(caminho_origem)
    nome_saida = f"temp_{'_'.join(partes_ids)}_{os.path.basename(caminho_completo)}"
    # partes_ids também é entrada externa (query param 'partes'); valida que o
    # nome de saída gerado a partir dela não escapa de ARQUIVOS_PATH.
    caminho_saida = _garantir_dentro_da_raiz(os.path.join(pasta_base, nome_saida))

    if os.path.exists(caminho_saida):
        os.remove(caminho_saida)

    mid_original = mido.MidiFile(caminho_origem, clip=True)

    canais = {int(p.split('_')[1]) for p in partes_ids if p.startswith('channel_')}
    tracks = {int(p.split('_')[1]) for p in partes_ids if p.startswith('track_')}

    # --- TRATAMENTO PARA MIDI TIPO 0 (CANAIS) ---
    if mid_original.type == 0 and canais:
        if not mid_original.tracks:
            raise ErroDeNegocio("Arquivo MIDI não possui tracks.")

        nova_track = mido.MidiTrack()
        abs_tick = 0
        ultimo_tick_mantido = 0

        for msg in mid_original.tracks[0]:
            abs_tick += msg.time

            # Meta‑eventos SEMPRE mantidos (andamento, compasso, etc.)
            if msg.is_meta:
                delta = abs_tick - ultimo_tick_mantido
                nova_track.append(msg.copy(time=delta))
                ultimo_tick_mantido = abs_tick
                continue

            # Eventos do canal selecionado: manter TODOS
            if hasattr(msg, 'channel') and msg.channel in canais:
                delta = abs_tick - ultimo_tick_mantido
                # Manter inclusive note_on com velocity=0 (funciona como note_off)
                nova_track.append(msg.copy(time=delta))
                ultimo_tick_mantido = abs_tick
            # else: ignorar completamente (canais não selecionados)

        novo_mid = mido.MidiFile(type=0, ticks_per_beat=mid_original.ticks_per_beat, clip=True)
        novo_mid.tracks.append(nova_track)
        novo_mid.save(caminho_saida)
        return caminho_saida

    # --- TRATAMENTO PARA MIDI TIPO 1 (TRACKS) ---
    novo_mid = mido.MidiFile(type=1, ticks_per_beat=mid_original.ticks_per_beat, clip=True)

    # Copia a primeira track (meta‑eventos)
    if mid_original.tracks:
        t0 = mido.MidiTrack()
        for msg in mid_original.tracks[0]:
            t0.append(msg.copy())
        novo_mid.tracks.append(t0)

    for idx in sorted(tracks):
        if idx >= len(mid_original.tracks):
            continue
        track = mid_original.tracks[idx]
        nt = mido.MidiTrack()
        for msg in track:
            if not msg.is_meta:   # meta‑eventos já estão na track 0
                nt.append(msg.copy())
        novo_mid.tracks.append(nt)

    novo_mid.save(caminho_saida)
    return caminho_saida


def exportar_parte_para_midi(caminho_completo: str, parte_id: str):
    return exportar_filtro_midi(caminho_completo, [parte_id])
