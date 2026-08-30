export const pageStyle = { width: '100%', minHeight: '100vh', backgroundColor: 'var(--color-bg-page)', fontFamily: 'Arial, sans-serif', padding: '30px 20px', paddingTop: '110px', boxSizing: 'border-box' };
export const contentWrapper = { display: 'flex', gap: '30px', width: '100%', maxWidth: '1250px', margin: '0 auto', alignItems: 'flex-start' };
export const columnBox = { backgroundColor: 'var(--color-bg-card)', padding: '30px', borderRadius: '24px', boxShadow: '0 15px 40px var(--shadow-card)', boxSizing: 'border-box' };
export const mainCard = { margin: '0 auto', backgroundColor: 'var(--color-bg-card)', padding: '45px', borderRadius: '24px', boxShadow: '0 15px 40px var(--shadow-card)' };
export const labelStyle = { fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: 'bold', marginBottom: '6px', display: 'block' };
export const inputStyle = { width: '100%', padding: '12px 15px', borderRadius: '10px', border: 'var(--border-width-base) solid var(--color-border)', fontSize: '15px', outline: 'none', backgroundColor: 'var(--color-bg-card)', color: 'var(--color-text-main)', cursor: 'pointer' };

export const selectOitavaStyle = { fontSize: '11px', padding: '4px', borderRadius: '6px', border: 'var(--border-width-base) solid var(--color-border-soft)', backgroundColor: 'var(--color-bg-card-alt)', outline: 'none', cursor: 'pointer', color: 'var(--color-text-slate-5)', fontWeight: 'bold' };

