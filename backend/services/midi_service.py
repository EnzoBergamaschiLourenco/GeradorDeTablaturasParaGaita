import os
import mido
from supabase import create_client
from dotenv import load_dotenv
import re

load_dotenv()
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

ARQUIVOS_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '../midiarchives'))

def _track_para_tempo_absoluto(track):
    eventos = []
    tempo = 0

    for msg in track:
        tempo += msg.time
        eventos.append((tempo, msg))

    return eventos


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
    
    trilhas_com_notas = [t for t in mid.tracks if any(msg.type == 'note_on' for msg in t)]

    if len(trilhas_com_notas) > 1:
        for i, track in enumerate(trilhas_com_notas):
            nome = track.name.strip() if track.name.strip() else f"Trilha {i+1}"
            partes.append({"id": f"track_{i}", "nome": nome})
    else:
        canais_encontrados = set()
        for msg in mid:
            if msg.type == 'note_on' and hasattr(msg, 'channel'):
                canais_encontrados.add(msg.channel)
        for ch in sorted(canais_encontrados):
            partes.append({"id": f"channel_{ch}", "nome": f"Canal MIDI {ch+1}"})

    return partes

def exportar_filtro_midi(caminho_completo: str, partes_ids: list):
    caminho_origem = os.path.join(ARQUIVOS_PATH, caminho_completo)

    pasta_base = os.path.dirname(caminho_origem)
    nome_saida = f"temp_{'_'.join(partes_ids)}_{os.path.basename(caminho_completo)}"
    caminho_saida = os.path.join(pasta_base, nome_saida)

    if os.path.exists(caminho_saida):
        return caminho_saida

    mid = mido.MidiFile(caminho_origem)

    novo_mid = mido.MidiFile(
        type=mid.type,
        ticks_per_beat=mid.ticks_per_beat
    )

    canais_alvo = {
        int(p.split("_")[1])
        for p in partes_ids
        if p.startswith("channel_")
    }

    trilhas_com_notas = [
        t for t in mid.tracks
        if any(m.type == "note_on" for m in t)
    ]

    tracks_alvo = {
        trilhas_com_notas[int(p.split("_")[1])]
        for p in partes_ids
        if p.startswith("track_")
    }

    for track in mid.tracks:

        # ==========================
        # FILTRO POR TRACK
        # ==========================
        if tracks_alvo:

            if track in tracks_alvo:

                eventos = _track_para_tempo_absoluto(track)

                nova = _tempo_absoluto_para_track(eventos)

                novo_mid.tracks.append(nova)

            elif not any(m.type == "note_on" for m in track):
                novo_mid.tracks.append(
                    _tempo_absoluto_para_track(
                        _track_para_tempo_absoluto(track)
                    )
                )

            continue

        # ==========================
        # FILTRO POR CANAL
        # ==========================

        eventos = []

        for tempo, msg in _track_para_tempo_absoluto(track):

            manter = (
                msg.is_meta
                or not hasattr(msg, "channel")
                or msg.channel in canais_alvo
            )

            if manter:
                eventos.append((tempo, msg))

        if eventos:
            novo_mid.tracks.append(
                _tempo_absoluto_para_track(eventos)
            )

    # Garante Program Change
    for track in novo_mid.tracks:

        canais = set()
        possui_pc = set()

        for msg in track:

            if hasattr(msg, "channel"):

                canais.add(msg.channel)

                if msg.type == "program_change":
                    possui_pc.add(msg.channel)

        faltando = canais - possui_pc

        if faltando:

            indice = 0

            while indice < len(track) and track[indice].is_meta:
                indice += 1

            for canal in sorted(faltando):

                track.insert(
                    indice,
                    mido.Message(
                        "program_change",
                        channel=canal,
                        program=0,
                        time=0
                    )
                )

                indice += 1

    novo_mid.save(caminho_saida)

    return caminho_saida

def exportar_parte_para_midi(caminho_completo: str, parte_id: str):
    # Reaproveita a lógica blindada acima para não duplicar código e manter os mesmos mapeamentos de índice
    return exportar_filtro_midi(caminho_completo, [parte_id])

def obter_notas_da_parte(caminho_completo: str, parte_id: str):
    caminho_local = os.path.join(ARQUIVOS_PATH, caminho_completo)
    mid = mido.MidiFile(caminho_local)
    
    # Extrai apenas as notas (note_on) da parte selecionada (simplificado)
    notas = []
    # Nota: você precisará adaptar a lógica de busca da track correta conforme seu sistema
    track = mid.tracks[int(parte_id.split('_')[1])]
    for msg in track:
        if msg.type == 'note_on' and msg.velocity > 0:
            notas.append(msg.note)
    
    return list(set(notas)) # Retorna apenas notas únicas

