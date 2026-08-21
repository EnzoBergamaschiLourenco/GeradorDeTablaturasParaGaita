import { useEffect, useRef, useState } from 'react';
import AnimatedMenuBar, { TOPBAR_CLEARANCE } from '../components/AnimatedMenuBar';
import { useAnimatedNavigate, CONTENT_FADE_MS } from '../hooks/useAnimatedNavigate';
import { buscarTonsPorTipo } from '../services/gaitaLayoutService';
import { buscarTablaturas } from '../services/tablaturaService';

// Estilos do controle de filtros recolhível — isolados aqui (mesmo padrão do
// bloco "Configurações da Gaita" de MontarTablatura.jsx) pra facilitar
// personalização sem mexer no restante da tela de resultados.
const filtrosStyles = {
  btnToggle: { padding: '4px 10px', fontSize: '12px', fontWeight: 'bold', backgroundColor: 'var(--color-bg-card-alt)', color: 'var(--color-primary)', border: 'var(--border-width-base) solid var(--color-border-alt)', borderRadius: '8px', cursor: 'pointer', flexShrink: 0 },
  btnLimpar: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', padding: 0, fontSize: '13px', backgroundColor: 'var(--color-bg-danger-soft)', color: 'var(--color-text-danger-strong)', border: 'var(--border-width-base) solid var(--color-danger)', borderRadius: '8px', cursor: 'pointer', flexShrink: 0 },
  resumo: { fontSize: '13px', color: 'var(--color-text-muted)' }
};

const RESULTADOS_POR_PAGINA = 15;

const OPCOES_ORDENACAO = [
  { valor: 'curtidas_desc', rotulo: 'Mais curtidas' },
  { valor: 'curtidas_asc', rotulo: 'Menos curtidas' },
  { valor: 'recentes', rotulo: 'Mais recentes' },
  { valor: 'antigas', rotulo: 'Mais antigas' },
  { valor: 'alfabetica_az', rotulo: 'Nome da música (A-Z)' },
  { valor: 'alfabetica_za', rotulo: 'Nome da música (Z-A)' }
];

// Ordenação aplicada só na exibição (não refaz a busca) — os resultados
// crus ficam guardados em `resultados` e são reordenados aqui conforme o
// critério escolhido em "Ordenar por".
function ordenarResultados(lista, criterio) {
  const copia = [...lista];

  switch (criterio) {
    case 'curtidas_asc':
      return copia.sort((a, b) => a.totalCurtidas - b.totalCurtidas);
    case 'recentes':
      return copia.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    case 'antigas':
      return copia.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    case 'alfabetica_az':
      return copia.sort((a, b) => a.nome_musica.localeCompare(b.nome_musica));
    case 'alfabetica_za':
      return copia.sort((a, b) => b.nome_musica.localeCompare(a.nome_musica));
    case 'curtidas_desc':
    default:
      return copia.sort((a, b) => b.totalCurtidas - a.totalCurtidas);
  }
}

// Botões de "Anterior / Próxima / Última" — usado antes e depois da lista de
// resultados (mesma navegação nos dois lugares, pra facilitar o uso em listas
// longas sem precisar rolar até o topo ou até o fim pra trocar de página).
function ControlesPaginacao({ paginaAtual, totalPaginas, onMudarPagina }) {
  if (totalPaginas <= 1) return null;

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '10px',
        padding: '14px 0'
      }}
    >
      <button type="button" onClick={() => onMudarPagina(1)} disabled={paginaAtual === 1} style={paginacaoStyles.btn(paginaAtual === 1)} title="Primeira página" aria-label="Primeira página">
        «
      </button>
      <button type="button" onClick={() => onMudarPagina(paginaAtual - 1)} disabled={paginaAtual === 1} style={paginacaoStyles.btn(paginaAtual === 1)} title="Página anterior" aria-label="Página anterior">
        ‹
      </button>

      <span style={paginacaoStyles.info}>
        Página {paginaAtual} de {totalPaginas}
      </span>

      <button type="button" onClick={() => onMudarPagina(paginaAtual + 1)} disabled={paginaAtual === totalPaginas} style={paginacaoStyles.btn(paginaAtual === totalPaginas)} title="Próxima página" aria-label="Próxima página">
        ›
      </button>
      <button type="button" onClick={() => onMudarPagina(totalPaginas)} disabled={paginaAtual === totalPaginas} style={paginacaoStyles.btn(paginaAtual === totalPaginas)} title="Última página" aria-label="Última página">
        »
      </button>
    </div>
  );
}

