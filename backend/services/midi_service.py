import os
import mido
from supabase import create_client
from dotenv import load_dotenv
import re

load_dotenv()
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

ARQUIVOS_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '../midiarchives'))

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
# LISTAGEM DE PARTES (tracks para tipo 1, canais para tipo 0)
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
# ==========================================================
def extrair_canal_midi(caminho_completo: str, canal: int):
    """Retorna lista de eventos (notas + config) para o canal fornecido."""
    caminho_local = os.path.join(ARQUIVOS_PATH, caminho_completo)
    mid = mido.MidiFile(caminho_local)
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

    mid = mido.MidiFile(type=0, ticks_per_beat=tpb)  # tipo 0, uma única track
    mid.tracks.append(nova_track)
    mid.save(nome_saida)


# ==========================================================
# EXPORTAÇÃO DE MIDI LIMPO (suporta track e channel)
# ==========================================================
def exportar_filtro_midi(caminho_completo: str, partes_ids: list):
    caminho_origem = os.path.join(ARQUIVOS_PATH, caminho_completo)
    pasta_base = os.path.dirname(caminho_origem)
    nome_saida = f"temp_{'_'.join(partes_ids)}_{os.path.basename(caminho_completo)}"
    caminho_saida = os.path.join(pasta_base, nome_saida)

    if os.path.exists(caminho_saida):
        os.remove(caminho_saida)

    mid_original = mido.MidiFile(caminho_origem)

    canais = {int(p.split('_')[1]) for p in partes_ids if p.startswith('channel_')}
    tracks = {int(p.split('_')[1]) for p in partes_ids if p.startswith('track_')}

    # --- TRATAMENTO PARA MIDI TIPO 0 (CANAIS) ---
    if mid_original.type == 0 and canais:
        if not mid_original.tracks:
            raise Exception("Arquivo MIDI não possui tracks.")

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

        novo_mid = mido.MidiFile(type=0, ticks_per_beat=mid_original.ticks_per_beat)
        novo_mid.tracks.append(nova_track)
        novo_mid.save(caminho_saida)
        return caminho_saida

    # --- TRATAMENTO PARA MIDI TIPO 1 (TRACKS) ---
    novo_mid = mido.MidiFile(type=1, ticks_per_beat=mid_original.ticks_per_beat)

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

    # Interceptamos um comando oculto do frontend para forçar a avaliação de um offset específico pós-ajuste
    target_offset = None
    if "__target_offset__" in overrides:
        target_offset = int(overrides.pop("__target_offset__"))

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