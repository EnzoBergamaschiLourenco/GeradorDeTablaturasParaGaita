import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import * as mm from '@magenta/music';
import * as s from '../styles/MontarTablaturaStyles';
import { useMidiPlayer, midiToNoteName } from '../hooks/useMidiPlayer';
import { supabase } from '../supabaseClient';
import CustomModal from '../components/CustomModal';
import LoadingOverlay from '../components/LoadingOverlay';
import TopBar from '../components/TopBar';
import { useAnimatedNavigate, fadeStyle } from '../hooks/useAnimatedNavigate';
import { useCarregamentoMinimo, usePontinhos } from '../hooks/useCarregamento';
import { useAuthUser } from '../hooks/useAuthUser';
import { useModal } from '../hooks/useModal';
import { buscarTonsPorTipo, buscarLayoutPorTomETipo } from '../services/gaitaLayoutService';
import { salvarNovaTablatura, avaliarMidi } from '../services/tablaturaService';
import { buscarPartesMidi, traduzirTablatura } from '../services/gaitaApiService';

// ================= COMPONENTE PRINCIPAL =================
export default function MontarTablatura() {
  const { modalConfig, showAlert, showConfirm, closeModal } = useModal();

  const [notaAvaliacao, setNotaAvaliacao] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  // Fica visível pelo tempo mínimo mesmo que a operação termine antes.
  const carregandoTela = useCarregamentoMinimo(isLoading);

  const location = useLocation();
  const { expanded, contentVisible, navigateAnimated } = useAnimatedNavigate(true);

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
  // Bloco "Configurações da Gaita" recolhido por padrão (e sempre que uma
  // configuração é aplicada com sucesso), liberando espaço vertical pra
  // "Partes Ativas". O botão "Editar/Recolher" no cabeçalho alterna livremente,
  // independente de haver ou não uma configuração já aplicada.
  const [configColapsada, setConfigColapsada] = useState(false);

  const [partesDisponiveis, setPartesDisponiveis] = useState([]);
  const [partesAdicionadas, setPartesAdicionadas] = useState([]);
  const [notasPorParte, setNotasPorParte] = useState({});
  const [dadosOitavas, setDadosOitavas] = useState({});
  // Modo "tela cheia" do bloco "Partes Ativas", pra acompanhar melhor a
  // reprodução com todas as partes visíveis de uma vez.
  const [partesMaximizado, setPartesMaximizado] = useState(false);

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
        navigateAnimated('/VisualizarTabs', {
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
        });
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
    setConfigColapsada(true);

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
    setConfigColapsada(false);
  };

  // Fecha o modal de ajustes sem confirmar nada — mantém tipo/tom e o que já foi traduzido,
  // já que "Limpar Configuração" é o botão dedicado para zerar os campos
  const fecharModalAjustes = () => {
    setAjustesPendentes([]);
    setIsTraduzindo(false);
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
    // Se nenhuma parte precisou de ajuste manual, já podemos atualizar o indicador aqui.
    // Caso contrário, ele só atualiza quando o usuário confirmar o modal de ajustes.
    if (!novosAjustes || novosAjustes.length === 0) {
      setConfigAplicada(configEmAplicacaoRef.current);
      setConfigColapsada(true);
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

  const handleBarraMouseDown = (e, idClicado) => {
    if (playingId !== idClicado) return;
    const rect = e.currentTarget.getBoundingClientRect();
    barraRectRef.current = rect;
    const percent = calcularPercentDoEvento(e.clientX, rect);
    setPercentArrasto(percent);
    setArrastandoBarra(true);
    seekRef.current(percent);
  };

  useEffect(() => {
    if (!arrastandoBarra) return;

    const handleMove = (e) => {
      if (!barraRectRef.current) return;
      setPercentArrasto(calcularPercentDoEvento(e.clientX, barraRectRef.current));
    };
    const handleUp = (e) => {
      if (barraRectRef.current) {
        seekRef.current(calcularPercentDoEvento(e.clientX, barraRectRef.current));
      }
      setArrastandoBarra(false);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
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
                  style={s.selectOitavaStyle}
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
                style={{ ...s.btnSoloStyle, ...(soloParteId === parte.id ? s.btnSoloAtivoStyle : {}) }}
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
            {!notasPorParte[parte.id] ? (
              <span style={{ color: 'var(--color-text-slate-3)', fontSize: '12px', fontStyle: 'italic' }}>Aguardando tradução...</span>
            ) : (
              notasPorParte[parte.id].map((nota, index) => {
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
                    onClick={(e) => handleNotaClick(e, parte.id, nota, index)}
                    onDragStart={(e) => {
                      if (!estaAlocada) handleDragStart(e, nota);
                    }}
                    style={estiloAplicado}
                  >
                    {nota.valor}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    );
  });

  // Bloco de barra de progresso + velocidade + tempo — extraído em função
  // porque é clonado no cabeçalho da coluna direita e (só quando maximizado)
  // dentro do overlay de tela cheia de "Partes Ativas", pra acompanhar a
  // reprodução sem precisar restaurar o tamanho padrão.
  const renderBarraProgresso = () => {
    const percentExibido = arrastandoBarra ? percentArrasto : (playingId === 'ALL' ? progress : 0);
    const tempoExibido = arrastandoBarra ? (percentArrasto / 100) * duration : (playingId === 'ALL' ? tempoAtual : 0);
    return (
      <>
        <div
          style={{ ...s.barraFundo, cursor: arrastandoBarra ? 'grabbing' : 'pointer' }}
          onMouseDown={(e) => handleBarraMouseDown(e, 'ALL')}
        >
          <div style={{ ...s.barraProgresso, width: `${percentExibido}%` }} />
          <div
            style={{
              ...s.barraThumb,
              left: `${percentExibido}%`,
              cursor: arrastandoBarra ? 'grabbing' : 'grab'
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
          <select
            style={s.selectVelocidadeCompacto}
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
        <TopBar expanded={expanded} navigateAnimated={navigateAnimated} />
        <div style={{ ...s.mainCard, maxWidth: '800px', textAlign: 'center', ...fadeStyle(contentVisible) }}>
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
              width: '100%', height: '300px', fontFamily: 'monospace', fontSize: '16px',
              padding: '12px', borderRadius: '8px', border: 'var(--border-width-base) solid var(--color-border-soft)'
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
      <TopBar expanded={expanded} navigateAnimated={navigateAnimated} />
      <div style={{ ...s.contentWrapper, ...fadeStyle(contentVisible) }}>
        {/* COLUNA ESQUERDA (fixa, com Partes Ativas rolando internamente) */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '20px', flex: 1,
          position: 'sticky', top: '110px', height: 'calc(100vh - 140px)'
        }}>

          {/* BLOCO: Configurações da Gaita (fixo, não rola) — recolhe com
              animação assim que uma configuração é aplicada, liberando
              espaço pra "Partes Ativas"; "Editar" reabre pra trocar de novo. */}
          <div style={{ flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 14px 20px', paddingRight: '6px' }}>
              <h3 style={{ ...s.tituloSecaoConfig, margin: 0 }}>Configurações da Gaita</h3>
              {/* Botão sempre visível (não só quando recolhido): funciona como
                  toggle — expande pra trocar tipo/tom, recolhe de novo ao
                  clicar de novo, sem precisar aplicar uma configuração. */}
              <button type="button" onClick={() => setConfigColapsada(prev => !prev)} style={s.btnExpandirConfig}>
                {configColapsada ? 'Editar ▾' : 'Recolher ▴'}
              </button>
            </div>

            <div style={{ ...s.columnBox, padding: configColapsada ? '14px 22px' : '22px' }}>
              {configColapsada && (
                <span style={{ ...s.infoConfigSelecionada, ...(configAplicada.tipo && configAplicada.tom ? s.infoConfigAplicada : s.infoConfigPendente) }}>
                  {configAplicada.tipo && configAplicada.tom
                    ? `${configAplicada.tipo} em ${configAplicada.tom}`
                    : 'Nenhuma definição aplicada'}
                </span>
              )}

              <div style={{ display: 'grid', gridTemplateRows: configColapsada ? '0fr' : '1fr', transition: 'grid-template-rows 300ms ease' }}>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ ...s.linhaCamposGaita, marginTop: configColapsada ? '14px' : 0 }}>
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
                          <option key={tom} value={tom}>
                            {tom}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={s.linhaBotoesConfig}>
                    <button type="button" onClick={limparConfiguracao} style={s.btnLimparConfig}>
                      Limpar Configuração
                    </button>
                    <button
                      type="button"
                      onClick={aplicarConfiguracoes}
                      style={{ ...s.btnAplicarConfig, ...(isTraduzindo ? { opacity: 0.6, cursor: 'not-allowed' } : {}) }}
                      disabled={isTraduzindo}
                    >
                      {isTraduzindo ? `Aplicando${pontosAplic}` : 'Aplicar Configurações'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* BLOCO: Partes Ativas (separado das Configurações, rola internamente) */}
          {partesAdicionadas.length > 0 && (
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <h3 style={s.tituloSecaoConfig}>Partes Ativas</h3>

              <div style={{ ...s.columnBox, padding: '22px', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '12px', flexShrink: 0, gap: '10px' }}>
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
                      style={s.btnMaximizarStyle}
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

        {/* COLUNA DIREITA (Sticky com Scroll Interno) */}
        <div style={{
          ...s.columnBox, flex: 1.2, position: 'sticky', top: '110px',
          height: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column', paddingBottom: '25px'
        }}>
          <div style={{
            marginBottom: '20px', borderBottom: 'var(--border-width-base) solid var(--color-border-alt)', paddingBottom: '15px',
            flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px'
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ color: 'var(--color-text-main)', margin: 0, fontSize: '28px', fontWeight: 'bold' }}>{nome}</h2>
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
              {linhasLetra.map((linha, index) => (
                <div key={linha.id} style={s.linhaContainer}>
                  <div
                    style={s.zonaDrop}
                    onDragOver={(e) => handleDragOverLinha(e, index)}
                    onDrop={(e) => handleDrop(e, index)}
                  >
                    {linha.notas.length === 0 && <span style={{ color: 'var(--color-border-soft)', fontSize: '12px' }}>Solte notas aqui...</span>}

                    {linha.notas.map((nota, notaIndex) => [
                      // PREVIEW: Agora atrelado ao ID do card exato, fugindo da discrepância de índices
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
                        onClick={() => removerNotaDaLinha(index, nota.id)}
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

                    <input type="text" placeholder="+" style={s.inputNotaManual} onKeyDown={(e) => handleAdicionarNotaManual(e, index)} />
                  </div>
                  <div
                    style={{ ...s.textoLetra, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '32px' }}
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
                        <span>{linha.texto || <span style={{ color: 'var(--color-border-soft)', fontStyle: 'italic' }}>[Linha vazia]</span>}</span>

                        {hoveredLinhaIndex === index && (
                          <div style={{ position: 'absolute', right: '10px', display: 'flex', gap: '8px' }}>
                            <button
                              onClick={() => handleEditLinha(index, linha.texto)}
                              style={{ cursor: 'pointer', background: 'var(--color-bg-card)', border: '1px solid var(--color-border-soft)', borderRadius: '4px', padding: '4px' }}
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => adicionarLinhaAbaixo(index)}
                              style={{ cursor: 'pointer', background: 'var(--color-bg-card)', border: '1px solid var(--color-border-soft)', borderRadius: '4px', padding: '4px' }}
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
                              style={{ cursor: 'pointer', background: 'var(--color-bg-card)', border: '1px solid var(--color-border-soft)', borderRadius: '4px', padding: '4px' }}
                            >
                              ✖️
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

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
          <div style={s.overlayPartesHeader}>
            <h2 style={s.overlayPartesTitulo}>Partes Ativas</h2>
            <button
              type="button"
              style={s.btnRestaurarStyle}
              onClick={() => setPartesMaximizado(false)}
              title="Voltar ao tamanho padrão"
              aria-label="Voltar ao tamanho padrão"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 14 10 14 10 20" />
                <polyline points="20 10 14 10 14 4" />
                <line x1="14" y1="10" x2="21" y2="3" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
              Restaurar
            </button>
          </div>

          {partesAdicionadas.length > 0 && midiSelecionado && (
            <div style={s.overlayBarraWrap}>
              <button
                style={{ ...s.btnPlayAll, padding: '10px 16px', fontSize: '13px', borderRadius: '8px', marginBottom: '10px' }}
                onClick={handleBtnPlayClick}
              >
                {playingId === 'ALL' && isPlaying ? '⏸ Pausar Música' : '▶ Tocar Música'}
              </button>
              {renderBarraProgresso()}
            </div>
          )}

          <div style={s.overlayListaWrap}>
            {renderListaPartes()}
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