export const btnPrimary = { padding: '14px 24px', backgroundColor: 'var(--color-primary)', color: 'var(--color-text-on-primary)', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px var(--shadow-button-primary-soft)' };
export const btnSecondary = { padding: '14px 24px', backgroundColor: 'var(--color-border-alt)', color: 'var(--color-text-muted)', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' };

export const cardNota = { padding: '6px 12px', backgroundColor: 'var(--color-primary)', color: 'var(--color-text-on-primary)', fontWeight: 'bold', borderRadius: '8px', cursor: 'pointer', userSelect: 'none', boxShadow: '0 2px 4px var(--shadow-note-default)', fontSize: '13px', transition: 'box-shadow 0.05s ease, transform 0.05s ease, background-color 0.05s ease, opacity 0.1s ease' };
export const linhaContainer = { display: 'flex', flexDirection: 'column', gap: '5px' };
export const zonaDrop = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', minHeight: '38px', padding: '6px 10px', backgroundColor: 'var(--color-bg-card)', border: '2px dashed var(--color-border)', borderRadius: '10px', transition: 'background-color 0.2s' };
export const cardNotaAlocada = { padding: '6px 12px', backgroundColor: 'var(--color-secondary-blue)', color: 'var(--color-text-on-primary)', fontWeight: 'bold', borderRadius: '6px', cursor: 'pointer', boxShadow: '0 2px 4px var(--shadow-note-default)', fontSize: '14px' };
export const inputNotaManual = { width: '40px', padding: '6px', borderRadius: '6px', border: 'var(--border-width-base) solid var(--color-border)', textAlign: 'center', outline: 'none', fontWeight: 'bold', color: 'var(--color-text-main)' };
export const textoLetra = { fontSize: '16px', color: 'var(--color-text-main)', paddingLeft: '5px', whiteSpace: 'pre-wrap' };
export const btnContinuar = { padding: '14px 28px', backgroundColor: 'var(--color-primary)', color: 'var(--color-text-on-primary)', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', boxShadow: '0 6px 18px var(--shadow-button-primary-alt)' };
export const btnContinuarDesabilitado = { backgroundColor: 'var(--color-border-alt)', color: 'var(--color-text-muted)', cursor: 'not-allowed', boxShadow: 'none' };

/* === Bloco "Configurações da Gaita" (compacto, campos lado a lado) === */
export const tituloSecaoConfig = { color: 'var(--color-primary)', fontSize: '18px', fontWeight: 'bold', margin: '0 0 14px 20px', textAlign: 'left' };
export const infoConfigSelecionada = { fontSize: '13px', fontWeight: 'bold' };
export const infoConfigPendente = { color: 'var(--color-text-danger-strong)' };
export const infoConfigAplicada = { color: 'var(--color-text-success)' };
export const linhaCamposGaita = { display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '14px' };
export const campoTipoGaitaWrap = { flex: '1 1 auto', minWidth: 0 };
export const campoTomGaitaWrap = { flex: '0 0 76px', width: '76px' };
export const inputTipoGaitaCompacto = { width: '100%', padding: '9px 10px', borderRadius: '10px', border: 'var(--border-width-base) solid var(--color-border)', fontSize: '13px', outline: 'none', backgroundColor: 'var(--color-bg-card)', color: 'var(--color-text-main)', cursor: 'pointer', boxSizing: 'border-box' };
export const inputTomGaitaCompacto = { width: '100%', padding: '9px 4px', borderRadius: '10px', border: 'var(--border-width-base) solid var(--color-border)', fontSize: '13px', textAlign: 'center', outline: 'none', backgroundColor: 'var(--color-bg-card)', color: 'var(--color-text-main)', cursor: 'pointer', boxSizing: 'border-box' };

export const selectVelocidadeCompacto = { flexShrink: 0, width: '58px', padding: '6px 4px', borderRadius: '8px', border: 'var(--border-width-base) solid var(--color-border)', fontSize: '12px', textAlign: 'center', outline: 'none', backgroundColor: 'var(--color-bg-card)', color: 'var(--color-text-main)', cursor: 'pointer', boxSizing: 'border-box' };

export const linhaBotoesConfig = { display: 'flex', gap: '10px' };
export const btnLimparConfig = { flex: 1, padding: '10px 12px', backgroundColor: 'var(--color-border-alt)', color: 'var(--color-text-muted)', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' };
export const btnAplicarConfig = { flex: 1, padding: '10px 12px', backgroundColor: 'var(--color-primary)', color: 'var(--color-text-on-primary)', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', boxShadow: '0 4px 10px var(--shadow-button-primary-soft)' };
export const btnExpandirConfig = { padding: '4px 10px', fontSize: '12px', fontWeight: 'bold', backgroundColor: 'var(--color-bg-card-alt)', color: 'var(--color-primary)', border: 'var(--border-width-base) solid var(--color-border-alt)', borderRadius: '8px', cursor: 'pointer' };

/* === Maximizar "Partes Ativas" === */
export const btnMaximizarStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', padding: 0, backgroundColor: 'var(--color-border-alt)', color: 'var(--color-text-muted)', border: 'none', borderRadius: '6px', cursor: 'pointer', flexShrink: 0 };
export const btnRestaurarStyle = { display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', backgroundColor: 'var(--color-border-alt)', color: 'var(--color-text-muted)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' };
export const overlayPartesMaximizado = { position: 'fixed', inset: 0, zIndex: 500, backgroundColor: 'var(--color-bg-card)', display: 'flex', flexDirection: 'column', padding: 'clamp(16px, 4vw, 24px) clamp(16px, 5vw, 30px)', boxSizing: 'border-box' };
export const overlayPartesHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, marginBottom: '16px', paddingBottom: '16px', borderBottom: 'var(--border-width-base) solid var(--color-border-alt)' };
export const overlayPartesTitulo = { margin: 0, color: 'var(--color-primary)', fontSize: '24px', fontWeight: 'bold' };
export const overlayBarraWrap = { flexShrink: 0, marginBottom: '20px', width: '100%' };
// Padding em todas as direções (compensado pela margem negativa, que cancela
// o deslocamento visual) para o glow/scale de "parte tocando" (cardParteTocandoStyle)
// não ficar cortado pela borda do container com scroll.
export const overlayListaWrap = { flex: 1, minHeight: 0, overflowY: 'auto', width: '100%', padding: '10px 20px 10px 10px', margin: '-10px -20px -10px -10px' };

export const cardParteStyle ={ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--color-bg-card)', padding: '10px 14px', borderRadius: '8px', borderWidth: '2px', borderStyle: 'solid', borderColor: 'var(--color-border-soft)', marginBottom: '2px', cursor: 'pointer', transition: 'box-shadow 0.08s ease, border-color 0.08s ease, transform 0.08s ease' };
export const cardParteNome = { fontWeight: 'bold', fontSize: '14px', color: 'var(--color-text-slate-7)' };
export const btnPlayAll = { padding: '6px 12px', backgroundColor: 'var(--color-primary)', color: 'var(--color-text-on-primary)', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 2px 6px var(--shadow-button-primary-soft)', transition: 'background-color 0.2s' };

export const notasCardInternoContainer = { display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '10px', backgroundColor: 'var(--color-bg-card-tertiary)', borderRadius: '8px', border: 'var(--border-width-base) solid var(--color-border-alt)', marginBottom: '14px' };

/* === Controles de Volume por Parte === */
export const volumeContainerStyle = { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', width: '100%' };
export const volumeIconStyle = { fontSize: '15px', width: '18px', textAlign: 'center', flexShrink: 0 };
export const volumeSliderStyle = { flex: 1, minWidth: 0, cursor: 'pointer' };
export const volumePercentStyle = { fontSize: '11px', color: 'var(--color-text-slate-2)', fontWeight: 'bold', width: '36px', textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums' };

export const btnSoloStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', borderRadius: '6px', border: 'var(--border-width-base) solid var(--color-border-soft)', backgroundColor: 'var(--color-bg-card-alt)', color: 'var(--color-text-slate-5)', fontSize: '12px', cursor: 'pointer', flexShrink: 0, transition: 'background-color 0.15s ease, border-color 0.15s ease' };
export const btnSoloAtivoStyle = { backgroundColor: 'var(--color-warning-strong)', border: 'var(--border-width-base) solid var(--color-warning-strong)', color: 'var(--color-text-slate-7)' };

export const btnResetVolumesStyle = { padding: '4px 10px', fontSize: '11px', fontWeight: 'bold', backgroundColor: 'var(--color-border-alt)', color: 'var(--color-text-muted)', border: 'none', borderRadius: '6px', cursor: 'pointer', transition: 'background-color 0.2s' };

/* === Barra de Progresso Redesenhada === */
export const barraFundo = { position: 'relative', width: '100%', height: '14px', backgroundColor: 'var(--color-border-alt)', borderRadius: '10px', marginTop: '16px', cursor: 'pointer', boxShadow: 'inset 0 1px 3px var(--shadow-note-default)' };
export const barraProgresso = { height: '100%', backgroundColor: 'var(--color-primary)', borderRadius: '10px', pointerEvents: 'none' };
export const barraThumb = { position: 'absolute', top: '50%', width: '16px', height: '16px', borderRadius: '50%', backgroundColor: 'var(--color-primary)', border: '2px solid var(--color-bg-card)', boxShadow: '0 1px 4px var(--shadow-note-default)', transform: 'translate(-50%, -50%)', pointerEvents: 'none' };
export const tempoLabel = { display: 'flex', justifyContent: 'flex-end', marginTop: '6px', fontSize: '12px', fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-slate-2)', fontWeight: 'bold' };

export const modalOverlay = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'var(--color-overlay-modal-strong)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };
export const modalContent = { backgroundColor: 'var(--color-bg-card)', padding: '30px', borderRadius: '16px', width: '90%', maxWidth: '550px', boxShadow: '0 10px 25px var(--shadow-note-selected)' };
export const btnCancelarModal = { padding: '10px 18px', backgroundColor: 'var(--color-bg-danger-soft)', color: 'var(--color-text-danger-strong)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' };
export const btnConfirmarModal = { padding: '10px 18px', backgroundColor: 'var(--color-primary)', color: 'var(--color-text-on-primary)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 10px var(--shadow-button-primary-soft)' };

/* === Modal único de Ajuste de Notas (agrupa todas as partes pendentes) === */
export const modalContentAjuste = { backgroundColor: 'var(--color-bg-card)', padding: 'clamp(18px, 4vw, 30px)', borderRadius: '16px', width: '92%', maxWidth: '700px', height: 'min(85dvh, 750px)', maxHeight: '750px', boxShadow: '0 10px 25px var(--shadow-note-selected)', display: 'flex', flexDirection: 'column', overflow: 'hidden' };
export const modalAjusteHeader = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', flexShrink: 0 };
export const modalAjusteTitulo = { margin: 0, color: 'var(--color-text-slate-4)' };
export const modalAjusteBadge = { fontSize: '12px', fontWeight: 'bold', color: 'var(--color-primary)', backgroundColor: 'var(--color-bg-icon-secondary)', padding: '4px 10px', borderRadius: '999px', whiteSpace: 'nowrap' };
export const modalAjusteDescricao = { color: 'var(--color-text-slate-5)', fontSize: '14px', lineHeight: '1.5', flexShrink: 0 };
export const modalAjusteListaPartes = { flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: '16px', margin: '16px 0', overflowY: 'auto', paddingRight: '10px' };

export const parteAjusteSecao = { flexShrink: 0, border: 'var(--border-width-base) solid var(--color-border-alt)', borderRadius: '12px', overflow: 'hidden' };
export const parteAjusteSecaoHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', backgroundColor: 'var(--color-bg-card-tertiary)', borderBottom: 'var(--border-width-base) solid var(--color-border-alt)' };
export const parteAjusteSecaoTitulo = { fontWeight: 'bold', fontSize: '14px', color: 'var(--color-text-slate-7)' };
export const parteAjusteSecaoContagem = { fontSize: '11px', color: 'var(--color-text-slate-2)', fontWeight: 'bold' };
export const parteAjusteNotasContainer = { display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px' };

export const notaAjusteLinha = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--color-bg-card-alt)', padding: '12px', borderRadius: '8px', border: 'var(--border-width-base) solid var(--color-border-alt)', gap: '12px' };
export const notaAjusteOriginal = { fontWeight: 'bold', display: 'block', fontSize: '15px', color: 'var(--color-text-slate-6)' };
export const notaAjusteSugestao = { fontSize: '12px', color: 'var(--color-text-slate-2)' };
export const selectAjusteNota = { padding: '8px', borderRadius: '6px', border: 'var(--border-width-base) solid var(--color-border-soft)', outline: 'none', cursor: 'pointer', fontWeight: 'bold', flexShrink: 0 };

export const modalAjusteFooter = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', paddingTop: '10px', borderTop: 'var(--border-width-base) solid var(--color-border-alt)', flexShrink: 0 };

/* Novos estilos Multi-seleção e Alocação */
export const cardNotaSelecionadaStyle = {
  outline: '2px solid var(--color-text-slate-6)', // Borda escura para indicar seleção
  outlineOffset: '2px',
  transform: 'scale(1.05)',
  boxShadow: '0 4px 8px var(--shadow-note-selected)'
};

export const cardNotaAlocadaTransparente = {
  opacity: 0.4,
  boxShadow: 'none',
  cursor: 'default'
};

export const cardParteTocandoStyle = {
  borderColor: 'var(--color-sky-highlight)',
  boxShadow: '0 0 8px var(--shadow-playing-glow-strong), 0 0 20px var(--shadow-playing-glow-soft)',
  transform: 'scale(1.01)'
};

export const cardNotaTocandoStyle = {
  backgroundColor: 'var(--color-warning-strong)',
  color: 'var(--color-text-on-note-playing)',
  transform: 'scale(1.08)',
  boxShadow: '0 0 8px var(--shadow-note-playing-strong), 0 0 18px var(--shadow-note-playing-medium)'
};

export const cardNotaTocandoAlocadaStyle = {
  backgroundColor: 'var(--color-warning-strong)',
  color: 'var(--color-text-on-note-playing)',
  opacity: 0.6,
  transform: 'scale(1.05)',
  boxShadow: '0 0 5px var(--shadow-note-playing-soft)'
};
