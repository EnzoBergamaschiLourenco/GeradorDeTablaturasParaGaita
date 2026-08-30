import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as mm from '@magenta/music';
import * as s from '../styles/MontarTablaturaStyles';
import { useMidiPlayer, midiToNoteName } from '../hooks/useMidiPlayer';
import { supabase } from '../supabaseClient';
import CustomModal from '../components/CustomModal';
import LoadingOverlay from '../components/LoadingOverlay';
import TopBar from '../components/TopBar';
import { useAnimatedNavigate, fadeStyle } from '../hooks/useAnimatedNavigate';
import { useIsStacked, useIsCoarsePointer, useMediaQuery } from '../hooks/useMediaQuery';
import { useCarregamentoMinimo, usePontinhos } from '../hooks/useCarregamento';
import { useAuthUser } from '../hooks/useAuthUser';
import { useModal } from '../hooks/useModal';
import { buscarTonsPorTipo, buscarLayoutPorTomETipo } from '../services/gaitaLayoutService';
import { salvarNovaTablatura, avaliarMidi } from '../services/tablaturaService';
import { buscarPartesMidi, traduzirTablatura } from '../services/gaitaApiService';
import { entradaMontagemAutorizada } from '../utils/montagemGuard';

// Texto do aviso mostrado em qualquer tentativa de sair da montagem (edição
// ou revisão) sem ter salvo.
const MSG_SAIR_MONTAGEM = 'Tudo será perdido, deseja sair mesmo assim?';