def traduzir_notas_para_gaita(notas_midi, tom, tipo):
    # Busca mapeamento no Supabase
    layout = supabase.table("layouts_gaita").select("id").eq("tom", tom).eq("tipo", tipo).single().execute()
    layout_id = layout.data['id']
    
    mapeamento = supabase.table("mapeamento_notas").select("nota_musical, comando_gaita").eq("layout_id", layout_id).execute()
    
    # Converte mapeamento para um dicionário {60: "1", 62: "-1", ...}
    # Aqui você precisaria de uma função auxiliar para converter "C4" para MIDI 60
    return mapeamento.data

def nota_para_midi(nota_str):
    # Converte string (C4, Bb4, F#5) para o número MIDI (60, 70, 78)
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
    
    is_channel = parte_id.startswith('channel')
    idx_alvo = int(parte_id.split('_')[1])
    
    notas_musica_ordenadas = []
    
    # 1. Extrai a melodia NA ORDEM
    if is_channel:
        for track in mid.tracks:
            for msg in track:
                if msg.type == 'note_on' and msg.velocity > 0 and getattr(msg, 'channel', -1) == idx_alvo:
                    notas_musica_ordenadas.append(msg.note)
    else:
        trilhas_com_notas = [t for t in mid.tracks if any(m.type == 'note_on' for m in t)]
        track = trilhas_com_notas[idx_alvo]
        for msg in track:
            if msg.type == 'note_on' and msg.velocity > 0:
                notas_musica_ordenadas.append(msg.note)
    
    if not notas_musica_ordenadas:
        return []

    notas_unicas = list(set(notas_musica_ordenadas))
    
    # 2. Busca o dicionário da Gaita no Supabase
    layout = supabase.table("layouts_gaita").select("id").eq("tom", tom).eq("tipo", tipo).single().execute()
    if not layout.data:
        raise Exception(f"Layout de gaita ({tom} {tipo}) não encontrado no banco de dados.")
        
    layout_id = layout.data['id']
    mapeamento = supabase.table("mapeamento_notas").select("nota_musical, comando_gaita").eq("layout_id", layout_id).execute()
    
    mapa_gaita = {}
    for item in mapeamento.data:
        midi_val = nota_para_midi(item['nota_musical'])
        mapa_gaita[midi_val] = item['comando_gaita']
        
    comandos_disponiveis = list(set(mapa_gaita.values()))
    
    posicoes_validas = []
    melhor_offset = None
    menor_qtd_faltantes = float('inf')
    notas_faltantes_do_melhor = []
    
    # 3. Algoritmo de Janela Deslizante (Oitavas)
    for offset in [-24, -12, 0, 12, 24]:
        faltantes_nesta_oitava = []
        
        for nota in notas_unicas:
            nota_alvo = nota + offset
            # Se a nota alvo não tá na gaita e o usuário não enviou um override pra nota original
            if nota_alvo not in mapa_gaita and str(nota) not in overrides:
                faltantes_nesta_oitava.append(nota)
        
        # Se não falta nenhuma nota (ou todas as faltantes foram cobertas pelos overrides)
        if len(faltantes_nesta_oitava) == 0:
            tablatura = []
            for n in notas_musica_ordenadas:
                if str(n) in overrides:
                    tablatura.append(overrides[str(n)])
                else:
                    tablatura.append(mapa_gaita[n + offset])
                    
            posicoes_validas.append({
                "offset": offset,
                "tablatura": tablatura
            })
        else:
            # Guarda o offset que exige o menor número de adaptações
            if len(faltantes_nesta_oitava) < menor_qtd_faltantes:
                menor_qtd_faltantes = len(faltantes_nesta_oitava)
                melhor_offset = offset
                notas_faltantes_do_melhor = faltantes_nesta_oitava
                
    # Se achou pelo menos uma posição onde a música cabe perfeitamente
    if posicoes_validas:
        return posicoes_validas
        
    # 4. Se a música é fisicamente impossível na gaita, prepara os dados pro Modal
    detalhes_faltantes = []
    for nota in notas_faltantes_do_melhor:
        nota_alvo = nota + melhor_offset
        # Matemática: acha a chave do mapa (nota na gaita) cuja diferença para a nota alvo é a menor possível
        nota_mais_proxima = min(mapa_gaita.keys(), key=lambda k: abs(k - nota_alvo))
        comando_sugerido = mapa_gaita[nota_mais_proxima]
        
        detalhes_faltantes.append({
            "nota_midi_original": nota,
            "sugestao_comando": comando_sugerido
        })
        
    return {
        "status": "requer_ajuste",
        "detalhes": detalhes_faltantes,
        "comandos_disponiveis": sorted(comandos_disponiveis, key=lambda x: (len(x), x)) # Ordena os comandos de forma limpa
    }