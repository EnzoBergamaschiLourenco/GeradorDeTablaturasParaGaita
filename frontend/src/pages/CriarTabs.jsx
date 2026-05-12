import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function CriarTablatura() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [usuario, setUsuario] = useState(null); // Estado para armazenar o usuário

  const [musica, setMusica] = useState('');
  const [midiLink, setMidiLink] = useState('');
  const [conteudo, setConteudo] = useState('');

  // Verifica se o usuário está logado ao carregar a página
  useEffect(() => {
    const dadosSalvos = localStorage.getItem('usuarioLogado');
    if (dadosSalvos) {
      setUsuario(JSON.parse(dadosSalvos));
    }
  }, []);

  const handleSalvar = () => {
    // LÓGICA DE VERIFICAÇÃO: Impede salvar se não estiver logado
    if (!usuario) {
      alert("⚠️ Você precisa estar logado para criar e salvar tablaturas!");
      navigate('/login');
      return;
    }

    setLoading(true);
    console.log({ musica, midiLink, conteudo, autor: usuario.nome });
    
    setTimeout(() => {
      alert("Tablatura salva com sucesso!");
      setLoading(false);
      navigate('/');
    }, 1000);
  };

  const infoMidi = () => {
    alert(
      "Como buscar o link MIDI:\n\n" +
      "1. Acesse um site de biblioteca (ex: BitMidi).\n" +
      "2. Pesquise a música desejada.\n" +
      "3. Clique com o botão direito no botão de 'Download'.\n" +
      "4. Selecione 'Copiar endereço do link' e cole aqui."
    );
  };

  const infoNotas = () => {
    alert(
      "Tradução das Notas (Padrão):\n\n" +
      "Números Positivos (+5): Soprar\n" +
      "Números Negativos (-5): Aspirar\n" +
      "Use espaços para alinhar a nota com a letra da música abaixo."
    );
  };

  return (
    <div style={{ textAlign: 'center', marginTop: '50px', fontFamily: 'Arial' }}>
      <h2>Criar Nova Tablatura</h2>

      <div style={{ display: 'flex', flexDirection: 'column', width: '350px', margin: '0 auto', gap: '10px' }}>
        
        <input 
          type="text" 
          placeholder="Nome da Música" 
          value={musica}
          onChange={(e) => setMusica(e.target.value)}
          style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
        />

        <input 
          type="text" 
          placeholder="URL do Arquivo MIDI (.mid)" 
          value={midiLink}
          onChange={(e) => setMidiLink(e.target.value)}
          style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
        />

        <div style={{ display: 'flex', gap: '5px' }}>
          <button 
            onClick={infoMidi}
            style={{ flex: 1, padding: '8px', fontSize: '12px', cursor: 'pointer', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px' }}
          >
            🔍 O que é MIDI?
          </button>
          <button 
            onClick={infoNotas}
            style={{ flex: 1, padding: '8px', fontSize: '12px', cursor: 'pointer', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px' }}
          >
            🎵 Tradução Notas
          </button>
        </div>

        <hr style={{ width: '100%', margin: '10px 0', border: '0.5px solid #eee' }} />

        <textarea 
          placeholder="Cole ou digite a tablatura aqui..." 
          value={conteudo}
          onChange={(e) => setConteudo(e.target.value)}
          style={{ 
            padding: '15px', 
            height: '200px', 
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
          onClick={handleSalvar} 
          disabled={loading}
          style={{ 
            padding: '12px', 
            backgroundColor: '#007bff', 
            color: 'white', 
            border: 'none', 
            cursor: 'pointer',
            fontWeight: 'bold',
            marginTop: '10px'
          }}
        >
          {loading ? 'Salvando...' : 'Salvar Tablatura'}
        </button>

        {/* Aviso discreto caso o usuário não esteja logado */}
        {!usuario && (
          <p style={{ color: 'red', fontSize: '12px', margin: '5px 0' }}>
            * É necessário estar logado para salvar.
          </p>
        )}

        <button 
          onClick={() => navigate('/')}
          style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', textDecoration: 'underline', fontSize: '14px' }}
        >
          Cancelar e Voltar
        </button>
      </div>
    </div>
  );
}