import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as mm from '@magenta/music';

// ================= CUSTOM HOOK DE ÁUDIO =================
// Centraliza toda a lógica do Magenta Music, isolando a complexidade do componente visual.
function useMidiPlayer() {
  const playerRef = useRef(null);
  const sequenceRef = useRef(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playingId, setPlayingId] = useState(null);

  // Inicializa o player uma única vez
  useEffect(() => {
    playerRef.current = new mm.Player();
    
    return () => {
      if (playerRef.current) {
        playerRef.current.stop();
      }
    };
  }, []);

  const stop = () => {
    if (playerRef.current) {
      playerRef.current.stop();
      setIsPlaying(false);
      setProgress(0);
      setPlayingId(null);
    }
  };

  const togglePlay = async (id, url) => {
    if (!playerRef.current) return;

    // Se clicou na mesma track que já está em contexto
    if (playingId === id) {
      if (isPlaying) {
        playerRef.current.pause();
        setIsPlaying(false);
      } else {
        playerRef.current.resume();
        setIsPlaying(true);
      }
      return;
    }

    // Se é uma nova track, reseta tudo
    stop();
    setPlayingId(id);
    setIsPlaying(true);
    setProgress(0);

    try {
      const sequence = await mm.urlToNoteSequence(url);

      // Garante que o instrumento padrão seja o Piano (0) se a track não especificar
      if (sequence.notes) {
        sequence.notes.forEach(note => {
          if (note.instrument == null || note.instrument === undefined) {
            note.instrument = 0;
          }
        });
      }

      setDuration(sequence.totalTime);
      sequenceRef.current = sequence;

      // Callback para atualizar a barra de progresso a cada nota tocada
      playerRef.current.callbackObject = {
        run(note) {
          if (sequence.totalTime > 0) {
            setProgress((note.startTime / sequence.totalTime) * 100);
          }
        }
      };

      // Inicia a reprodução. O await segura a execução até a música terminar naturalmente.
      await playerRef.current.start(sequence);
      
      // Quando a música acaba naturalmente (sem ser interrompada por stop/pause)
      if (playerRef.current.getPlayState() !== 'paused') {
        setIsPlaying(false);
        setProgress(0);
        setPlayingId(null);
      }

    } catch (err) {
      console.error("Erro ao carregar ou reproduzir MIDI via Magenta:", err);
      stop();
    }
  };

  const seek = (percent) => {
    if (!playerRef.current || !sequenceRef.current) return;
    
    const timeInSeconds = (percent / 100) * duration;
    // O Magenta utiliza seekTo() para pular para um ponto específico
    playerRef.current.seekTo(timeInSeconds);
    setProgress(percent);
  };

  return { togglePlay, stop, seek, progress, duration, isPlaying, playingId };
}


