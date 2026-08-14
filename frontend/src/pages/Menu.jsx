import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import CustomModal from '../components/CustomModal';
import { useAuthUser } from '../hooks/useAuthUser';
import { useModal } from '../hooks/useModal';
import { buscarTonsPorTipo } from '../services/gaitaLayoutService';
import { buscarTablaturas } from '../services/tablaturaService';

export default function Menu() {

  const { modalConfig, showConfirm, closeModal } = useModal();

  const navigate = useNavigate();

  const { usuario, logout } = useAuthUser();
  const [busca, setBusca] = useState('');
  const [mostrarSugestao, setMostrarSugestao] = useState(false);

  // Estados da pesquisa e filtros
  const [pesquisaAtiva, setPesquisaAtiva] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [resultados, setResultados] = useState([]);

  // Campos de filtro
  const [filtroNomeMusica, setFiltroNomeMusica] = useState('');
  const [filtroAutorMusica, setFiltroAutorMusica] = useState('');
  const [filtroAutorTab, setFiltroAutorTab] = useState('');
  const [filtroTom, setFiltroTom] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');

  // Tons existentes para o tipo de gaita selecionado
  const [tonsFiltroDisponiveis, setTonsFiltroDisponiveis] = useState([]);
  const [carregandoTonsFiltro, setCarregandoTonsFiltro] = useState(false);

  const tiposDeGaita = [
    'Diatônica',
    'Trêmolo',
    'Cromática 10',
    'Cromática 12',
    'Cromática 14',
    'Cromática 16'
  ];

  // Sugestão de acesso à página de visualização
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

  // Busca os tons realmente existentes na tabela layouts_gaita.
  // Quando um tipo é selecionado, traz somente os tons daquele tipo.
  useEffect(() => {
    const buscarTonsDoTipo = async () => {
      setCarregandoTonsFiltro(true);

      try {
        const { data, error } = await buscarTonsPorTipo(filtroTipo);

        if (error) {
          console.error('Erro ao buscar tons disponíveis:', error);
          setTonsFiltroDisponiveis([]);
          return;
        }

        const tonsUnicos = [...new Set(
          (data || [])
            .map((item) => item.tom)
            .filter(Boolean)
        )];

        setTonsFiltroDisponiveis(tonsUnicos);

        // Se o tom selecionado não existir para o novo tipo,
        // volta para "Todos".
        if (filtroTom && !tonsUnicos.includes(filtroTom)) {
          setFiltroTom('');
        }
      } catch (err) {
        console.error('Falha ao buscar tons disponíveis:', err);
        setTonsFiltroDisponiveis([]);
      } finally {
        setCarregandoTonsFiltro(false);
      }
    };

    buscarTonsDoTipo();
  }, [filtroTipo]);

  const handleLogout = () => {
    showConfirm('Deseja mesmo sair?', {
      title: 'Sair da conta',
      type: 'warning',
      onConfirm: () => {
        // O que acontece se o usuário clicar em "Confirmar"
        logout();
        navigate('/login');
      }
    });
  };

  // Função para buscar tablaturas no Supabase
  const handleBuscarTablaturas = async (termoInicial = '') => {
    setCarregando(true);
    setPesquisaAtiva(true);

    try {
      const nomeParaBuscar = filtroNomeMusica || termoInicial;

      const { data, error } = await buscarTablaturas({
        nome: nomeParaBuscar,
        autorMusica: filtroAutorMusica,
        autorTab: filtroAutorTab,
        tom: filtroTom,
        tipo: filtroTipo
      });

      if (error) {
        console.error('Erro ao buscar no Supabase:', error);
        setResultados([]);
      } else if (data) {
        const formatados = data.map((item) => {
          const curtidasValidas = Array.isArray(item.curtidas)
            ? item.curtidas.filter((c) => c.bool_curtida !== false).length
            : 0;

          return {
            ...item,
            nome_musica: item.musicas?.nome || 'Música Sem Nome',
            autor_musica: item.musicas?.autor || 'Desconhecido',
            autor_tab: item.usuarios?.nome || 'Anônimo',
            tom_gaita: item.layouts_gaita?.tom || 'N/A',
            tipo_gaita: item.layouts_gaita?.tipo || 'N/A',
            midi_utilizado: item.arquivos_midi?.arquivo_midi || 'Nenhum',
            conteudo: item.tablatura,
            created_at: item.data,
            totalCurtidas: curtidasValidas
          };
        });

        // Ordenação: maior número de curtidas primeiro
        formatados.sort((a, b) => b.totalCurtidas - a.totalCurtidas);

        setResultados(formatados);
      }
    } catch (err) {
      console.error('Falha na busca:', err);
      setResultados([]);
    } finally {
      setCarregando(false);
    }
  };

  // Pesquisa pela barra principal
  const handlePesquisaPrincipal = () => {
    const termo = busca.trim();

    if (termo) {
      setFiltroNomeMusica(termo);
      handleBuscarTablaturas(termo);
    }
  };

  const handleKeyDownBusca = (e) => {
    if (e.key === 'Enter') {
      handlePesquisaPrincipal();
    }
  };

  // Volta para a tela inicial, escondendo os resultados.
  const voltarParaInicio = () => {
    setPesquisaAtiva(false);
    setResultados([]);
    setBusca('');
    setFiltroNomeMusica('');
    setFiltroAutorMusica('');
    setFiltroAutorTab('');
    setFiltroTom('');
    setFiltroTipo('');
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
        overflowY: 'auto',
        boxSizing: 'border-box',
        padding: '30px 20px 50px'
      }}
    >
      {/* Login/Perfil - Canto Superior Esquerdo */}
      <div
        style={{
          position: 'fixed',
          top: '20px',
          left: '20px',
          zIndex: 10
        }}
      >
        {usuario ? (
          <div
            onClick={() => navigate('/Perfil')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              backgroundColor: 'var(--color-bg-card)',
              padding: '10px 14px',
              borderRadius: '12px',
              boxShadow: '0 4px 12px var(--shadow-card)',
              overflow: 'hidden',
              cursor: 'pointer'
            }}
          >
            {usuario.foto_perfil ? (
              <img
                src={usuario.foto_perfil}
                alt="Perfil"
                style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '2px solid var(--color-primary)',
                  boxSizing: 'border-box'
                }}
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            ) : (
              <svg viewBox="0 0 24 24" width="30" height="30" fill="var(--color-text-slate-2)">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            )}

            <div style={{ textAlign: 'left' }}>
              <span
                style={{
                  display: 'block',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  color: 'var(--color-text-main)'
                }}
              >
                {usuario.nome}
              </span>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  handleLogout();
                }}
                style={{
                  fontSize: '12px',
                  color: 'var(--color-danger)',
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
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-text-on-primary)',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: 'bold',
              boxShadow: '0 4px 12px var(--shadow-button-primary-alt)'
            }}
          >
            Login / Sign-In
          </button>
        )}
      </div>

      {/* CONTEÚDO PRINCIPAL */}
      <CustomModal
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        onConfirm={modalConfig.onConfirm}
        onClose={closeModal}
      />
      <div
        style={{
          width: '100%',
          maxWidth: pesquisaAtiva ? '1000px' : '550px',
          margin: '70px auto 0',
          transition: 'max-width 0.3s ease'
        }}
      >
        {!pesquisaAtiva ? (
          /* ================= TELA INICIAL ================= */
          <div
            style={{
              width: '100%',
              backgroundColor: 'var(--color-bg-card)',
              padding: '45px',
              borderRadius: '24px',
              boxShadow: '0 15px 40px var(--shadow-card)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              boxSizing: 'border-box'
            }}
          >
            <h1
              style={{
                margin: 0,
                color: 'var(--color-primary)',
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
                color: 'var(--color-text-muted)',
                textAlign: 'center',
                lineHeight: '1.5'
              }}
            >
              Crie e visualize tablaturas para gaita de forma simples, rápida e
              intuitiva.
            </p>

            {/* Barra de Pesquisa Principal */}
            <div
              style={{
                width: '100%',
                position: 'relative',
                marginBottom: '25px'
              }}
            >
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Pesquisar tablaturas..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  onKeyDown={handleKeyDownBusca}
                  style={{
                    flex: 1,
                    padding: '15px 18px',
                    borderRadius: '14px',
                    border: 'var(--border-width-base) solid var(--color-border)',
                    fontSize: '15px',
                    boxSizing: 'border-box',
                    outline: 'none',
                    transition: '0.2s'
                  }}
                />

                <button
                  onClick={handlePesquisaPrincipal}
                  style={{
                    padding: '0 20px',
                    backgroundColor: 'var(--color-primary)',
                    color: 'var(--color-text-on-primary)',
                    border: 'none',
                    borderRadius: '14px',
                    cursor: 'pointer',
                    fontSize: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Pesquisar"
                >
                  🔍
                </button>
              </div>

              {mostrarSugestao && busca.length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    backgroundColor: 'var(--color-bg-card)',
                    border: 'var(--border-width-base) solid var(--color-border)',
                    borderTop: 'none',
                    borderRadius: '0 0 14px 14px',
                    overflow: 'hidden',
                    boxShadow: '0 8px 20px var(--shadow-card)',
                    zIndex: 5
                  }}
                >
                  <div
                    onClick={() => navigate('/VisualizarTabs')}
                    style={{
                      padding: '14px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      color: 'var(--color-text-main)',
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
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-text-on-primary)',
                border: 'none',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold',
                borderRadius: '14px',
                boxShadow: '0 6px 18px var(--shadow-button-primary)',
                transition: '0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              CRIAR TABS
            </button>
          </div>
        ) : (
          /* ================= TELA DE RESULTADOS ================= */
          <div
            style={{
              width: '100%',
              backgroundColor: 'var(--color-bg-card)',
              padding: '35px',
              borderRadius: '24px',
              boxShadow: '0 15px 40px var(--shadow-card)',
              boxSizing: 'border-box'
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '15px',
                marginBottom: '25px'
              }}
            >
              <div>
                <h1
                  style={{
                    margin: 0,
                    color: 'var(--color-primary)',
                    fontSize: '30px'
                  }}
                >
                  Resultados
                </h1>

                <p
                  style={{
                    margin: '7px 0 0',
                    color: 'var(--color-text-muted)',
                    fontSize: '14px'
                  }}
                >
                  {filtroNomeMusica
                    ? `Resultados para "${filtroNomeMusica}"`
                    : 'Filtre as tablaturas disponíveis'}
                </p>
              </div>

              <button
                onClick={voltarParaInicio}
                style={{
                  background: 'none',
                  border: 'var(--border-width-base) solid var(--color-border)',
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                  fontSize: '14px',
                  padding: '9px 14px',
                  borderRadius: '8px'
                }}
              >
                ✕
              </button>
            </div>

            {/* Filtros */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                marginBottom: '15px'
              }}
            >
              <input
                type="text"
                placeholder="Nome da música"
                value={filtroNomeMusica}
                onChange={(e) => setFiltroNomeMusica(e.target.value)}
                style={{
                  padding: '10px',
                  borderRadius: '8px',
                  border: 'var(--border-width-base) solid var(--color-border-neutral)'
                }}
              />

              <input
                type="text"
                placeholder="Autor da música"
                value={filtroAutorMusica}
                onChange={(e) => setFiltroAutorMusica(e.target.value)}
                style={{
                  padding: '10px',
                  borderRadius: '8px',
                  border: 'var(--border-width-base) solid var(--color-border-neutral)'
                }}
              />

              <input
                type="text"
                placeholder="Autor da tab"
                value={filtroAutorTab}
                onChange={(e) => setFiltroAutorTab(e.target.value)}
                style={{
                  padding: '10px',
                  borderRadius: '8px',
                  border: 'var(--border-width-base) solid var(--color-border-neutral)',
                  gridColumn: 'span 2'
                }}
              />

              {/* Dropdown Tom da Gaita */}
              <select
                value={filtroTom}
                onChange={(e) => setFiltroTom(e.target.value)}
                disabled={carregandoTonsFiltro}
                style={{
                  padding: '10px',
                  borderRadius: '8px',
                  border: 'var(--border-width-base) solid var(--color-border-neutral)',
                }}
              >
                <option value="">
                  {carregandoTonsFiltro
                    ? 'Carregando tons...'
                    : 'Tom da gaita (Todos)'}
                </option>

                {tonsFiltroDisponiveis.map((tom) => (
                  <option key={tom} value={tom}>
                    {tom}
                  </option>
                ))}
              </select>

              {/* Dropdown Tipo da Gaita */}
              <select
                value={filtroTipo}
                onChange={(e) => {
                  setFiltroTipo(e.target.value);
                  setFiltroTom('');
                }}
                style={{
                  padding: '10px',
                  borderRadius: '8px',
                  border: 'var(--border-width-base) solid var(--color-border-neutral)',
                }}
              >
                <option value="">Tipo da gaita (Todos)</option>

                {tiposDeGaita.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {tipo}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => handleBuscarTablaturas()}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-text-on-primary)',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Aplicar Filtros
            </button>

            <hr
              style={{
                border: 'none',
                borderTop: 'var(--border-width-base) solid var(--color-border-divider)',
                margin: '25px 0'
              }}
            />

            {/* Lista de Cards */}
            <h3 style={{ margin: '0 0 15px', color: 'var(--color-text-faint)' }}>
              Resultados
            </h3>

            {carregando ? (
              <p style={{ color: 'var(--color-text-muted)' }}>Carregando tablaturas...</p>
            ) : resultados.length === 0 ? (
              <p style={{ color: 'var(--color-text-light)' }}>
                Nenhuma tablatura encontrada.
              </p>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '15px'
                }}
              >
                {resultados.map((tab) => (
                  <div
                    key={tab.id}
                    onClick={() =>
                      navigate('/VisualizarTabs', { state: { tab } })
                    }
                    style={{
                      backgroundColor: 'var(--color-bg-card-alt)',
                      border: 'var(--border-width-base) solid var(--color-border-alt)',
                      borderRadius: '12px',
                      padding: '16px',
                      cursor: 'pointer',
                      transition: '0.2s ease',
                      boxShadow: '0 2px 6px var(--shadow-card-softer)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-primary)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-border-alt)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <h4
                      style={{
                        margin: '0 0 6px',
                        color: 'var(--color-primary)',
                        fontSize: '18px'
                      }}
                    >
                      {tab.nome_musica}
                    </h4>

                    <p
                      style={{
                        margin: '3px 0',
                        fontSize: '14px',
                        color: 'var(--color-text-secondary)'
                      }}
                    >
                      <strong>Autor da Música:</strong> {tab.autor_musica}
                    </p>

                    <p
                      style={{
                        margin: '3px 0',
                        fontSize: '14px',
                        color: 'var(--color-text-secondary)'
                      }}
                    >
                      <strong>Autor da Tab:</strong> {tab.autor_tab}
                    </p>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '10px',
                        marginTop: '12px',
                        fontSize: '12px',
                        color: 'var(--color-text-light)'
                      }}
                    >
                      <span>
                        🎵 {tab.tipo_gaita} — Tom {tab.tom_gaita}
                      </span>

                      <span>
                        📅{' '}
                        {tab.created_at
                          ? new Date(tab.created_at).toLocaleDateString()
                          : 'Data N/A'}
                      </span>

                      <span>👍 {tab.totalCurtidas} curtidas</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Botão de criar tablatura somente no final dos resultados */}
            <div
              style={{
                marginTop: '30px',
                paddingTop: '20px',
                borderTop: 'var(--border-width-base) solid var(--color-border-divider)'
              }}
            >
              <button
                onClick={() => navigate('/CriarTabs')}
                style={{
                  width: '100%',
                  padding: '16px',
                  backgroundColor: 'var(--color-primary)',
                  color: 'var(--color-text-on-primary)',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  borderRadius: '14px',
                  boxShadow: '0 6px 18px var(--shadow-button-primary)',
                  transition: '0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                CRIAR TABS
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}