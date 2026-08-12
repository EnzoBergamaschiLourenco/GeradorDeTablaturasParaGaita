import os

ARQUIVOS_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '../midiarchives'))


def _garantir_dentro_da_raiz(caminho_absoluto: str) -> str:
    """Garante que o caminho resolvido permanece dentro de ARQUIVOS_PATH."""
    raiz_resolvida = os.path.realpath(ARQUIVOS_PATH)
    caminho_resolvido = os.path.realpath(caminho_absoluto)
    try:
        dentro_da_raiz = os.path.commonpath([caminho_resolvido, raiz_resolvida]) == raiz_resolvida
    except ValueError:
        # commonpath levanta ValueError quando os caminhos estão em drives diferentes (Windows)
        dentro_da_raiz = False

    if not dentro_da_raiz:
        raise ValueError(f"Caminho inválido ou fora do diretório permitido: '{caminho_absoluto}'")

    return caminho_resolvido


def resolver_caminho_seguro(caminho_relativo: str) -> str:
    """Resolve caminho_relativo dentro de ARQUIVOS_PATH, rejeitando tentativas de escape (ex.: '../')."""
    candidato = os.path.join(ARQUIVOS_PATH, caminho_relativo)
    return _garantir_dentro_da_raiz(candidato)