// ================= COMPONENTE PRINCIPAL =================
export default function MontarTablatura() {
  const location = useLocation();
  const navigate = useNavigate();

  // Dados recebidos do navigate (da página CriarTabs)
  const dadosRecebidos = location.state || {};
  const musicaId = dadosRecebidos.musicaId || 1;
  const nome = dadosRecebidos.nome || "Bad Romance (Exemplo)";
  const autor = dadosRecebidos.autor || "Lady Gaga (Exemplo)";
  const letra = dadosRecebidos.letra || "Rah, hah, ah, ah, ah.\nRoma, roma, ma.\nGaga, ooh la la,\nWant your bad romance.";
  const midiSelecionado = dadosRecebidos.midi || null; 

  // Estados dos Dropdowns
  const [tomGaita, setTomGaita] = useState('C');
  const [tipoGaita, setTipoGaita] = useState('Diatônica');
  const [parteMidi, setParteMidi] = useState('');

  // Estados de Dados
  const [partesDisponiveis, setPartesDisponiveis] = useState([]);
  const [notasPorParte, setNotasPorParte] = useState({});
  const [linhasLetra, setLinhasLetra] = useState([]);
  const [mostrarPreview, setMostrarPreview] = useState(false);
  const [partesAdicionadas, setPartesAdicionadas] = useState([]);

  // Inicializa o Hook Customizado de Áudio
  const { 
    togglePlay, 
    stop, 
    seek, 
    progress, 
    isPlaying, 
    playingId 
  } = useMidiPlayer();

  // 1. BUSCAR AS PARTES DO MIDI AO CARREGAR
  useEffect(() => {
    if (letra) {
      const linhas = letra.split('\n').map((texto, index) => ({
        id: `linha-${index}`,
        texto: texto,
        notas: []
      }));
      setLinhasLetra(linhas);
    }

    if (midiSelecionado) {
      const caminho_completo = midiSelecionado.path; 
      fetch(`http://127.0.0.1:8000/midi/partes/${caminho_completo}`)
        .then(res => res.json())
        .then(data => setPartesDisponiveis(data.partes))
        .catch(err => console.error("Erro ao buscar partes:", err));
    }
  }, [letra, midiSelecionado, musicaId]);

  // 2. PROCESSAR O MIDI E TRADUZIR NOTAS
  const traduzirParteMidi = async (parteId) => {
    try {
      const response = await fetch(`http://127.0.0.1:8000/traduzir-tablatura`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          musica_id: musicaId,
          nome_arquivo: midiSelecionado.arquivo_midi,
          parte_id: parteId,
          tom_gaita: tomGaita,
          tipo_gaita: tipoGaita
        })
      });

      const data = await response.json();
      const notasComId = data.tablatura.map((valor, i) => ({
        id: `nota-${parteId}-${i}-${Date.now()}`,
        valor: valor,
        parteOrigem: parteId
      }));

      setNotasPorParte(prev => ({
        ...prev,
        [parteId]: notasComId
      }));
    } catch (err) {
      console.error("Erro ao processar:", err);
      alert("Erro ao conectar com a API de processamento/tradução.");
    }
  };

  // GERENCIAMENTO DOS CARDS DE PARTES MIDI
  const adicionarParteCard = () => {
    if (parteMidi === '') return alert("Selecione uma parte do MIDI!");
    if (partesAdicionadas.find(p => p.id === parteMidi)) return alert("Esta parte já foi adicionada!");

    const parteEncontrada = partesDisponiveis.find(p => p.id === parteMidi);
    if (parteEncontrada) {
      setPartesAdicionadas([...partesAdicionadas, parteEncontrada]);
      traduzirParteMidi(parteEncontrada.id);
      setParteMidi(''); 
    }
  };

  const removerParteCard = (parteId) => {
    if (playingId === parteId || playingId === 'ALL') {
      stop(); // Usa a função limpa do hook
    }

    setPartesAdicionadas(prev => prev.filter(p => p.id !== parteId));
    setNotasPorParte(prev => {
      const cópia = { ...prev };
      delete cópia[parteId];
      return cópia;
    });
  };

  // ================= AÇÕES DA INTERFACE DE ÁUDIO =================
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

  const tocarTodasAsPartes = () => {
    if (partesAdicionadas.length === 0) return;
    const partesQuery = partesAdicionadas.map(p => p.id).join(',');
    handlePlayClick('ALL', partesQuery);
  };

  // ================= DRAG AND DROP LOGIC =================
  const handleDragStart = (e, nota) => { 
    e.dataTransfer.setData('notaId', nota.id); 
    e.dataTransfer.setData('parteOrigem', nota.parteOrigem); 
  };
  const handleDragOver = (e) => { e.preventDefault(); };

  const handleDrop = (e, columnLinhaIndex) => {
    e.preventDefault();
    const notaId = e.dataTransfer.getData('notaId');
    const parteOrigem = e.dataTransfer.getData('parteOrigem'); // Correção do getData aqui
    
    let notaEncontrada = null;
    
    // Procura na parte de origem informada
    if (parteOrigem && notasPorParte[parteOrigem]) {
      notaEncontrada = notasPorParte[parteOrigem].find(n => n.id === notaId);
    } else {
      // Fallback: Varre todas as partes caso o metadado se perca no drag
      Object.keys(notasPorParte).forEach(chave => {
        const achou = notasPorParte[chave].find(n => n.id === notaId);
        if (achou) notaEncontrada = achou;
      });
    }
    
    if (notaEncontrada) {
      const origemEfetiva = notaEncontrada.parteOrigem;
      
      // Só tenta filtrar se a lista daquela parte de fato existir para evitar o crash
      if (origemEfetiva && notasPorParte[origemEfetiva]) {
        setNotasPorParte(prev => ({
          ...prev,
          [origemEfetiva]: prev[origemEfetiva].filter(n => n.id !== notaId)
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
      
      if (notaRemovida && notaRemovida.parteOrigem) {
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

  // ================= TELA DE PREVIEW =================
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
            <button style={btnSecondary} onClick={() => setMostrarPreview(false)}>
              Voltar para Edição
            </button>
            <button style={btnPrimary} onClick={() => alert("Tablatura pronta para salvar!")}>
              Salvar Tablatura Definitiva
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ================= TELA DE MONTAGEM =================
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
                {['C', 'G', 'A', 'D', 'E', 'F', 'Bb'].map(tom => (
                  <option key={tom} value={tom}>{tom}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Tipo de Gaita</label>
              <select style={inputStyle} value={tipoGaita} onChange={e => setTipoGaita(e.target.value)}>
                <option value="Diatônica">Diatônica</option>
                <option value="Cromática">Cromática</option>
                <option value="Tremolo">Tremolo</option>
                <option value="Oitavada">Oitavada</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Selecionar Parte do MIDI</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <select style={inputStyle} value={parteMidi} onChange={e => setParteMidi(e.target.value)}>
                  <option value="" disabled>Selecione a trilha...</option>
                  {partesDisponiveis.map(parte => (
                    <option key={parte.id} value={parte.id}>{parte.nome}</option>
                  ))}
                </select>
                <button style={btnAdicionarParte} onClick={adicionarParteCard}>
                  + Add
                </button>
              </div>
            </div>

            {partesAdicionadas.length > 0 && (
              <div style={containerCardsMidi}>
                
                {/* CABEÇALHO DO PLAY ALL COM BARRA DE PROGRESSO */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#4a5568' }}>Partes Ativas:</span>
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: '100px' }}>
                    <button style={btnPlayAll} onClick={tocarTodasAsPartes}>
                      {playingId === 'ALL' && isPlaying ? '⏸ Pause All' : '▶ Play All'}
                    </button>
                    {playingId === 'ALL' && (
                      <div style={barraFundo} onClick={(e) => handleSeekClick(e, 'ALL')}>
                         <div style={{ ...barraProgresso, width: `${progress}%` }} />
                      </div>
                    )}
                  </div>
                </div>
                
                {/* CARDS INDIVIDUAIS COM BARRAS DE PROGRESSO */}
                {partesAdicionadas.map(parte => (
                  <div key={parte.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                    
                    <div style={cardParteStyle}>
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, marginRight: '15px' }}>
                        <span style={cardParteNome}>{parte.nome}</span>
                        {/* Barra de Progresso Clicável do Card */}
                        <div style={barraFundo} onClick={(e) => handleSeekClick(e, parte.id)} title="Clique para avançar/retroceder">
                          <div style={{ 
                              ...barraProgresso, 
                              width: playingId === parte.id ? `${progress}%` : '0%' 
                          }}></div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <button 
                          style={btnPlayCard} 
                          onClick={() => handlePlayClick(parte.id, parte.id)} 
                          title={playingId === parte.id && isPlaying ? "Pausar" : "Tocar"}
                        >
                          {playingId === parte.id && isPlaying ? '⏸' : '▶'}
                        </button>
                        <button style={btnRemoverCard} onClick={() => removerParteCard(parte.id)} title="Remover parte">
                          ✖
                        </button>
                      </div>
                    </div>

                    <div style={notasCardInternoContainer}>
                      {!notasPorParte[parte.id] ? (
                        <span style={{ color: '#a0aec0', fontSize: '12px', fontStyle: 'italic' }}>Processando notas...</span>
                      ) : notasPorParte[parte.id].length === 0 ? (
                        <span style={{ color: '#cbd5e1', fontSize: '11px' }}>Todas as notas foram alocadas.</span>
                      ) : (
                        notasPorParte[parte.id].map(nota => (
                          <div key={nota.id} draggable onDragStart={(e) => handleDragStart(e, nota)} style={cardNota}>
                            {nota.valor}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}

              </div>
            )}
          </div>
        </div>

        {/* COLUNA DIREITA */}
        <div style={{ ...columnBox, position: 'relative' }}>
          <div style={{ marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '15px' }}>
            <h2 style={{ color: '#333', margin: 0, fontSize: '24px' }}>{nome}</h2>
            <span style={{ color: '#666' }}>{autor}</span>
            {midiSelecionado && <span style={{display: 'block', fontSize: '12px', color: '#007bff', marginTop: '5px'}}>MIDI: {midiSelecionado.arquivo_midi}</span>}
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

                  <input 
                    type="text" placeholder="+" style={inputNotaManual}
                    onKeyDown={(e) => handleAdicionarNotaManual(e, index)}
                  />
                </div>

                <div style={textoLetra}>
                  {linha.texto || <span style={{ color: '#cbd5e1', fontStyle: 'italic' }}>[Linha vazia]</span>}
                </div>
              </div>
            ))}
          </div>

          <button style={btnContinuar} onClick={() => setMostrarPreview(true)}>
            Continuar ➔
          </button>
        </div>

      </div>
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

const btnPrimary = { padding: '14px 24px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,123,255,0.2)' };
const btnSecondary = { padding: '14px 24px', backgroundColor: '#e2e8f0', color: '#666', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' };

const cardNota = { padding: '6px 12px', backgroundColor: '#007bff', color: 'white', fontWeight: 'bold', borderRadius: '8px', cursor: 'grab', userSelect: 'none', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', fontSize: '13px' };
const linhaContainer = { display: 'flex', flexDirection: 'column', gap: '5px' };
const zonaDrop = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', minHeight: '38px', padding: '6px 10px', backgroundColor: '#fff', border: '2px dashed #d8e3f0', borderRadius: '10px', transition: 'background-color 0.2s' };
const cardNotaAlocada = { padding: '6px 12px', backgroundColor: '#1a73e8', color: 'white', fontWeight: 'bold', borderRadius: '6px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', fontSize: '14px' };
const inputNotaManual = { width: '40px', padding: '6px', borderRadius: '6px', border: '1px solid #d8e3f0', textAlign: 'center', outline: 'none', fontWeight: 'bold', color: '#333' };
const textoLetra = { fontSize: '16px', color: '#333', paddingLeft: '5px', whiteSpace: 'pre-wrap' };
const btnContinuar = { position: 'absolute', bottom: '25px', right: '35px', padding: '14px 28px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', boxShadow: '0 6px 18px rgba(0,123,255,0.3)' };

const btnAdicionarParte = { padding: '0 20px', backgroundColor: '#238636', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 10px rgba(35,134,54,0.15)', fontSize: '14px' };
const containerCardsMidi = { backgroundColor: '#f8fafc', padding: '15px', borderRadius: '14px', border: '1px solid #e2e8f0', marginTop: '10px' };
const cardParteStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '2px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' };
const cardParteNome = { fontWeight: 'bold', fontSize: '14px', color: '#334155' };
const btnPlayAll = { padding: '6px 12px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,123,255,0.2)' };
const btnPlayCard = { width: '28px', height: '28px', backgroundColor: '#e0f2fe', color: '#0369a1', border: 'none', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' };
const btnRemoverCard = { width: '28px', height: '28px', backgroundColor: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' };

const notasCardInternoContainer = { display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '10px', backgroundColor: '#edf2f7', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '14px' };

// ESTILOS DA BARRA DE PROGRESSO
const barraFundo = { width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', marginTop: '8px', cursor: 'pointer', overflow: 'hidden', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.1)' };
const barraProgresso = { height: '100%', backgroundColor: '#007bff', transition: 'width 0.1s linear', borderRadius: '4px' };