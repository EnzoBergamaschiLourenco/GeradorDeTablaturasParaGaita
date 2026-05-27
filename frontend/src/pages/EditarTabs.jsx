import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function EditarTablatura() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [usuario, setUsuario] = useState(null);
  const [conteudo, setConteudo] = useState('');

  // Dados fixos (Simulando o que viria da tablatura selecionada com o autor incluso)
  const tabData = {
    criador: "João da Gaita",
    musica: "Hallelujah",
    autorMusica: "Leonard Cohen" // Adicionado o autor da música aqui
  };

  // Verifica se o usuário está logado
  useEffect(() => {
    const dadosSalvos = localStorage.getItem('usuarioLogado');
    if (dadosSalvos) {
      setUsuario(JSON.parse(dadosSalvos));
    }
  }, []);

  const handleSalvarEdicao = () => {
    if (!usuario) {
      alert("⚠️ Você precisa estar logado para editar tablaturas!");
      navigate('/login');
      return;
    }

    setLoading(true);
    // Incluído 'autorMusica' no log dos dados salvos
    console.log({ musica: tabData.musica, autorMusica: tabData.autorMusica, conteudo, editor: usuario.nome });
    
    setTimeout(() => {
      alert("Edição salva com sucesso!");
      setLoading(false);
      navigate('/');
    }, 1000);
  };

  return (
    <div style={{ textAlign: 'center', marginTop: '50px', fontFamily: 'Arial' }}>
      <h2>Editar Tablatura</h2>

      <div style={{ display: 'flex', flexDirection: 'column', width: '350px', margin: '0 auto', gap: '15px' }}>
        
        {/* Cabeçalho igual ao "Visualizar" */}
        <div style={{ textAlign: 'left', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '5px', border: '1px solid #ddd' }}>
          <p style={{ margin: '5px 0' }}><strong>Música:</strong> {tabData.musica}</p>
          {/* Nova linha exibindo o Autor da Música embaixo do nome da música */}
          <p style={{ margin: '5px 0' }}><strong>Autor da Música:</strong> {tabData.autorMusica}</p>
          <p style={{ margin: '5px 0' }}><strong>Criado por:</strong> {tabData.criador}</p>
        </div>

        {/* Área de Edição igual ao "Criar" */}
        <textarea 
          placeholder="Edite a tablatura aqui..." 
          value={conteudo}
          onChange={(e) => setConteudo(e.target.value)}
          style={{ 
            padding: '15px', 
            height: '250px', 
            borderRadius: '4px', 
            border: '1px solid #e6db55', 
            backgroundColor: '#fffbe6',
            color: '#000',
            fontFamily: 'monospace',
            fontSize: '15px',
            resize: 'vertical'
          }}
        />

        <button 
          onClick={handleSalvarEdicao} 
          disabled={loading}
          style={{ 
            padding: '12px', 
            backgroundColor: '#007bff', 
            color: 'white', 
            border: 'none', 
            cursor: 'pointer',
            fontWeight: 'bold',
            borderRadius: '4px'
          }}
        >
          {loading ? 'Salvando...' : 'Salvar Edição'}
        </button>

        {/* Link para Voltar ao Menu */}
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