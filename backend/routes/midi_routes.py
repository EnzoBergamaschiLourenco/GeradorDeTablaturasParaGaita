import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, Dict
import os

from core.errors import ErroDeNegocio
from core.paths import resolver_caminho_seguro
from services import midi_file_service, gaita_translation_service

router = APIRouter()
logger = logging.getLogger(__name__)

MENSAGEM_ERRO_INESPERADO = "Erro interno ao processar a solicitação."


@router.get("/midi/partes/{caminho_completo:path}")
async def get_partes(caminho_completo: str):
    try:
        partes = midi_file_service.baixar_e_extrair_partes(caminho_completo)
        return {"partes": partes}
    except (ValueError, ErroDeNegocio) as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        logger.exception("Erro inesperado em GET /midi/partes/%s", caminho_completo)
        raise HTTPException(status_code=500, detail=MENSAGEM_ERRO_INESPERADO)


@router.get("/midi/exportar/{caminho_completo:path}/{parte_id}")
async def exportar_midi(
    caminho_completo: str,
    parte_id: str,
    tom: str = "C",        # parâmetros obrigatórios para gaita
    tipo: str = "diatonica",
    overrides: str = ""    # JSON string opcional
):
    try:
        overrides_dict = {}
        if overrides:
            import json
            overrides_dict = json.loads(overrides)

        caminho_arquivo = midi_file_service.exportar_tablatura_para_midi(
            caminho_completo, parte_id, tom, tipo, overrides_dict
        )
        return FileResponse(
            caminho_arquivo,
            media_type="audio/midi",
            filename=os.path.basename(caminho_arquivo)
        )
    except (ValueError, ErroDeNegocio) as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        logger.exception("Erro inesperado em GET /midi/exportar/%s/%s", caminho_completo, parte_id)
        raise HTTPException(status_code=500, detail=MENSAGEM_ERRO_INESPERADO)

@router.get("/midi/play/{caminho_completo:path}")
async def tocar_midi(
    caminho_completo: str,
    partes: Optional[str] = ""
):
    try:
        lista_partes = partes.split(",") if partes else []

        if not lista_partes:
            caminho = resolver_caminho_seguro(caminho_completo)

            return FileResponse(
                caminho,
                media_type="audio/midi"
            )

        caminho_saida = midi_file_service.exportar_filtro_midi(
            caminho_completo,
            lista_partes
        )

        return FileResponse(
            caminho_saida,
            media_type="audio/midi"
        )

    except (ValueError, ErroDeNegocio) as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        logger.exception("Erro inesperado em GET /midi/play/%s", caminho_completo)
        raise HTTPException(status_code=500, detail=MENSAGEM_ERRO_INESPERADO)


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
        resultado = gaita_translation_service.processar_traducao_gaita(
            caminho_completo=req.caminho_completo,
            parte_id=req.parte_id,
            tom=req.tom_gaita,
            tipo=req.tipo_gaita,
            overrides=req.overrides or {}
        )

        return {
            "posicoes": resultado
        }

    except (ValueError, ErroDeNegocio) as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        logger.exception("Erro inesperado em POST /midi/traduzir (parte_id=%s)", req.parte_id)
        raise HTTPException(status_code=500, detail=MENSAGEM_ERRO_INESPERADO)
