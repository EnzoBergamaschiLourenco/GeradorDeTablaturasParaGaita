from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional # <-- IMPORT FALTANDO ADICIONADO AQUI
import os

# Importamos o módulo inteiro para poder usar midi_service.ARQUIVOS_PATH e midi_service.exportar_filtro_midi
from services import midi_service 

router = APIRouter()

@router.get("/midi/partes/{caminho_completo:path}")
async def get_partes(caminho_completo: str):
    try:
        # Passamos o caminho completo direto para o serviço
        partes = midi_service.baixar_e_extrair_partes(caminho_completo)
        return {"partes": partes}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/midi/exportar/{caminho_completo:path}/{parte_id}")
async def exportar_midi(caminho_completo: str, parte_id: str):
    try:
        # Passamos o caminho completo para a exportação
        caminho_arquivo = midi_service.exportar_parte_para_midi(caminho_completo, parte_id)
        
        if os.path.exists(caminho_arquivo):
            return FileResponse(caminho_arquivo, media_type='audio/midi', filename=os.path.basename(caminho_arquivo))
        else:
            raise HTTPException(status_code=404, detail="Arquivo não gerado")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@router.get("/midi/play/{caminho_completo:path}")
def tocar_midi(caminho_completo: str, partes: Optional[str] = ""):
    # Transforma a string "track_1,channel_0" em uma lista
    lista_partes = partes.split(",") if partes else []
    
    if not lista_partes:
        # Se não enviou partes, retorna o arquivo original
        caminho = os.path.join(midi_service.ARQUIVOS_PATH, caminho_completo)
        return FileResponse(caminho, media_type="audio/midi")
        
    caminho_saida = midi_service.exportar_filtro_midi(caminho_completo, lista_partes)
    return FileResponse(caminho_saida, media_type="audio/midi")

class TraducaoRequest(BaseModel):
    musica_id: int
    parte_id: str
    tom_gaita: str
    tipo_gaita: str

@router.post("/midi/traduzir")
async def traduzir_tablatura(req: TraducaoRequest):
    try:
        # Assumindo que você tem o caminho salvo ou acessível
        # Ajuste conforme seu armazenamento
        caminho = f"{req.musica_id}/arquivo.mid" 
        posicoes = midi_service.processar_traducao_gaita(caminho, req.parte_id, req.tom_gaita, req.tipo_gaita)
        return {"posicoes": posicoes}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
