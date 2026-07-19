import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

export default function Menu() {
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState(null);
  const [busca, setBusca] = useState('');
  const [mostrarSugestao, setMostrarSugestao] = useState(false);

  useEffect(() => {
    const dadosSalvos = localStorage.getItem('usuarioLogado');
    if (dadosSalvos) {
      setUsuario(JSON.parse(dadosSalvos));
    }
  }, []);

  useEffect(() => {
    const termo = busca.toLowerCase();

    if (
      termo.includes('visu') ||
      termo.includes('tab') ||
      termo.includes('ver')
    ) {
      setMostrarSugestao(true);
    } else {
      setMostrarSugestao(false);
    }
  }, [busca]);

  const handleLogout = () => {
    if (window.confirm('Deseja mesmo sair?')) {
      localStorage.removeItem('usuarioLogado');
      setUsuario(null);
      navigate('/login');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: '#f4f7fb',
        fontFamily: 'Arial, sans-serif',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden'
      }}
    >
      {/* Login/Perfil - Canto Superior Esquerdo */}
      <div
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          zIndex: 10
        }}
      >
        {usuario ? (
          <div onClick={() => navigate('/Perfil')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              backgroundColor: 'white',
              padding: '10px 14px',
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              overflow: 'hidden',
            }}
          >
            {usuario.foto_perfil ? (
              <img
                src={usuario.foto_perfil}
                alt="Perfil"
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '3px solid #007bff',
                  boxSizing: 'border-box'
                }}
                onError={(e) => { e.target.style.display = 'none'; }} // Se a foto falhar, esconde
              />
            ) : (
              /* Ícone de Usuário Local (SVG) */
              <svg viewBox="0 0 24 24" width="30" height="30" fill="#64748b">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            )}

            <div style={{ textAlign: 'left' }}>
              <span
                style={{
                  display: 'block',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  color: '#333'
                }}
              >
                {usuario.nome}
              </span>

              <span
                onClick={handleLogout}
                style={{
                  fontSize: '12px',
                  color: '#ff4d4d',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                Sair
              </span>
            </div>
          </div>
        ) : (
          <button
            onClick={() => navigate('/login')}
            style={{
              padding: '12px 24px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: 'bold',
              boxShadow: '0 4px 12px rgba(0,123,255,0.3)'
            }}
          >
            Login / Sign-In
          </button>
        )}
      </div>

      {/* Conteúdo Principal */}
      <div
        style={{
          width: '100%',
          maxWidth: '550px',
          backgroundColor: 'white',
          padding: '45px',
          borderRadius: '24px',
          boxShadow: '0 15px 40px rgba(0,0,0,0.08)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}
      >
        <h1
          style={{
            margin: 0,
            color: '#007bff',
            fontSize: '42px',
            fontWeight: 'bold'
          }}
        >
          HarmonicaTabs
        </h1>

        <p
          style={{
            marginTop: '12px',
            marginBottom: '35px',
            color: '#666',
            textAlign: 'center',
            lineHeight: '1.5'
          }}
        >
          Crie e visualize tablaturas para gaita de forma simples,
          rápida e intuitiva.
        </p>

        {/* Barra de Pesquisa */}
        <div
          style={{
            width: '100%',
            position: 'relative',
            marginBottom: '25px'
          }}
        >
          <input
            type="text"
            placeholder="Pesquisar tablaturas..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            style={{
              width: '100%',
              padding: '15px 18px',
              borderRadius: '14px',
              border: '1px solid #d8e3f0',
              fontSize: '15px',
              boxSizing: 'border-box',
              outline: 'none',
              transition: '0.2s'
            }}
          />

          {mostrarSugestao && busca.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                backgroundColor: 'white',
                border: '1px solid #d8e3f0',
                borderTop: 'none',
                borderRadius: '0 0 14px 14px',
                overflow: 'hidden',
                boxShadow: '0 8px 20px rgba(0,0,0,0.08)',
                zIndex: 5
              }}
            >
              <div
                onClick={() => navigate('/VisualizarTabs')}
                style={{
                  padding: '14px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: '#333',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                🔍 <strong>Visualizar Tablaturas</strong>
              </div>
            </div>
          )}
        </div>

        {/* Botão Principal */}
        <button
          onClick={() => navigate('/CriarTabs')}
          style={{
            width: '100%',
            padding: '16px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
            borderRadius: '14px',
            boxShadow: '0 6px 18px rgba(0,123,255,0.25)',
            transition: '0.2s'
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateY(0)';
          }}
        >
          CRIAR TABS
        </button>
      </div>
    </div>
  );
}