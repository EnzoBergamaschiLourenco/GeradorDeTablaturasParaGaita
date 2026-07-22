import os
import mido
from supabase import create_client
from dotenv import load_dotenv
import re

load_dotenv()
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

ARQUIVOS_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '../midiarchives'))

# ==========================================================
# FUNÇÕES AUXILIARES DE TEMPO (apenas para tradução gaita)
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
# LISTAGEM DE PARTES (apenas tracks com notas)
# ==========================================================
def baixar_e_extrair_partes(caminho_completo: str):
    caminho_local = os.path.join(ARQUIVOS_PATH, caminho_completo)
    os.makedirs(os.path.dirname(caminho_local), exist_ok=True)
    if not os.path.exists(caminho_local):
        try:
            response = supabase.storage.from_("Arquivos MIDI").download(caminho_completo)
            with open(caminho_local, "wb") as f:
                f.write(response)
        except Exception as e:
            raise Exception(f"Erro ao baixar '{caminho_completo}' do Supabase: {str(e)}")

    mid = mido.MidiFile(caminho_local)
    partes = []
    for i, track in enumerate(mid.tracks):
        possui_notas = any(msg.type == "note_on" and msg.velocity > 0 for msg in track)
        if possui_notas:
            nome = next((msg.name.strip() for msg in track if msg.type == "track_name" and msg.name.strip()), f"Trilha {i}")
            partes.append({"id": f"track_{i}", "nome": nome})
    return partes

# ==========================================================
# EXPORTAÇÃO DE MIDI LIMPO (COPIA DIRETA DAS TRACKS)
# ==========================================================
def exportar_filtro_midi(caminho_completo: str, partes_ids: list):
    caminho_origem = os.path.join(ARQUIVOS_PATH, caminho_completo)
    pasta_base = os.path.dirname(caminho_origem)
    nome_saida = f"temp_{'_'.join(partes_ids)}_{os.path.basename(caminho_completo)}"
    caminho_saida = os.path.join(pasta_base, nome_saida)

    # Sem cache – apaga se existir
    if os.path.exists(caminho_saida):
        os.remove(caminho_saida)

    mid_original = mido.MidiFile(caminho_origem)
    novo_mid = mido.MidiFile(type=1, ticks_per_beat=mid_original.ticks_per_beat)  # ← ALTERADO

    # 1. Copia a primeira track original (meta‑eventos: andamento, compasso, etc.)
    if mid_original.tracks:
        nova_track0 = mido.MidiTrack()
        for msg in mid_original.tracks[0]:
            nova_track0.append(msg.copy())
        novo_mid.tracks.append(nova_track0)

    # 2. Para cada parte selecionada, copia a track correspondente (sem meta‑eventos)
    indices_tracks = {int(pid.split("_")[1]) for pid in partes_ids if pid.startswith("track_")}

    for idx in sorted(indices_tracks):
        if idx >= len(mid_original.tracks):
            continue
        track = mid_original.tracks[idx]
        nova_track = mido.MidiTrack()
        for msg in track:
            if msg.is_meta:   # remove meta‑eventos (já estão na track0)
                continue
            nova_track.append(msg.copy())
        novo_mid.tracks.append(nova_track)

    novo_mid.save(caminho_saida)
    return caminho_saida

def exportar_parte_para_midi(caminho_completo: str, parte_id: str):
    return exportar_filtro_midi(caminho_completo, [parte_id])


# ==========================================================
# TRADUÇÃO PARA TABLATURA (INALTERADA)
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

    caminho_local = os.path.join(ARQUIVOS_PATH, caminho_completo)
    mid = mido.MidiFile(caminho_local)
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
            raise Exception(f"Track {idx_alvo} não encontrada.")
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
        raise Exception(f"Layout de gaita ({tom} {tipo}) não encontrado no banco de dados.")

    layout_id = layout_response.data[0]["id"]
    mapeamento_response = supabase.table("mapeamento_notas").select("nota_musical, comando_gaita").eq("layout_id", layout_id).execute()
    if not mapeamento_response.data:
        raise Exception(f"Nenhum mapeamento de notas cadastrado para o layout ({tom} {tipo}).")

    mapa_gaita = {nota_para_midi(item["nota_musical"]): item["comando_gaita"] for item in mapeamento_response.data}
    comandos_disponiveis = list(set(mapa_gaita.values()))
    notas_unicas = list(set(evento["nota_midi"] for evento in eventos_musicais))
    posicoes_validas = []
    melhor_offset = None
    menor_qtd_faltantes = float("inf")
    notas_faltantes_do_melhor = []

    for offset in [-24, -12, 0, 12, 24]:
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
            posicoes_validas.append({"offset": offset, "tablatura": comandos})
        else:
            if len(faltantes) < menor_qtd_faltantes:
                menor_qtd_faltantes = len(faltantes)
                melhor_offset = offset
                notas_faltantes_do_melhor = faltantes

    if posicoes_validas:
        return posicoes_validas

    detalhes_faltantes = []
    for nota in notas_faltantes_do_melhor:
        nota_alvo = nota + (melhor_offset if melhor_offset is not None else 0)
        nota_mais_proxima = min(mapa_gaita.keys(), key=lambda k: abs(k - nota_alvo)) if mapa_gaita else 0
        comando_sugerido = mapa_gaita.get(nota_mais_proxima, "1")
        detalhes_faltantes.append({"nota_midi_original": nota, "sugestao_comando": comando_sugerido})

    return {
        "status": "requer_ajuste",
        "detalhes": detalhes_faltantes,
        "comandos_disponiveis": sorted(comandos_disponiveis, key=lambda x: (len(x), x))
    }