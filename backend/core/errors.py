class ErroDeNegocio(Exception):
    """Erro esperado do domínio (ex.: layout não encontrado, arquivo inválido).

    As rotas em routes/midi_routes.py devolvem a mensagem deste erro direto
    para o cliente (HTTP 400), diferente de exceções não previstas, que são
    logadas no servidor e respondidas com uma mensagem genérica.
    """
    pass
