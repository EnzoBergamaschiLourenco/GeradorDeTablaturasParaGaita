from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, Dict
import os

from services import midi_service

router = APIRouter()


@router.get("/midi/partes/{caminho_completo:path}")
async def get_partes(caminho_completo: str):
    try:
        partes = midi_service.baixar_e_extrair_partes(caminho_completo)
        return {"partes": partes}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/midi/exportar/{caminho_completo:path}/{parte_id}")
async def exportar_midi(caminho_completo: str, parte_id: str):
    try:
        caminho_arquivo = midi_service.exportar_parte_para_midi(
            caminho_completo,
            parte_id
        )

        if not os.path.exists(caminho_arquivo):
            raise HTTPException(status_code=404, detail="Arquivo não gerado")

        return FileResponse(
            caminho_arquivo,
            media_type="audio/midi",
            filename=os.path.basename(caminho_arquivo)
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/midi/play/{caminho_completo:path}")
async def tocar_midi(
    caminho_completo: str,
    partes: Optional[str] = ""
):
    try:
        lista_partes = partes.split(",") if partes else []

        if not lista_partes:
            caminho = os.path.join(
                midi_service.ARQUIVOS_PATH,
                caminho_completo
            )

            return FileResponse(
                caminho,
                media_type="audio/midi"
            )

        caminho_saida = midi_service.exportar_filtro_midi(
            caminho_completo,
            lista_partes
        )

        return FileResponse(
            caminho_saida,
            media_type="audio/midi"
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class TraducaoRequest(BaseModel):
    musica_id: int
    caminho_completo: str
    parte_id: str
    tom_gaita: str
    tipo_gaita: str
    overrides: Optional[Dict[str, str]] = None


@router.post("/midi/traduzir")
async def traduzir_tablatura(req: TraducaoRequest):
    try:
        resultado = midi_service.processar_traducao_gaita(
            caminho_completo=req.caminho_completo,
            parte_id=req.parte_id,
            tom=req.tom_gaita,
            tipo=req.tipo_gaita,
            overrides=req.overrides or {}
        )

        return {
            "posicoes": resultado
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )