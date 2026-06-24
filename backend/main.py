from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import midi_routes # Importe suas rotas aqui

app = FastAPI()

# --- CONFIGURAÇÃO DO CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], # Permite o seu React
    allow_credentials=True,
    allow_methods=["*"], # Permite GET, POST, etc.
    allow_headers=["*"], # Permite todos os headers
)

app.include_router(midi_routes.router)