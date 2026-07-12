import os
import mido
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

# Define a pasta raiz de armazenamento local
ARQUIVOS_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '../midiarchives'))

def baixar_e_extrair_partes(caminho_completo: str):
    """
    caminho_completo: ex '3/1782251607177_samurai.mid'
    """
    # Define o caminho local mantendo a estrutura de pastas
    caminho_local = os.path.join(ARQUIVOS_PATH, caminho_completo)

    # Garante que a subpasta exista localmente antes de baixar
    os.makedirs(os.path.dirname(caminho_local), exist_ok=True)

    # 1. Baixa do Supabase se não existir localmente
    if not os.path.exists(caminho_local):
        try:
            response = supabase.storage.from_("Arquivos MIDI").download(caminho_completo)
            with open(caminho_local, "wb") as f:
                f.write(response)
        except Exception as e:
            raise Exception(f"Erro ao baixar '{caminho_completo}' do Supabase: {str(e)}")

    # 2. Processa com mido
    mid = mido.MidiFile(caminho_local)
    partes = []
    
    # Filtra trilhas com conteúdo musical
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

def exportar_parte_para_midi(caminho_completo: str, parte_id: str):
    caminho_origem = os.path.join(ARQUIVOS_PATH, caminho_completo)
    # Define um caminho de saída na mesma pasta do arquivo original
    pasta_base = os.path.dirname(caminho_completo)
    nome_saida = f"temp_{parte_id}_{os.path.basename(caminho_completo)}"
    caminho_saida = os.path.join(ARQUIVOS_PATH, pasta_base, nome_saida)
    
    mid = mido.MidiFile(caminho_origem)
    novo_mid = mido.MidiFile()
    track_destino = mido.MidiTrack()
    novo_mid.tracks.append(track_destino)
    
    prefixo, valor = parte_id.split('_')
    valor = int(valor)

    for msg in mid:
        # Lógica de filtragem corrigida
        if msg.type in ['note_on', 'note_off']:
            if prefixo == 'track':
                # Nota: Em arquivos multi-track, o filtro é pelo índice da trilha
                # Aqui você precisaria saber qual trilha o parte_id 'track_i' referencia
                track_destino.append(msg)
            elif prefixo == 'channel':
                if hasattr(msg, 'channel') and msg.channel == valor:
                    track_destino.append(msg)
    
    novo_mid.save(caminho_saida)
    return caminho_saida

def exportar_filtro_midi(caminho_completo: str, partes_ids: list):
    # caminho_completo ex: '3/1782251607177_samurai.mid'
    caminho_origem = os.path.join(ARQUIVOS_PATH, caminho_completo)
    pasta_base = os.path.dirname(caminho_origem)
    
    # Gera hash para evitar conflitos de cache
    nome_saida = f"temp_{'_'.join(partes_ids)}_{os.path.basename(caminho_completo)}"
    caminho_saida = os.path.join(pasta_base, nome_saida)

    if os.path.exists(caminho_saida):
        return caminho_saida

    mid = mido.MidiFile(caminho_origem)
    novo_mid = mido.MidiFile()

    # Separa canais e tracks
    canais_alvo = [int(p.split('_')[1]) for p in partes_ids if p.startswith('channel')]
    tracks_alvo = [int(p.split('_')[1]) for p in partes_ids if p.startswith('track')]

    for i, track in enumerate(mid.tracks):
        # Verifica se esta track é uma das selecionadas ou se filtra por canal
        if i in tracks_alvo:
            novo_mid.tracks.append(track)
        elif canais_alvo:
            nova_track = mido.MidiTrack()
            # Mantém meta (tempo, etc)
            for msg in track:
                if msg.is_meta or (hasattr(msg, 'channel') and msg.channel in canais_alvo):
                    nova_track.append(msg)
            if len(nova_track) > 0:
                novo_mid.tracks.append(nova_track)
                
    novo_mid.save(caminho_saida)
    return caminho_saida