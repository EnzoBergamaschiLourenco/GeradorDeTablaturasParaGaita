import os
import mido
from supabase import create_client
from dotenv import load_dotenv
import re

load_dotenv()
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

ARQUIVOS_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '../midiarchives'))

# ==========================================================
# FUNÇÕES AUXILIARES DE CONVERSÃO DE TEMPO (TICKS -> SEGUNDOS)
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
    current_tempo = 500000 # Padrão: 120 BPM
    
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

def _track_para_tempo_absoluto(track):
    eventos = []
    tempo = 0
    for msg in track:
        tempo += msg.time
        eventos.append((tempo, msg))
    return eventos

def _track_para_eventos_absolutos(track):
    eventos = []
    tempo_absoluto = 0
    for msg in track:
        tempo_absoluto += msg.time
        if msg.type != "end_of_track":
            eventos.append((tempo_absoluto, msg))
    return eventos

def _eventos_absolutos_para_track(eventos, duracao_total_ticks):
    nova_track = mido.MidiTrack()
    ultimo_tempo = 0
    for tempo_absoluto, msg in sorted(eventos, key=lambda x: x[0]):
        delta = tempo_absoluto - ultimo_tempo
        nova_track.append(msg.copy(time=delta))
        ultimo_tempo = tempo_absoluto

    tempo_restante = duracao_total_ticks - ultimo_tempo
    if tempo_restante < 0:
        tempo_restante = 0
    nova_track.append(mido.MetaMessage("end_of_track", time=tempo_restante))
    return nova_track

def _obter_duracao_total_ticks(mid):
    maior_duracao = 0
    for track in mid.tracks:
        tempo_absoluto = 0
        for msg in track:
            tempo_absoluto += msg.time
        maior_duracao = max(maior_duracao, tempo_absoluto)
    return maior_duracao

def _tempo_absoluto_para_track(eventos):
    nova = mido.MidiTrack()
    ultimo_tempo = 0
    for tempo, msg in sorted(eventos, key=lambda x: x[0]):
        delta = tempo - ultimo_tempo
        nova.append(msg.copy(time=delta))
        ultimo_tempo = tempo
    return nova

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
    trilhas_com_notas = []

    for track in mid.tracks:
        possui_notas = any(msg.type == "note_on" and msg.velocity > 0 for msg in track)
        if possui_notas:
            trilhas_com_notas.append(track)

    if len(trilhas_com_notas) > 1:
        for i, track in enumerate(trilhas_com_notas):
            nome = next((msg.name.strip() for msg in track if msg.type == "track_name" and msg.name.strip()), f"Trilha {i + 1}")
            partes.append({"id": f"track_{i}", "nome": nome})
    else:
        canais_encontrados = set()
        for track in mid.tracks:
            for msg in track:
                if msg.type == "note_on" and msg.velocity > 0 and hasattr(msg, "channel"):
                    canais_encontrados.add(msg.channel)
        for canal in sorted(canais_encontrados):
            partes.append({"id": f"channel_{canal}", "nome": f"Canal MIDI {canal + 1}"})
    return partes

def exportar_filtro_midi(caminho_completo: str, partes_ids: list):
    caminho_origem = os.path.join(ARQUIVOS_PATH, caminho_completo)
    pasta_base = os.path.dirname(caminho_origem)
    nome_saida = f"temp_{'_'.join(partes_ids)}_{os.path.basename(caminho_completo)}"
    caminho_saida = os.path.join(pasta_base, nome_saida)

    if os.path.exists(caminho_saida):
        return caminho_saida

    mid = mido.MidiFile(caminho_origem)
    duracao_total_ticks = _obter_duracao_total_ticks(mid)
    novo_mid = mido.MidiFile(type=mid.type, ticks_per_beat=mid.ticks_per_beat)

    trilhas_com_notas = [track for track in mid.tracks if any(msg.type == "note_on" and msg.velocity > 0 for msg in track)]
    tracks_alvo_indices = [int(parte.split("_")[1]) for parte in partes_ids if parte.startswith("track_")]
    canais_alvo = {int(parte.split("_")[1]) for parte in partes_ids if parte.startswith("channel_")}

    if tracks_alvo_indices:
        for indice in tracks_alvo_indices:
            if indice >= len(trilhas_com_notas):
                continue
            track_original = trilhas_com_notas[indice]
            eventos = _track_para_eventos_absolutos(track_original)
            nova_track = _eventos_absolutos_para_track(eventos, duracao_total_ticks)
            novo_mid.tracks.append(nova_track)
    elif canais_alvo:
        eventos_filtrados = []
        for track in mid.tracks:
            eventos = _track_para_eventos_absolutos(track)
            for tempo_absoluto, msg in eventos:
                manter = False
                if msg.is_meta: manter = True
                elif not hasattr(msg, "channel"): manter = True
                elif msg.channel in canais_alvo: manter = True
                if manter:
                    eventos_filtrados.append((tempo_absoluto, msg))
        nova_track = _eventos_absolutos_para_track(eventos_filtrados, duracao_total_ticks)
        novo_mid.tracks.append(nova_track)

    if not novo_mid.tracks:
        raise Exception("Nenhuma track ou canal válido foi encontrado.")

    for track in novo_mid.tracks:
        canais = set()
        possui_program_change = set()
        for msg in track:
            if not hasattr(msg, "channel"): continue
            canais.add(msg.channel)
            if msg.type == "program_change":
                possui_program_change.add(msg.channel)
        canais_sem_program_change = (canais - possui_program_change)
        if canais_sem_program_change:
            indice_insercao = 0
            while (indice_insercao < len(track) and track[indice_insercao].is_meta):
                indice_insercao += 1
            for canal in sorted(canais_sem_program_change):
                track.insert(indice_insercao, mido.Message("program_change", channel=canal, program=0, time=0))
                indice_insercao += 1

    novo_mid.save(caminho_saida)
    return caminho_saida

def exportar_parte_para_midi(caminho_completo: str, parte_id: str):
    return exportar_filtro_midi(caminho_completo, [parte_id])

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
        trilhas_com_notas = [track for track in mid.tracks if any(msg.type == "note_on" and msg.velocity > 0 for msg in track)]
        if idx_alvo >= len(trilhas_com_notas):
            raise Exception(f"Track {idx_alvo} não encontrada.")
        
        track = trilhas_com_notas[idx_alvo]
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

    layout = supabase.table("layouts_gaita").select("id").eq("tom", tom).eq("tipo", tipo).single().execute()
    if not layout.data:
        raise Exception(f"Layout de gaita ({tom} {tipo}) não encontrado.")

    layout_id = layout.data["id"]
    mapeamento = supabase.table("mapeamento_notas").select("nota_musical, comando_gaita").eq("layout_id", layout_id).execute()
    mapa_gaita = {nota_para_midi(item["nota_musical"]): item["comando_gaita"] for item in mapeamento.data}
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
        nota_alvo = nota + melhor_offset
        nota_mais_proxima = min(mapa_gaita.keys(), key=lambda k: abs(k - nota_alvo))
        comando_sugerido = mapa_gaita[nota_mais_proxima]
        detalhes_faltantes.append({
            "nota_midi_original": nota,
            "sugestao_comando": comando_sugerido
        })

    return {
        "status": "requer_ajuste",
        "detalhes": detalhes_faltantes,
        "comandos_disponiveis": sorted(comandos_disponiveis, key=lambda x: (len(x), x))
    }