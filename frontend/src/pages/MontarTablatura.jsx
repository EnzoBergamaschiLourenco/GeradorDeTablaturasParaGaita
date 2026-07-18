import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as mm from '@magenta/music';
import * as s from '../styles/MontarTablaturaStyles';
import { useMidiPlayer, midiToNoteName } from '../hooks/useMidiPlayer';

// ================= COMPONENTE PRINCIPAL =================
export default function MontarTablatura() {
  const location = useLocation();
  const navigate = useNavigate();

  const dadosRecebidos = location.state || {};
  const musicaId = dadosRecebidos.musicaId || 1;
  const nome = dadosRecebidos.nome || "Música Exemplo";
  const autor = dadosRecebidos.autor || "Autor Exemplo";
  const letra = dadosRecebidos.letra || "Insira a letra aqui...";
  const midiSelecionado = dadosRecebidos.midi || null;

  const [tomGaita, setTomGaita] = useState('C');
  const [tipoGaita, setTipoGaita] = useState('Diatônica');

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
  const [mapeamentoUsuario, setMapeamentoUsuario] = useState({});
  const [parteEmAjuste, setParteEmAjuste] = useState(null);

  const [linhasLetra, setLinhasLetra] = useState([]);
  const [mostrarPreview, setMostrarPreview] = useState(false);

  const [cardsExpandidos, setCardsExpandidos] = useState({});
  const alternarExpansaoParte = (parteId) => {
    setCardsExpandidos(prev => ({ ...prev, [parteId]: !prev[parteId] }));
  };

  const {
    togglePlayAll, stop, seek, progress, duration, isPlaying, playingId, tempoAtual, alterarVolume, volumes = {}
  } = useMidiPlayer();

  const notaEstaTocando = (nota, tempo) => {
    if (!nota || nota.inicio === undefined || nota.fim === undefined) return false;
    return tempo >= nota.inicio && tempo < nota.fim;
  };

  const parteEstaTocando = (parteId) => {
    const dados = notasPorParte[parteId];
    if (!dados) return false;
    return dados.some(nota => notaEstaTocando(nota, tempoAtual));
  };

  // Coleta todas as notas que já estão posicionadas em linhas da letra
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
      fetch(`http://127.0.0.1:8000/midi/partes/${midiSelecionado.path}`)
        .then(res => res.json())
        .then(data => {
          setPartesDisponiveis(data.partes);
          setPartesAdicionadas(data.partes);
          setFilaTraducao([...data.partes]);
        })
        .catch(err => console.error("Erro ao buscar partes:", err));
    }
  }, [letra, midiSelecionado, musicaId]);

  useEffect(() => {
    if (filaTraducao.length > 0 && !modalAjusteAberto && !isTraduzindo) {
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

  const traduzirParteFila = async (parteEncontrada, overrides = null) => {
    setIsTraduzindo(true);
    try {
      const response = await fetch(`http://127.0.0.1:8000/midi/traduzir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          musica_id: musicaId,
          caminho_completo: midiSelecionado.path,
          parte_id: parteEncontrada.id,
          tom_gaita: tomGaita,
          tipo_gaita: tipoGaita,
          overrides: overrides
        })
      });

      const resData = await response.json();
      const data = resData.posicoes;

      if (data && data.status === "requer_ajuste") {
        setNotasPendentes(data.detalhes);
        setComandosDaGaita(data.comandos_disponiveis);
        setParteEmAjuste(parteEncontrada);

        const mapInicial = {};
        data.detalhes.forEach(item => { mapInicial[item.nota_midi_original] = item.sugestao_comando; });
        setMapeamentoUsuario(mapInicial);
        setModalAjusteAberto(true);
        setIsTraduzindo(false);
      }
      else if (Array.isArray(data) && data.length > 0) {
        setModalAjusteAberto(false);
        setDadosOitavas(prev => ({
          ...prev,
          [parteEncontrada.id]: { posicoes: data, selecionada: 0 }
        }));
        atualizarNotasDoCard(parteEncontrada.id, data[0].tablatura);

        setFilaTraducao(prev => prev.slice(1));
        setIsTraduzindo(false);
      }
      else {
        setFilaTraducao(prev => prev.slice(1));
        setIsTraduzindo(false);
      }
    } catch (err) {
      console.error("Falha de conexão com a API na tradução.");
      setFilaTraducao(prev => prev.slice(1));
      setIsTraduzindo(false);
    }
  };

  const confirmarAjustes = () => traduzirParteFila(parteEmAjuste, mapeamentoUsuario);

  const cancelarAjustes = () => {
    setModalAjusteAberto(false);
    setParteEmAjuste(null);
    setFilaTraducao(prev => prev.slice(1));
  };

  const recarregarTraducoes = () => {
    setIsTraduzindo(false);
    setModalAjusteAberto(false);
    setNotasPorParte({});
    setDadosOitavas({});
    setFilaTraducao([...partesAdicionadas]);
  };

  const handleMudancaOitava = (parteId, novaOitavaIndex) => {
    setDadosOitavas(prev => ({
      ...prev, [parteId]: { ...prev[parteId], selecionada: novaOitavaIndex }
    }));
    atualizarNotasDoCard(parteId, dadosOitavas[parteId].posicoes[novaOitavaIndex].tablatura);
  };

  const handleSeekClick = (e, idClicado) => {
    if (playingId !== idClicado) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
    seek(percent);
  };

  // ================= SELEÇÃO & DRAG AND DROP =================
  const handleNotaClick = (e, parteId, nota, index) => {
    // Evita selecionar notas que já estão na letra
    if (notasAlocadasSet.has(nota.id)) return;

    // Evitar selecionar o texto acidentalmente com o shift
    if (e.shiftKey) e.preventDefault();

    if (e.ctrlKey || e.metaKey) {
      // Toggle
      setNotasSelecionadas(prev => {
        if (prev.includes(nota.id)) return prev.filter(id => id !== nota.id);
        return [...prev, nota.id];
      });
      setUltimaNotaClicada({ parteId, index });
    } else if (e.shiftKey && ultimaNotaClicada && ultimaNotaClicada.parteId === parteId) {
      // Seleção em massa (Range)
      const start = Math.min(ultimaNotaClicada.index, index);
      const end = Math.max(ultimaNotaClicada.index, index);
      const rangeIds = notasPorParte[parteId].slice(start, end + 1).map(n => n.id);

      const newSet = new Set([...notasSelecionadas, ...rangeIds]);
      setNotasSelecionadas(Array.from(newSet));
    } else {
      // Seleção Simples
      setNotasSelecionadas([nota.id]);
      setUltimaNotaClicada({ parteId, index });
    }
  };

  const handleDragStart = (e, nota) => {
    let idsToDrag = notasSelecionadas;
    // Se a pessoa arrastar uma nota que não está na seleção, 
    // desconsideramos a seleção anterior e arrastamos apenas ela.
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

    // Percorre os arrays na ordem para manter a sequência exata de como as notas aparecem
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
      // Limpa a seleção após alocar
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

  // ================= RENDERIZAÇÃO =================
  if (mostrarPreview) {
    return (
      <div style={s.pageStyle}>
        <div style={{ ...s.mainCard, maxWidth: '800px', textAlign: 'center' }}>
          <h2 style={{ color: '#007bff', marginBottom: 5 }}>{nome}</h2>
          <p style={{ color: '#666', marginBottom: 30 }}>{autor}</p>

          <div style={{ backgroundColor: '#f8fafc', padding: '30px', borderRadius: '14px', border: '1px solid #e2e8f0', textAlign: 'left', fontFamily: 'monospace', fontSize: '16px' }}>
            {linhasLetra.map((linha, index) => (
              <div key={index} style={{ marginBottom: '20px' }}>
                <div style={{ fontWeight: 'bold', color: '#007bff', letterSpacing: '4px', marginBottom: '4px', minHeight: '20px' }}>
                  {linha.notas.map(n => n.valor).join('   ')}
                </div>
                <div style={{ color: '#333' }}>
                  {linha.texto}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '15px', marginTop: '30px', justifyContent: 'center' }}>
            <button style={s.btnSecondary} onClick={() => setMostrarPreview(false)}>Voltar para Edição</button>
            <button style={s.btnPrimary} onClick={() => alert("Tablatura salva!")}>Salvar Tablatura</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={s.pageStyle}>
      <div style={s.contentWrapper}>

        {/* COLUNA ESQUERDA */}
        <div style={{ ...s.columnBox, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <h3 style={{ color: '#007bff', fontSize: '18px', fontWeight: 'bold', margin: 0 }}>
              Configurações da Gaita
            </h3>
            <button
              onClick={recarregarTraducoes}
              style={s.btnRecarregar}
              title="Recarregar e Traduzir Novamente"
            >
              ↻
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '25px' }}>
            <div>
              <label style={s.labelStyle}>Tom da Gaita</label>
              <select style={s.inputStyle} value={tomGaita} onChange={e => setTomGaita(e.target.value)}>
                {['C', 'G', 'A', 'D', 'E', 'F', 'Bb'].map(tom => <option key={tom} value={tom}>{tom}</option>)}
              </select>
            </div>
            <div>
              <label style={s.labelStyle}>Tipo de Gaita</label>
              <select style={s.inputStyle} value={tipoGaita} onChange={e => setTipoGaita(e.target.value)}>
                <option value="Diatônica">Diatônica</option>
                <option value="Cromática">Cromática</option>
              </select>
            </div>

            {partesAdicionadas.length > 0 && (
              <div style={s.containerCardsMidi}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#4a5568' }}>Partes Ativas:</span>
                </div>

                {/* CARDS INDIVIDUAIS */}
                {partesAdicionadas.map(parte => {
                  const oitavaInfo = dadosOitavas[parte.id];
                  const cardExpandido = cardsExpandidos[parte.id] === true;
                  const cardEstaTocando = parteEstaTocando(parte.id);

                  return (
                    <div key={parte.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                      <div
                        onClick={() => alternarExpansaoParte(parte.id)}
                        style={{
                          ...s.cardParteStyle,
                          ...(cardEstaTocando ? s.cardParteTocandoStyle : {})
                        }}
                      >
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
                                {oitavaInfo.posicoes.map((p, idx) => (
                                  <option key={idx} value={idx}>
                                    {p.offset === 0 ? 'Oitava Original' : p.offset > 0 ? `+${p.offset / 12} Oitava` : `${p.offset / 12} Oitava`}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }} onClick={e => e.stopPropagation()}>
                            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>Volume</span>
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.01"
                              value={volumes[parte.id] ?? 1}
                              onChange={e => {
                                const novoVolume = parseFloat(e.target.value);
                                alterarVolume(parte.id, novoVolume);
                              }}
                              style={{ width: '100%', cursor: 'pointer' }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* CONTEÚDO EXPANDIDO */}
                      {cardExpandido && (
                        <div style={s.notasCardInternoContainer}>
                          {!notasPorParte[parte.id] ? (
                            <span style={{ color: '#a0aec0', fontSize: '12px', fontStyle: 'italic' }}>Aguardando tradução...</span>
                          ) : (
                            notasPorParte[parte.id].map((nota, index) => {
                              const estaTocando = notaEstaTocando(nota, tempoAtual);
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
          ...s.columnBox,
          flex: 1.2,
          position: 'sticky',
          top: '30px',
          height: 'calc(100vh - 60px)', // Faz a coluna ter o tamanho exato da tela disponível
          display: 'flex',
          flexDirection: 'column',
          paddingBottom: '25px'
        }}>
          {/* Header fixo da coluna direita com Título + Player */}
          <div style={{
            marginBottom: '20px',
            borderBottom: '1px solid #e2e8f0',
            paddingBottom: '15px',
            flexShrink: 0,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '20px'
          }}>
            <div style={{ flex: 1 }}>
              <h2 style={{ color: '#333', margin: 0, fontSize: '24px' }}>{nome}</h2>
              <span style={{ color: '#666' }}>{autor}</span>
            </div>

            {/* PLAYER MOVIDO PARA A DIREITA */}
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
                {playingId === 'ALL' && (
                  <div
                    style={s.barraFundo}
                    onClick={(e) => handleSeekClick(e, 'ALL')}
                  >
                    <div
                      style={{ ...s.barraProgresso, width: `${progress}%` }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Área scrollável das letras */}
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '10px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '30px' }}>
              {linhasLetra.map((linha, index) => (
                <div key={linha.id} style={s.linhaContainer}>
                  <div style={s.zonaDrop} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, index)}>
                    {linha.notas.length === 0 && <span style={{ color: '#cbd5e1', fontSize: '12px' }}>Solte notas aqui...</span>}
                    {linha.notas.map(nota => (
                      <div key={nota.id} style={s.cardNotaAlocada} onClick={() => removerNotaDaLinha(index, nota.id)} title="Clique para remover">
                        {nota.valor}
                      </div>
                    ))}
                    <input type="text" placeholder="+" style={s.inputNotaManual} onKeyDown={(e) => handleAdicionarNotaManual(e, index)} />
                  </div>
                  <div style={s.textoLetra}>{linha.texto || <span style={{ color: '#cbd5e1', fontStyle: 'italic' }}>[Linha vazia]</span>}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Botão Fixo no fundo da coluna da direita */}
          <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'flex-end', paddingTop: '15px', backgroundColor: 'white' }}>
            <button style={{ ...s.btnContinuar, position: 'relative', bottom: 'auto', right: 'auto' }} onClick={() => setMostrarPreview(true)}>
              Continuar ➔
            </button>
          </div>
        </div>
      </div>

      {/* --- MODAL DE AJUSTE DE NOTAS --- */}
      {modalAjusteAberto && (
        <div style={s.modalOverlay}>
          <div style={s.modalContent}>
            <h3 style={{ marginTop: 0, color: '#1e293b' }}>Ajuste de Notas</h3>
            <p style={{ color: '#475569', fontSize: '14px', lineHeight: '1.5' }}>
              A parte <strong>{parteEmAjuste?.nome}</strong> possui notas que não existem fisicamente na {tipoGaita} em {tomGaita}.
              Escolha as adaptações abaixo para contornar isso:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', margin: '20px 0', maxHeight: '400px', overflowY: 'auto' }}>
              {notasPendentes.map((nota, index) => (
                <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div>
                    <span style={{ fontWeight: 'bold', display: 'block', fontSize: '15px', color: '#0f172a' }}>
                      Nota Original: {midiToNoteName(nota.nota_midi_original)}
                    </span>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      Comando sugerido: <strong>{nota.sugestao_comando}</strong>
                    </span>
                  </div>

                  <select
                    value={mapeamentoUsuario[nota.nota_midi_original]}
                    onChange={(e) => setMapeamentoUsuario({ ...mapeamentoUsuario, [nota.nota_midi_original]: e.target.value })}
                    style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    {comandosDaGaita.map(cmd => (
                      <option key={cmd} value={cmd}>{cmd}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={cancelarAjustes} style={s.btnCancelarModal}>Cancelar e Pular</button>
              <button onClick={confirmarAjustes} style={s.btnConfirmarModal}>Confirmar Adaptações</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= STYLES ================= */
// AQUI: Foram removidos absolute, overflowX e posicionamentos que quebravam o sticky
const pageStyle = { width: '100%', minHeight: '100vh', backgroundColor: '#f4f7fb', fontFamily: 'Arial, sans-serif', padding: '30px 20px', boxSizing: 'border-box' };
const contentWrapper = { display: 'flex', gap: '30px', width: '100%', maxWidth: '1250px', margin: '0 auto', alignItems: 'flex-start' };
const columnBox = { backgroundColor: 'white', padding: '30px', borderRadius: '24px', boxShadow: '0 15px 40px rgba(0,0,0,0.08)', boxSizing: 'border-box' };
const mainCard = { margin: '0 auto', backgroundColor: 'white', padding: '45px', borderRadius: '24px', boxShadow: '0 15px 40px rgba(0,0,0,0.08)' };
const labelStyle = { fontSize: '13px', color: '#666', fontWeight: 'bold', marginBottom: '6px', display: 'block' };
const inputStyle = { width: '100%', padding: '12px 15px', borderRadius: '10px', border: '1px solid #d8e3f0', fontSize: '15px', outline: 'none', backgroundColor: '#fff', color: '#333', cursor: 'pointer' };

const selectOitavaStyle = { fontSize: '11px', padding: '4px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', outline: 'none', cursor: 'pointer', color: '#475569', fontWeight: 'bold' };

const btnPrimary = { padding: '14px 24px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,123,255,0.2)' };
const btnSecondary = { padding: '14px 24px', backgroundColor: '#e2e8f0', color: '#666', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' };

const cardNota = { padding: '6px 12px', backgroundColor: '#007bff', color: 'white', fontWeight: 'bold', borderRadius: '8px', cursor: 'grab', userSelect: 'none', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', fontSize: '13px', transition: 'box-shadow 0.05s ease, transform 0.05s ease, background-color 0.05s ease, opacity 0.1s ease' };
const linhaContainer = { display: 'flex', flexDirection: 'column', gap: '5px' };
const zonaDrop = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', minHeight: '38px', padding: '6px 10px', backgroundColor: '#fff', border: '2px dashed #d8e3f0', borderRadius: '10px', transition: 'background-color 0.2s' };
const cardNotaAlocada = { padding: '6px 12px', backgroundColor: '#1a73e8', color: 'white', fontWeight: 'bold', borderRadius: '6px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', fontSize: '14px' };
const inputNotaManual = { width: '40px', padding: '6px', borderRadius: '6px', border: '1px solid #d8e3f0', textAlign: 'center', outline: 'none', fontWeight: 'bold', color: '#333' };
const textoLetra = { fontSize: '16px', color: '#333', paddingLeft: '5px', whiteSpace: 'pre-wrap' };
const btnContinuar = { padding: '14px 28px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', boxShadow: '0 6px 18px rgba(0,123,255,0.3)' };

const containerCardsMidi = { backgroundColor: '#f8fafc', padding: '15px', borderRadius: '14px', border: '1px solid #e2e8f0', marginTop: '10px' };

const cardParteStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: '10px 14px', borderRadius: '8px', borderWidth: '2px', borderStyle: 'solid', borderColor: '#cbd5e1', marginBottom: '2px', cursor: 'pointer', transition: 'box-shadow 0.08s ease, border-color 0.08s ease, transform 0.08s ease' };
const cardParteNome = { fontWeight: 'bold', fontSize: '14px', color: '#334155' };
const btnPlayAll = { padding: '6px 12px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,123,255,0.2)' };

const notasCardInternoContainer = { display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '10px', backgroundColor: '#edf2f7', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '14px' };
const barraFundo = { width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', marginTop: '8px', cursor: 'pointer', overflow: 'hidden', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.1)' };
const barraProgresso = { height: '100%', backgroundColor: '#007bff', transition: 'width 0.1s linear', borderRadius: '4px' };

const modalOverlay = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };
const modalContent = { backgroundColor: 'white', padding: '30px', borderRadius: '16px', width: '90%', maxWidth: '550px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' };
const btnCancelarModal = { padding: '10px 18px', backgroundColor: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' };
const btnConfirmarModal = { padding: '10px 18px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 10px rgba(0,123,255,0.2)' };

const btnRecarregar = { display: 'flex', justifyContent: 'center', alignItems: 'center', width: '32px', height: '32px', backgroundColor: '#e2e8f0', color: '#007bff', border: 'none', borderRadius: '8px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', transition: 'background-color 0.2s', paddingBottom: '2px' };

// Novos estilos para os estados de alocação e reprodução
const cardNotaAlocadaTransparente = {
  opacity: 0.4,
  boxShadow: 'none',
  cursor: 'default' // Indica que não pode arrastar
};

const cardParteTocandoStyle = {
  borderColor: '#38bdf8',
  boxShadow: '0 0 8px rgba(14, 165, 233, 0.8), 0 0 20px rgba(14, 165, 233, 0.4)',
  transform: 'scale(1.01)'
};

const cardNotaTocandoStyle = {
  backgroundColor: '#facc15',
  color: '#422006',
  transform: 'scale(1.08)',
  boxShadow: '0 0 8px rgba(250, 204, 21, 0.9), 0 0 18px rgba(250, 204, 21, 0.5)'
};

const cardNotaTocandoAlocadaStyle = {
  backgroundColor: '#facc15',
  color: '#422006',
  opacity: 0.6,
  transform: 'scale(1.05)',
  boxShadow: '0 0 5px rgba(250, 204, 21, 0.4)'
};