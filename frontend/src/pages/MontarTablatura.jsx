import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import 'html-midi-player';

export default function MontarTablatura() {
  const location = useLocation();
  const navigate = useNavigate();

  // Dados recebidos do navigate (da página CriarTabs) com proteções e fallbacks
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

  // Estados de Dados da API
  const [partesDisponiveis, setPartesDisponiveis] = useState([]);
  
  // Dicionário para armazenar as notas de cada parte: { [parteId]: [ {id, valor, parteOrigem}, ... ] }
  const [notasPorParte, setNotasPorParte] = useState({});
  
  // Estado para montar a letra com as notas arrastadas
  const [linhasLetra, setLinhasLetra] = useState([]);

  // Estado da tela de Visualização Final
  const [mostrarPreview, setMostrarPreview] = useState(false);

  // Estado Referente aos cards com partes selecionadas
  const [partesAdicionadas, setPartesAdicionadas] = useState([]);
  const [urlMidi, setUrlMidi] = useState('');
  const midiPlayerRef = useRef(null);

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

  // 2. PROCESSAR O MIDI E TRADUZIR NOTAS (Vão direto para o card correspondente)
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

      // Salva as notas associadas à chave da parte específica
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
    
    if (partesAdicionadas.find(p => p.id === parteMidi)) {
      return alert("Esta parte do MIDI já foi adicionada!");
    }

    const parteEncontrada = partesDisponiveis.find(p => p.id === parteMidi);
    if (parteEncontrada) {
      setPartesAdicionadas([...partesAdicionadas, parteEncontrada]);
      traduzirParteMidi(parteEncontrada.id);
      setParteMidi(''); 
    }
  };

  const removerParteCard = (parteId) => {
    setPartesAdicionadas(prev => prev.filter(p => p.id !== parteId));
    setNotasPorParte(prev => {
      const cópia = { ...prev };
      delete cópia[parteId];
      return cópia;
    });
  };

  // CONTROLES DE ÁUDIO MIDI PLAYER
  const tocarMidiFiltro = (partesQuery) => {
    if (!midiSelecionado) return;
    
    const player = midiPlayerRef.current;
    if (player) {
      // Para a execução anterior se houver para evitar sobreposição travada
      player.stop();
    }

    const url = `http://127.0.0.1:8000/midi/play/${midiSelecionado.path}?partes=${partesQuery}`;
    setUrlMidi(url);
  };

  // Dispara o início do som assim que o elemento de áudio invisível registrar a alteração da URL
  useEffect(() => {
    if (urlMidi && midiPlayerRef.current) {
      const iniciarPlayer = async () => {
        try {
          // Aguarda um ciclo mínimo de renderização para o Web Component ler o novo atributo 'src'
          await new Promise(resolve => setTimeout(resolve, 150));
          if (midiPlayerRef.current) {
            midiPlayerRef.current.start();
          }
        } catch (e) {
          console.error("Falha ao tocar o arquivo gerado:", e);
        }
      };
      iniciarPlayer();
    }
  }, [urlMidi]);

  const tocarTodasAsPartes = () => {
    if (partesAdicionadas.length === 0) return;
    const partesQuery = partesAdicionadas.map(p => p.id).join(',');
    tocarMidiFiltro(partesQuery);
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
    const parteOrigem = e.dataTransfer.setData ? e.dataTransfer.getData('parteOrigem') : null;
    
    // Procura a nota dentro da parte correta no dicionário de notas
    let notaEncontrada = null;
    if (parteOrigem && notasPorParte[parteOrigem]) {
      notaEncontrada = notasPorParte[parteOrigem].find(n => n.id === notaId);
    } else {
      // Fallback abrangente caso o dataTransfer perca a referência da string de origem
      Object.keys(notasPorParte).forEach(chave => {
        const achou = notasPorParte[chave].find(n => n.id === notaId);
        if (achou) notaEncontrada = achou;
      });
    }
    
    if (notaEncontrada) {
      const origemEfetiva = notaEncontrada.parteOrigem;
      // Remove do pool de notas disponíveis daquele card específico
      setNotasPorParte(prev => ({
        ...prev,
        [origemEfetiva]: prev[origemEfetiva].filter(n => n.id !== notaId)
      }));

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
        // Devolve a nota para dentro do card correto
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
        
        {/* COLUNA ESQUERDA: CONFIGURAÇÕES E TRILHAS DO MIDI */}
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

            {/* SEÇÃO DINÂMICA DOS CARDS DE TRILHAS MIDI SELECIONADAS */}
            {partesAdicionadas.length > 0 && (
              <div style={containerCardsMidi}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#4a5568' }}>Partes Ativas:</span>
                  <button style={btnPlayAll} onClick={tocarTodasAsPartes}>
                    ▶ Play All
                  </button>
                </div>
                
                {partesAdicionadas.map(parte => (
                  <div key={parte.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                    <div style={cardParteStyle}>
                      <span style={cardParteNome}>{parte.nome}</span>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <button style={btnPlayCard} onClick={() => tocarMidiFiltro(parte.id)} title="Tocar esta parte">
                          ▶
                        </button>
                        <button style={btnRemoverCard} onClick={() => removerParteCard(parte.id)} title="Remover parte">
                          ✖
                        </button>
                      </div>
                    </div>

                    {/* NOTAS GERADAS ESPECÍFICAS DESTA PARTE DENTRO DO SEU RESPECTIVO CARD */}
                    <div style={notasCardInternoContainer}>
                      {!notasPorParte[parte.id] ? (
                        <span style={{ color: '#a0aec0', fontSize: '12px', fontStyle: 'italic' }}>Processando notas...</span>
                      ) : notasPorParte[parte.id].length === 0 ? (
                        <span style={{ color: '#cbd5e1', fontSize: '11px' }}>Todas as notas foram alocadas na letra.</span>
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

        {/* COLUNA DIREITA: LETRA E POSICIONAMENTO */}
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
                    title="Digite uma nota manual e aperte Enter"
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

      {/* PLAYER MIDI INVISÍVEL PARA EXECUÇÃO DOS CONTROLES WEB */}
      {urlMidi && (
        <midi-player
          ref={midiPlayerRef}
          src={urlMidi}
          style={{ display: 'none' }}
        ></midi-player>
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

// NOVO ESTILO DO SUB-CONTAINER DE NOTAS ACOPLADO ABAIXO DE CADA TRILHA ATIVA
const notasCardInternoContainer = { display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '10px', backgroundColor: '#edf2f7', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '14px' };