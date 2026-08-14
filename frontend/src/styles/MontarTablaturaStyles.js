export const pageStyle = { width: '100%', minHeight: '100vh', backgroundColor: 'var(--color-bg-page)', fontFamily: 'Arial, sans-serif', padding: '30px 20px', boxSizing: 'border-box' };
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

export const containerCardsMidi = { backgroundColor: 'var(--color-bg-card-alt)', padding: '15px', borderRadius: '14px', border: 'var(--border-width-base) solid var(--color-border-alt)', marginTop: '10px' };

export const cardParteStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--color-bg-card)', padding: '10px 14px', borderRadius: '8px', borderWidth: '2px', borderStyle: 'solid', borderColor: 'var(--color-border-soft)', marginBottom: '2px', cursor: 'pointer', transition: 'box-shadow 0.08s ease, border-color 0.08s ease, transform 0.08s ease' };
export const cardParteNome = { fontWeight: 'bold', fontSize: '14px', color: 'var(--color-text-slate-7)' };
export const btnPlayAll = { padding: '6px 12px', backgroundColor: 'var(--color-primary)', color: 'var(--color-text-on-primary)', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 2px 6px var(--shadow-button-primary-soft)', transition: 'background-color 0.2s' };

export const notasCardInternoContainer = { display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '10px', backgroundColor: 'var(--color-bg-card-tertiary)', borderRadius: '8px', border: 'var(--border-width-base) solid var(--color-border-alt)', marginBottom: '14px' };

/* === Barra de Progresso Redesenhada === */
export const barraFundo = { width: '100%', height: '14px', backgroundColor: 'var(--color-border-alt)', borderRadius: '10px', marginTop: '12px', cursor: 'pointer', overflow: 'hidden', boxShadow: 'inset 0 1px 3px var(--shadow-note-default)' };
export const barraProgresso = { height: '100%', backgroundColor: 'var(--color-primary)', transition: 'width 0.1s linear', borderRadius: '10px' };

export const modalOverlay = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'var(--color-overlay-modal-strong)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };
export const modalContent = { backgroundColor: 'var(--color-bg-card)', padding: '30px', borderRadius: '16px', width: '90%', maxWidth: '550px', boxShadow: '0 10px 25px var(--shadow-note-selected)' };
export const btnCancelarModal = { padding: '10px 18px', backgroundColor: 'var(--color-bg-danger-soft)', color: 'var(--color-text-danger-strong)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' };
export const btnConfirmarModal = { padding: '10px 18px', backgroundColor: 'var(--color-primary)', color: 'var(--color-text-on-primary)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 10px var(--shadow-button-primary-soft)' };

export const btnRecarregar = { display: 'flex', justifyContent: 'center', alignItems: 'center', width: '32px', height: '32px', backgroundColor: 'var(--color-border-alt)', color: 'var(--color-primary)', border: 'none', borderRadius: '8px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', transition: 'background-color 0.2s', paddingBottom: '2px' };

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
