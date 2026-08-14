import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import CustomModal from '../components/CustomModal';
import { useAuthUser } from '../hooks/useAuthUser';
import { useModal } from '../hooks/useModal';
import {
  contarCurtidas,
  usuarioCurtiu,
  removerCurtida,
  adicionarCurtida,
  atualizarTextoTablatura,
  excluirTablatura
} from '../services/tablaturaService';

export default function VisualizarTabs() {
  const { modalConfig, showAlert, showConfirm, closeModal } = useModal();

  const navigate = useNavigate();
  const location = useLocation();
  const tabRecebida = location.state?.tab;

  const { usuario } = useAuthUser();
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
    setTextoTablatura(tabData.conteudoOriginal);
  }, []);

  // Busca o status de curtida e o total atualizado no banco ao carregar
  useEffect(() => {
    const carregarCurtidas = async () => {
      if (!tabData.id) return;

      // Busca total de curtidas reais
      const { count } = await contarCurtidas(tabData.id);

      setTotalCurtidas(count || 0);

      // Checa se o usuário atual curtiu
      if (usuario) {
        const { data } = await usuarioCurtiu({ tablaturaId: tabData.id, usuarioId: usuario.id });

        if (data) setCurtido(true);
      }
    };

    carregarCurtidas();
  }, [usuario, tabData.id]);

  const handleCurtida = async () => {
    if (!usuario) {
      showAlert("⚠️ Você precisa estar logado para curtir esta tablatura!");
      navigate('/login');
      return;
    }

    if (!tabData.id) return;

    try {
      if (curtido) {
        // Remove a curtida
        const { error } = await removerCurtida({ usuarioId: usuario.id, tablaturaId: tabData.id });

        if (!error) {
          setCurtido(false);
          setTotalCurtidas((prev) => Math.max(0, prev - 1));
        }
      } else {
        // Adiciona a curtida
        const { error } = await adicionarCurtida({ usuarioId: usuario.id, tablaturaId: tabData.id });

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
      showAlert("A tablatura não pode estar vazia.");
      return;
    }

    setSalvando(true);
    const { error } = await atualizarTextoTablatura({ id: tabData.id, tablatura: textoTablatura });

    setSalvando(false);

    if (error) {
      console.error("Erro ao salvar:", error);
      showAlert("Erro ao salvar alterações.");
    } else {
      setEditando(false);
      showAlert("Tablatura atualizada com sucesso!");
    }
  };

  const handleExcluir = async () => {
    showConfirm('Tem certeza que deseja excluir esta tablatura? Essa ação não pode ser desfeita.', {
      title: 'Excluir tablatura',
      type: 'warning',
      onConfirm: async () => {
        try {
          const { error } = await excluirTablatura(tabData.id);

          if (error) throw error;

          showAlert("Tablatura excluída com sucesso!");
          navigate('/');
        } catch (error) {
          console.error("Erro ao excluir:", error);
          showAlert("Ocorreu um erro ao excluir a tablatura.");
        }
      }
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'var(--color-bg-page)',
        fontFamily: 'Arial, sans-serif',
        display: 'flex',
        overflow: 'hidden'
      }}
    >
      <CustomModal
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        onConfirm={modalConfig.onConfirm}
        onClose={closeModal}
      />
      {/* Botão Voltar - Canto Esquerdo */}
      <div style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 10 }}>
        <button
          onClick={() => navigate('/')}
          style={{
            padding: '10px 18px',
            backgroundColor: 'var(--color-bg-card)',
            color: 'var(--color-primary)',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            fontWeight: 'bold',
            boxShadow: '0 4px 12px var(--shadow-card)',
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
          backgroundColor: 'var(--color-bg-page)'
        }}
      >
        <div style={{
          width: '100%',
          height: '80%',
          maxWidth: '90%', // aumentado para melhor aproveitamento
          backgroundColor: 'var(--color-bg-paper)',
          borderRadius: '16px',
          border: 'var(--border-width-base) solid var(--color-border-paper)',
          boxShadow: '0 10px 30px var(--shadow-card-soft)',
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
                color: 'var(--color-text-main)'
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
                color: 'var(--color-text-main)'
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
          backgroundColor: 'var(--color-bg-card)',
          borderLeft: 'var(--border-width-base) solid var(--color-border-alt)',
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
          boxShadow: '0 15px 40px var(--shadow-card)',
          backgroundColor: 'var(--color-bg-card)'
        }}>

          {/* Topo do Card - Informações */}
          <h2 style={{ margin: '0 0 10px 0', color: 'var(--color-primary)', fontSize: '36px' }}>
            {tabData.musica}
          </h2>
          <hr style={{ border: 'none', borderTop: '2px solid var(--color-border-divider-alt)', marginBottom: '20px' }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '16px', color: 'var(--color-text-secondary)' }}>
            <p style={{ margin: 0 }}><strong>Autor da Música:</strong> {tabData.autorMusica}</p>
            <p style={{ margin: 0 }}><strong>Autor da Tab:</strong> {tabData.criador}</p>
            <p style={{ margin: 0 }}><strong>MIDI Utilizado:</strong> {tabData.midiUtilizado}</p>
            <p style={{ margin: 0 }}><strong>Tom / Tipo:</strong> Gaita {tabData.tomGaita} ({tabData.tipoGaita})</p>
            <p style={{ margin: 0 }}><strong>Data de Criação:</strong> {tabData.dataCriacao}</p>
          </div>

          <hr style={{ border: 'none', borderTop: '2px solid var(--color-border-divider-alt)', margin: '30px 0' }} />

          {/* Base do Card - Ações */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>

            {/* Botão de Curtida */}
            <button
              onClick={handleCurtida}
              style={{
                padding: '16px',
                backgroundColor: curtido ? 'var(--color-bg-liked)' : 'var(--color-bg-not-liked)',
                color: curtido ? 'var(--color-text-success)' : 'var(--color-text-main)',
                border: curtido ? '2px solid var(--color-border-liked)' : '2px solid var(--color-border)',
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
              <span style={{ backgroundColor: curtido ? 'var(--color-bg-liked-badge)' : 'var(--color-border-alt)', padding: '4px 10px', borderRadius: '20px', fontSize: '14px' }}>
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
                      backgroundColor: 'var(--color-success)',
                      color: 'var(--color-text-on-primary)',
                      border: 'none',
                      cursor: salvando ? 'not-allowed' : 'pointer',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      borderRadius: '12px',
                      boxShadow: '0 4px 12px var(--shadow-button-success)'
                    }}
                  >
                    {salvando ? 'Salvando...' : '💾 Salvar alterações'}
                  </button>
                ) : (
                  <button
                    onClick={() => setEditando(true)}
                    style={{
                      padding: '14px',
                      backgroundColor: 'var(--color-warning)',
                      color: 'var(--color-text-on-warning)',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      borderRadius: '12px',
                      boxShadow: '0 4px 12px var(--shadow-button-warning)'
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
                    color: 'var(--color-danger-strong)',
                    border: '2px solid var(--color-danger-strong)',
                    cursor: 'pointer',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    borderRadius: '12px',
                    transition: '0.2s'
                  }}
                  onMouseEnter={(e) => { e.target.style.backgroundColor = 'var(--color-danger-strong)'; e.target.style.color = 'var(--color-text-on-primary)'; }}
                  onMouseLeave={(e) => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = 'var(--color-danger-strong)'; }}
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