// ================= COMPONENTE PRINCIPAL =================
export default function MontarTablatura() {
  const { modalConfig, showAlert, showConfirm, closeModal } = useModal();

  const [notaAvaliacao, setNotaAvaliacao] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  // Fica visível pelo tempo mínimo mesmo que a operação termine antes.
  const carregandoTela = useCarregamentoMinimo(isLoading);

  const location = useLocation();
  const navigate = useNavigate();
  const { expanded, contentVisible, navigateAnimated } = useAnimatedNavigate(true);

  // Guarda de entrada (ver utils/montagemGuard): true só quando a tela foi
  // aberta pelo "Criar Tabs" nesta sessão. Link direto e reload dão false —
  // aí o efeito abaixo redireciona pra /CriarTabs em vez de renderizar uma
  // tela quebrada, sem os dados/partes que vivem só em memória.
  const [acessoAutorizado] = useState(() => entradaMontagemAutorizada(location.key));
  // isStacked: abaixo de BP_STACK as duas colunas do editor empilham e a
  // página rola no fluxo normal (sem sticky de altura fixa).
  // isCoarse: em toque, habilita tap-to-place, botões de linha sempre
  // visíveis e alvos de toque maiores.
  const isStacked = useIsStacked();
  const isCoarse = useIsCoarsePointer();
  // Mesmo ponto (~760px) em que os campos de filtro do menu passam a quebrar
  // linha: daqui pra baixo, na tela de foco de uma parte, as setas ‹ › vão
  // pra uma linha abaixo do "Montar tablatura", liberando largura pro conteúdo.
  const setasFocoEmbaixo = useMediaQuery('(max-width: 760px)');

  const dadosRecebidos = location.state || {};
  const musicaId = dadosRecebidos.musicaId || 1;
  const nome = dadosRecebidos.nome || "Música Exemplo";
  const autor = dadosRecebidos.autor || "Autor Exemplo";
  const letra = dadosRecebidos.letra || "Insira a letra aqui...";
  const midiSelecionado = dadosRecebidos.midi || null;

  const [tipoGaita, setTipoGaita] = useState('');
  const [tomGaita, setTomGaita] = useState('');
  // Só reflete tipo/tom depois de "Aplicar Configurações" (ou "Confirmar Adaptações", se houver ajustes pendentes) — não a cada troca nos campos
  const [configAplicada, setConfigAplicada] = useState({ tipo: '', tom: '' });
  const configEmAplicacaoRef = useRef({ tipo: '', tom: '' });
  const [tonsDisponiveis, setTonsDisponiveis] = useState([]);
  const [carregandoTons, setCarregandoTons] = useState(false);
  const tiposDeGaitaOpcoes = ['Diatônica', 'Trêmolo', 'Cromática 10', 'Cromática 12', 'Cromática 14', 'Cromática 16'];
  // As "Configurações da Gaita" viraram um popup: abre sozinho ao entrar na
  // tela (obrigatório, sem botão de sair até aplicar) e pode ser reaberto
  // pelo botão de engrenagem ao lado de "Resetar Volumes" (aí opcional, com
  // ✕). Já aplicado uma vez => o ✕ aparece.
  const [modalConfigAberto, setModalConfigAberto] = useState(true);

  const [partesDisponiveis, setPartesDisponiveis] = useState([]);
  const [partesAdicionadas, setPartesAdicionadas] = useState([]);
  const [notasPorParte, setNotasPorParte] = useState({});
  const [dadosOitavas, setDadosOitavas] = useState({});
  // Modo "tela cheia" do bloco "Partes Ativas", pra acompanhar melhor a
  // reprodução com todas as partes visíveis de uma vez.
  const [partesMaximizado, setPartesMaximizado] = useState(false);
  // Linha visível na navegação linha-a-linha da montagem — usada quando a
  // tela empilha (abaixo de BP_STACK), no lugar da lista rolável de linhas.
  const [linhaFocoIndex, setLinhaFocoIndex] = useState(0);
  // Parte ativa mostrada acima do "Montar tablatura" no layout empilhado
  // (null => a primeira). O dropdown ao lado do nome troca de parte.
  const [parteVisivelId, setParteVisivelId] = useState(null);
  const [trocarParteVisivelAberto, setTrocarParteVisivelAberto] = useState(false);

  // === ESTADOS PARA MULTISELEÇÃO ===
  const [notasSelecionadas, setNotasSelecionadas] = useState([]);
  const [ultimaNotaClicada, setUltimaNotaClicada] = useState(null);

  const [isTraduzindo, setIsTraduzindo] = useState(false);
  // "..." animado dos botões "Aplicando" (config e modal de ajustes).
  const pontosAplic = usePontinhos(isTraduzindo || carregandoTela);

  // === AJUSTES DE NOTAS PENDENTES (agrupados em um único modal) ===
  // Cada item: { parteId, parteNome, offset, detalhes, comandosDisponiveis, mapeamento, novaOitavaIndex }
  const [ajustesPendentes, setAjustesPendentes] = useState([]);
  const modalAjusteAberto = ajustesPendentes.length > 0;
  const { usuario } = useAuthUser();

  const [linhasLetra, setLinhasLetra] = useState([]);
  const [dragOverInfo, setDragOverInfo] = useState(null);
  const [draggingIds, setDraggingIds] = useState([]);
  const [mostrarPreview, setMostrarPreview] = useState(false);
  const [hoveredLinhaIndex, setHoveredLinhaIndex] = useState(null);
  const [editingLinhaIndex, setEditingLinhaIndex] = useState(null);
  const [editingText, setEditingText] = useState("");

  const [user, setUser] = useState(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, []);

  const [textoTablatura, setTextoTablatura] = useState('');

  // ═══════════════ GUARDA DE SAÍDA (edição e revisão) ═══════════════
  // Montar a tablatura não pode ser abandonado por engano: nada é salvo até
  // "Salvar Tablatura". Enquanto esta tela está aberta — nas DUAS etapas
  // (edição e revisão) — toda forma de sair passa por uma confirmação:
  //  • título "HarmonicaTabs", chip de perfil e botão de login (via TopBar,
  //    que recebe `navegarComConfirmacao` no lugar de `navigateAnimated`);
  //  • botão Voltar do navegador (popstate + entrada-sentinela no histórico);
  //  • recarregar / fechar a aba / sair do site (beforeunload — alerta nativo).
  // A única saída sem pergunta é salvar com sucesso (handleSaveTablatura
  // chama `sairSemGuarda`).
  const guardaDesarmadaRef = useRef(false);
  const sentinelaRef = useRef(false);

  // Descarta a entrada-sentinela do histórico e só então navega, pra não
  // sobrar um "/MontarTablatura" vazio acessível pelo Voltar depois.
  const sairSemGuarda = useCallback((executarNavegacao) => {
    guardaDesarmadaRef.current = true;
    // A sentinela é a única entrada sem state do React Router (pushState(null)).
    if (sentinelaRef.current && window.history.state === null) {
      window.history.go(-1);
      setTimeout(executarNavegacao, 0);
    } else {
      executarNavegacao();
    }
  }, []);

  // Vai no lugar de `navigateAnimated` no TopBar: confirma antes de sair.
  const navegarComConfirmacao = useCallback((path, opts) => {
    if (guardaDesarmadaRef.current) {
      navigateAnimated(path, opts);
      return;
    }
    showConfirm(MSG_SAIR_MONTAGEM, {
      title: 'Sair sem salvar?',
      type: 'warning',
      confirmLabel: 'Sair sem salvar',
      onConfirm: () => {
        closeModal();
        sairSemGuarda(() => navigateAnimated(path, opts));
      }
    });
  }, [navigateAnimated, showConfirm, closeModal, sairSemGuarda]);

  // Entrada não autorizada (link direto ou reload): desarma as guardas de
  // saída e volta pro Criar Tabs, sem passar pela confirmação (não há o que
  // salvar — o estado da montagem já se perdeu).
  useEffect(() => {
    if (acessoAutorizado) return;
    guardaDesarmadaRef.current = true;
    // replace: não deixa /MontarTablatura no histórico (senão o Voltar cairia
    // de novo aqui e redirecionaria em looping visual).
    navigate('/CriarTabs', { replace: true });
  }, [acessoAutorizado, navigate]);

  // Voltar do navegador: mantém uma entrada-sentinela no topo do histórico e
  // intercepta o popstate pra confirmar antes de deixar a tela.
  useEffect(() => {
    if (!acessoAutorizado) return;
    if (!sentinelaRef.current) {
      window.history.pushState(null, '', window.location.href);
      sentinelaRef.current = true;
    }

    const onPopState = () => {
      if (guardaDesarmadaRef.current) return;
      // O Voltar consumiu a sentinela — repõe na hora pra segurar o usuário
      // enquanto ele decide no modal.
      window.history.pushState(null, '', window.location.href);
      showConfirm(MSG_SAIR_MONTAGEM, {
        title: 'Sair sem salvar?',
        type: 'warning',
        confirmLabel: 'Sair sem salvar',
        onConfirm: () => {
          closeModal();
          guardaDesarmadaRef.current = true;
          // -2 = a sentinela reposta + a própria entrada de MontarTablatura.
          window.history.go(-2);
        }
      });
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recarregar / fechar aba / sair do site: alerta nativo do navegador.
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (guardaDesarmadaRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  const {
    togglePlayAll, stop, seek, duration, isPlaying, playingId, tempoAtual, progress,
    alterarVolume, volumes, alternarSolo, resetarVolumes, soloParteId, changeSpeed, playbackSpeed = {}
  } = useMidiPlayer();

  const formatarPercentualVolume = (vol) => `${Math.round((vol ?? 1) * 100)}%`;
  const iconeVolume = (vol) => {
    const v = vol ?? 1;
    if (v <= 0) return '🔇';
    if (v < 0.5) return '🔈';
    if (v < 1) return '🔉';
    return '🔊';
  };

  // Pausa o player automaticamente quando entra em carregamento
  useEffect(() => {
    if (isLoading) {
      stop();
    }
  }, [isLoading, stop]);

  const formatarTempo = (segundos) => {
    const valor = (typeof segundos === 'number' && isFinite(segundos) && segundos > 0) ? segundos : 0;
    const min = Math.floor(valor / 60);
    const sec = Math.floor(valor % 60);
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  // Geração do texto da tablatura
  useEffect(() => {
    if (mostrarPreview) {
      const texto = linhasLetra
        .map(linha => {
          const comandos = linha.notas.map(n => n.valor).join(' ');
          const letra = linha.texto || '';
          if (!comandos && !letra) return '';
          return `${comandos}\n${letra}`;
        })
        .filter(line => line !== '')
        .join('\n');
      setTextoTablatura(texto);
    }
  }, [mostrarPreview, linhasLetra]);

  const handleSaveTablatura = async () => {
    if (!usuario) {
      showAlert("Usuário não autenticado.", "Aviso", "warning");
      return;
    }

    setIsLoading(true);
    try {
      const { data: layout, error: layoutError } = await buscarLayoutPorTomETipo({
        tom: tomGaita,
        tipo: tipoGaita
      });

      if (layoutError || !layout) {
        showAlert("Erro ao encontrar o layout da gaita. Verifique se o tom e tipo são válidos.", "Erro", "error");
        setIsLoading(false);
        return;
      }

      const dataAtual = new Date().toISOString().split('T')[0];

      const { data: tablaturaSalva, error: insertError } = await salvarNovaTablatura({
        tablatura: textoTablatura,
        data: dataAtual,
        usuarioId: usuario.id,
        midiId: midiSelecionado?.id,
        musicaId: musicaId,
        gaitaId: layout.id
      });

      if (insertError) {
        console.error(insertError);
        showAlert("Erro ao salvar tablatura.", "Erro", "error");
      } else {
        if (midiSelecionado?.id) {
          const { error: ratingError } = await avaliarMidi({
            usuarioId: usuario.id,
            midiId: midiSelecionado.id,
            nota: notaAvaliacao
          });

          if (ratingError) {
            console.error("Erro ao salvar a avaliação do MIDI:", ratingError);
          }
        }

        // Vai direto pra tela de visualização da tablatura recém-criada, em
        // vez de voltar pro menu — monta o mesmo formato de objeto que o
        // Menu passa pro VisualizarTabs ao clicar num resultado de busca.
        // Salvou: libera a guarda de saída e descarta a entrada-sentinela
        // antes de navegar (sem confirmação — o trabalho foi salvo).
        sairSemGuarda(() => navigateAnimated('/VisualizarTabs', {
          expand: true,
          state: {
            tab: {
              id: tablaturaSalva.id,
              usuario_id: usuario.id,
              autor_tab: usuario.nome,
              nome_musica: nome,
              autor_musica: autor,
              midi_utilizado: midiSelecionado?.arquivo_midi || 'Nenhum',
              tom_gaita: tomGaita,
              tipo_gaita: tipoGaita,
              created_at: dataAtual,
              conteudo: textoTablatura
            }
          }
        }));
      }
    } catch (err) {
      console.error(err);
      showAlert("Erro inesperado ao salvar.", "Erro", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const [cardsExpandidos, setCardsExpandidos] = useState({});
  const alternarExpansaoParte = (parteId) => {
    setCardsExpandidos(prev => ({ ...prev, [parteId]: !prev[parteId] }));
  };

  const notaEstaTocando = (nota, tempo) => {
    if (!nota) return false;
    const start = nota.startTime ?? nota.inicio;
    const end = nota.endTime ?? nota.fim;
    return tempo >= (start - 0.05) && tempo < (end + 0.05);
  };

  const parteEstaTocando = (parteId) => {
    const dados = notasPorParte[parteId];
    if (!dados) return false;
    return dados.some(nota => notaEstaTocando(nota, tempoAtual));
  };

  // Notas já alocadas nas linhas da letra
  const notasAlocadasSet = new Set();
  linhasLetra.forEach(linha => {
    linha.notas.forEach(nota => {
      if (nota.id) notasAlocadasSet.add(nota.id);
    });
  });

  // "Continuar" só é liberado com type/tom de gaita aplicados (qualquer um,
  // não importa qual) E pelo menos uma nota já colocada na tablatura.
  const configPronta = Boolean(configAplicada.tipo && configAplicada.tom);
  const temNotaAlocada = notasAlocadasSet.size > 0;
  const podeContinuar = configPronta && temNotaAlocada;

  // Índice da linha visível na navegação linha-a-linha (layout empilhado),
  // sempre dentro dos limites — a quantidade de linhas muda ao adicionar/
  // excluir linha.
  const linhaFocoSegura = Math.min(Math.max(linhaFocoIndex, 0), Math.max(0, linhasLetra.length - 1));
  // Parte mostrada acima do "Montar tablatura" no empilhado (fallback: 1ª).
  const parteVisivel = partesAdicionadas.find(p => p.id === parteVisivelId) || partesAdicionadas[0] || null;

  const handleContinuarClick = () => {
    if (!podeContinuar) {
      showAlert(
        "Aplique o tipo e o tom da gaita e adicione ao menos uma nota na tablatura antes de continuar.",
        "Complete a configuração",
        "warning"
      );
      return;
    }
    if (isPlaying) stop();
    setMostrarPreview(true);
  };

  const handleBtnPlayClick = () => {
    if (configAplicada.tipo && configAplicada.tom) {
      togglePlayAll(partesAdicionadas.map(p => p.id), midiSelecionado?.path, volumes);
    }
    else { showAlert("Por favor, selecione o Tipo e o Tom da gaita e aplique as configurações.", "Aviso", "warning"); }
  };

  useEffect(() => {
    if (letra) {
      setLinhasLetra(letra.split('\n').map((texto, index) => ({ id: `linha-${index}`, texto: texto, notas: [] })));
    }
    if (midiSelecionado) {
      setIsLoading(true);
      buscarPartesMidi(midiSelecionado.path)
        .then(data => {
          setPartesDisponiveis(data.partes);
          setPartesAdicionadas(data.partes);
        })
        .catch(err => console.error("Erro ao buscar partes:", err))
        .finally(() => setIsLoading(false));
    }
  }, [letra, midiSelecionado, musicaId]);

  const atualizarNotasDoCard = (parteId, tablaturaArray) => {
    const notasComId = tablaturaArray.map((notaObj) => ({
      ...notaObj,
      id: `nota-${parteId}-${notaObj.id}-${Date.now()}`,
      valor: notaObj.comando,
      parteOrigem: parteId
    }));
    setNotasPorParte(prev => ({ ...prev, [parteId]: notasComId }));
  };

  // Escolhe a melhor oitava (perfeita e mais próxima de 0) dentre as opções testadas pelo backend
  const escolherMelhorOitava = (data) => {
    const perfect0 = data.findIndex(p => p.offset === 0 && p.perfeita);
    if (perfect0 !== -1) return perfect0;

    let perfects = data.map((p, i) => ({ ...p, index: i })).filter(p => p.perfeita);
    if (perfects.length > 0) {
      perfects.sort((a, b) => Math.abs(a.offset) - Math.abs(b.offset));
      return perfects[0].index;
    }

    // Se nenhuma é perfeita, pega a que tiver menos detalhes faltando
    let imperfects = data.map((p, i) => ({ ...p, index: i }));
    imperfects.sort((a, b) => {
      if (a.detalhes.length !== b.detalhes.length) return a.detalhes.length - b.detalhes.length;
      return Math.abs(a.offset) - Math.abs(b.offset);
    });
    return imperfects[0].index;
  };

  // Processa TODAS as partes da fila de uma vez e acumula os ajustes pendentes
  // em um único lote, para exibir um só modal ao final (em vez de um por parte).
  const processarFilaTraducao = async (partesParaProcessar) => {
    setIsTraduzindo(true);
    setIsLoading(true);
    const novosAjustes = [];
    try {
      for (const parteEncontrada of partesParaProcessar) {
        try {
          const resData = await traduzirTablatura({
            musica_id: musicaId,
            caminho_completo: midiSelecionado.path,
            parte_id: parteEncontrada.id,
            tom_gaita: tomGaita,
            tipo_gaita: tipoGaita,
            overrides: null // Na primeira vez manda sem ajustes
          });

          const data = resData.posicoes; // Array com TODAS as oitavas testadas
          if (!Array.isArray(data) || data.length === 0) continue;

          const bestIndex = escolherMelhorOitava(data);

          setDadosOitavas(prev => ({
            ...prev,
            [parteEncontrada.id]: { posicoes: data, selecionada: bestIndex }
          }));

          const bestOption = data[bestIndex];

          if (bestOption.perfeita) {
            atualizarNotasDoCard(parteEncontrada.id, bestOption.tablatura);
          } else {
            const mapInicial = {};
            bestOption.detalhes.forEach(item => { mapInicial[item.nota_midi_original] = item.sugestao_comando; });
            novosAjustes.push({
              parteId: parteEncontrada.id,
              parteNome: parteEncontrada.nome,
              offset: bestOption.offset,
              detalhes: bestOption.detalhes,
              comandosDisponiveis: bestOption.comandos_disponiveis,
              mapeamento: mapInicial,
              novaOitavaIndex: null
            });
          }
        } catch (err) {
          console.error(err);
          showAlert(`Falha na tradução da parte ${parteEncontrada.nome}: \n${err.message}`, "Erro", "error");
        }
      }
    } finally {
      setIsTraduzindo(false);
      setIsLoading(false);
      if (novosAjustes.length > 0) {
        setAjustesPendentes(prev => [...prev, ...novosAjustes]);
      }
    }
    return novosAjustes;
  };

  const atualizarMapeamentoAjuste = (parteId, notaMidiOriginal, novoComando) => {
    setAjustesPendentes(prev => prev.map(ajuste =>
      ajuste.parteId === parteId
        ? { ...ajuste, mapeamento: { ...ajuste.mapeamento, [notaMidiOriginal]: novoComando } }
        : ajuste
    ));
  };

  // Confirma todos os ajustes pendentes de uma vez (um request por parte, em paralelo)
  const confirmarTodosAjustes = async () => {
    setIsLoading(true);
    const parteIdsAplicados = [];
    const falhas = [];
    try {
      await Promise.all(ajustesPendentes.map(async (ajuste) => {
        try {
          const resData = await traduzirTablatura({
            musica_id: musicaId,
            caminho_completo: midiSelecionado.path,
            parte_id: ajuste.parteId,
            tom_gaita: tomGaita,
            tipo_gaita: tipoGaita,
            // Passamos a oitava desejada escondida no dicionário
            overrides: { ...ajuste.mapeamento, __target_offset__: String(ajuste.offset) }
          });
          const data = resData.posicoes;

          // Se deu certo, a API devolveu apenas a opção selecionada com perfeita: true
          if (Array.isArray(data) && data.length > 0 && data[0].perfeita) {
            const novaTablatura = data[0].tablatura;

            setDadosOitavas(prev => {
              const posicoesAtuais = prev[ajuste.parteId]?.posicoes || [];
              const newPosicoes = [...posicoesAtuais];
              const updatedIndex = ajuste.novaOitavaIndex !== null ? ajuste.novaOitavaIndex : (prev[ajuste.parteId]?.selecionada ?? 0);
              newPosicoes[updatedIndex] = { ...newPosicoes[updatedIndex], perfeita: true, tablatura: novaTablatura, ajustadaManualmente: true };
              return {
                ...prev,
                [ajuste.parteId]: { posicoes: newPosicoes, selecionada: updatedIndex }
              };
            });

            atualizarNotasDoCard(ajuste.parteId, novaTablatura);
            parteIdsAplicados.push(ajuste.parteId);
          } else {
            falhas.push(ajuste.parteNome);
          }
        } catch (e) {
          console.error(e);
          falhas.push(ajuste.parteNome);
        }
      }));
    } finally {
      setIsLoading(false);
    }

    // Remove da lista pendente apenas as partes aplicadas com sucesso; falhas continuam no modal
    setAjustesPendentes(prev => prev.filter(a => !parteIdsAplicados.includes(a.parteId)));

    // Só agora (confirmação final do modal) o indicador de "gaita/tom em uso" é atualizado
    setConfigAplicada(configEmAplicacaoRef.current);

    if (falhas.length > 0) {
      showAlert(`Não foi possível aplicar os ajustes para: ${falhas.join(', ')}. Tente novamente.`, "Erro", "error");
    }
  };

  // Zera tipo/tom da gaita e limpa as partes ativas, voltando ao estado "Aguardando tradução"
  const limparConfiguracao = () => {
    setAjustesPendentes([]);
    setIsTraduzindo(false);
    setNotasPorParte({});
    setDadosOitavas({});
    setTipoGaita('');
    setTomGaita('');
    setConfigAplicada({ tipo: '', tom: '' });
  };

  // ✕ do popup de configuração — só existe quando já há uma config aplicada
  // (a primeira vez é obrigatória). Restaura os campos para a config em uso,
  // pra não deixar tipo/tom "meio trocados" sem aplicar.
  const fecharModalConfig = () => {
    setTipoGaita(configAplicada.tipo);
    setTomGaita(configAplicada.tom);
    setModalConfigAberto(false);
  };

  // "← Voltar" no modal de adaptações: descarta os ajustes pendentes e volta
  // ao popup obrigatório de escolha de tipo/tom (configAplicada ainda não foi
  // confirmada, então ele reabre em modo obrigatório, sem ✕).
  const fecharModalAjustes = () => {
    setAjustesPendentes([]);
    setIsTraduzindo(false);
    setModalConfigAberto(true);
  };

  // Só é disparado pelo botão "Aplicar Configurações" — selecionar os campos sozinho não traduz nada
  const aplicarConfiguracoes = async () => {
    if (!tipoGaita || !tomGaita) {
      showAlert("Por favor, selecione o Tipo e o Tom da gaita.", "Aviso", "warning");
      return;
    }
    if (isTraduzindo) return;

    configEmAplicacaoRef.current = { tipo: tipoGaita, tom: tomGaita };
    setAjustesPendentes([]);
    setNotasPorParte({});
    setDadosOitavas({});

    const novosAjustes = await processarFilaTraducao([...partesAdicionadas]);
    // Traduziu (com ou sem ajustes pendentes): fecha o popup de configuração.
    // Se houver ajustes, o modal de adaptações aparece por cima na sequência.
    if (Array.isArray(novosAjustes)) {
      setModalConfigAberto(false);
    }
    // Se nenhuma parte precisou de ajuste manual, já podemos atualizar o indicador aqui.
    // Caso contrário, ele só atualiza quando o usuário confirmar o modal de ajustes.
    if (!novosAjustes || novosAjustes.length === 0) {
      setConfigAplicada(configEmAplicacaoRef.current);
    }
  };

  const handleMudancaOitava = (parteId, novaOitavaIndex) => {
    const opcao = dadosOitavas[parteId].posicoes[novaOitavaIndex];

    // Se for perfeita nativamente, OU se já foi ajustada e salva pelo usuário antes
    if (opcao.perfeita || opcao.tablatura) {
      setDadosOitavas(prev => ({
        ...prev, [parteId]: { ...prev[parteId], selecionada: novaOitavaIndex }
      }));
      atualizarNotasDoCard(parteId, opcao.tablatura);
    } else {
      // Adiciona (ou substitui) o ajuste pendente dessa parte no modal agrupado
      const parte = partesAdicionadas.find(p => p.id === parteId);
      const mapInicial = {};
      opcao.detalhes.forEach(item => { mapInicial[item.nota_midi_original] = item.sugestao_comando; });

      setAjustesPendentes(prev => ([
        ...prev.filter(a => a.parteId !== parteId),
        {
          parteId,
          parteNome: parte?.nome,
          offset: opcao.offset,
          detalhes: opcao.detalhes,
          comandosDisponiveis: opcao.comandos_disponiveis,
          mapeamento: mapInicial,
          novaOitavaIndex
        }
      ]));
      // Obs: Não atualizamos 'selecionada' no estado, assim o <select> só muda se o modal for confirmado.
    }
  };

  // ---------- ARRASTAR NA BARRA DE PROGRESSO (estilo YouTube) ----------
  const [arrastandoBarra, setArrastandoBarra] = useState(false);
  const [percentArrasto, setPercentArrasto] = useState(0);
  const barraRectRef = useRef(null);
  const seekRef = useRef(seek);
  useEffect(() => { seekRef.current = seek; });

  const calcularPercentDoEvento = (clientX, rect) => {
    const x = clientX - rect.left;
    return Math.max(0, Math.min(100, (x / rect.width) * 100));
  };

  const iniciarArrastoBarra = (clientX, currentTarget, idClicado) => {
    if (playingId !== idClicado) return;
    const rect = currentTarget.getBoundingClientRect();
    barraRectRef.current = rect;
    const percent = calcularPercentDoEvento(clientX, rect);
    setPercentArrasto(percent);
    setArrastandoBarra(true);
    seekRef.current(percent);
  };

  const handleBarraMouseDown = (e, idClicado) => {
    iniciarArrastoBarra(e.clientX, e.currentTarget, idClicado);
  };

  // Mesma interação por toque (o drag nativo de mouse não dispara em touch).
  const handleBarraTouchStart = (e, idClicado) => {
    if (!e.touches[0]) return;
    iniciarArrastoBarra(e.touches[0].clientX, e.currentTarget, idClicado);
  };

  useEffect(() => {
    if (!arrastandoBarra) return;

    const moverPara = (clientX) => {
      if (!barraRectRef.current) return;
      setPercentArrasto(calcularPercentDoEvento(clientX, barraRectRef.current));
    };
    const soltarEm = (clientX) => {
      if (barraRectRef.current && typeof clientX === 'number') {
        seekRef.current(calcularPercentDoEvento(clientX, barraRectRef.current));
      }
      setArrastandoBarra(false);
    };

    const handleMove = (e) => moverPara(e.clientX);
    const handleUp = (e) => soltarEm(e.clientX);
    const handleTouchMove = (e) => { if (e.touches[0]) moverPara(e.touches[0].clientX); };
    const handleTouchEnd = (e) => soltarEm(e.changedTouches[0]?.clientX);

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [arrastandoBarra]);

  // ================= SELEÇÃO & DRAG AND DROP =================
  const handleNotaClick = (e, parteId, nota, index) => {
    if (notasAlocadasSet.has(nota.id)) return;
    if (e.shiftKey) e.preventDefault();

    if (e.ctrlKey || e.metaKey) {
      setNotasSelecionadas(prev => {
        if (prev.includes(nota.id)) return prev.filter(id => id !== nota.id);
        return [...prev, nota.id];
      });
      setUltimaNotaClicada({ parteId, index });
    } else if (e.shiftKey && ultimaNotaClicada && ultimaNotaClicada.parteId === parteId) {
      const start = Math.min(ultimaNotaClicada.index, index);
      const end = Math.max(ultimaNotaClicada.index, index);
      const rangeIds = notasPorParte[parteId].slice(start, end + 1).map(n => n.id);
      const newSet = new Set([...notasSelecionadas, ...rangeIds]);
      setNotasSelecionadas(Array.from(newSet));
    } else if (notasSelecionadas.length === 1 && notasSelecionadas[0] === nota.id) {
      // Toque simples numa nota que já é a única selecionada: desmarca
      // (funciona igual no notebook e no celular).
      setNotasSelecionadas([]);
      setUltimaNotaClicada(null);
    } else {
      setNotasSelecionadas([nota.id]);
      setUltimaNotaClicada({ parteId, index });
    }
  };

  const handleDragStart = (e, nota) => {
    let idsToDrag = notasSelecionadas;
    if (!idsToDrag.includes(nota.id)) {
      idsToDrag = [nota.id];
      setNotasSelecionadas([nota.id]);
    }
    e.dataTransfer.setData('notasIds', JSON.stringify(idsToDrag));
    setTimeout(() => setDraggingIds(idsToDrag), 0);
  };

  // Encontra a posição de inserção levando em consideração tanto X quanto Y.
  // Isso é necessário porque os cards podem ocupar várias linhas visuais
  // dentro da mesma zonaDrop.
  const calcularPosicaoDrop = (container, clientX, clientY, idsIgnorados) => {
    const cardElements = Array.from(
      container.querySelectorAll('[data-nota-id]')
    ).filter(el => {
      const notaId = el.getAttribute('data-nota-id');
      if (idsIgnorados.includes(notaId)) return false;
      if (el.style.display === 'none') return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });

    if (cardElements.length === 0) {
      return {
        targetNotaId: null,
        isAfterLast: true
      };
    }

    const linhasVisuais = [];

    cardElements.forEach(el => {
      const rect = el.getBoundingClientRect();
      let linha = linhasVisuais.find(l =>
        Math.abs(l.top - rect.top) < 5
      );
      if (!linha) {
        linha = {
          top: rect.top,
          bottom: rect.bottom,
          cards: []
        };

        linhasVisuais.push(linha);
      }
      linha.cards.push({
        el,
        rect,
        notaId: el.getAttribute('data-nota-id')
      });
      linha.bottom = Math.max(linha.bottom, rect.bottom);
    });

    linhasVisuais.sort((a, b) => a.top - b.top);

    linhasVisuais.forEach(linha => {
      linha.cards.sort((a, b) => a.rect.left - b.rect.left);
    });

    let linhaSelecionada = linhasVisuais.find(linha =>
      clientY >= linha.top &&
      clientY <= linha.bottom
    );

    if (!linhaSelecionada) {
      linhaSelecionada = linhasVisuais.reduce((maisProxima, linha) => {
        const distancia =
          clientY < linha.top
            ? linha.top - clientY
            : clientY - linha.bottom;

        const distanciaAtual =
          clientY < maisProxima.top
            ? maisProxima.top - clientY
            : clientY - maisProxima.bottom;

        return distancia < distanciaAtual ? linha : maisProxima;
      });
    }

    const indiceLinha = linhasVisuais.indexOf(linhaSelecionada);
    const ultimaLinha = indiceLinha === linhasVisuais.length - 1;
    const cardAntesDoMouse = linhaSelecionada.cards.find(card => {
      const centerX = card.rect.left + card.rect.width / 2;
      return clientX < centerX;
    });

    if (cardAntesDoMouse) {
      return {
        targetNotaId: cardAntesDoMouse.notaId,
        isAfterLast: false
      };
    }

    if (!ultimaLinha) {
      const proximaLinha = linhasVisuais[indiceLinha + 1];

      if (proximaLinha && proximaLinha.cards.length > 0) {
        return {
          targetNotaId: proximaLinha.cards[0].notaId,
          isAfterLast: false
        };
      }
    }

    return {
      targetNotaId: null,
      isAfterLast: true
    };
  };

  const handleDragOverLinha = (e, linhaIndex) => {
    e.preventDefault();
    e.stopPropagation();

    const container = e.currentTarget;

    const resultado = calcularPosicaoDrop(
      container,
      e.clientX,
      e.clientY,
      draggingIds
    );

    setDragOverInfo(prev => {
      if (
        prev &&
        prev.linhaIndex === linhaIndex &&
        prev.targetNotaId === resultado.targetNotaId &&
        prev.isAfterLast === resultado.isAfterLast
      ) {
        return prev;
      }

      return {
        linhaIndex,
        targetNotaId: resultado.targetNotaId,
        isAfterLast: resultado.isAfterLast
      };
    });
  };


  const handleDrop = (e, columnLinhaIndex) => {
    e.preventDefault();
    e.stopPropagation();
    const notasIdsStr = e.dataTransfer.getData('notasIds');
    if (!notasIdsStr) return;
    const notasIds = JSON.parse(notasIdsStr);
    const container = e.currentTarget;
    const {
      targetNotaId,
      isAfterLast
    } = calcularPosicaoDrop(
      container,
      e.clientX,
      e.clientY,
      notasIds
    );
    setDragOverInfo(null);
    setDraggingIds([]);
    const notasParaInserir = [];

    Object.keys(notasPorParte).forEach(chave => {
      notasPorParte[chave].forEach(n => {
        if (
          notasIds.includes(n.id) &&
          !notasParaInserir.find(x => x.id === n.id)
        ) {
          notasParaInserir.push(n);
        }
      });
    });

    linhasLetra.forEach(linha => {
      linha.notas.forEach(n => {
        if (
          notasIds.includes(n.id) &&
          !notasParaInserir.find(x => x.id === n.id)
        ) {
          notasParaInserir.push(n);
        }
      });
    });

    if (notasParaInserir.length === 0) return;

    notasParaInserir.sort(
      (a, b) => notasIds.indexOf(a.id) - notasIds.indexOf(b.id)
    );

    setLinhasLetra(prev => {
      const novasLinhas = prev.map(l => ({
        ...l,
        notas: [...l.notas]
      }));

      novasLinhas.forEach(linha => {
        linha.notas = linha.notas.filter(
          n => !notasIds.includes(n.id)
        );
      });
      const linhaDestino = novasLinhas[columnLinhaIndex];
      if (!linhaDestino) {
        return novasLinhas;
      }
      let targetIndex = linhaDestino.notas.length;
      if (!isAfterLast && targetNotaId) {
        const foundIdx = linhaDestino.notas.findIndex(
          n => n.id === targetNotaId
        );
        if (foundIdx !== -1) {
          targetIndex = foundIdx;
        }
      }
      linhaDestino.notas.splice(
        targetIndex,
        0,
        ...notasParaInserir
      );
      return novasLinhas;
    });
    setNotasSelecionadas([]);
  };

  const handleDragEndGlobal = () => {
    setDragOverInfo(null);
    setDraggingIds([]);
  };

  // Fallback de toque: sem drag nativo, tocar numa linha adiciona ao FIM dela
  // os cards de nota atualmente selecionados (tocar num card em "Partes
  // Ativas" já seleciona, via handleNotaClick). Reusa a mesma coleta do
  // handleDrop, sem o cálculo de posição — reordenar fino continua só no mouse.
  const handleZonaTap = (linhaIndex) => {
    if (!isCoarse || notasSelecionadas.length === 0) return;
    const ids = notasSelecionadas;
    const notasParaInserir = [];

    Object.keys(notasPorParte).forEach(chave => {
      notasPorParte[chave].forEach(n => {
        if (ids.includes(n.id) && !notasParaInserir.find(x => x.id === n.id)) notasParaInserir.push(n);
      });
    });
    linhasLetra.forEach(linha => {
      linha.notas.forEach(n => {
        if (ids.includes(n.id) && !notasParaInserir.find(x => x.id === n.id)) notasParaInserir.push(n);
      });
    });

    if (notasParaInserir.length === 0) return;
    notasParaInserir.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));

    setLinhasLetra(prev => {
      const novasLinhas = prev.map(l => ({ ...l, notas: [...l.notas] }));
      novasLinhas.forEach(linha => {
        linha.notas = linha.notas.filter(n => !ids.includes(n.id));
      });
      const destino = novasLinhas[linhaIndex];
      if (!destino) return novasLinhas;
      destino.notas.push(...notasParaInserir);
      return novasLinhas;
    });
    setNotasSelecionadas([]);
  };

  const removerNotaDaLinha = (linhaIndex, notaId) => {
    setLinhasLetra(prev => {
      const novasLinhas = [...prev];
      novasLinhas[linhaIndex] = {
        ...novasLinhas[linhaIndex],
        notas: novasLinhas[linhaIndex].notas.filter(n => n.id !== notaId)
      };
      return novasLinhas;
    });
  };

  const handleAdicionarNotaManual = (e, linhaIndex) => {
    if (e.key === 'Enter' && e.target.value.trim() !== '') {
      const novaNota = { id: `nota-manual-${Date.now()}`, valor: e.target.value.trim(), parteOrigem: 'manual' };
      setLinhasLetra(prev => {
        const novasLinhas = [...prev];
        novasLinhas[linhaIndex] = {
          ...novasLinhas[linhaIndex],
          notas: [...novasLinhas[linhaIndex].notas, novaNota]
        };
        return novasLinhas;
      });
      e.target.value = '';
    }
  };

  const handleEditLinha = (index, currentText) => {
    setEditingLinhaIndex(index);
    setEditingText(currentText);
  };

  const salvarEdicaoLinha = (index) => {
    setLinhasLetra(prev => {
      const novasLinhas = [...prev];
      novasLinhas[index] = { ...novasLinhas[index], texto: editingText };
      return novasLinhas;
    });
    setEditingLinhaIndex(null);
  };

  const adicionarLinhaAbaixo = (index) => {
    setLinhasLetra(prev => {
      const novasLinhas = [...prev];
      novasLinhas.splice(index + 1, 0, {
        id: `linha-adicional-${Date.now()}`,
        texto: '',
        notas: []
      });
      return novasLinhas;
    });
  };

  const deletarLinha = (index) => {
    setLinhasLetra(prev => prev.filter((_, i) => i !== index));
  };
  // ================= Buscar tons da gaita baseado no tipo selecionado =================

  useEffect(() => {
    async function carregarTonsDoTipo() {
      if (!tipoGaita) return;
      setCarregandoTons(true);

      try {
        const { data, error } = await buscarTonsPorTipo(tipoGaita);

        if (error) {
          console.error("Erro ao buscar tons no Supabase:", error);
          setTonsDisponiveis([]);
        } else if (data) {
          const tonsUnicos = [...new Set(data.map((item) => item.tom))];
          setTonsDisponiveis(tonsUnicos);
        }
      } catch (err) {
        console.error("Erro na conexão com Supabase:", err);
      } finally {
        setCarregandoTons(false);
      }
    }

    carregarTonsDoTipo();
  }, [tipoGaita]);

  // Cards de nota de UMA parte (as "bolinhas" com +5, -4...). Extraído porque
  // aparece no card expandido da lista, no overlay de "Partes Ativas"
  // maximizado e na tela de foco de uma parte — sempre com o mesmo
  // estado/handlers (seleção, drag, destaque de "tocando"/"alocada").
  const renderNotasDaParte = (parteId) => {
    if (!notasPorParte[parteId]) {
      return <span style={{ color: 'var(--color-text-slate-3)', fontSize: '12px', fontStyle: 'italic' }}>Aguardando tradução...</span>;
    }
    return notasPorParte[parteId].map((nota, index) => {
      const tempoSeguro = (typeof tempoAtual === 'number' && !isNaN(tempoAtual)) ? tempoAtual : 0;
      const estaTocando = notaEstaTocando(nota, tempoSeguro);
      const estaAlocada = notasAlocadasSet.has(nota.id);
      const estaSelecionada = notasSelecionadas.includes(nota.id);

      let estiloAplicado = { ...s.cardNota };
      if (estaSelecionada && !estaAlocada) {
        estiloAplicado = { ...estiloAplicado, ...s.cardNotaSelecionadaStyle };
      }
      if (estaAlocada) {
        estiloAplicado = { ...estiloAplicado, ...s.cardNotaAlocadaTransparente };
      }
      if (estaTocando) {
        estiloAplicado = {
          ...estiloAplicado,
          ...(estaAlocada ? s.cardNotaTocandoAlocadaStyle : s.cardNotaTocandoStyle)
        };
      }

      return (
        <div
          key={nota.id}
          draggable={!estaAlocada}
          onClick={(e) => handleNotaClick(e, parteId, nota, index)}
          onDragStart={(e) => {
            if (!estaAlocada) handleDragStart(e, nota);
          }}
          style={estiloAplicado}
        >
          {nota.valor}
        </div>
      );
    });
  };

  // Lista de cards de "Partes Ativas" — extraída em função porque é
  // renderizada tanto na coluna esquerda normal quanto (idêntica, mesmo
  // estado/handlers) dentro do overlay de tela cheia (partesMaximizado).
  const renderListaPartes = () => partesAdicionadas.map(parte => {
    const oitavaInfo = dadosOitavas[parte.id];
    const cardExpandido = cardsExpandidos[parte.id] === true;
    const cardEstaTocando = parteEstaTocando(parte.id);

    return (
      <div key={parte.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
        <div onClick={() => alternarExpansaoParte(parte.id)}
          style={{ ...s.cardParteStyle, ...(cardEstaTocando ? s.cardParteTocandoStyle : {}) }}>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={s.cardParteNome}>
                {cardExpandido ? '▼' : '▶'} {parte.nome}
              </span>

              {oitavaInfo && oitavaInfo.posicoes.length > 1 && (
                <select
                  value={oitavaInfo.selecionada}
                  onClick={e => e.stopPropagation()}
                  onChange={e => handleMudancaOitava(parte.id, parseInt(e.target.value))}
                  style={{ ...s.selectOitavaStyle, ...(isCoarse ? { minHeight: '36px', fontSize: '13px' } : {}) }}
                >
                  {oitavaInfo.posicoes.map((p, idx) => {
                    // AQUI: A estrela só aparece se a oitava for nativamente perfeita e não tiver o ajuste manual
                    const isNativa = p.perfeita && !p.ajustadaManualmente;

                    const labelOitava = p.offset === 0 ? 'Oitava Original'
                      : p.offset > 0 ? `+${p.offset / 12} Oitava` : `${p.offset / 12} Oitava`;

                    return (
                      <option key={idx} value={idx}>
                        {isNativa ? '⭐ ' : ''}{labelOitava}
                      </option>
                    );
                  })}
                </select>
              )}
            </div>

            <div style={s.volumeContainerStyle} onClick={e => e.stopPropagation()}>
              <span style={s.volumeIconStyle} title="Volume da parte">
                {iconeVolume(volumes[parte.id])}
              </span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                className="volume-slider"
                value={volumes[parte.id] ?? 1}
                onChange={e => {
                  const novoVolume = parseFloat(e.target.value);
                  alterarVolume(parte.id, novoVolume);
                }}
                style={{
                  ...s.volumeSliderStyle,
                  '--vol-pct': formatarPercentualVolume(volumes[parte.id]),
                  '--vol-fill-color': soloParteId === parte.id ? 'var(--color-warning-strong)' : 'var(--color-primary)'
                }}
                aria-label={`Volume da parte ${parte.nome}`}
              />
              <span style={s.volumePercentStyle}>{formatarPercentualVolume(volumes[parte.id])}</span>
              <button
                type="button"
                style={{
                  ...s.btnSoloStyle,
                  ...(isCoarse ? { width: '36px', height: '36px' } : {}),
                  ...(soloParteId === parte.id ? s.btnSoloAtivoStyle : {})
                }}
                onClick={() => alternarSolo(parte.id, partesAdicionadas.map(p => p.id))}
                title={soloParteId === parte.id ? 'Desativar solo (restaurar volumes)' : 'Ouvir somente esta parte (solo)'}
              >
                🎧
              </button>
            </div>
          </div>
        </div>

        {cardExpandido && (
          <div style={s.notasCardInternoContainer}>
            {renderNotasDaParte(parte.id)}
          </div>
        )}
      </div>
    );
  });

  // Uma "Linha de nota e letra" da montagem: número à esquerda, a zona de
  // soltar/tocar notas (com preview de arraste, tap-to-place, input manual) e,
  // abaixo, a linha da letra com seus botões de editar/adicionar/excluir.
  // Extraído porque aparece na coluna direita normal E na tela de foco de uma
  // parte (lá, uma linha por vez, navegada por setas).
  const renderLinhaTablatura = (linha, index) => (
    <div key={linha.id} style={s.linhaTablaturaRow}>
      <div style={s.numeroLinha}>{index + 1}</div>
      <div style={{ ...s.linhaContainer, flex: 1, minWidth: 0 }}>
        <div
          style={{
            ...s.zonaDrop,
            // Zona vazia com notas selecionadas (fluxo de toque): azul
            // serrilhada + texto azul, mesmo destaque do preview de arraste.
            ...(isCoarse && notasSelecionadas.length > 0
              ? { border: '2px dashed var(--color-primary)' }
              : {})
          }}
          onDragOver={(e) => handleDragOverLinha(e, index)}
          onDrop={(e) => handleDrop(e, index)}
          onClick={() => handleZonaTap(index)}
        >
          {linha.notas.length === 0 && (
            <span style={{
              color: isCoarse && notasSelecionadas.length > 0 ? 'var(--color-primary)' : 'var(--color-border-soft)',
              fontSize: '12px',
              fontWeight: isCoarse && notasSelecionadas.length > 0 ? 'bold' : 'normal'
            }}>
              {isCoarse && notasSelecionadas.length > 0 ? 'Toque para adicionar aqui' : 'Solte notas aqui...'}
            </span>
          )}

          {linha.notas.map((nota) => [
            // PREVIEW: atrelado ao ID do card exato, fugindo da discrepância de índices
            dragOverInfo?.linhaIndex === index && dragOverInfo?.targetNotaId === nota.id && !dragOverInfo?.isAfterLast && (
              (draggingIds.length > 0 ? draggingIds : [1]).map((dragId, idx) => (
                <div key={`preview-${nota.id}-${idx}`} style={{ ...s.cardNotaAlocada, opacity: 0.5, border: '2px dashed var(--color-primary)', backgroundColor: 'transparent', color: 'transparent', pointerEvents: 'none' }}>+</div>
              ))
            ),
            // CARD REAL
            <div
              key={nota.id}
              data-nota-id={nota.id}
              style={{
                ...s.cardNotaAlocada,
                cursor: 'grab',
                display: draggingIds.includes(nota.id) ? 'none' : 'flex'
              }}
              onClick={(e) => { e.stopPropagation(); removerNotaDaLinha(index, nota.id); }}
              title="Clique para remover. Arraste para reordenar."
              draggable
              onDragStart={(e) => {
                const idsToDrag = [nota.id];
                e.dataTransfer.setData('notasIds', JSON.stringify(idsToDrag));
                e.stopPropagation();
                setTimeout(() => setDraggingIds(idsToDrag), 0);
              }}
              onDragEnd={handleDragEndGlobal}
            >
              {nota.valor}
            </div>
          ])}

          {/* PREVIEW no final da linha */}
          {dragOverInfo?.linhaIndex === index && dragOverInfo?.isAfterLast && (
            (draggingIds.length > 0 ? draggingIds : [1]).map((dragId, idx) => (
              <div key={`preview-end-${idx}`} style={{ ...s.cardNotaAlocada, opacity: 0.5, border: '2px dashed var(--color-primary)', backgroundColor: 'transparent', color: 'transparent', pointerEvents: 'none' }}>+</div>
            ))
          )}

          <input type="text" placeholder="+" style={s.inputNotaManual} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => handleAdicionarNotaManual(e, index)} />
        </div>
        <div
          style={{ ...s.textoLetra, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', minHeight: '32px', textAlign: 'center' }}
          onMouseEnter={() => setHoveredLinhaIndex(index)}
          onMouseLeave={() => setHoveredLinhaIndex(null)}
        >
          {editingLinhaIndex === index ? (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%', justifyContent: 'center' }}>
              <input
                type="text"
                value={editingText}
                onChange={(e) => setEditingText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') salvarEdicaoLinha(index);
                  if (e.key === 'Escape') setEditingLinhaIndex(null);
                }}
                style={{ ...s.inputStyle, padding: '4px 8px', margin: 0, width: '80%' }}
                autoFocus
              />
              <button onClick={() => salvarEdicaoLinha(index)} style={{ cursor: 'pointer', background: 'none', border: 'none', fontSize: '16px' }}>✅</button>
              <button onClick={() => setEditingLinhaIndex(null)} style={{ cursor: 'pointer', background: 'none', border: 'none', fontSize: '16px' }}>❌</button>
            </div>
          ) : (
            <>
              <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{linha.texto || <span style={{ color: 'var(--color-border-soft)', fontStyle: 'italic' }}>[Linha vazia]</span>}</span>

              {(hoveredLinhaIndex === index || isCoarse) && (
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  <button
                    onClick={() => handleEditLinha(index, linha.texto)}
                    style={{ cursor: 'pointer', background: 'var(--color-bg-card)', border: '1px solid var(--color-border-soft)', borderRadius: '4px', padding: isCoarse ? '8px 10px' : '4px' }}
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => adicionarLinhaAbaixo(index)}
                    style={{ cursor: 'pointer', background: 'var(--color-bg-card)', border: '1px solid var(--color-border-soft)', borderRadius: '4px', padding: isCoarse ? '8px 10px' : '4px' }}
                  >
                    ➕
                  </button>
                  <button
                    onClick={() => {
                      showConfirm('Deletar a linha e todos os posicionamentos de comandos de gaita nela?', {
                        title: 'Deletar linha?',
                        type: 'warning',
                        onConfirm: () => {
                          deletarLinha(index);
                          closeModal();
                        }
                      });
                    }}
                    title="Excluir linha"
                    style={{ cursor: 'pointer', background: 'var(--color-bg-card)', border: '1px solid var(--color-border-soft)', borderRadius: '4px', padding: isCoarse ? '8px 10px' : '4px' }}
                  >
                    ✖️
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );

  // Seta de navegação de linha na tela de foco (direcao -1 = anterior,
  // +1 = próxima). Nas laterais em telas largas; empilhada numa linha
  // própria (flex:1) abaixo de 760px.
  const renderSetaFoco = (direcao) => {
    const desabilitada = direcao < 0
      ? linhaFocoSegura <= 0
      : linhaFocoSegura >= linhasLetra.length - 1;
    const rotulo = direcao < 0 ? 'Linha anterior' : 'Próxima linha';
    return (
      <button
        type="button"
        style={{ ...s.overlayFocoSeta, ...(setasFocoEmbaixo ? { flex: 1 } : { alignSelf: 'center' }), ...(desabilitada ? s.overlayFocoSetaOff : {}) }}
        onClick={() => setLinhaFocoIndex(linhaFocoSegura + direcao)}
        disabled={desabilitada}
        title={rotulo}
        aria-label={rotulo}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points={direcao < 0 ? '15 18 9 12 15 6' : '9 18 15 12 9 6'} />
        </svg>
      </button>
    );
  };

  // Bloco de barra de progresso + velocidade + tempo — extraído em função
  // porque é clonado no cabeçalho da coluna direita e (só quando maximizado)
  // dentro do overlay de tela cheia de "Partes Ativas", pra acompanhar a
  // reprodução sem precisar restaurar o tamanho padrão.
  const renderBarraProgresso = ({ semMargemTopo = false } = {}) => {
    const percentExibido = arrastandoBarra ? percentArrasto : (playingId === 'ALL' ? progress : 0);
    const tempoExibido = arrastandoBarra ? (percentArrasto / 100) * duration : (playingId === 'ALL' ? tempoAtual : 0);
    return (
      <>
        <div
          style={{
            ...s.barraFundo,
            ...(isCoarse ? { height: '20px', touchAction: 'none' } : {}),
            ...(semMargemTopo ? { marginTop: 0 } : {}),
            cursor: arrastandoBarra ? 'grabbing' : 'pointer'
          }}
          onMouseDown={(e) => handleBarraMouseDown(e, 'ALL')}
          onTouchStart={(e) => handleBarraTouchStart(e, 'ALL')}
        >
          <div style={{ ...s.barraProgresso, width: `${percentExibido}%` }} />
          <div
            style={{
              ...s.barraThumb,
              ...(isCoarse ? { width: '22px', height: '22px' } : {}),
              left: `${percentExibido}%`,
              cursor: arrastandoBarra ? 'grabbing' : 'grab'
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
          <select
            style={{ ...s.selectVelocidadeCompacto, ...(isCoarse ? { minHeight: '40px', fontSize: '13px' } : {}) }}
            onChange={(e) => changeSpeed(parseFloat(e.target.value))}
            value={playbackSpeed}
          >
            <option value={1}>1x</option>
            <option value={0.5}>0.5x</option>
            <option value={0.25}>0.25x</option>
          </select>
          <div style={{ ...s.tempoLabel, marginTop: 0 }}>
            {formatarTempo(tempoExibido)} / {formatarTempo(duration)}
          </div>
        </div>
      </>
    );
  };

  // ================= RENDERIZAÇÃO =================
  // Entrada não autorizada: não renderiza a tela quebrada — o efeito acima já
  // está redirecionando pra /CriarTabs.
  if (!acessoAutorizado) return null;

  if (mostrarPreview) {
    return (
      <div style={s.pageStyle}>
        <LoadingOverlay visivel={carregandoTela} />
        <CustomModal
          isOpen={modalConfig.isOpen}
          title={modalConfig.title}
          message={modalConfig.message}
          type={modalConfig.type}
          onConfirm={modalConfig.onConfirm}
          confirmLabel={modalConfig.confirmLabel}
          onClose={closeModal}
        />
        {/* navegarComConfirmacao: título/perfil/login pedem confirmação antes
            de sair (perde tudo que foi montado). */}
        <TopBar expanded={expanded} navigateAnimated={navegarComConfirmacao} />
        <div style={{ ...s.mainCard, maxWidth: '800px', padding: 'clamp(20px, 5vw, 45px)', textAlign: 'center', ...fadeStyle(contentVisible) }}>
          <h2 style={{ color: 'var(--color-primary)', marginBottom: 5 }}>{nome}</h2>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: 30 }}>{autor}</p>

          {midiSelecionado && (
            <div style={{
              display: 'flex', alignItems: 'center', backgroundColor: 'var(--color-bg-card-alt)',
              border: 'var(--border-width-base) solid var(--color-border-alt)', borderRadius: '14px', padding: '15px',
              boxSizing: 'border-box', marginBottom: '25px', textAlign: 'left'
            }}>
              <div style={{ width: 42, height: 42, backgroundColor: 'var(--color-bg-icon-secondary)', color: 'var(--color-secondary-blue)', display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '10px', fontSize: '18px' }}>
                🎵
              </div>
              <div style={{ flex: 1, paddingLeft: 15 }}>
                <span style={{ color: 'var(--color-text-main)', fontWeight: 'bold', display: 'block', fontSize: '14px' }}>
                  {midiSelecionado.arquivo_midi}
                </span>
                <small style={{ color: 'var(--color-text-muted)', fontSize: 12, display: 'block', marginBottom: '6px' }}>
                  Avalie este arquivo MIDI:
                </small>
                <div style={{ display: 'flex', gap: '5px' }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span key={star} onClick={() => setNotaAvaliacao(star)}
                      style={{
                        cursor: 'pointer', fontSize: '26px',
                        color: star <= notaAvaliacao ? 'var(--color-warning)' : 'var(--color-border-soft)',
                        transition: 'color 0.1s'
                      }}>
                      ★
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '15px', marginBottom: 20, justifyContent: 'center' }}>
            <div>
              <label style={s.labelStyle}>Tipo de Gaita</label>
              <input value={tipoGaita} style={s.inputStyle} readOnly />
            </div>
            <div>
              <label style={s.labelStyle}>Tom da Gaita</label>
              <input value={tomGaita} style={s.inputStyle} readOnly />
            </div>
          </div>

          <textarea
            value={textoTablatura}
            onChange={e => setTextoTablatura(e.target.value)}
            style={{
              width: '100%', height: 'clamp(220px, 45vh, 300px)', fontFamily: 'monospace', fontSize: '16px',
              padding: '12px', borderRadius: '8px', border: 'var(--border-width-base) solid var(--color-border-soft)',
              boxSizing: 'border-box'
            }}
          />

          <div style={{ display: 'flex', gap: '15px', marginTop: '30px', justifyContent: 'center' }}>
            <button style={s.btnSecondary} onClick={() => setMostrarPreview(false)}>Voltar para Edição</button>
            <button style={s.btnPrimary} onClick={handleSaveTablatura}>Salvar Tablatura</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={s.pageStyle}>
      <LoadingOverlay visivel={carregandoTela} />
      <CustomModal
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        onConfirm={modalConfig.onConfirm}
        confirmLabel={modalConfig.confirmLabel}
        onClose={closeModal}
      />
      {/* navegarComConfirmacao: título/perfil/login pedem confirmação antes
          de sair (perde tudo que foi montado). */}
      <TopBar expanded={expanded} navigateAnimated={navegarComConfirmacao} />
      <div style={{
        ...s.contentWrapper,
        ...(isStacked ? { flexDirection: 'column', alignItems: 'stretch' } : {}),
        ...fadeStyle(contentVisible)
      }}>
        {/* COLUNA ESQUERDA (Partes Ativas) — só em tela larga. Ao empilhar,
            "Partes Ativas" some daqui; vê-se as partes pelo botão de
            maximizar (que passa a ficar ao lado do nome da parte na direita). */}
        {!isStacked && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0,
          flex: 1,
          position: 'sticky', top: '110px',
          height: 'calc(100vh - 140px)'
        }}>

          {/* Partes Ativas ocupa a coluna esquerda inteira. As
              "Configurações da Gaita" viraram o popup modalConfigAberto,
              reabível pela engrenagem ao lado de "Resetar Volumes". */}
          {partesAdicionadas.length > 0 && (
            <div style={{ flex: isStacked ? 'none' : 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <div style={{ ...s.columnBox, padding: '22px', flex: isStacked ? 'none' : 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Título agora DENTRO do retângulo, à esquerda; ações à direita. */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexShrink: 0, gap: '10px' }}>
                  <h3 style={{ ...s.tituloSecaoConfig, margin: 0 }}>Partes Ativas</h3>
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    <button
                      type="button"
                      style={s.btnResetVolumesStyle}
                      onClick={() => resetarVolumes(partesAdicionadas.map(p => p.id))}
                      title="Restaura o volume de todas as partes para o máximo"
                    >
                      ↺ Resetar Volumes
                    </button>
                    <button
                      type="button"
                      style={{ ...s.btnMaximizarStyle, ...(isCoarse ? { width: '36px', height: '36px' } : {}) }}
                      onClick={() => setModalConfigAberto(true)}
                      title="Configurações da gaita (tipo e tom)"
                      aria-label="Configurações da gaita"
                    >
                      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      style={{ ...s.btnMaximizarStyle, ...(isCoarse ? { width: '36px', height: '36px' } : {}) }}
                      onClick={() => setPartesMaximizado(true)}
                      title="Maximizar Partes Ativas"
                      aria-label="Maximizar Partes Ativas"
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 3 21 3 21 9" />
                        <polyline points="9 21 3 21 3 15" />
                        <line x1="21" y1="3" x2="14" y2="10" />
                        <line x1="3" y1="21" x2="10" y2="14" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '4px 20px 4px 4px', margin: '-4px -20px -4px -4px' }}>
                  {renderListaPartes()}
                </div>
              </div>
            </div>
          )}
        </div>
        )}

        {/* COLUNA DIREITA (Sticky com Scroll Interno; empilha no fluxo normal
            abaixo de BP_STACK) */}
        <div style={{
          ...s.columnBox, position: isStacked ? 'static' : 'sticky', top: '110px',
          height: isStacked ? 'auto' : 'calc(100vh - 140px)',
          ...(isStacked ? { flex: 'none', width: '100%', minWidth: 0 } : { flex: 1.2 }),
          display: 'flex', flexDirection: 'column', paddingBottom: '25px'
        }}>
          {!isStacked ? (
            <>
              <div style={{
                marginBottom: '20px', borderBottom: 'var(--border-width-base) solid var(--color-border-alt)', paddingBottom: '15px',
                flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', flexWrap: 'wrap'
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2 style={{ color: 'var(--color-text-main)', margin: 0, fontSize: 'clamp(20px, 5vw, 28px)', fontWeight: 'bold' }}>{nome}</h2>
                  <span style={{ color: 'var(--color-text-muted)' }}>{autor}</span>
                </div>

                {partesAdicionadas.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: '220px' }}>
                    <button
                      style={{ ...s.btnPlayAll, padding: '12px 18px', fontSize: '14px', borderRadius: '8px' }}
                      onClick={handleBtnPlayClick}
                    >
                      {playingId === 'ALL' && isPlaying ? '⏸ Pausar Música' : '▶ Tocar Música'}
                    </button>
                    {renderBarraProgresso()}
                  </div>
                )}
              </div>

              <div style={{ flex: 1, overflowY: 'auto', paddingRight: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '30px' }}>
                  {linhasLetra.map((linha, index) => renderLinhaTablatura(linha, index))}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Empilhado: player compacto — play à esquerda, barra no meio,
                  velocidade à direita. Com título + autor da música, e a
                  engrenagem de configuração da gaita à direita do título. */}
              <div style={{ marginBottom: '16px', borderBottom: 'var(--border-width-base) solid var(--color-border-alt)', paddingBottom: '14px', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h2 style={{ color: 'var(--color-text-main)', margin: '0 0 2px', fontSize: 'clamp(18px, 5vw, 24px)', fontWeight: 'bold' }}>{nome}</h2>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>{autor}</span>
                  </div>
                  <button
                    type="button"
                    style={{ ...s.btnMaximizarStyle, ...(isCoarse ? { width: '36px', height: '36px' } : {}), flexShrink: 0 }}
                    onClick={() => setModalConfigAberto(true)}
                    title="Configurações da gaita (tipo e tom)"
                    aria-label="Configurações da gaita"
                  >
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                  </button>
                </div>

                {partesAdicionadas.length > 0 && (
                  <div style={{ ...s.overlayFocoHeader, marginTop: '12px' }}>
                    <button
                      type="button"
                      style={s.btnPlayIconeFoco}
                      onClick={handleBtnPlayClick}
                      title={playingId === 'ALL' && isPlaying ? 'Pausar música' : 'Tocar música'}
                      aria-label={playingId === 'ALL' && isPlaying ? 'Pausar música' : 'Tocar música'}
                    >
                      {playingId === 'ALL' && isPlaying ? '⏸' : '▶'}
                    </button>

                    <div style={s.overlayFocoBarraWrap}>
                      <div
                        style={{ ...s.barraFundo, marginTop: 0, ...(isCoarse ? { height: '20px', touchAction: 'none' } : {}) }}
                        onMouseDown={(e) => handleBarraMouseDown(e, 'ALL')}
                        onTouchStart={(e) => handleBarraTouchStart(e, 'ALL')}
                      >
                        <div style={{ ...s.barraProgresso, width: `${arrastandoBarra ? percentArrasto : (playingId === 'ALL' ? progress : 0)}%` }} />
                        <div style={{ ...s.barraThumb, ...(isCoarse ? { width: '22px', height: '22px' } : {}), left: `${arrastandoBarra ? percentArrasto : (playingId === 'ALL' ? progress : 0)}%` }} />
                      </div>
                      <div style={{ ...s.tempoLabel, marginTop: '4px' }}>
                        {formatarTempo(arrastandoBarra ? (percentArrasto / 100) * duration : (playingId === 'ALL' ? tempoAtual : 0))} / {formatarTempo(duration)}
                      </div>
                    </div>

                    <select
                      style={s.overlayFocoVelocidade}
                      onChange={(e) => changeSpeed(parseFloat(e.target.value))}
                      value={playbackSpeed}
                      aria-label="Velocidade de reprodução"
                      title="Velocidade de reprodução"
                    >
                      <option value={1}>1x</option>
                      <option value={0.5}>0.5x</option>
                      <option value={0.25}>0.25x</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Uma parte ativa específica (selecionável pelo nome) acima do
                  "Montar tablatura", com divisória própria entre ela e ele.
                  O botão de maximizar "Partes Ativas" fica ao lado do nome. */}
              {parteVisivel && (
                <div style={{ flexShrink: 0, marginBottom: '16px', paddingBottom: '16px', borderBottom: 'var(--border-width-base) solid var(--color-border-alt)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ ...s.overlayFocoParteWrap, flex: '0 1 auto', minWidth: 0 }}>
                      <button
                        type="button"
                        style={s.overlayFocoParteBtn}
                        onClick={() => setTrocarParteVisivelAberto((v) => !v)}
                        aria-haspopup="listbox"
                        aria-expanded={trocarParteVisivelAberto}
                        title="Trocar de parte"
                      >
                        <span style={s.overlayFocoParteNome}>{parteVisivel.nome}</span>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="7 10 12 5 17 10" />
                          <polyline points="7 14 12 19 17 14" />
                        </svg>
                      </button>

                      {trocarParteVisivelAberto && (
                        <>
                          <div style={s.overlayFocoParteBackdrop} onClick={() => setTrocarParteVisivelAberto(false)} />
                          <div style={s.overlayFocoParteMenu} role="listbox" aria-label="Escolher parte">
                            {partesAdicionadas.map((parteOpc) => (
                              <button
                                key={parteOpc.id}
                                type="button"
                                role="option"
                                aria-selected={parteOpc.id === parteVisivel.id}
                                style={{ ...s.overlayFocoParteOpcao, ...(parteOpc.id === parteVisivel.id ? s.overlayFocoParteOpcaoAtiva : {}) }}
                                onClick={() => { setTrocarParteVisivelAberto(false); setParteVisivelId(parteOpc.id); }}
                              >
                                {parteOpc.nome}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>

                    <button
                      type="button"
                      style={{ ...s.btnMaximizarStyle, ...(isCoarse ? { width: '36px', height: '36px' } : {}), flexShrink: 0 }}
                      onClick={() => setPartesMaximizado(true)}
                      title="Maximizar Partes Ativas"
                      aria-label="Maximizar Partes Ativas"
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 3 21 3 21 9" />
                        <polyline points="9 21 3 21 3 15" />
                        <line x1="21" y1="3" x2="14" y2="10" />
                        <line x1="3" y1="21" x2="10" y2="14" />
                      </svg>
                    </button>
                  </div>

                  <div style={s.overlayFocoNotasCompacta}>
                    {renderNotasDaParte(parteVisivel.id)}
                  </div>
                </div>
              )}

              <h4 style={s.overlayFocoSecaoTitulo}>
                Montar tablatura{linhasLetra.length > 0 ? ` (linha ${linhaFocoSegura + 1} de ${linhasLetra.length})` : ''}
              </h4>
              <div style={{ ...s.overlayFocoLinhaWrap, flex: 'none', maxHeight: '58vh', overflow: 'hidden', ...(setasFocoEmbaixo ? s.overlayFocoLinhaWrapColuna : {}) }}>
                {!setasFocoEmbaixo && renderSetaFoco(-1)}

                <div style={s.overlayFocoLinhaConteudo}>
                  {linhasLetra[linhaFocoSegura]
                    ? renderLinhaTablatura(linhasLetra[linhaFocoSegura], linhaFocoSegura)
                    : <span style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>Nenhuma linha de letra.</span>}
                </div>

                {!setasFocoEmbaixo && renderSetaFoco(1)}

                {setasFocoEmbaixo && (
                  <div style={s.overlayFocoSetasRow}>
                    {renderSetaFoco(-1)}
                    {renderSetaFoco(1)}
                  </div>
                )}
              </div>
            </>
          )}

          <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'flex-end', paddingTop: '15px', backgroundColor: 'var(--color-bg-card)' }}>
            <button
              style={{
                ...s.btnContinuar, position: 'relative', bottom: 'auto', right: 'auto',
                ...(podeContinuar ? {} : s.btnContinuarDesabilitado)
              }}
              onClick={handleContinuarClick}
              title={podeContinuar ? undefined : 'Aplique o tipo/tom da gaita e adicione ao menos uma nota antes de continuar'}
            >
              Continuar ➔
            </button>
          </div>
        </div>
      </div>
      {/* Modo tela cheia de "Partes Ativas": fundo na mesma cor do card das
          partes, clone da barra de progresso (com velocidade/tempo) no topo
          pra acompanhar a reprodução, e todas as partes em lista corrida. */}
      {partesMaximizado && (
        <div style={s.overlayPartesMaximizado}>
          {/* Cabeçalho: play (esquerda) + barra/velocidade + botão de
              restaurar (direita) — os dois botões iguais e altos. Sem o
              título "Partes Ativas". */}
          <div style={{ ...s.overlayBarraWrap, display: 'flex', alignItems: 'stretch', gap: '10px', marginBottom: '14px' }}>
            {partesAdicionadas.length > 0 && midiSelecionado ? (
              <>
                <button
                  type="button"
                  style={{ ...s.btnPlayIconeFoco, height: 'auto', minHeight: '48px', alignSelf: 'stretch' }}
                  onClick={handleBtnPlayClick}
                  title={playingId === 'ALL' && isPlaying ? 'Pausar música' : 'Tocar música'}
                  aria-label={playingId === 'ALL' && isPlaying ? 'Pausar música' : 'Tocar música'}
                >
                  {playingId === 'ALL' && isPlaying ? '⏸' : '▶'}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {renderBarraProgresso({ semMargemTopo: true })}
                </div>
              </>
            ) : (
              <div style={{ flex: 1 }} />
            )}
            <button
              type="button"
              style={{ ...s.btnPlayIconeFoco, height: 'auto', minHeight: '48px', alignSelf: 'stretch', backgroundColor: 'var(--color-border-alt)', color: 'var(--color-text-muted)', boxShadow: 'none' }}
              onClick={() => setPartesMaximizado(false)}
              title="Voltar ao tamanho padrão"
              aria-label="Voltar ao tamanho padrão"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 14 10 14 10 20" />
                <polyline points="20 10 14 10 14 4" />
                <line x1="14" y1="10" x2="21" y2="3" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            </button>
          </div>

          {/* "Resetar Volumes" agora também vive dentro do maximizado. */}
          {partesAdicionadas.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px', flexShrink: 0 }}>
              <button
                type="button"
                style={s.btnResetVolumesStyle}
                onClick={() => resetarVolumes(partesAdicionadas.map(p => p.id))}
                title="Restaura o volume de todas as partes para o máximo"
              >
                ↺ Resetar Volumes
              </button>
            </div>
          )}
          <div style={s.overlayListaWrap}>
            {renderListaPartes()}
          </div>
        </div>
      )}

      {/* Popup de Configurações da Gaita. Abre sozinho ao entrar na tela: a
          PRIMEIRA vez é obrigatória (sem ✕, sem fechar por fora). Depois de
          aplicada uma config, o botão de engrenagem reabre este mesmo popup —
          aí opcional, com ✕ e fechável clicando fora. */}
      {modalConfigAberto && (
        <div
          style={s.modalOverlay}
          onClick={configPronta ? fecharModalConfig : undefined}
        >
          <div
            style={{ ...s.modalContent, maxWidth: '440px', position: 'relative' }}
            onClick={(e) => e.stopPropagation()}
          >
            {configPronta && (
              <button
                type="button"
                onClick={fecharModalConfig}
                aria-label="Fechar"
                title="Fechar"
                style={s.modalConfigFechar}
              >
                ✕
              </button>
            )}

            <h3 style={{ margin: '0 0 6px', color: 'var(--color-primary)', paddingRight: '28px' }}>
              Configurações da Gaita
            </h3>
            <p style={{ margin: '0 0 18px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              Escolha o tipo e o tom da gaita para gerar a tablatura.
            </p>

            <div style={s.linhaCamposGaita}>
              <div style={s.campoTipoGaitaWrap}>
                <label style={s.labelStyle}>Tipo da Gaita:</label>
                <select
                  style={s.inputTipoGaitaCompacto}
                  value={tipoGaita}
                  onChange={(e) => setTipoGaita(e.target.value)}
                >
                  <option value="">Selecione o tipo</option>
                  {tiposDeGaitaOpcoes.map((tipo) => (
                    <option key={tipo} value={tipo}>{tipo}</option>
                  ))}
                </select>
              </div>

              <div style={s.campoTomGaitaWrap}>
                <label style={s.labelStyle}>Tom:</label>
                <select
                  style={s.inputTomGaitaCompacto}
                  value={tomGaita}
                  onChange={(e) => setTomGaita(e.target.value)}
                  disabled={carregandoTons || tonsDisponiveis.length === 0}
                >
                  <option value="">-</option>
                  {tonsDisponiveis.map((tom) => (
                    <option key={tom} value={tom}>{tom}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={s.linhaBotoesConfig}>
              {configPronta && (
                <button type="button" onClick={limparConfiguracao} style={s.btnLimparConfig}>
                  Limpar
                </button>
              )}
              <button
                type="button"
                onClick={aplicarConfiguracoes}
                style={{ ...s.btnAplicarConfig, ...((isTraduzindo || carregandoTela) ? { opacity: 0.6, cursor: 'not-allowed' } : {}) }}
                disabled={isTraduzindo || carregandoTela}
              >
                {isTraduzindo ? `Aplicando${pontosAplic}` : 'Aplicar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalAjusteAberto && (
        <div style={s.modalOverlay}>
          <div style={s.modalContentAjuste}>
            <div style={s.modalAjusteHeader}>
              <h3 style={s.modalAjusteTitulo}>Ajuste de Notas</h3>
              <span style={s.modalAjusteBadge}>
                {ajustesPendentes.length} {ajustesPendentes.length === 1 ? 'parte precisa' : 'partes precisam'} de ajuste
              </span>
            </div>
            <p style={s.modalAjusteDescricao}>
              As partes abaixo possuem notas que não existem fisicamente na {tipoGaita} em {tomGaita}.
              Escolha as adaptações necessárias para cada uma e confirme tudo de uma vez.
            </p>

            <div style={s.modalAjusteListaPartes}>
              {ajustesPendentes.map((ajuste) => (
                <div key={ajuste.parteId} style={s.parteAjusteSecao}>
                  <div style={s.parteAjusteSecaoHeader}>
                    <span style={s.parteAjusteSecaoTitulo}>{ajuste.parteNome}</span>
                    <span style={s.parteAjusteSecaoContagem}>
                      {ajuste.detalhes.length} {ajuste.detalhes.length === 1 ? 'nota' : 'notas'}
                    </span>
                  </div>

                  <div style={s.parteAjusteNotasContainer}>
                    {ajuste.detalhes.map((nota, index) => (
                      <div key={index} style={s.notaAjusteLinha}>
                        <div>
                          <span style={s.notaAjusteOriginal}>
                            Nota Original: {midiToNoteName(nota.nota_midi_original)}
                          </span>
                          <span style={s.notaAjusteSugestao}>
                            Comando sugerido: <strong>{nota.sugestao_comando}</strong>
                          </span>
                        </div>

                        <select
                          value={ajuste.mapeamento[nota.nota_midi_original]}
                          onChange={(e) => atualizarMapeamentoAjuste(ajuste.parteId, nota.nota_midi_original, e.target.value)}
                          style={s.selectAjusteNota}
                        >
                          {ajuste.comandosDisponiveis.map(cmd => (
                            <option key={cmd} value={cmd}>{cmd}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div style={s.modalAjusteFooter}>
              <button
                onClick={fecharModalAjustes}
                style={{ ...s.btnCancelarModal, ...(isLoading ? { opacity: 0.6, cursor: 'not-allowed' } : {}) }}
                disabled={isLoading}
              >
                ← Voltar
              </button>
              <button
                onClick={confirmarTodosAjustes}
                style={{ ...s.btnConfirmarModal, ...(isLoading ? { opacity: 0.6, cursor: 'not-allowed' } : {}) }}
                disabled={isLoading}
              >
                {isLoading ? `Aplicando${pontosAplic}` : 'Confirmar Adaptações'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}