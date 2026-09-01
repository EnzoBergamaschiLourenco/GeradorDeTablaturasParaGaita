import re

import mido

from core.errors import ErroDeNegocio
from core.paths import resolver_caminho_seguro
from core.supabase_client import supabase

# ==========================================================
# FUNÇÕES AUXILIARES DE TEMPO (usadas apenas pela tradução)
# ==========================================================
def _build_tempo_map(mid):
    tempos = []
    for track in mid.tracks:
        abs_tick = 0
        for msg in track:
            abs_tick += msg.time
            if msg.type == 'set_tempo':
                tempos.append((abs_tick, msg.tempo))
    tempos.sort(key=lambda x: x[0])
    return tempos

def _tick_to_second(target_tick, tpb, tempo_map):
    sec = 0.0
    current_tick = 0
    current_tempo = 500000
    for tempo_tick, tempo_val in tempo_map:
        if target_tick > tempo_tick:
            delta_ticks = tempo_tick - current_tick
            sec += mido.tick2second(delta_ticks, tpb, current_tempo)
            current_tick = tempo_tick
            current_tempo = tempo_val
        else:
            break
    delta_ticks = target_tick - current_tick
    sec += mido.tick2second(delta_ticks, tpb, current_tempo)
    return sec


# ==========================================================
# TRADUÇÃO PARA TABLATURA
# ==========================================================
def nota_para_midi(nota_str):
    notas_base = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11}
    match = re.match(r"([A-Ga-g][#b]?)(-?\d+)", nota_str)
    if not match: return -1
    nome, oitava = match.groups()
    nome = nome.capitalize()
    return notas_base[nome] + (int(oitava) + 1) * 12

def processar_traducao_gaita(caminho_completo, parte_id, tom, tipo, overrides=None):
    if overrides is None:
        overrides = {}

    # Interceptamos um comando oculto do frontend para forçar a avaliação de um offset específico pós-ajuste
    target_offset = None
    if "__target_offset__" in overrides:
        target_offset = int(overrides.pop("__target_offset__"))

    caminho_local = resolver_caminho_seguro(caminho_completo)
    mid = mido.MidiFile(caminho_local, clip=True)
    tpb = mid.ticks_per_beat
    tempo_map = _build_tempo_map(mid)

    is_channel = parte_id.startswith("channel")
    idx_alvo = int(parte_id.split("_")[1])
    eventos_musicais = []

    if is_channel:
        for track in mid.tracks:
            abs_tick = 0
            notas_abertas = {}
            for msg in track:
                abs_tick += msg.time
                if not hasattr(msg, "channel") or msg.channel != idx_alvo:
                    continue
                if msg.type == "note_on" and msg.velocity > 0:
                    notas_abertas[msg.note] = abs_tick
                elif msg.type == "note_off" or (msg.type == "note_on" and msg.velocity == 0):
                    if msg.note in notas_abertas:
                        inicio_tick = notas_abertas.pop(msg.note)
                        eventos_musicais.append({
                            "nota_midi": msg.note,
                            "inicio": _tick_to_second(inicio_tick, tpb, tempo_map),
                            "fim": _tick_to_second(abs_tick, tpb, tempo_map)
                        })
    else:
        if idx_alvo >= len(mid.tracks):
            raise ErroDeNegocio(f"Track {idx_alvo} não encontrada.")
        track = mid.tracks[idx_alvo]
        abs_tick = 0
        notas_abertas = {}
        for msg in track:
            abs_tick += msg.time
            if msg.type == "note_on" and msg.velocity > 0:
                notas_abertas[msg.note] = abs_tick
            elif msg.type == "note_off" or (msg.type == "note_on" and msg.velocity == 0):
                if msg.note in notas_abertas:
                    inicio_tick = notas_abertas.pop(msg.note)
                    eventos_musicais.append({
                        "nota_midi": msg.note,
                        "inicio": _tick_to_second(inicio_tick, tpb, tempo_map),
                        "fim": _tick_to_second(abs_tick, tpb, tempo_map)
                    })

    if not eventos_musicais:
        return []

    layout_response = supabase.table("layouts_gaita").select("id").eq("tom", tom).eq("tipo", tipo).execute()
    if not layout_response.data:
        raise ErroDeNegocio(f"Layout de gaita ({tom} {tipo}) não encontrado no banco de dados.")

    layout_id = layout_response.data[0]["id"]
    mapeamento_response = supabase.table("mapeamento_notas").select("nota_musical, comando_gaita").eq("layout_id", layout_id).execute()
    if not mapeamento_response.data:
        raise ErroDeNegocio(f"Nenhum mapeamento de notas cadastrado para o layout ({tom} {tipo}).")

    mapa_gaita = {nota_para_midi(item["nota_musical"]): item["comando_gaita"] for item in mapeamento_response.data}
    comandos_disponiveis = list(set(mapa_gaita.values()))
    notas_unicas = list(set(evento["nota_midi"] for evento in eventos_musicais))

    # Range abrangente de oitavas (de -4 a +4 oitavas)
    offsets_to_test = [-48, -36, -24, -12, 0, 12, 24, 36, 48]
    if target_offset is not None:
        offsets_to_test = [target_offset] # Se for confirmação do modal, avalia apenas a oitava pedida

    posicoes = []

    for offset in offsets_to_test:
        # Verifica se o deslocamento joga a música para fora do alcance técnico do MIDI (0 a 127)
        if min(notas_unicas) + offset < 0 or max(notas_unicas) + offset > 127:
            continue

        faltantes = []
        for nota in notas_unicas:
            nota_alvo = nota + offset
            if nota_alvo not in mapa_gaita and str(nota) not in overrides:
                faltantes.append(nota)

        if not faltantes:
            comandos = []
            for indice, evento in enumerate(eventos_musicais):
                nota_original = evento["nota_midi"]
                comando = overrides[str(nota_original)] if str(nota_original) in overrides else mapa_gaita[nota_original + offset]
                comandos.append({
                    "id": indice,
                    "nota_midi": nota_original,
                    "comando": comando,
                    "inicio": evento["inicio"],
                    "fim": evento["fim"]
                })
            posicoes.append({
                "offset": offset,
                "perfeita": True,
                "tablatura": comandos
            })
        else:
            detalhes_faltantes = []
            for nota in faltantes:
                nota_alvo = nota + offset

                if mapa_gaita:
                    # A nova lógica prioriza a mesma nota (modulo 12) em outra oitava.
                    # O multiplicador 1000 garante que a diferença de semitom pese muito mais
                    # do que a distância de oitavas na hora da escolha.
                    nota_mais_proxima = min(
                        mapa_gaita.keys(),
                        key=lambda k: (min(abs((k % 12) - (nota_alvo % 12)), 12 - abs((k % 12) - (nota_alvo % 12))) * 1000) + abs(k - nota_alvo)
                    )
                else:
                    nota_mais_proxima = 0

                comando_sugerido = mapa_gaita.get(nota_mais_proxima, "1")
                detalhes_faltantes.append({"nota_midi_original": nota, "sugestao_comando": comando_sugerido})

            posicoes.append({
                "offset": offset,
                "perfeita": False,
                "detalhes": detalhes_faltantes,
                "comandos_disponiveis": sorted(comandos_disponiveis, key=lambda x: (len(x), x))
            })

    # O retorno agora é SEMPRE uma lista estruturada de todas as opções de oitavas
    return posicoes
