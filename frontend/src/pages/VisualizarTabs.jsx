import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient'; // Ajuste o caminho conforme o seu projeto

export default function VisualizarTabs() {
  const navigate = useNavigate();
  const location = useLocation();
  const tabRecebida = location.state?.tab;

  const [usuario, setUsuario] = useState(null);
  const [curtido, setCurtido] = useState(false);
  const [totalCurtidas, setTotalCurtidas] = useState(0);

  // Estados para edição
  const [editando, setEditando] = useState(false);
  const [textoTablatura, setTextoTablatura] = useState('');
  const [salvando, setSalvando] = useState(false);

  // Fallback e Mapeamento
  const tabData = {
    id: tabRecebida?.id || null,
    usuario_id: tabRecebida?.usuario_id || null,
    criador: tabRecebida?.autor_tab || tabRecebida?.usuarios?.nome || "João da Gaita",
    musica: tabRecebida?.nome_musica || tabRecebida?.musicas?.nome || "Hallelujah",
    autorMusica: tabRecebida?.autor_musica || tabRecebida?.musicas?.autor || "Leonard Cohen",
    midiUtilizado: tabRecebida?.midi_utilizado || tabRecebida?.arquivos_midi?.arquivo_midi || "Sem MIDI",
    tomGaita: tabRecebida?.tom_gaita || tabRecebida?.layouts_gaita?.tom || "C",
    tipoGaita: tabRecebida?.tipo_gaita || tabRecebida?.layouts_gaita?.tipo || "Diatônica",
    dataCriacao: tabRecebida?.created_at ? new Date(tabRecebida.created_at).toLocaleDateString() : "01/01/2026",
    conteudoOriginal: tabRecebida?.conteudo || tabRecebida?.tablatura || `
+5   -5   -5   -5   -5   +5
That Da-vid played and it 

  +5     -4    -4
Pleased the Lord
    `
  };

  const isOwner = usuario && tabData.usuario_id && usuario.id === tabData.usuario_id;

  useEffect(() => {
    const dadosSalvos = localStorage.getItem('usuarioLogado');
    if (dadosSalvos) {
      setUsuario(JSON.parse(dadosSalvos));
    }
    setTextoTablatura(tabData.conteudoOriginal);
  }, []);

  // Busca o status de curtida e o total atualizado no banco ao carregar
  useEffect(() => {
    const carregarCurtidas = async () => {
      if (!tabData.id) return;

      // Busca total de curtidas reais
      const { count } = await supabase
        .from('curtidas')
        .select('*', { count: 'exact', head: true })
        .eq('tablatura_id', tabData.id)
        .eq('bool_curtida', true);

      setTotalCurtidas(count || 0);

      // Checa se o usuário atual curtiu
      if (usuario) {
        const { data } = await supabase
          .from('curtidas')
          .select('id')
          .eq('tablatura_id', tabData.id)
          .eq('usuario_id', usuario.id)
          .eq('bool_curtida', true)
          .maybeSingle();

        if (data) setCurtido(true);
      }
    };

    carregarCurtidas();
  }, [usuario, tabData.id]);

  const handleCurtida = async () => {
    if (!usuario) {
      alert("⚠️ Você precisa estar logado para curtir esta tablatura!");
      navigate('/login');
      return;
    }

    if (!tabData.id) return;

    try {
      if (curtido) {
        // Remove a curtida
        const { error } = await supabase
          .from('curtidas')
          .delete()
          .match({ usuario_id: usuario.id, tablatura_id: tabData.id });

        if (!error) {
          setCurtido(false);
          setTotalCurtidas((prev) => Math.max(0, prev - 1));
        }
      } else {
        // Adiciona a curtida
        const { error } = await supabase
          .from('curtidas')
          .insert({
            usuario_id: usuario.id,
            tablatura_id: tabData.id,
            bool_curtida: true
          });

        if (!error) {
          setCurtido(true);
          setTotalCurtidas((prev) => prev + 1);
        }
      }
    } catch (error) {
      console.error("Erro ao curtir:", error);
    }
  };

  const handleSalvarEdicao = async () => {
    if (!textoTablatura.trim()) {
      alert("A tablatura não pode estar vazia.");
      return;
    }

    setSalvando(true);
    const { error } = await supabase
      .from('tablaturas')
      .update({ tablatura: textoTablatura })
      .eq('id', tabData.id);

    setSalvando(false);

    if (error) {
      console.error("Erro ao salvar:", error);
      alert("Erro ao salvar alterações.");
    } else {
      setEditando(false);
      alert("Tablatura atualizada com sucesso!");
    }
  };

  const handleExcluir = async () => {
    const confirmou = window.confirm("ATENÇÃO: Tem certeza que deseja excluir permanentemente essa tablatura?");

    if (confirmou && tabData.id) {
      try {
        // Como o schema não tem ON DELETE CASCADE, precisamos deletar as curtidas vinculadas primeiro
        await supabase
          .from('curtidas')
          .delete()
          .eq('tablatura_id', tabData.id);

        // Agora deletamos a tablatura
        const { error } = await supabase
          .from('tablaturas')
          .delete()
          .eq('id', tabData.id);

        if (error) throw error;

        alert("Tablatura excluída com sucesso!");
        navigate('/');
      } catch (error) {
        console.error("Erro ao excluir:", error);
        alert("Ocorreu um erro ao excluir a tablatura.");
      }
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
        overflow: 'hidden'
      }}
    >
      {/* Botão Voltar - Canto Esquerdo */}
      <div style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 10 }}>
        <button
          onClick={() => navigate('/')}
          style={{
            padding: '10px 18px',
            backgroundColor: 'white',
            color: '#007bff',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            fontWeight: 'bold',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          ← Voltar
        </button>
      </div>

      {/* COLUNA DA ESQUERDA (Texto da Tablatura) */}
      <div
        style={{
          width: '50%',
          height: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px', // ajustado para ocupar melhor o espaço
          boxSizing: 'border-box',
          backgroundColor: '#f4f7fb'
        }}
      >
        <div style={{
          width: '100%',
          height: '80%',
          maxWidth: '90%', // aumentado para melhor aproveitamento
          backgroundColor: '#fffbe6',
          borderRadius: '16px',
          border: '1px solid #e6db55',
          boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden' // para garantir que o conteúdo não vaze
        }}>
          {/* Área de Texto - sem cabeçalho */}
          {editando ? (
            <textarea
              value={textoTablatura}
              onChange={(e) => setTextoTablatura(e.target.value)}
              style={{
                flex: 1,
                padding: '20px',
                border: 'none',
                outline: 'none',
                backgroundColor: 'transparent', // fundo transparente (herda o amarelado)
                fontFamily: 'monospace',
                fontSize: '18px',
                resize: 'none',
                lineHeight: '1.6',
                color: '#333'
              }}
            />
          ) : (
            <div
              style={{
                flex: 1,
                padding: '20px',
                overflowY: 'auto',
                fontFamily: 'monospace',
                fontSize: '18px',
                whiteSpace: 'pre-wrap',
                lineHeight: '1.6',
                color: '#333'
              }}
            >
              {textoTablatura}
            </div>
          )}
        </div>
      </div>

      {/* COLUNA DA DIREITA (Card de Informações e Ações) */}
      <div
        style={{
          width: '50%',
          height: '100%',
          backgroundColor: 'white',
          borderLeft: '1px solid #e2e8f0',
          boxSizing: 'border-box',
          padding: '60px 40px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}
      >
        <div style={{
          width: '100%',
          maxWidth: '500px',
          margin: '0 auto',
          padding: '40px',
          borderRadius: '24px',
          boxShadow: '0 15px 40px rgba(0,0,0,0.08)',
          backgroundColor: 'white'
        }}>

          {/* Topo do Card - Informações */}
          <h2 style={{ margin: '0 0 10px 0', color: '#007bff', fontSize: '36px' }}>
            {tabData.musica}
          </h2>
          <hr style={{ border: 'none', borderTop: '2px solid #f0f0f0', marginBottom: '20px' }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '16px', color: '#555' }}>
            <p style={{ margin: 0 }}><strong>Autor da Música:</strong> {tabData.autorMusica}</p>
            <p style={{ margin: 0 }}><strong>Autor da Tab:</strong> {tabData.criador}</p>
            <p style={{ margin: 0 }}><strong>MIDI Utilizado:</strong> {tabData.midiUtilizado}</p>
            <p style={{ margin: 0 }}><strong>Tom / Tipo:</strong> Gaita {tabData.tomGaita} ({tabData.tipoGaita})</p>
            <p style={{ margin: 0 }}><strong>Data de Criação:</strong> {tabData.dataCriacao}</p>
          </div>

          <hr style={{ border: 'none', borderTop: '2px solid #f0f0f0', margin: '30px 0' }} />

          {/* Base do Card - Ações */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>

            {/* Botão de Curtida */}
            <button
              onClick={handleCurtida}
              style={{
                padding: '16px',
                backgroundColor: curtido ? '#e8f5e9' : '#f0f4f8',
                color: curtido ? '#2e7d32' : '#333',
                border: curtido ? '2px solid #4caf50' : '2px solid #d8e3f0',
                cursor: 'pointer',
                fontSize: '18px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                borderRadius: '14px',
                transition: '0.2s ease'
              }}
            >
              {curtido ? '💚 Curtido' : '🤍 Curtir'}
              <span style={{ backgroundColor: curtido ? '#c8e6c9' : '#e2e8f0', padding: '4px 10px', borderRadius: '20px', fontSize: '14px' }}>
                {totalCurtidas}
              </span>
            </button>

            {/* Controles do Dono da Tablatura */}
            {isOwner && (
              <>
                {editando ? (
                  <button
                    onClick={handleSalvarEdicao}
                    disabled={salvando}
                    style={{
                      padding: '14px',
                      backgroundColor: '#28a745',
                      color: 'white',
                      border: 'none',
                      cursor: salvando ? 'not-allowed' : 'pointer',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      borderRadius: '12px',
                      boxShadow: '0 4px 12px rgba(40,167,69,0.3)'
                    }}
                  >
                    {salvando ? 'Salvando...' : '💾 Salvar alterações'}
                  </button>
                ) : (
                  <button
                    onClick={() => setEditando(true)}
                    style={{
                      padding: '14px',
                      backgroundColor: '#ffc107',
                      color: 'black',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      borderRadius: '12px',
                      boxShadow: '0 4px 12px rgba(255,193,7,0.3)'
                    }}
                  >
                    ✏️ Editar Tablatura
                  </button>
                )}

                <button
                  onClick={handleExcluir}
                  style={{
                    padding: '14px',
                    backgroundColor: 'transparent',
                    color: '#dc3545',
                    border: '2px solid #dc3545',
                    cursor: 'pointer',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    borderRadius: '12px',
                    transition: '0.2s'
                  }}
                  onMouseEnter={(e) => { e.target.style.backgroundColor = '#dc3545'; e.target.style.color = 'white'; }}
                  onMouseLeave={(e) => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = '#dc3545'; }}
                >
                  🗑️ Deletar Tablatura
                </button>
              </>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}