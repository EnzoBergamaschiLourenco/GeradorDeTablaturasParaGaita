import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as mm from '@magenta/music';
import * as s from '../styles/MontarTablaturaStyles';
import { useMidiPlayer, midiToNoteName } from '../hooks/useMidiPlayer';
import { supabase } from '../supabaseClient';
import CustomModal from '../components/CustomModal';
import { useAuthUser } from '../hooks/useAuthUser';
import { useModal } from '../hooks/useModal';
import { buscarTonsPorTipo, buscarLayoutPorTomETipo } from '../services/gaitaLayoutService';
import { salvarNovaTablatura, avaliarMidi } from '../services/tablaturaService';
import { buscarPartesMidi, traduzirTablatura } from '../services/gaitaApiService';

// ================= COMPONENTE PRINCIPAL =================
export default function MontarTablatura() {
  const { modalConfig, showAlert, closeModal } = useModal();

  const [notaAvaliacao, setNotaAvaliacao] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  const dadosRecebidos = location.state || {};
  const musicaId = dadosRecebidos.musicaId || 1;
  const nome = dadosRecebidos.nome || "Música Exemplo";
  const autor = dadosRecebidos.autor || "Autor Exemplo";
  const letra = dadosRecebidos.letra || "Insira a letra aqui...";
  const midiSelecionado = dadosRecebidos.midi || null;

  const [tipoGaita, setTipoGaita] = useState('');
  const [tomGaita, setTomGaita] = useState('');
  const [configuracaoConfirmada, setConfiguracaoConfirmada] = useState(false);
  const [tonsDisponiveis, setTonsDisponiveis] = useState([]);
  const [carregandoTons, setCarregandoTons] = useState(false);
  const tiposDeGaitaOpcoes = ['Diatônica', 'Trêmolo', 'Cromática 10', 'Cromática 12', 'Cromática 14', 'Cromática 16'];
  const primeiraMudancaTomRef = useRef(false);

  const [partesDisponiveis, setPartesDisponiveis] = useState([]);
  const [partesAdicionadas, setPartesAdicionadas] = useState([]);
  const [notasPorParte, setNotasPorParte] = useState({});
  const [dadosOitavas, setDadosOitavas] = useState({});

  // === ESTADOS PARA MULTISELEÇÃO ===
  const [notasSelecionadas, setNotasSelecionadas] = useState([]);
  const [ultimaNotaClicada, setUltimaNotaClicada] = useState(null);

  // === ESTADOS DE FILA PARA TRADUÇÃO SEQUENCIAL ===
  const [filaTraducao, setFilaTraducao] = useState([]);
  const [isTraduzindo, setIsTraduzindo] = useState(false);

  const [modalAjusteAberto, setModalAjusteAberto] = useState(false);
  const [notasPendentes, setNotasPendentes] = useState([]);
  const [comandosDaGaita, setComandosDaGaita] = useState([]);
  const { usuario } = useAuthUser();
  const [mapeamentoUsuario, setMapeamentoUsuario] = useState({});

  useEffect(() => {
    if (!tomGaita) return;

    if (!primeiraMudancaTomRef.current) {
      primeiraMudancaTomRef.current = true;
      recarregarTraducoes();
    }
  }, [tomGaita]);

  const [parteEmAjuste, setParteEmAjuste] = useState(null);
  const [offsetEmAjuste, setOffsetEmAjuste] = useState(null);
  const [novaOitavaPendente, setNovaOitavaPendente] = useState(null);

  const [linhasLetra, setLinhasLetra] = useState([]);
  const [mostrarPreview, setMostrarPreview] = useState(false);

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

      const { error: insertError } = await salvarNovaTablatura({
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
        navigate('/');
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
          setFilaTraducao([...data.partes]);
        })
        .catch(err => console.error("Erro ao buscar partes:", err))
        .finally(() => setIsLoading(false));
    }
  }, [letra, midiSelecionado, musicaId]);

  useEffect(() => {
    if (!tipoGaita || !tomGaita) {
      return;
    }
    else if (filaTraducao.length > 0 && !modalAjusteAberto && !isTraduzindo) {
      const parteAtual = filaTraducao[0];
      traduzirParteFila(parteAtual);
    }
  }, [filaTraducao, modalAjusteAberto, isTraduzindo]);

  const atualizarNotasDoCard = (parteId, tablaturaArray) => {
    const notasComId = tablaturaArray.map((notaObj) => ({
      ...notaObj,
      id: `nota-${parteId}-${notaObj.id}-${Date.now()}`,
      valor: notaObj.comando,
      parteOrigem: parteId
    }));
    setNotasPorParte(prev => ({ ...prev, [parteId]: notasComId }));
  };

  const traduzirParteFila = async (parteEncontrada) => {
    setIsTraduzindo(true);
    setIsLoading(true);
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

      if (Array.isArray(data) && data.length > 0) {
        // Decide qual é a oitava padrão (melhor cenário: perfeita e próxima a 0)
        let bestIndex = -1;
        const perfect0 = data.findIndex(p => p.offset === 0 && p.perfeita);

        if (perfect0 !== -1) {
          bestIndex = perfect0;
        } else {
          let perfects = data.map((p, i) => ({ ...p, index: i })).filter(p => p.perfeita);
          if (perfects.length > 0) {
            perfects.sort((a, b) => Math.abs(a.offset) - Math.abs(b.offset));
            bestIndex = perfects[0].index;
          } else {
            // Se nenhuma é perfeita, pega a que tiver menos detalhes faltando
            let imperfects = data.map((p, i) => ({ ...p, index: i }));
            imperfects.sort((a, b) => {
              if (a.detalhes.length !== b.detalhes.length) return a.detalhes.length - b.detalhes.length;
              return Math.abs(a.offset) - Math.abs(b.offset);
            });
            bestIndex = imperfects[0].index;
          }
        }

        setDadosOitavas(prev => ({
          ...prev,
          [parteEncontrada.id]: { posicoes: data, selecionada: bestIndex }
        }));

        const bestOption = data[bestIndex];

        if (bestOption.perfeita) {
          atualizarNotasDoCard(parteEncontrada.id, bestOption.tablatura);
          setFilaTraducao(prev => prev.slice(1));
        } else {
          // Congela a fila, prepara modal para a oitava sugerida
          setParteEmAjuste(parteEncontrada);
          setOffsetEmAjuste(bestOption.offset);
          setNovaOitavaPendente(null);
          setNotasPendentes(bestOption.detalhes);
          setComandosDaGaita(bestOption.comandos_disponiveis);
          const mapInicial = {};
          bestOption.detalhes.forEach(item => { mapInicial[item.nota_midi_original] = item.sugestao_comando; });
          setMapeamentoUsuario(mapInicial);
          setModalAjusteAberto(true);
        }
      } else {
        setFilaTraducao(prev => prev.slice(1));
      }
    } catch (err) {
      console.error(err);
      showAlert(`Falha na tradução da parte ${parteEncontrada.nome}: \n${err.message}`, "Erro", "error");
      setFilaTraducao(prev => prev.slice(1));
    } finally {
      setIsTraduzindo(false);
      setIsLoading(false);
    }
  };

  const confirmarAjustes = async () => {
    setIsLoading(true);
    try {
      const resData = await traduzirTablatura({
        musica_id: musicaId,
        caminho_completo: midiSelecionado.path,
        parte_id: parteEmAjuste.id,
        tom_gaita: tomGaita,
        tipo_gaita: tipoGaita,
        // Passamos a oitava desejada escondida no dicionário
        overrides: { ...mapeamentoUsuario, __target_offset__: String(offsetEmAjuste) }
      });
      const data = resData.posicoes;

      // Se deu certo, a API devolveu apenas a opção selecionada com perfeita: true
      if (Array.isArray(data) && data.length > 0 && data[0].perfeita) {
        const novaTablatura = data[0].tablatura;

        setDadosOitavas(prev => {
          const newPosicoes = [...prev[parteEmAjuste.id].posicoes];
          const updatedIndex = novaOitavaPendente !== null ? novaOitavaPendente : prev[parteEmAjuste.id].selecionada;
          newPosicoes[updatedIndex] = { ...newPosicoes[updatedIndex], perfeita: true, tablatura: novaTablatura, ajustadaManualmente: true };
          return {
            ...prev,
            [parteEmAjuste.id]: { posicoes: newPosicoes, selecionada: updatedIndex }
          };
        });

        atualizarNotasDoCard(parteEmAjuste.id, novaTablatura);

        setModalAjusteAberto(false);
        setParteEmAjuste(null);
        setOffsetEmAjuste(null);
        setNovaOitavaPendente(null);

        // Remove da fila se estava processando em massa
        if (filaTraducao.length > 0 && filaTraducao[0].id === parteEmAjuste.id) {
          setFilaTraducao(prev => prev.slice(1));
        }
      }
    } catch (e) {
      showAlert("Erro ao aplicar ajustes: " + e.message, "Erro", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const recarregarTraducoes = () => {
    setIsTraduzindo(false);
    setModalAjusteAberto(false);
    setNotasPorParte({});
    setDadosOitavas({});
    setFilaTraducao([...partesAdicionadas]);
    if (!tipoGaita || !tomGaita) {
      showAlert("Por favor, selecione o Tipo e o Tom da gaita.", "Aviso", "warning");
      return;
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
      // Abre o modal para essa oitava sem tablatura
      setParteEmAjuste(partesAdicionadas.find(p => p.id === parteId));
      setOffsetEmAjuste(opcao.offset);
      setNovaOitavaPendente(novaOitavaIndex);

      setNotasPendentes(opcao.detalhes);
      setComandosDaGaita(opcao.comandos_disponiveis);
      const mapInicial = {};
      opcao.detalhes.forEach(item => { mapInicial[item.nota_midi_original] = item.sugestao_comando; });
      setMapeamentoUsuario(mapInicial);
      setModalAjusteAberto(true);
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
  };

  const handleDragOver = (e) => { e.preventDefault(); };

  const handleDrop = (e, columnLinhaIndex) => {
    e.preventDefault();
    const notasIdsStr = e.dataTransfer.getData('notasIds');
    if (!notasIdsStr) return;
    const notasIds = JSON.parse(notasIdsStr);

    const notasParaAdicionar = [];

    Object.keys(notasPorParte).forEach(chave => {
      notasPorParte[chave].forEach(n => {
        if (notasIds.includes(n.id) && !notasAlocadasSet.has(n.id)) {
          notasParaAdicionar.push(n);
        }
      });
    });

    if (notasParaAdicionar.length > 0) {
      setLinhasLetra(prev => {
        const novasLinhas = [...prev];
        novasLinhas[columnLinhaIndex] = {
          ...novasLinhas[columnLinhaIndex],
          notas: [...novasLinhas[columnLinhaIndex].notas, ...notasParaAdicionar]
        };
        return novasLinhas;
      });
      setNotasSelecionadas([]);
    }
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

  // ================= RENDERIZAÇÃO =================
  if (mostrarPreview) {
    return (
      <div style={s.pageStyle}>
        {isLoading && (
          <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            backgroundColor: 'var(--color-overlay-loading)', display: 'flex',
            justifyContent: 'center', alignItems: 'center', zIndex: 9999
          }}>
            <div style={{ backgroundColor: 'var(--color-bg-card)', padding: '20px 40px', borderRadius: '8px', fontSize: '18px', color: 'var(--color-text-main)' }}>
              Carregando...
            </div>
          </div>
        )}
        <CustomModal
          isOpen={modalConfig.isOpen}
          title={modalConfig.title}
          message={modalConfig.message}
          type={modalConfig.type}
          onConfirm={modalConfig.onConfirm}
          onClose={closeModal}
        />
        <div style={{ ...s.mainCard, maxWidth: '800px', textAlign: 'center' }}>
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
      {isLoading && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'var(--color-overlay-loading)', display: 'flex',
          justifyContent: 'center', alignItems: 'center', zIndex: 9999
        }}>
          <div style={{ backgroundColor: 'var(--color-bg-card)', padding: '20px 40px', borderRadius: '8px', fontSize: '18px', color: 'var(--color-text-main)' }}>
            Carregando...
          </div>
        </div>
      )}
      <CustomModal
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        onConfirm={modalConfig.onConfirm}
        onClose={closeModal}
      />
      <div style={s.contentWrapper}>
        {/* COLUNA ESQUERDA */}
        <div style={{ ...s.columnBox, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <h3 style={{ color: 'var(--color-primary)', fontSize: '18px', fontWeight: 'bold', margin: 0 }}>
              Configurações da Gaita
            </h3>
            <button onClick={recarregarTraducoes} style={s.btnRecarregar} title="Recarregar e Traduzir Novamente">↻</button>
            <p style={{ fontSize: '50%', color: 'var(--color-text-muted)' }}>Carregar comandos de gaita</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '25px' }}>
            {/* CAMPO 1: TIPO DA GAITA (ACIMA) */}
            <div>
              <label style={s.labelStyle}>Tipo da Gaita:</label>
              <select style={s.inputStyle}
                value={tipoGaita}
                onChange={(e) => {
                  setTipoGaita(e.target.value);
                }}
              >
                <option value="">Selecione o tipo de gaita</option>
                {tiposDeGaitaOpcoes.map((tipo) => (
                  <option key={tipo} value={tipo}>{tipo}</option>
                ))}
              </select>
            </div>

            {/* CAMPO 2: TOM DA GAITA (ABAIXO, DEPENDENTE DO TIPO) */}
            <div>
              <label style={s.labelStyle}>Tom da Gaita:</label>
              <select
                style={s.inputStyle}
                value={tomGaita}
                onChange={(e) => {
                  setTomGaita(e.target.value);
                }}
                disabled={carregandoTons || tonsDisponiveis.length === 0}
              >
                <option value="">Escolha o tom da gaita</option>

                {tonsDisponiveis.map((tom) => (
                  <option key={tom} value={tom}>
                    {tom}
                  </option>
                ))}
              </select>
            </div>

            {partesAdicionadas.length > 0 && (
              <div style={s.containerCardsMidi}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--color-text-slate-1)' }}>Partes Ativas:</span>
                  <button
                    type="button"
                    style={s.btnResetVolumesStyle}
                    onClick={() => resetarVolumes(partesAdicionadas.map(p => p.id))}
                    title="Restaura o volume de todas as partes para o máximo"
                  >
                    ↺ Resetar Volumes
                  </button>
                </div>

                {partesAdicionadas.map(parte => {
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
                })}
              </div>
            )}
          </div>
        </div>

        {/* COLUNA DIREITA (Sticky com Scroll Interno) */}
        <div style={{
          ...s.columnBox, flex: 1.2, position: 'sticky', top: '30px',
          height: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column', paddingBottom: '25px'
        }}>
          <div style={{
            marginBottom: '20px', borderBottom: 'var(--border-width-base) solid var(--color-border-alt)', paddingBottom: '15px',
            flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px'
          }}>
            <div style={{ flex: 1 }}>
              <h2 style={{ color: 'var(--color-text-main)', margin: 0, fontSize: '24px' }}>{nome}</h2>
              <span style={{ color: 'var(--color-text-muted)' }}>{autor}</span>
            </div>

            <div className="controles-player">
              <select
                style={s.inputStyle}
                onChange={(e) => changeSpeed(parseFloat(e.target.value))}
                value={playbackSpeed}
                disabled={!isPlaying}
              >
                <option value={1}>1x</option>
                <option value={0.5}>0.5x</option>
                <option value={0.25}>0.25x</option>
              </select>
            </div>

            {partesAdicionadas.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: '220px' }}>
                <button
                  style={{ ...s.btnPlayAll, padding: '12px 18px', fontSize: '14px', borderRadius: '8px' }}
                  onClick={() => togglePlayAll(
                    partesAdicionadas.map(p => p.id),
                    midiSelecionado?.path,
                    volumes
                  )}
                >
                  {playingId === 'ALL' && isPlaying ? '⏸ Pausar Música' : '▶ Tocar Música'}
                </button>
                {playingId === 'ALL' && (() => {
                  const percentExibido = arrastandoBarra ? percentArrasto : progress;
                  const tempoExibido = arrastandoBarra ? (percentArrasto / 100) * duration : tempoAtual;
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
                      <div style={s.tempoLabel}>
                        {formatarTempo(tempoExibido)} / {formatarTempo(duration)}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '10px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '30px' }}>
              {linhasLetra.map((linha, index) => (
                <div key={linha.id} style={s.linhaContainer}>
                  <div style={s.zonaDrop} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, index)}>
                    {linha.notas.length === 0 && <span style={{ color: 'var(--color-border-soft)', fontSize: '12px' }}>Solte notas aqui...</span>}
                    {linha.notas.map(nota => (
                      <div key={nota.id} style={s.cardNotaAlocada} onClick={() => removerNotaDaLinha(index, nota.id)} title="Clique para remover">
                        {nota.valor}
                      </div>
                    ))}
                    <input type="text" placeholder="+" style={s.inputNotaManual} onKeyDown={(e) => handleAdicionarNotaManual(e, index)} />
                  </div>
                  <div style={s.textoLetra}>{linha.texto || <span style={{ color: 'var(--color-border-soft)', fontStyle: 'italic' }}>[Linha vazia]</span>}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'flex-end', paddingTop: '15px', backgroundColor: 'var(--color-bg-card)' }}>
            <button style={{ ...s.btnContinuar, position: 'relative', bottom: 'auto', right: 'auto' }} onClick={() => setMostrarPreview(true)}>
              Continuar ➔
            </button>
          </div>
        </div>
      </div>

      {modalAjusteAberto && (
        <div style={s.modalOverlay}>
          <div style={s.modalContent}>
            <h3 style={{ marginTop: 0, color: 'var(--color-text-slate-4)' }}>Ajuste de Notas</h3>
            <p style={{ color: 'var(--color-text-slate-5)', fontSize: '14px', lineHeight: '1.5' }}>
              A parte <strong>{parteEmAjuste?.nome}</strong> possui notas que não existem fisicamente na {tipoGaita} em {tomGaita}.
              Escolha as adaptações abaixo para contornar isso:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', margin: '20px 0', maxHeight: '400px', overflowY: 'auto' }}>
              {notasPendentes.map((nota, index) => (
                <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--color-bg-card-alt)', padding: '12px', borderRadius: '8px', border: 'var(--border-width-base) solid var(--color-border-alt)' }}>
                  <div>
                    <span style={{ fontWeight: 'bold', display: 'block', fontSize: '15px', color: 'var(--color-text-slate-6)' }}>
                      Nota Original: {midiToNoteName(nota.nota_midi_original)}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-slate-2)' }}>
                      Comando sugerido: <strong>{nota.sugestao_comando}</strong>
                    </span>
                  </div>

                  <select
                    value={mapeamentoUsuario[nota.nota_midi_original]}
                    onChange={(e) => setMapeamentoUsuario({ ...mapeamentoUsuario, [nota.nota_midi_original]: e.target.value })}
                    style={{ padding: '8px', borderRadius: '6px', border: 'var(--border-width-base) solid var(--color-border-soft)', outline: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    {comandosDaGaita.map(cmd => (
                      <option key={cmd} value={cmd}>{cmd}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={confirmarAjustes} style={s.btnConfirmarModal}>Confirmar Adaptações</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}