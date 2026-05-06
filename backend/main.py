from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Permite que o React (porta 5173) acesse o Python (porta 8000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/auth/signup")
async def signup():
    return {"message": "Criação de conta"}

@app.post("/auth/login")
async def login():
    return {"token": "seu-jwt-aqui"}

@app.post("/auth/recovery")
async def recover_password():
    return {"message": "E-mail de recuperação enviado"}