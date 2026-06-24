from fastapi import APIRouter, HTTPException
from services.midi_service import *
from fastapi.responses import FileResponse
import os

router = APIRouter()

@router.get("/midi/partes/{caminho_completo:path}")
async def get_partes(caminho_completo: str):
    try:
        # Agora passamos o caminho completo direto para o serviço
        partes = baixar_e_extrair_partes(caminho_completo)
        return {"partes": partes}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/midi/exportar/{caminho_completo:path}/{parte_id}")
async def exportar_midi(caminho_completo: str, parte_id: str):
    try:
        # Passamos o caminho completo para a exportação
        caminho_arquivo = exportar_parte_para_midi(caminho_completo, parte_id)
        
        if os.path.exists(caminho_arquivo):
            return FileResponse(caminho_arquivo, media_type='audio/midi', filename=os.path.basename(caminho_arquivo))
        else:
            raise HTTPException(status_code=404, detail="Arquivo não gerado")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))