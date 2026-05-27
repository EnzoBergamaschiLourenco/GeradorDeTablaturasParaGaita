import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function VisualizarTabs() {
  const navigate = useNavigate();
  const [curtido, setCurtido] = useState(false);
  const [usuario, setUsuario] = useState(null);

  // Verifica se o usuário está logado ao carregar a página
  useEffect(() => {
    const dadosSalvos = localStorage.getItem('usuarioLogado');
    if (dadosSalvos) {
      setUsuario(JSON.parse(dadosSalvos));
    }
  }, []);

  // Dados ilustrativos
  const tabData = {
    criador: "João da Gaita",
    musica: "Hallelujah",
    autorMusica: "Leonard Cohen",
    conteúdo: `
    +5   -5   -5   -5   -5   +5
    That Da-vid played and it 
    
      +5     -4    -4
    Pleased the Lord
    `
  };

  const handleCurtida = () => {
    if (usuario) {
      setCurtido(!curtido);
    } else {
      alert("⚠️ Você precisa estar logado para curtir esta tablatura!");
      navigate('/login');
    }
  };

  const handlePersonalizar = () => {
    if (usuario) {
      navigate('/CriarTabs');
    } else {
      alert("⚠️ Você precisa estar logado para personalizar ou editar tablaturas!");
      navigate('/login');
    }
  };

  const handleEditar = () => {
    if (usuario) {
      navigate('/EditarTabs');
    } else {
      alert("⚠️ Você precisa estar logado para editar!");
      navigate('/login');
    }
  };

  // Nova função para tratar a exclusão da tablatura
  const handleExcluir = () => {
    if (!usuario) {
      alert("⚠️ Você precisa estar logado para excluir uma tablatura!");
      navigate('/login');
      return;
    }

    // Abre a caixa de confirmação nativa (Sim/Não)
    const confirmou = window.confirm("Tem certeza que deseja excluir essa tablatura?");
    
    if (confirmou) {
      alert("Tablatura excluída com sucesso!");
      // Aqui você inseriria a lógica para deletar no banco de dados
      navigate('/'); // Redireciona para a página principal após excluir
    }
    // Caso escolha "Não", a caixa apenas fecha e nada acontece
  };

  return (
    <div style={{ textAlign: 'center', marginTop: '50px', fontFamily: 'Arial' }}>
      
      <h2>Visualizar Tablatura</h2>

      <div style={{ display: 'flex', flexDirection: 'column', width: '350px', margin: '0 auto', gap: '15px' }}>
        
        {/* Informações do Criador */}
        <div style={{ textAlign: 'left', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '5px', border: '1px solid #ddd' }}>
          <p style={{ margin: '5px 0' }}><strong>Música:</strong> {tabData.musica}</p>
          <p style={{ margin: '5px 0' }}><strong>Autor da Música:</strong> {tabData.autorMusica}</p>
          <p style={{ margin: '5px 0' }}><strong>Criado por:</strong> {tabData.criador}</p>
        </div>

        {/* Área da Tablatura */}
        <div style={{ 
          backgroundColor: '#fffbe6', 
          padding: '20px', 
          borderRadius: '5px', 
          border: '1px solid #e6db55',
          textAlign: 'left',
          fontFamily: 'monospace',
          fontSize: '16px',
          whiteSpace: 'pre-wrap',
          boxShadow: 'inset 0 0 5px rgba(0,0,0,0.05)'
        }}>
          {tabData.conteúdo}
        </div>

        {/* Botão de Curtida */}
        <button 
          onClick={handleCurtida} 
          style={{ 
            padding: '10px', 
            backgroundColor: curtido ? '#28a745' : '#007bff', 
            color: 'white', 
            border: 'none', 
            cursor: 'pointer',
            fontSize: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            borderRadius: '4px',
            transition: '0.3s'
          }}
        >
          {curtido ? '👍 Curtido!' : '👍 Curtir Tablatura'}
        </button>

        {/* Botão Personalizar */}
        <button 
          onClick={handlePersonalizar}
          style={{ 
            padding: '10px', 
            backgroundColor: '#6c757d', 
            color: 'white', 
            border: 'none', 
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
            borderRadius: '4px'
          }}
        >
          Personalizar Tablatura
        </button>

        {/* Botão Editar */}
        <button 
          onClick={handleEditar}
          style={{ 
            padding: '10px', 
            backgroundColor: '#ffc107', 
            color: 'black', 
            border: 'none', 
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
            borderRadius: '4px'
          }}
        >
          Editar Tablatura
        </button>

        {/* Novo Botão Excluir (Posicionado embaixo do Editar) */}
        <button 
          onClick={handleExcluir}
          style={{ 
            padding: '10px', 
            backgroundColor: '#dc3545', 
            color: 'white', 
            border: 'none', 
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
            borderRadius: '4px'
          }}
        >
          Excluir Tablatura
        </button>

        {/* Link para Voltar */}
        <span 
          onClick={() => navigate('/')}
          style={{ color: '#666', cursor: 'pointer', textDecoration: 'underline', fontSize: '13px', marginTop: '5px' }}
        >
          Voltar ao Menu
        </span>

      </div>
    </div>
  );
}