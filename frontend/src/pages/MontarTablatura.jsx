import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as mm from '@magenta/music';

// Função auxiliar para traduzir o número MIDI em nota musical no Modal
const midiToNoteName = (midi) => {
  const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const octave = Math.floor(midi / 12) - 1;
  const note = notes[midi % 12];
  return `${note}${octave}`;
};

// ================= CUSTOM HOOK DE ÁUDIO =================
// ================= CUSTOM HOOK DE ÁUDIO =================
// ================= CUSTOM HOOK DE ÁUDIO =================
function useMidiPlayer() {
  const [tempoAtual, setTempoAtual] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playingId, setPlayingId] = useState(null);

  const playerRef = useRef(null);
  const sequenceRef = useRef(null);
  
  // Refs absolutas: Blindam o relógio contra re-renderizações (expandir cards)
  const requestRef = useRef(null);
  const isPlayingRef = useRef(false);
  const startTimeRef = useRef(0);
  const pausedTimeRef = useRef(0);

  useEffect(() => {
    playerRef.current = new mm.Player();
    return () => {
      if (playerRef.current) playerRef.current.stop();
      cancelAnimationFrame(requestRef.current);
    };
  }, []);

  const atualizarVisual = () => {
    if (isPlayingRef.current && sequenceRef.current) {
      let tempoCalculado = (Date.now() - startTimeRef.current) / 1000 + pausedTimeRef.current;
      if (tempoCalculado > sequenceRef.current.totalTime) {
        tempoCalculado = sequenceRef.current.totalTime;
      }
      
      setTempoAtual(tempoCalculado);
      if (sequenceRef.current.totalTime > 0) {
        setProgress((tempoCalculado / sequenceRef.current.totalTime) * 100);
      }
      
      requestRef.current = requestAnimationFrame(atualizarVisual);
    }
  };

  const startLoop = () => {
    isPlayingRef.current = true;
    startTimeRef.current = Date.now();
    cancelAnimationFrame(requestRef.current);
    requestRef.current = requestAnimationFrame(atualizarVisual);
  };

  const stopLoop = () => {
    isPlayingRef.current = false;
    cancelAnimationFrame(requestRef.current);
  };

  const stop = () => {
    if (playerRef.current) playerRef.current.stop();
    stopLoop();
    setIsPlaying(false);
    setProgress(0);
    setTempoAtual(0);
    pausedTimeRef.current = 0;
    setPlayingId(null);
  };

  const togglePlay = async (id, url) => {
    if (!playerRef.current) return;

    if (playingId === id) {
      if (isPlaying) {
        // PAUSE: Usamos .stop() para silenciar os osciladores instantaneamente
        const tempoPausado = (Date.now() - startTimeRef.current) / 1000 + pausedTimeRef.current;
        pausedTimeRef.current = tempoPausado;
        playerRef.current.stop();
        stopLoop();
        setIsPlaying(false);
      } else {
        // RESUME: Inicia e avança para o ponto salvo
        setIsPlaying(true);
        startLoop();
        playerRef.current.start(sequenceRef.current).catch(e => console.error(e));
        playerRef.current.seekTo(pausedTimeRef.current);
      }
      return;
    }

    stop();
    setPlayingId(id);
    setIsPlaying(true);
    pausedTimeRef.current = 0;

    try {
      const sequence = await mm.urlToNoteSequence(url);
      if (!sequence.notes || sequence.notes.length === 0) {
        stop();
        return;
      }

      sequence.notes.forEach(note => {
        if (note.instrument === null || note.instrument === undefined) note.instrument = 0;
      });

      sequenceRef.current = sequence;
      setDuration(sequence.totalTime);

      startLoop();
      await playerRef.current.start(sequence);
      
      if (isPlayingRef.current) stop(); // Fim natural da música
    } catch (err) {
      console.error("Erro ao reproduzir MIDI:", err);
      stop();
    }
  };

  const seek = (percent) => {
    if (!playerRef.current || !sequenceRef.current) return;
    const timeInSeconds = (percent / 100) * duration;
    
    pausedTimeRef.current = timeInSeconds;
    startTimeRef.current = Date.now();
    playerRef.current.seekTo(timeInSeconds);
    
    setTempoAtual(timeInSeconds);
    setProgress(percent);
  };

  return { togglePlay, stop, seek, progress, duration, isPlaying, playingId, tempoAtual };
}

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
  const [parteMidi, setParteMidi] = useState('');

  const [partesDisponiveis, setPartesDisponiveis] = useState([]);
  const [partesAdicionadas, setPartesAdicionadas] = useState([]);
  
  const [notasPorParte, setNotasPorParte] = useState({});
  const [dadosOitavas, setDadosOitavas] = useState({});

  // --- Estados do Modal de Ajuste ---
  const [modalAjusteAberto, setModalAjusteAberto] = useState(false);
  const [notasPendentes, setNotasPendentes] = useState([]);
  const [comandosDaGaita, setComandosDaGaita] = useState([]);
  const [mapeamentoUsuario, setMapeamentoUsuario] = useState({});
  const [parteEmAjuste, setParteEmAjuste] = useState(null);

  const [linhasLetra, setLinhasLetra] = useState([]);
  const [mostrarPreview, setMostrarPreview] = useState(false);
  
  const [cardsExpandidos, setCardsExpandidos] = useState({});
  const alternarExpansaoParte = (parteId) => {
    setCardsExpandidos(prev => ({
      ...prev,
      [parteId]: !prev[parteId]
    }));
  };

  const { togglePlay, stop, seek, progress, isPlaying, playingId, tempoAtual } = useMidiPlayer();

  const notaEstaTocando = (nota, tempo) => {
    if (
      !nota ||
      nota.inicio === undefined ||
      nota.fim === undefined
    ) {
      return false;
    }

    return (
      tempo >= nota.inicio &&
      tempo < nota.fim
    );
  };

  const parteEstaTocando = (parteId) => {
    const dados = notasPorParte[parteId];
    if (!dados) return false;
    return dados.some(nota => notaEstaTocando(nota, tempoAtual));
  };

  // 1. Busca as partes na inicialização e já joga todas para o estado Adicionadas
  useEffect(() => {
    if (letra) {
      setLinhasLetra(letra.split('\n').map((texto, index) => ({ id: `linha-${index}`, texto: texto, notas: [] })));
    }
    if (midiSelecionado) {
      fetch(`http://127.0.0.1:8000/midi/partes/${midiSelecionado.path}`)
        .then(res => res.json())
        .then(data => {
          setPartesDisponiveis(data.partes);
          setPartesAdicionadas(data.partes); // <-- Auto-add todas as partes
        })
        .catch(err => console.error("Erro ao buscar partes:", err));
    }
  }, [letra, midiSelecionado, musicaId]);

  // 2. Dispara a tradução automaticamente (e retraduz sozinho se você mudar a configuração da Gaita)
  useEffect(() => {
    if (partesAdicionadas.length > 0) {
      partesAdicionadas.forEach(parte => {
        tentarTraduzirParte(parte);
      });
    }
  }, [partesAdicionadas.length, tomGaita, tipoGaita]);

  const atualizarNotasDoCard = (parteId, tablaturaArray) => {
    const notasComId = tablaturaArray.map((notaObj) => ({
      ...notaObj,
      id: `nota-${parteId}-${notaObj.id}-${Date.now()}`,
      valor: notaObj.comando, // Mantemos 'valor' para compatibilidade com o Drag and Drop
      parteOrigem: parteId
    }));
    setNotasPorParte(prev => ({ ...prev, [parteId]: notasComId }));
  };

  const tentarTraduzirParte = async (parteEncontrada, overrides = null) => {
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
      } 
      else if (Array.isArray(data) && data.length > 0) {
        setModalAjusteAberto(false);
        setDadosOitavas(prev => ({
          ...prev,
          [parteEncontrada.id]: { posicoes: data, selecionada: 0 }
        }));
        atualizarNotasDoCard(parteEncontrada.id, data[0].tablatura);
      } 
      else {
        alert(`Erro desconhecido ou falha na conversão.`);
        removerParteCard(parteEncontrada.id);
      }
    } catch (err) {
      console.error("Erro na tradução:", err);
      alert("Falha de conexão com a API.");
      removerParteCard(parteEncontrada.id);
    }
  };

  const adicionarParteCard = async () => {
    if (!parteMidi) return alert("Selecione uma parte do MIDI!");
    if (partesAdicionadas.find(p => p.id === parteMidi)) return alert("Esta parte já foi adicionada!");

    const parteEncontrada = partesDisponiveis.find(p => p.id === parteMidi);
    if (!parteEncontrada) return;

    setPartesAdicionadas([...partesAdicionadas, parteEncontrada]);
    setParteMidi(''); 
    
    await tentarTraduzirParte(parteEncontrada);
  };

  const confirmarAjustes = () => {
    tentarTraduzirParte(parteEmAjuste, mapeamentoUsuario);
  };

  const cancelarAjustes = () => {
    setModalAjusteAberto(false);
    removerParteCard(parteEmAjuste.id);
    setParteEmAjuste(null);
  };

  const handleMudancaOitava = (parteId, novaOitavaIndex) => {
    setDadosOitavas(prev => ({
      ...prev, [parteId]: { ...prev[parteId], selecionada: novaOitavaIndex }
    }));
    atualizarNotasDoCard(parteId, dadosOitavas[parteId].posicoes[novaOitavaIndex].tablatura);
  };

  const removerParteCard = (parteId) => {
    if (playingId === parteId || playingId === 'ALL') stop();
    setPartesAdicionadas(prev => prev.filter(p => p.id !== parteId));
    setNotasPorParte(prev => { const c = { ...prev }; delete c[parteId]; return c; });
    setDadosOitavas(prev => { const c = { ...prev }; delete c[parteId]; return c; });
  };

  const handlePlayClick = (idOrigem, partesQuery) => {
    if (!midiSelecionado) return;
    const url = `http://127.0.0.1:8000/midi/play/${midiSelecionado.path}?partes=${partesQuery}&_t=${Date.now()}`;
    togglePlay(idOrigem, url);
  };

  const handleSeekClick = (e, idClicado) => {
    if (playingId !== idClicado) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
    seek(percent);
  };

  // ================= DRAG AND DROP =================
  const handleDragStart = (e, nota) => { 
    e.dataTransfer.setData('notaId', nota.id); 
    e.dataTransfer.setData('parteOrigem', nota.parteOrigem); 
  };
  const handleDragOver = (e) => { e.preventDefault(); };

  const handleDrop = (e, columnLinhaIndex) => {
    e.preventDefault();
    const notaId = e.dataTransfer.getData('notaId');
    const parteOrigem = e.dataTransfer.getData('parteOrigem');
    
    let notaEncontrada = null;
    if (parteOrigem && notasPorParte[parteOrigem]) {
      notaEncontrada = notasPorParte[parteOrigem].find(n => n.id === notaId);
    } else {
      Object.keys(notasPorParte).forEach(chave => {
        const achou = notasPorParte[chave].find(n => n.id === notaId);
        if (achou) notaEncontrada = achou;
      });
    }
    
    if (notaEncontrada) {
      const origemEfetiva = notaEncontrada.parteOrigem;
      if (origemEfetiva && notasPorParte[origemEfetiva]) {
        setNotasPorParte(prev => ({
          ...prev, [origemEfetiva]: prev[origemEfetiva].filter(n => n.id !== notaId)
        }));
      }
      setLinhasLetra(prev => {
        const novasLinhas = [...prev];
        novasLinhas[columnLinhaIndex].notas.push(notaEncontrada);
        return novasLinhas;
      });
    }
  };

  const removerNotaDaLinha = (linhaIndex, notaId) => {
    setLinhasLetra(prev => {
      const novasLinhas = [...prev];
      const notaRemovida = novasLinhas[linhaIndex].notas.find(n => n.id === notaId);
      novasLinhas[linhaIndex].notas = novasLinhas[linhaIndex].notas.filter(n => n.id !== notaId);
      
      if (notaRemovida && notaRemovida.parteOrigem && notaRemovida.parteOrigem !== 'manual') {
        setNotasPorParte(disponiveis => ({
          ...disponiveis,
          [notaRemovida.parteOrigem]: [...(disponiveis[notaRemovida.parteOrigem] || []), notaRemovida]
        }));
      }
      return novasLinhas;
    });
  };

  const handleAdicionarNotaManual = (e, linhaIndex) => {
    if (e.key === 'Enter' && e.target.value.trim() !== '') {
      const novaNota = { id: `nota-manual-${Date.now()}`, valor: e.target.value.trim(), parteOrigem: 'manual' };
      setLinhasLetra(prev => {
        const novasLinhas = [...prev];
        novasLinhas[linhaIndex].notas.push(novaNota);
        return novasLinhas;
      });
      e.target.value = '';
    }
  };

  // ================= RENDERIZAÇÃO =================
  if (mostrarPreview) {
    return (
      <div style={pageStyle}>
        <div style={{ ...mainCard, maxWidth: '800px', textAlign: 'center' }}>
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
            <button style={btnSecondary} onClick={() => setMostrarPreview(false)}>Voltar para Edição</button>
            <button style={btnPrimary} onClick={() => alert("Tablatura salva!")}>Salvar Tablatura</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={contentWrapper}>
        
        {/* COLUNA ESQUERDA */}
        <div style={columnBox}>
          <h3 style={sectionTitle}>Configurações da Gaita</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '25px' }}>
            <div>
              <label style={labelStyle}>Tom da Gaita</label>
              <select style={inputStyle} value={tomGaita} onChange={e => setTomGaita(e.target.value)}>
                {['C', 'G', 'A', 'D', 'E', 'F', 'Bb'].map(tom => <option key={tom} value={tom}>{tom}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Tipo de Gaita</label>
              <select style={inputStyle} value={tipoGaita} onChange={e => setTipoGaita(e.target.value)}>
                <option value="Diatônica">Diatônica</option>
                <option value="Cromática">Cromática</option>
              </select>
            </div>

            {partesAdicionadas.length > 0 && (
              <div style={containerCardsMidi}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#4a5568' }}>Partes Ativas:</span>
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: '100px' }}>
                    <button style={btnPlayAll} onClick={() => handlePlayClick('ALL', partesAdicionadas.map(p => p.id).join(','))}>
                      {playingId === 'ALL' && isPlaying ? '⏸ Pause All' : '▶ Play All'}
                    </button>
                    {playingId === 'ALL' && (
                      <div style={barraFundo} onClick={(e) => handleSeekClick(e, 'ALL')}>
                         <div style={{ ...barraProgresso, width: `${progress}%` }} />
                      </div>
                    )}
                  </div>
                </div>
                
                {/* CARDS INDIVIDUAIS */}
                {partesAdicionadas.map(parte => {7
                  const oitavaInfo = dadosOitavas[parte.id];
                  const cardExpandido = cardsExpandidos[parte.id] === true; // Default para true
                  const cardEstaTocando = parteEstaTocando(parte.id);

                  return (
                    <div key={parte.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                      
                      {/* CARD PRINCIPAL */}
                      {/* CARD PRINCIPAL REDUZIDO */}
                      <div
                        onClick={() => alternarExpansaoParte(parte.id)}
                        style={{
                          ...cardParteStyle,
                          ...(cardEstaTocando ? cardParteTocandoStyle : {})
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={cardParteNome}>
                              {cardExpandido ? '▼' : '▶'} {parte.nome}
                            </span>
                            
                            {oitavaInfo && oitavaInfo.posicoes.length > 1 && (
                              <select
                                value={oitavaInfo.selecionada}
                                onClick={e => e.stopPropagation()}
                                onChange={e => handleMudancaOitava(parte.id, parseInt(e.target.value))}
                                style={selectOitavaStyle}
                              >
                                {oitavaInfo.posicoes.map((p, idx) => (
                                  <option key={idx} value={idx}>
                                    {p.offset === 0 ? 'Oitava Original' : p.offset > 0 ? `+${p.offset / 12} Oitava` : `${p.offset / 12} Oitava`}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>

                          {/* NOVO: Slider de Volume no lugar da barra de progresso */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }} onClick={e => e.stopPropagation()}>
                            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>Volume</span>
                            <input 
                              type="range" 
                              min="0" max="100" defaultValue="100" 
                              style={{ flex: 1, height: '4px', cursor: 'pointer' }} 
                              onChange={(e) => console.log(`Volume de ${parte.nome} ajustado para ${e.target.value}`)}
                            />
                          </div>
                        </div>
                      </div>

                      {/* CONTEÚDO EXPANDIDO */}
                      {cardExpandido && (
                        <div style={notasCardInternoContainer}>
                          {!notasPorParte[parte.id] ? (
                            <span style={{ color: '#a0aec0', fontSize: '12px', fontStyle: 'italic' }}>Processando notas...</span>
                          ) : (
                            notasPorParte[parte.id].map(nota => {
                              const estaTocando = notaEstaTocando(nota, tempoAtual);
                              return (
                                <div
                                  key={nota.id}
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, nota)}
                                  style={{
                                    ...cardNota,
                                    ...(estaTocando ? cardNotaTocandoStyle : {})
                                  }}
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

        {/* COLUNA DIREITA */}
        <div style={{ ...columnBox, position: 'relative' }}>
          <div style={{ marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '15px' }}>
            <h2 style={{ color: '#333', margin: 0, fontSize: '24px' }}>{nome}</h2>
            <span style={{ color: '#666' }}>{autor}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '80px' }}>
            {linhasLetra.map((linha, index) => (
              <div key={linha.id} style={linhaContainer}>
                <div style={zonaDrop} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, index)}>
                  {linha.notas.length === 0 && <span style={{ color: '#cbd5e1', fontSize: '12px' }}>Solte notas aqui...</span>}
                  {linha.notas.map(nota => (
                    <div key={nota.id} style={cardNotaAlocada} onClick={() => removerNotaDaLinha(index, nota.id)} title="Clique para remover">
                      {nota.valor}
                    </div>
                  ))}
                  <input type="text" placeholder="+" style={inputNotaManual} onKeyDown={(e) => handleAdicionarNotaManual(e, index)} />
                </div>
                <div style={textoLetra}>{linha.texto || <span style={{ color: '#cbd5e1', fontStyle: 'italic' }}>[Linha vazia]</span>}</div>
              </div>
            ))}
          </div>
          <button style={btnContinuar} onClick={() => setMostrarPreview(true)}>Continuar ➔</button>
        </div>
      </div>

      {/* --- MODAL DE AJUSTE DE NOTAS --- */}
      {modalAjusteAberto && (
        <div style={modalOverlay}>
            <div style={modalContent}>
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
                                style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', cursor: 'pointer', fontWeight: 'bold', color: '#334155' }}
                            >
                                {comandosDaGaita.map(cmd => (
                                    <option key={cmd} value={cmd}>{cmd}</option>
                                ))}
                            </select>
                        </div>
                    ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button onClick={cancelarAjustes} style={btnCancelarModal}>Cancelar e Remover</button>
                    <button onClick={confirmarAjustes} style={btnConfirmarModal}>Confirmar Adaptações</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}

/* ================= STYLES ================= */
const pageStyle = { position: 'absolute', top: 0, left: 0, width: '100vw', minHeight: '100vh', backgroundColor: '#f4f7fb', fontFamily: 'Arial, sans-serif', padding: '40px 20px', boxSizing: 'border-box', overflowX: 'hidden' };
const contentWrapper = { display: 'flex', gap: '30px', width: '100%', maxWidth: '1200px', margin: '0 auto', alignItems: 'flex-start' };
const columnBox = { flex: 1, backgroundColor: 'white', padding: '35px', borderRadius: '24px', boxShadow: '0 15px 40px rgba(0,0,0,0.08)', boxSizing: 'border-box' };
const mainCard = { margin: '0 auto', backgroundColor: 'white', padding: '45px', borderRadius: '24px', boxShadow: '0 15px 40px rgba(0,0,0,0.08)' };
const sectionTitle = { color: '#007bff', fontSize: '18px', marginBottom: '20px', fontWeight: 'bold' };
const labelStyle = { fontSize: '13px', color: '#666', fontWeight: 'bold', marginBottom: '6px', display: 'block' };
const inputStyle = { width: '100%', padding: '12px 15px', borderRadius: '10px', border: '1px solid #d8e3f0', fontSize: '15px', outline: 'none', backgroundColor: '#fff', color: '#333', cursor: 'pointer' };

const selectOitavaStyle = { fontSize: '11px', padding: '4px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', outline: 'none', cursor: 'pointer', color: '#475569', fontWeight: 'bold' };

const btnPrimary = { padding: '14px 24px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,123,255,0.2)' };
const btnSecondary = { padding: '14px 24px', backgroundColor: '#e2e8f0', color: '#666', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' };

// As propriedades transition foram inseridas aqui nativamente para evitar pulos secos
const cardNota = { padding: '6px 12px', backgroundColor: '#007bff', color: 'white', fontWeight: 'bold', borderRadius: '8px', cursor: 'grab', userSelect: 'none', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', fontSize: '13px', transition: 'box-shadow 0.05s ease, transform 0.05s ease, background-color 0.05s ease' };
const linhaContainer = { display: 'flex', flexDirection: 'column', gap: '5px' };
const zonaDrop = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', minHeight: '38px', padding: '6px 10px', backgroundColor: '#fff', border: '2px dashed #d8e3f0', borderRadius: '10px', transition: 'background-color 0.2s' };
const cardNotaAlocada = { padding: '6px 12px', backgroundColor: '#1a73e8', color: 'white', fontWeight: 'bold', borderRadius: '6px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', fontSize: '14px' };
const inputNotaManual = { width: '40px', padding: '6px', borderRadius: '6px', border: '1px solid #d8e3f0', textAlign: 'center', outline: 'none', fontWeight: 'bold', color: '#333' };
const textoLetra = { fontSize: '16px', color: '#333', paddingLeft: '5px', whiteSpace: 'pre-wrap' };
const btnContinuar = { position: 'absolute', bottom: '25px', right: '35px', padding: '14px 28px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', boxShadow: '0 6px 18px rgba(0,123,255,0.3)' };

const btnAdicionarParte = { padding: '0 20px', backgroundColor: '#238636', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 10px rgba(35,134,54,0.15)', fontSize: '14px' };
const containerCardsMidi = { backgroundColor: '#f8fafc', padding: '15px', borderRadius: '14px', border: '1px solid #e2e8f0', marginTop: '10px' };

const cardParteStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: '10px 14px', borderRadius: '8px', borderWidth: '2px', borderStyle: 'solid', borderColor: '#cbd5e1', marginBottom: '2px', cursor: 'pointer', transition: 'box-shadow 0.08s ease, border-color 0.08s ease, transform 0.08s ease' };
const cardParteNome = { fontWeight: 'bold', fontSize: '14px', color: '#334155' };
const btnPlayAll = { padding: '6px 12px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,123,255,0.2)' };
const btnPlayCard = { width: '28px', height: '28px', backgroundColor: '#e0f2fe', color: '#0369a1', border: 'none', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' };
const btnRemoverCard = { width: '28px', height: '28px', backgroundColor: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' };

const notasCardInternoContainer = { display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '10px', backgroundColor: '#edf2f7', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '14px' };
const barraFundo = { width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', marginTop: '8px', cursor: 'pointer', overflow: 'hidden', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.1)' };
const barraProgresso = { height: '100%', backgroundColor: '#007bff', transition: 'width 0.1s linear', borderRadius: '4px' };

const modalOverlay = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };
const modalContent = { backgroundColor: 'white', padding: '30px', borderRadius: '16px', width: '90%', maxWidth: '550px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' };
const btnCancelarModal = { padding: '10px 18px', backgroundColor: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' };
const btnConfirmarModal = { padding: '10px 18px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 10px rgba(0,123,255,0.2)' };

// Efeitos de brilho acoplados via JavaScript dinâmico
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