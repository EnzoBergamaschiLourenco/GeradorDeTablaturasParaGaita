import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient'; // Ajuste o caminho se necessário

export default function Menu() {
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState(null);
  const [busca, setBusca] = useState('');
  const [mostrarSugestao, setMostrarSugestao] = useState(false);

  // Estados da pesquisa e filtros
  const [pesquisaAtiva, setPesquisaAtiva] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [resultados, setResultados] = useState([]);

  // Campos de Filtro na Coluna da Direita
  const [filtroNomeMusica, setFiltroNomeMusica] = useState('');
  const [filtroAutorMusica, setFiltroAutorMusica] = useState('');
  const [filtroAutorTab, setFiltroAutorTab] = useState('');
  const [filtroTom, setFiltroTom] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');

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

  // Função para buscar no Supabase baseada no Schema SQL
  const buscarTablaturas = async (termoInicial = '') => {
    setCarregando(true);
    setPesquisaAtiva(true);

    try {
      const nomeParaBuscar = filtroNomeMusica || termoInicial;

      // Define se usa !inner para filtrar estritamente a relação quando houver filtro ativo
      const joinMusicas = (nomeParaBuscar || filtroAutorMusica) ? '!inner' : '';
      const joinUsuarios = filtroAutorTab ? '!inner' : '';
      const joinGaita = (filtroTom || filtroTipo) ? '!inner' : '';

      // Monta a consulta trazendo os dados das tabelas relacionadas
      let query = supabase.from('tablaturas').select(`
        id,
        tablatura,
        data,
        usuario_id,
        musica_id,
        midi_id,
        gaita_id,
        musicas${joinMusicas} (
          id,
          nome,
          autor
        ),
        usuarios${joinUsuarios} (
          id,
          nome
        ),
        layouts_gaita${joinGaita} (
          id,
          tom,
          tipo
        ),
        arquivos_midi (
          id,
          arquivo_midi
        ),
        curtidas (
          id,
          bool_curtida
        )
      `);

      // Aplicando filtros nas tabelas relacionadas
      if (nomeParaBuscar) {
        query = query.ilike('musicas.nome', `%${nomeParaBuscar}%`);
      }
      if (filtroAutorMusica) {
        query = query.ilike('musicas.autor', `%${filtroAutorMusica}%`);
      }
      if (filtroAutorTab) {
        query = query.ilike('usuarios.nome', `%${filtroAutorTab}%`);
      }
      if (filtroTom) {
        query = query.eq('layouts_gaita.tom', filtroTom);
      }
      if (filtroTipo) {
        query = query.eq('layouts_gaita.tipo', filtroTipo);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Erro ao buscar no Supabase:', error);
      } else if (data) {
        // Formata os dados retornados para consumo simplificado na interface
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

        // 🔽 ORDENAÇÃO: do maior número de curtidas para o menor
        formatados.sort((a, b) => b.totalCurtidas - a.totalCurtidas);

        setResultados(formatados);
      }
    } catch (err) {
      console.error('Falha na busca:', err);
    } finally {
      setCarregando(false);
    }
  };

  // Dispara a busca ao clicar no botão de lupa ou ao pressionar Enter na barra principal
  const handlePesquisaPrincipal = () => {
    if (busca.trim() !== '') {
      setFiltroNomeMusica(busca);
      buscarTablaturas(busca);
    }
  };

  const handleKeyDownBusca = (e) => {
    if (e.key === 'Enter') {
      handlePesquisaPrincipal();
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
          <div
            onClick={() => navigate('/Perfil')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              backgroundColor: 'white',
              padding: '10px 14px',
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
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
                  border: '2px solid #007bff',
                  boxSizing: 'border-box'
                }}
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            ) : (
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
                onClick={(e) => {
                  e.stopPropagation();
                  handleLogout();
                }}
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

      {/* COLUNA DA ESQUERDA (Menu) */}
      <div
        style={{
          width: pesquisaAtiva ? '50%' : '100%',
          height: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          transition: 'width 0.3s ease',
          boxSizing: 'border-box',
          padding: '20px'
        }}
      >
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
            Crie e visualize tablaturas para gaita de forma simples, rápida e
            intuitiva.
          </p>

          {/* Barra de Pesquisa com Botão de Lupa */}
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
                  border: '1px solid #d8e3f0',
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
                  backgroundColor: '#007bff',
                  color: 'white',
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

            {mostrarSugestao && busca.length > 0 && !pesquisaAtiva && (
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

      {/* COLUNA DA DIREITA (Filtros + Resultados) */}
      {pesquisaAtiva && (
        <div
          style={{
            width: '50%',
            height: '100%',
            backgroundColor: 'white',
            borderLeft: '1px solid #e2e8f0',
            boxSizing: 'border-box',
            padding: '30px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <h2 style={{ margin: 0, color: '#333' }}>Filtros de Pesquisa</h2>
            <button
              onClick={() => setPesquisaAtiva(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#888',
                cursor: 'pointer',
                fontSize: '18px'
              }}
            >
              ✕ Fechar
            </button>
          </div>

          {/* Formulário de Filtros */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px'
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
                border: '1px solid #ccc'
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
                border: '1px solid #ccc'
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
                border: '1px solid #ccc',
                gridColumn: 'span 2'
              }}
            />

            {/* Dropdown Tom da Gaita */}
            <select
              value={filtroTom}
              onChange={(e) => setFiltroTom(e.target.value)}
              style={{
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid #ccc'
              }}
            >
              <option value="">Tom da gaita (Todos)</option>
              {['C', 'D', 'E', 'F', 'G', 'A', 'Bb'].map((tom) => (
                <option key={tom} value={tom}>
                  {tom}
                </option>
              ))}
            </select>

            {/* Dropdown Tipo da Gaita */}
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              style={{
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid #ccc'
              }}
            >
              <option value="">Tipo da gaita (Todos)</option>
              <option value="Diatônica">Diatônica</option>
              <option value="Cromática">Cromática</option>
            </select>
          </div>

          <button
            onClick={() => buscarTablaturas()}
            style={{
              padding: '12px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            Aplicar Filtros
          </button>

          <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '10px 0' }} />

          {/* Lista de Cards */}
          <h3 style={{ margin: 0, color: '#444' }}>Resultados</h3>

          {carregando ? (
            <p style={{ color: '#666' }}>Carregando tablaturas...</p>
          ) : resultados.length === 0 ? (
            <p style={{ color: '#888' }}>Nenhuma tablatura encontrada.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {resultados.map((tab) => (
                <div
                  key={tab.id}
                  onClick={() => navigate('/VisualizarTabs', { state: { tab } })}
                  style={{
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '16px',
                    cursor: 'pointer',
                    transition: '0.2s ease',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#007bff';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <h4 style={{ margin: '0 0 6px 0', color: '#007bff', fontSize: '18px' }}>
                    {tab.nome_musica}
                  </h4>
                  <p style={{ margin: '3px 0', fontSize: '14px', color: '#555' }}>
                    <strong>Autor da Música:</strong> {tab.autor_musica}
                  </p>
                  <p style={{ margin: '3px 0', fontSize: '14px', color: '#555' }}>
                    <strong>Autor da Tab:</strong> {tab.autor_tab}
                  </p>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginTop: '12px',
                      fontSize: '12px',
                      color: '#888'
                    }}
                  >
                    <span>
                      📅 {tab.created_at ? new Date(tab.created_at).toLocaleDateString() : 'Data N/A'}
                    </span>
                    <span>👍 {tab.totalCurtidas} curtidas</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}