const paginacaoStyles = {
  btn: (desabilitado) => ({
    padding: '7px 12px',
    fontSize: '13px',
    fontWeight: 'bold',
    backgroundColor: 'var(--color-bg-card-alt)',
    color: desabilitado ? 'var(--color-text-light)' : 'var(--color-primary)',
    border: 'var(--border-width-base) solid var(--color-border-alt)',
    borderRadius: '8px',
    cursor: desabilitado ? 'default' : 'pointer',
    opacity: desabilitado ? 0.5 : 1
  }),
  info: { fontSize: '13px', color: 'var(--color-text-muted)', margin: '0 6px' }
};

export default function Menu() {

  // Barra de perfil (canto superior direito): expande para virar a barra de
  // menu completa quando a pesquisa está ativa OU quando o usuário clica em um
  // botão que leva para outra tela (login, perfil, criar tabs) — nesse caso a
  // navegação real só acontece depois que a animação termina de tocar, e o
  // conteúdo abaixo (fadeStyle) some/aparece junto, em vez de trocar de tela
  // de repente.
  const { expanded: navExpanded, contentVisible, navigateAnimated } = useAnimatedNavigate(false);
  const [busca, setBusca] = useState('');
  const [mostrarSugestao, setMostrarSugestao] = useState(false);

  const irParaLogin = () => navigateAnimated('/login', { expand: true });
  const irParaPerfil = () => navigateAnimated('/Perfil', { expand: true });
  const irParaCriarTabs = () => navigateAnimated('/CriarTabs', { expand: true });

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

  // Bloco de filtros recolhido por padrão ao entrar nos resultados, pra dar
  // foco à lista; "Editar" reabre os campos, "Recolher" some com eles de
  // novo — mesmo padrão de "Configurações da Gaita" em MontarTablatura.jsx.
  const [filtrosColapsados, setFiltrosColapsados] = useState(true);

  // Snapshot dos filtros realmente aplicados na última busca — separado dos
  // campos "ao vivo" acima (filtroNomeMusica etc.) pra que o cabeçalho
  // ("Resultados para X", contagem de filtros) só mude quando o usuário
  // clicar em "Aplicar Filtros", não a cada tecla digitada.
  const [filtrosAplicados, setFiltrosAplicados] = useState({
    nome: '', autorMusica: '', autorTab: '', tom: '', tipo: ''
  });
  const filtrosAtivos = Object.values(filtrosAplicados).filter((valor) => valor).length;

  // Paginação e ordenação da lista de resultados — puramente de exibição,
  // não disparam nova busca no Supabase. Toda nova busca volta pra página 1
  // e pro critério padrão (mais curtidas primeiro).
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [ordenacao, setOrdenacao] = useState('curtidas_desc');
  const topoListaRef = useRef(null);
  // Div raiz com o scroll de verdade da tela (position:fixed + overflowY:auto
  // — a página em si não rola, esse container interno é quem rola). Usado
  // pelo atalho de paginação de baixo pra voltar ao topo da TELA, não só da
  // lista.
  const scrollContainerRef = useRef(null);
  // true só entre o clique no atalho de baixo e o próximo commit do React —
  // sinaliza pro efeito abaixo que essa troca de página específica precisa
  // rolar pro topo.
  const deveRolarParaTopoRef = useRef(false);

  // Atalhos de paginação de cima da lista: rolam só até o início da lista
  // (já estão praticamente ali).
  const irParaPagina = (pagina) => {
    setPaginaAtual(pagina);
    topoListaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Atalhos de baixo, que ficam longe do topo da tela depois de uma lista
  // grande: levam o usuário de volta pro topo da tela inteira ao trocar de
  // página. O scroll só acontece dentro do useEffect (depois que o React já
  // trocou o conteúdo da lista pra nova página) — chamar scrollTo direto
  // aqui, na mesma passada que muda a página, deixava a rolagem instável:
  // o navegador começava a animar com a altura da página ANTIGA (ainda na
  // tela no exato instante do clique) e, no meio da animação suave, o
  // conteúdo trocava de altura (página nova, geralmente com menos itens),
  // fazendo o scroll parar antes de chegar ao topo.
  const irParaPaginaEVoltarAoTopo = (pagina) => {
    deveRolarParaTopoRef.current = true;
    setPaginaAtual(pagina);
    // O próprio botão clicado fica focado; alguns navegadores tentam manter
    // o elemento focado visível e brigam com a rolagem programática pro
    // topo. Tirando o foco aqui, isso não acontece.
    document.activeElement?.blur();
  };

  useEffect(() => {
    if (deveRolarParaTopoRef.current) {
      deveRolarParaTopoRef.current = false;
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [paginaAtual]);

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

  // Função para buscar tablaturas no Supabase
  const handleBuscarTablaturas = async (termoInicial = '') => {
    setCarregando(true);
    setPesquisaAtiva(true);
    // Toda nova busca reaplica o critério padrão (mais curtidas) e volta
    // pra primeira página, independente do que estava selecionado antes.
    setPaginaAtual(1);
    setOrdenacao('curtidas_desc');
    // Ao aplicar, recolhe os campos de filtro de volta — dá foco pros
    // resultados assim que a busca é feita, sem precisar de um clique extra.
    setFiltrosColapsados(true);

    try {
      const nomeParaBuscar = filtroNomeMusica || termoInicial;

      // Só agora — de fato aplicando a busca — o snapshot exibido no
      // cabeçalho é atualizado (ver comentário em filtrosAplicados).
      setFiltrosAplicados({
        nome: nomeParaBuscar,
        autorMusica: filtroAutorMusica,
        autorTab: filtroAutorTab,
        tom: filtroTom,
        tipo: filtroTipo
      });

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

  // Limpa só os campos de filtro (o que já foi aplicado na busca continua
  // valendo até "Aplicar Filtros" ser clicado de novo) — pensado pra
  // redefinir rápido antes de montar uma nova combinação de filtros.
  const limparCamposDeFiltro = () => {
    setFiltroNomeMusica('');
    setFiltroAutorMusica('');
    setFiltroAutorTab('');
    setFiltroTom('');
    setFiltroTipo('');
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
    setFiltrosColapsados(true);
    setFiltrosAplicados({ nome: '', autorMusica: '', autorTab: '', tom: '', tipo: '' });
    setPaginaAtual(1);
    setOrdenacao('curtidas_desc');
  };

  const resultadosOrdenados = ordenarResultados(resultados, ordenacao);
  const totalPaginas = Math.max(1, Math.ceil(resultadosOrdenados.length / RESULTADOS_POR_PAGINA));
  const paginaSegura = Math.min(paginaAtual, totalPaginas);
  const resultadosDaPagina = resultadosOrdenados.slice(
    (paginaSegura - 1) * RESULTADOS_POR_PAGINA,
    paginaSegura * RESULTADOS_POR_PAGINA
  );

  return (
    <div
      ref={scrollContainerRef}
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
      <AnimatedMenuBar
        expanded={pesquisaAtiva || navExpanded}
        onTitleClick={voltarParaInicio}
        onProfileClick={irParaPerfil}
        onLoginClick={irParaLogin}
      />

      {/* CONTEÚDO PRINCIPAL — fadeStyle: some ao navegar para outra tela, aparece com fade ao montar */}
      <div
        style={{
          width: '100%',
          maxWidth: pesquisaAtiva ? '1000px' : '550px',
          margin: `${TOPBAR_CLEARANCE}px auto 0`,
          opacity: contentVisible ? 1 : 0,
          transition: `max-width 0.3s ease, opacity ${CONTENT_FADE_MS}ms ease`
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
                    onClick={() => navigateAnimated('/VisualizarTabs', { expand: true })}
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
              onClick={irParaCriarTabs}
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
            {/* Título fixo à esquerda, isolado numa linha só sua — não se
                move conforme o texto da busca/filtros muda de tamanho. */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '15px',
                marginBottom: '10px'
              }}
            >
              <h1
                style={{
                  margin: 0,
                  color: 'var(--color-primary)',
                  fontSize: '30px',
                  flexShrink: 0
                }}
              >
                Resultados
              </h1>

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

            {/* Subtítulo (só reflete a última busca aplicada, não os campos
                sendo digitados) + controle de filtros na mesma linha, pra não
                ocupar espaço vertical extra — "Editar Filtros" expande os
                campos abaixo com animação, "Recolher Filtros" some com eles
                de novo, sem trocar de tela. Espaço embaixo só existe quando
                expandido (separa do grid de campos); recolhido, o espaço até
                a linha divisória vem só da margem da própria linha. */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px',
                marginBottom: filtrosColapsados ? 0 : '15px'
              }}
            >
              <p
                style={{
                  margin: 0,
                  color: 'var(--color-text-muted)',
                  fontSize: '14px'
                }}
              >
                {resultados.length} Resultado{resultados.length !== 1 ? 's' : ''}
                {filtrosAplicados.nome ? ` para "${filtrosAplicados.nome}"` : ''}
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {filtrosColapsados && (
                  <span style={filtrosStyles.resumo}>
                    {filtrosAtivos > 0
                      ? `${filtrosAtivos} filtro${filtrosAtivos > 1 ? 's' : ''} aplicado${filtrosAtivos > 1 ? 's' : ''}`
                      : 'Nenhum filtro aplicado'}
                  </span>
                )}
                {!filtrosColapsados && (
                  <button type="button" onClick={limparCamposDeFiltro} style={filtrosStyles.btnLimpar} title="Limpar filtros" aria-label="Limpar filtros">
                    🧹
                  </button>
                )}
                <button type="button" onClick={() => setFiltrosColapsados((prev) => !prev)} style={filtrosStyles.btnToggle}>
                  {filtrosColapsados ? 'Editar Filtros ▾' : 'Recolher Filtros ▴'}
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateRows: filtrosColapsados ? '0fr' : '1fr', transition: 'grid-template-rows 300ms ease' }}>
              <div style={{ overflow: 'hidden' }}>
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
              </div>
            </div>

            {/* Separa os campos de filtro (recolhidos ou expandidos) da
                lista de resultados. Essa margem é a referência de espaçamento
                pros dois lados — o mesmo valor é usado no espaço entre o
                subtítulo e a linha quando os filtros estão recolhidos, e
                entre a linha e a linha "Ordenar por" logo abaixo. */}
            <hr
              style={{
                border: 'none',
                borderTop: 'var(--border-width-base) solid var(--color-border-divider)',
                margin: '10px 0'
              }}
            />

            {/* Lista de Cards — "Ordenar por" à esquerda e paginação
                centralizada, na mesma linha. Grid de 3 colunas (não flex com
                position:absolute) pra centralizar a paginação sem nunca
                sobrepor a ordenação — cada coluna reserva seu próprio
                espaço, então se a linha ficar estreita o conteúdo
                quebra/encolhe dentro da própria coluna em vez de invadir a
                vizinha. A paginação some daqui se não houver mais de uma
                página; a ordenação não se repete embaixo, diferente da
                paginação (que ajuda tanto no topo quanto no fim de listas
                longas). */}
            <div
              ref={topoListaRef}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
                alignItems: 'center',
                gap: '10px',
                marginTop: 0,
                marginBottom: '15px'
              }}
            >
              <div style={{ justifySelf: 'start', minWidth: 0, maxWidth: '100%' }}>
                {resultados.length > 0 && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '13px', color: 'var(--color-text-muted)', minWidth: 0 }}>
                    Ordenar por:
                    <select
                      value={ordenacao}
                      onChange={(e) => {
                        setOrdenacao(e.target.value);
                        setPaginaAtual(1);
                      }}
                      style={{
                        padding: '6px 8px',
                        borderRadius: '8px',
                        border: 'var(--border-width-base) solid var(--color-border-neutral)',
                        fontSize: '13px',
                        minWidth: 0,
                        maxWidth: '100%'
                      }}
                    >
                      {OPCOES_ORDENACAO.map((opcao) => (
                        <option key={opcao.valor} value={opcao.valor}>
                          {opcao.rotulo}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              <div style={{ justifySelf: 'center' }}>
                {!carregando && resultados.length > 0 && (
                  <ControlesPaginacao
                    paginaAtual={paginaSegura}
                    totalPaginas={totalPaginas}
                    onMudarPagina={irParaPagina}
                  />
                )}
              </div>
            </div>

            {carregando ? (
              <p style={{ color: 'var(--color-text-muted)' }}>Carregando tablaturas...</p>
            ) : resultados.length === 0 ? (
              <p style={{ color: 'var(--color-text-light)' }}>
                Nenhuma tablatura encontrada.
              </p>
            ) : (
              <>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '15px'
                  }}
                >
                  {resultadosDaPagina.map((tab) => (
                  <div
                    key={tab.id}
                    onClick={() =>
                      navigateAnimated('/VisualizarTabs', { expand: true, state: { tab } })
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

                <ControlesPaginacao
                  paginaAtual={paginaSegura}
                  totalPaginas={totalPaginas}
                  onMudarPagina={irParaPaginaEVoltarAoTopo}
                />
              </>
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
                onClick={irParaCriarTabs}
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