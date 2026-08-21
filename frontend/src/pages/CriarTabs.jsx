import { useState, useEffect, useRef } from 'react';
import CustomModal from '../components/CustomModal';
import TopBar, { TOPBAR_CLEARANCE } from '../components/TopBar';
import { useAnimatedNavigate, fadeStyle } from '../hooks/useAnimatedNavigate';
import { useAuthUser } from '../hooks/useAuthUser';
import { useModal } from '../hooks/useModal';
import {
  buscarSugestoesMusicas,
  buscarMusicaExata,
  criarMusica,
  buscarArquivosMidiPorMusica,
  buscarAvaliacoesMidi,
  uploadArquivoMidi,
  registrarArquivoMidi
} from '../services/musicaService';

export default function CriarTabs() {
  const { modalConfig, showAlert, closeModal } = useModal();

  const { expanded, contentVisible, navigateAnimated } = useAnimatedNavigate(true);
  const [loading, setLoading] = useState(false);
  const { usuario } = useAuthUser();

  const [musica, setMusica] = useState('');
  const [autorMusica, setAutorMusica] = useState('');
  const [letra, setLetra] = useState('');

  // Estados de controle do MIDI
  const [musicaId, setMusicaId] = useState(null);
  const [arquivosMidi, setArquivosMidi] = useState([]);
  const [midiSelecionado, setMidiSelecionado] = useState(null);
  const [uploadingMidi, setUploadingMidi] = useState(false);
  const fileInputRef = useRef(null);

  const [sugestoes, setSugestoes] = useState([]);
  const debounceRef = useRef(null);

  // ===== BUSCA COM DEBOUNCE PARA SUGESTÕES =====
  useEffect(() => {
    if (!musica || musica.trim().length < 2) {
      setSugestoes([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      const termo = musica.trim();
      if (termo.length < 2) return;

      const { data, error } = await buscarSugestoesMusicas(termo);

      if (error) {
        console.error("Erro Supabase:", error);
        return;
      }
      setSugestoes(data || []);
    }, 750);

    return () => clearTimeout(debounceRef.current);
  }, [musica]);

  const selecionarSugestao = (item) => {
    setMusica(item.nome);
    setAutorMusica(item.autor || '');
    setLetra(item.letra || '');
    setMusicaId(item.id);
    setMidiSelecionado(null);
    setSugestoes([]);
  };

  // ===== BUSCA DE MATCH EXATO E CÁLCULO DE MÉDIA DE ESTRELAS =====
  const buscarMidis = async (id) => {
    const { data: midis, error } = await buscarArquivosMidiPorMusica(id);

    if (!error && midis) {
      const midiIds = midis.map(m => m.id);

      if (midiIds.length > 0) {
        // Busca as avaliações dos arquivos MIDI encontrados
        const { data: avaliacoes, error: errorAvaliacoes } = await buscarAvaliacoesMidi(midiIds);

        if (!errorAvaliacoes && avaliacoes) {
          // Atribui a média calculada a cada arquivo
          const midisComMedia = midis.map(midi => {
            const notasDoMidi = avaliacoes.filter(a => a.midi_id === midi.id).map(a => a.nota);
            const media = notasDoMidi.length > 0 ? notasDoMidi.reduce((a, b) => a + b, 0) / notasDoMidi.length : 0;
            return { ...midi, mediaNota: media };
          });
          setArquivosMidi(midisComMedia);
          return;
        }
      }
      setArquivosMidi(midis || []);
    }
  };

  // Trava os campos se a música já existir
  useEffect(() => {
    const checkExactMatch = async () => {
      if (!musica.trim() || !autorMusica.trim()) {
        setMusicaId(null);
        setArquivosMidi([]);
        setMidiSelecionado(null);
        return;
      }

      const { data } = await buscarMusicaExata({ nome: musica.trim(), autor: autorMusica.trim() });

      if (data) {
        setMusicaId(data.id);
        if (data.letra) setLetra(data.letra);
        buscarMidis(data.id);
      } else {
        setMusicaId(null);
        setArquivosMidi([]);
        setMidiSelecionado(null);
      }
    };

    const timeout = setTimeout(checkExactMatch, 500);
    return () => clearTimeout(timeout);
  }, [musica, autorMusica]);

  // ===== UPLOAD DO MIDI =====
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploadingMidi(true);
    let currentMusicaId = musicaId;

    try {
      if (!currentMusicaId) {
        if (!musica.trim() || !autorMusica.trim() || !letra.trim()) {
          showAlert("⚠️ Preencha Nome, Autor e Letra da música para adicionar um MIDI.");
          setUploadingMidi(false);
          return;
        }

        const { data: novaMusica, error: errMusica } = await criarMusica({
          nome: musica.trim(),
          autor: autorMusica.trim(),
          letra: letra.trim()
        });

        if (errMusica) throw errMusica;
        currentMusicaId = novaMusica.id;
        setMusicaId(currentMusicaId);
      }

      const nomeSeguro = file.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // remove acentos
        .replace(/[^\w\s.-]/g, '')       // remove caracteres problemáticos
        .replace(/\s+/g, '_');            // espaços -> _

      const fileName = `${Date.now()}_${nomeSeguro}`;
      const filePath = `${currentMusicaId}/${fileName}`;
      const { error: uploadError, data } = await uploadArquivoMidi({ filePath, file });

      if (uploadError) throw uploadError;

      const { data: novoMidi, error: insertError } = await registrarArquivoMidi({
        arquivoMidi: file.name,
        musicaId: currentMusicaId,
        path: data.path
      });
      if (insertError) throw insertError;

      buscarMidis(currentMusicaId);
      setMidiSelecionado(novoMidi);

    } catch (error) {
      console.error("Erro no upload:", error);
      showAlert("Erro ao processar o arquivo MIDI.", "Erro", "error");
    } finally {
      setUploadingMidi(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ===== AÇÃO DE REDIRECIONAR / MONTAR TABLATURA =====
  const handleMontarTablatura = async () => {
    if (!usuario) {
      showAlert("Você precisa estar logado para montar tablaturas!", "Aviso", "info");
      navigateAnimated('/login', { expand: true });
      return;
    }

    if (!midiSelecionado) {
      if (!musica.trim() || !autorMusica.trim() || !letra.trim()) {
          showAlert("Preencha Nome, Autor e Letra da música.", "Aviso", "info");
      } else {
          showAlert("Selecione um arquivo MIDI na coluna da direita para prosseguir.", "Aviso", "info");
      }
      return;
    }

    setLoading(true);
    let currentMusicaId = musicaId;

    try {
      if (!currentMusicaId) {
        if (!musica.trim() || !autorMusica.trim() || !letra.trim()) {
          setLoading(false);
          return;
        }

        const { data: novaMusica, error: errMusica } = await criarMusica({
          nome: musica.trim(),
          autor: autorMusica.trim(),
          letra: letra.trim()
        });

        if (errMusica) throw errMusica;
        currentMusicaId = novaMusica.id;
      }

      navigateAnimated('/MontarTablatura', {
        expand: true,
        state: {
          musicaId: currentMusicaId,
          nome: musica,
          autor: autorMusica,
          letra: letra,
          midi: midiSelecionado
        }
      });

    } catch (error) {
      console.error("Erro ao salvar música:", error);
      showAlert("Houve um erro ao processar os dados.", "Erro", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={pageStyle}>
      <TopBar expanded={expanded} navigateAnimated={navigateAnimated} />
      <div style={{ ...contentWrapper, ...fadeStyle(contentVisible) }}>

        <CustomModal
          isOpen={modalConfig.isOpen}
          title={modalConfig.title}
          message={modalConfig.message}
          type={modalConfig.type}
          onConfirm={modalConfig.onConfirm}
          confirmLabel={modalConfig.confirmLabel}
          onClose={closeModal}
        />
        {/* COLUNA ESQUERDA: FORMULÁRIO */}
        <div style={leftColumn}>
          <h2 style={{ color: 'var(--color-primary)', marginBottom: 25, textAlign: 'center', fontWeight: 'bold', fontSize: '32px' }}>
            Criar Nova Tablatura
          </h2>

          <div style={{ position: 'relative' }}>
            <label style={labelStyle}>Nome da Música</label>
            <input
              style={inputStyle}
              placeholder="Ex: Asa Branca"
              value={musica}
              onChange={(e) => setMusica(e.target.value)}
            />

            {sugestoes.length > 0 && (
              <div style={suggestBox}>
                {sugestoes.map((item, index) => (
                  <div
                    key={index}
                    onClick={() => selecionarSugestao(item)}
                    style={suggestItem}
                    onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--color-bg-page)'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                  >
                    🎵 <strong style={{ color: 'var(--color-text-main)' }}>{item.nome}</strong>
                    <small style={{ display: 'block', color: 'var(--color-text-muted)', marginTop: 2 }}>{item.autor}</small>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label style={labelStyle}>Autor da Música {musicaId && <span style={{ color: 'var(--color-primary)' }}>(Bloqueado)</span>}</label>
            <input
              style={{ ...inputStyle, backgroundColor: musicaId ? 'var(--color-bg-input-locked)' : 'var(--color-bg-card)', cursor: musicaId ? 'not-allowed' : 'text' }}
              placeholder="Ex: Luiz Gonzaga"
              value={autorMusica}
              onChange={(e) => setAutorMusica(e.target.value)}
              disabled={!!musicaId}
            />
          </div>

          <div>
            <label style={labelStyle}>
              Letra da Música {musicaId && <span style={{ color: 'var(--color-primary)' }}>(Bloqueado)</span>}
            </label>
            <textarea
              style={{ ...textareaStyle, backgroundColor: musicaId ? 'var(--color-bg-input-locked)' : 'var(--color-bg-card)', cursor: musicaId ? 'not-allowed' : 'text' }}
              placeholder="Cole ou digite a letra da música aqui..."
              value={letra}
              onChange={(e) => setLetra(e.target.value)}
              disabled={!!musicaId}
            />
          </div>

          <button style={buttonStyle} onClick={handleMontarTablatura} disabled={loading}>
            {loading ? 'Processando...' : 'MONTAR TABLATURA'}
          </button>

          {!usuario && <p style={{ color: 'var(--color-danger)', fontSize: 13, marginTop: 12, textAlign: 'center', fontWeight: 'bold' }}>* Login necessário para salvar</p>}
          <p style={linkStyle} onClick={() => navigateAnimated('/', { expand: false })}>Cancelar e Voltar</p>
        </div>

        {/* COLUNA DIREITA */}
        {musica.trim() && autorMusica.trim() && (
          <div style={rightColumn}>
            <h3 style={{ color: 'var(--color-primary)', marginBottom: 25, textAlign: 'center', fontWeight: 'bold', fontSize: '22px' }}>
              Arquivos MIDI: {musica}
            </h3>

            <div style={midiListContainer}>

              {midiSelecionado ? (
                <div style={{ ...midiCardStyle, border: '2px solid var(--color-primary)', backgroundColor: 'var(--color-bg-highlight)' }}>
                  <div style={iconBoxPrimary}>🎵</div>
                  <div style={{ flex: 1, paddingLeft: 15, textAlign: 'left', overflow: 'hidden' }}>
                    <span style={{ color: 'var(--color-text-main)', fontWeight: 'bold', display: 'block', fontSize: '14px' }}>
                      {midiSelecionado.arquivo_midi}
                    </span>
                    <small style={{ color: 'var(--color-primary)', fontSize: 12, fontWeight: 'bold' }}>MIDI Selecionado</small>
                  </div>
                  <button
                    style={{ ...useMidiButton, backgroundColor: 'var(--color-danger-strong)', boxShadow: 'none' }}
                    onClick={() => setMidiSelecionado(null)}
                  >
                    Trocar
                  </button>
                </div>
              ) : (
                <>
                  <div style={midiCardStyle}>
                    <div style={iconBoxPrimary}>+</div>
                    <div style={{ flex: 1, paddingLeft: 15, textAlign: 'left' }}>
                      <span style={{ color: 'var(--color-text-main)', fontWeight: 'bold', fontSize: '15px' }}>Adicionar Novo MIDI</span>
                      <small style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 12, marginTop: 2 }}>Fazer upload do arquivo .mid</small>
                    </div>
                    <button style={uploadButton} onClick={() => fileInputRef.current.click()} disabled={uploadingMidi}>
                      {uploadingMidi ? '...' : 'Selecionar'}
                    </button>
                    <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".mid,.midi" onChange={handleFileUpload} />
                  </div>

                  {arquivosMidi.map((midi) => (
                    <div key={midi.id} style={midiCardStyle}>
                      <div style={iconBoxSecondary}>🎵</div>
                      <div style={{ flex: 1, paddingLeft: 15, textAlign: 'left', overflow: 'hidden' }}>
                        <span style={{ color: 'var(--color-text-main)', fontWeight: 'bold', display: 'block', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', fontSize: '14px' }}>
                          {midi.arquivo_midi}
                        </span>

                        {/* EXIBIÇÃO EM ESTRELAS COM SUPORTE A MEIO PREENCHIMENTO */}
                        <div style={{ display: 'flex', gap: '2px', marginTop: '4px' }}>
                          {[1, 2, 3, 4, 5].map((star) => {
                            const notaArredondada = Math.round((midi.mediaNota || 0) * 2) / 2;
                            let styleEstrela = { color: 'var(--color-border-soft)' }; // Vazia por padrão

                            if (notaArredondada >= star) {
                              styleEstrela = { color: 'var(--color-warning)' }; // Totalmente preenchida
                            } else if (notaArredondada === star - 0.5) {
                              styleEstrela = {
                                background: 'linear-gradient(90deg, var(--color-warning) 50%, var(--color-border-soft) 50%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                display: 'inline-block'
                              }; // Meia estrela preenchida com gradiente
                            }

                            return (
                              <span key={star} style={{ fontSize: '16px', ...styleEstrela }}>
                                ★
                              </span>
                            );
                          })}
                        </div>
                      </div>
                      <button style={useMidiButton} onClick={() => setMidiSelecionado(midi)}>
                        Usar
                      </button>
                    </div>
                  ))}
                </>
              )}

              {arquivosMidi.length === 0 && !midiSelecionado && (
                <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', marginTop: 20, fontSize: 14, lineHeight: '1.5' }}>
                  Nenhum arquivo MIDI encontrado.<br />
                  {!musicaId && <strong style={{ color: 'var(--color-danger)' }}>Insira a letra ao lado para liberar uploads!</strong>}
                </p>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

/* ===== ESTILOS ===== */
const pageStyle = { position: 'absolute', top: 0, left: 0, width: '100vw', minHeight: '100vh', backgroundColor: 'var(--color-bg-page)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: 'Arial, sans-serif', padding: '40px 20px', paddingTop: `${TOPBAR_CLEARANCE}px`, boxSizing: 'border-box', overflowX: 'hidden' };

const contentWrapper ={ display: 'flex', gap: '30px', width: '100%', maxWidth: '1100px', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-start' };
const leftColumn = { flex: 1, minWidth: '320px', maxWidth: '500px', backgroundColor: 'var(--color-bg-card)', padding: '40px', borderRadius: '24px', boxShadow: '0 15px 40px var(--shadow-card)', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' };
const rightColumn = { flex: 1, minWidth: '320px', maxWidth: '500px', backgroundColor: 'var(--color-bg-card)', padding: '40px', borderRadius: '24px', boxShadow: '0 15px 40px var(--shadow-card)', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' };
const labelStyle = { color: 'var(--color-text-muted)', fontSize: 13, fontWeight: 'bold', marginBottom: 6, display: 'block', marginLeft: 2, textAlign: 'left' };
const inputStyle = { width: '100%', padding: '15px 18px', marginBottom: 20, borderRadius: '14px', border: 'var(--border-width-base) solid var(--color-border)', backgroundColor: 'var(--color-bg-card)', color: 'var(--color-text-main)', outline: 'none', boxSizing: 'border-box', fontSize: '15px', transition: '0.2s' };
const textareaStyle = { width: '100%', height: 200, padding: '15px 18px', borderRadius: '14px', border: 'var(--border-width-base) solid var(--color-border)', backgroundColor: 'var(--color-bg-card)', color: 'var(--color-text-main)', fontFamily: 'Arial, sans-serif', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box', outline: 'none', lineHeight: '1.5', transition: '0.2s' };
const buttonStyle = { width: '100%', padding: '16px', backgroundColor: 'var(--color-primary)', color: 'var(--color-text-on-primary)', border: 'none', borderRadius: '14px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', marginTop: 20, boxShadow: '0 6px 18px var(--shadow-button-primary)', letterSpacing: '0.5px' };
const linkStyle = { color: 'var(--color-text-muted)', fontSize: '14px', cursor: 'pointer', textDecoration: 'underline', marginTop: 20, textAlign: 'center', fontWeight: '500' };
const suggestBox = { position: 'absolute', top: 'calc(100% - 15px)', left: 0, right: 0, backgroundColor: 'var(--color-bg-card)', border: 'var(--border-width-base) solid var(--color-border)', borderRadius: '14px', boxShadow: '0 8px 25px var(--shadow-card)', zIndex: 10, overflow: 'hidden' };
const suggestItem = { padding: '12px 16px', cursor: 'pointer', textAlign: 'left', borderBottom: 'var(--border-width-base) solid var(--color-bg-page)' };
const midiListContainer = { display: 'flex', flexDirection: 'column', gap: '15px' };
const midiCardStyle = { display: 'flex', alignItems: 'center', backgroundColor: 'var(--color-bg-card-alt)', border: 'var(--border-width-base) solid var(--color-border-alt)', borderRadius: '14px', padding: '15px', boxSizing: 'border-box', transition: '0.2s' };
const iconBoxPrimary = { width: 42, height: 42, backgroundColor: 'var(--color-bg-icon-primary)', color: 'var(--color-text-icon-success)', display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '10px', fontSize: '22px', fontWeight: 'bold' };
const iconBoxSecondary = { width: 42, height: 42, backgroundColor: 'var(--color-bg-icon-secondary)', color: 'var(--color-secondary-blue)', display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '10px', fontSize: '18px' };
const uploadButton = { padding: '8px 14px', backgroundColor: 'var(--color-success-alt)', color: 'var(--color-text-on-primary)', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', boxShadow: '0 4px 10px var(--shadow-button-success-alt)' };
const useMidiButton = { padding: '8px 16px', backgroundColor: 'var(--color-primary)', color: 'var(--color-text-on-primary)', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', boxShadow: '0 4px 10px var(--shadow-button-primary-faint)' };