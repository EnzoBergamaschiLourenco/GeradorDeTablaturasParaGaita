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

  // Lógica de sugestão tipo Google
  useEffect(() => {
    const termo = busca.toLowerCase();
    if (termo.includes('visu') || termo.includes('tab') || termo.includes('ver')) {
      setMostrarSugestao(true);
    } else {
      setMostrarSugestao(false);
    }
  }, [busca]);

  const handleLogout = () => {
    if (window.confirm("Deseja mesmo sair?")) {
      localStorage.removeItem('usuarioLogado');
      setUsuario(null);
      navigate('/login');
    }
  };

  return (
    <div style={{ 
      textAlign: 'center', 
      marginTop: '50px', 
      fontFamily: 'Arial',
      minHeight: '100vh' 
    }}>
      
      {/* Login/Perfil - Canto Superior Esquerdo */}
      <div style={{ 
        position: 'absolute', 
        top: '20px', 
        left: '20px', 
        zIndex: 10 
      }}>
        {usuario ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img 
              onClick={() => navigate('/perfil')}
              src={usuario.foto || 'https://via.placeholder.com/45'} 
              alt="Perfil" 
              style={{ width: '45px', height: '45px', borderRadius: '50%', border: '2px solid #007bff', cursor: 'pointer', objectFit: 'cover' }} 
            />
            <div style={{ textAlign: 'left' }}>
              <span style={{ display: 'block', fontWeight: 'bold', fontSize: '14px', color: '#333' }}>{usuario.nome}</span>
              <span 
                onClick={handleLogout}
                style={{ fontSize: '12px', color: '#ff4d4d', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Sair
              </span>
            </div>
          </div>
        ) : (
          <button 
            onClick={() => navigate('/login')}
            style={{ 
              padding: '10px 20px', 
              backgroundColor: '#007bff', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px', 
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Login / Sign-In
          </button>
        )}
      </div>

      {/* Conteúdo Centralizado */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        width: '350px', 
        margin: '0 auto' 
      }}>
        
        <h2 style={{ marginBottom: '30px' }}>HarmonicaTabs</h2>

        {/* Barra de Pesquisa com Sugestão */}
        <div style={{ width: '100%', position: 'relative', marginBottom: '20px' }}>
          <input 
            type="text" 
            placeholder="Pesquisar músicas..." 
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '10px', 
              borderRadius: '4px', 
              border: '1px solid #ccc',
              boxSizing: 'border-box',
              outline: 'none'
            }}
          />

          {/* Lista de Sugestões (Aparece ao digitar) */}
          {mostrarSugestao && busca.length > 0 && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              backgroundColor: 'white',
              border: '1px solid #ccc',
              borderTop: 'none',
              borderRadius: '0 0 4px 4px',
              textAlign: 'left',
              zIndex: 5,
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}>
              <div 
                onClick={() => navigate('/VisualizarTabs')}
                style={{
                  padding: '10px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: '#333',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#f8f9fa'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
              >
                🔍 <strong>Visualizar Tablaturas</strong>
              </div>
            </div>
          )}
        </div>

        {/* Botões de Ação - Apenas CRIAR TABS */}
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '10px' }}>
          <button 
            onClick={() => navigate('/CriarTabs')} 
            style={{ 
              padding: '12px', 
              backgroundColor: '#007bff', 
              color: 'white', 
              border: 'none', 
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
              borderRadius: '4px' 
            }}
          >
            CRIAR TABS
          </button>
        </div>
      </div>
    </div>
  );
}