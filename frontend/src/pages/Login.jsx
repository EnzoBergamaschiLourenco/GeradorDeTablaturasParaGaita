import { useState, useRef, useEffect } from 'react';
import CustomModal from '../components/CustomModal';
import TopBar, { TOPBAR_CLEARANCE } from '../components/TopBar';
import { useAnimatedNavigate, fadeStyle } from '../hooks/useAnimatedNavigate';
import { registrarUsuario, buscarUsuarioPorCredenciais } from '../services/authService';
import { useModal } from '../hooks/useModal';

// Duração do fade usado ao trocar entre os modos (login/cadastro/esqueci
// senha) DENTRO do mesmo card — mais curta que CONTENT_FADE_MS (que é do
// fade da página inteira ao navegar de rota) porque aqui não há troca de
// tela, só de conteúdo interno.
const MODE_FADE_MS = 200;

export default function Login() {
  const { modalConfig, showAlert, closeModal } = useModal();

  // modoExibido: o que está de fato renderizado no card ('login' | 'register'
  // | 'recover'). modoVisivel controla o fade desse bloco: ao trocar de modo,
  // primeiro ele some (opacity 0), só então o conteúdo é trocado (já
  // invisível) e, no frame seguinte, reaparece com fade-in — em vez do troca
  // instantânea de antes.
  const [modoExibido, setModoExibido] = useState('login');
  const [modoVisivel, setModoVisivel] = useState(true);
  const modoTimeoutRef = useRef(null);

  useEffect(() => () => clearTimeout(modoTimeoutRef.current), []);

  const trocarModo = (novoModo) => {
    if (novoModo === modoExibido) return;
    setModoVisivel(false);
    clearTimeout(modoTimeoutRef.current);
    modoTimeoutRef.current = setTimeout(() => {
      setModoExibido(novoModo);
      requestAnimationFrame(() => setModoVisivel(true));
    }, MODE_FADE_MS);
  };

  const isRegistering = modoExibido === 'register';
  const isRecovering = modoExibido === 'recover';

  const [loading, setLoading] = useState(false);
  const { expanded, contentVisible, navigateAnimated } = useAnimatedNavigate(true);

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [nome, setNome] = useState('');
  const [fotoFile, setFotoFile] = useState(null); // Mudança para receber o arquivo

  // =========================
  // AUTENTICAÇÃO
  // =========================
  const handleAuth = async () => {
    setLoading(true);

    try {
      if (isRegistering) {
        const { error } = await registrarUsuario({ nome, email, senha, fotoFile });

        if (error) {
          showAlert("Erro ao registrar: Email já cadastrado ou dados inválidos.", "Erro no cadastro", "error");
        } else {
          showAlert("Conta criada com sucesso!", "Cadastro realizado", "info");
          trocarModo('login');
        }
      } else {
        const { data, error } = await buscarUsuarioPorCredenciais({ email, senha });

        if (error || !data) {
          showAlert("E-mail ou senha incorretos.", "Erro no login", "error");
        } else {
          localStorage.setItem(
            'usuarioLogado',
            JSON.stringify({
              id: data.id,
              nome: data.nome,
              email: data.email,
              foto_perfil: data.foto_perfil || data.foto
            })
          );

          navigateAnimated('/', { expand: false });
        }
      }
    } catch (error) {
      console.error(error);
      showAlert("Ocorreu um erro no processamento.", "Erro", "error");
    }

    setLoading(false);
  };

  const handleRecoverPassword = (e) => {
    e.preventDefault();
    showAlert("Um email com orientações de redefinição de senha foi enviado!", "Recuperação de Senha", "info");
    trocarModo('login');
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'var(--color-bg-page)',
        fontFamily: 'Arial, sans-serif',
        display: 'flex',
        justifyContent: 'center',
        // flex-start (em vez de center): mesmo motivo do Perfil — o card de
        // "Criar nova conta" é alto o bastante para, centralizado, ter o topo
        // empurrado pra cima da barra de menu (e inacessível por scroll,
        // já que overflow:auto num flex centralizado nasce com o topo do
        // conteúdo já "cortado" fora da viewport). Com flex-start ele sempre
        // começa logo abaixo do respiro de TOPBAR_CLEARANCE.
        alignItems: 'flex-start',
        paddingTop: `${TOPBAR_CLEARANCE}px`,
        boxSizing: 'border-box',
        overflowY: 'auto'
      }}
    >
      <TopBar expanded={expanded} navigateAnimated={navigateAnimated} />
      <CustomModal
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        onConfirm={modalConfig.onConfirm}
        onClose={closeModal}
      />
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          backgroundColor: 'var(--color-bg-card)',
          padding: '40px',
          borderRadius: '24px',
          boxShadow: '0 15px 40px var(--shadow-card)',
          textAlign: 'center',
          ...fadeStyle(contentVisible)
        }}
      >
        {/* Bloco interno com fade próprio: ao trocar entre login/cadastro/
            esqueci senha, esse wrapper some, o conteúdo é trocado enquanto
            invisível, e então reaparece — em vez de trocar instantaneamente. */}
        <div style={{ opacity: modoVisivel ? 1 : 0, transition: `opacity ${MODE_FADE_MS}ms ease` }}>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: '25px' }}>
            {isRegistering
              ? 'Crie sua conta para começar'
              : 'Faça login para continuar'}
          </p>

          {/* RECUPERAÇÃO DE SENHA */}
          {isRecovering ? (
            <form onSubmit={handleRecoverPassword}>
              <input
                type="email"
                placeholder="Seu e-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
                required
              />

              <button style={buttonStyle} type="submit">
                Enviar recuperação
              </button>

              <p style={linkStyle} onClick={() => trocarModo('login')}>
                Voltar ao login
              </p>
            </form>
          ) : (
            <>
              {/* REGISTRO */}
              {isRegistering && (
                <>
                  <input
                    type="text"
                    placeholder="Nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    style={inputStyle}
                  />

                  <label style={labelStyle}>Foto de perfil</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFotoFile(e.target.files[0])}
                    style={inputStyle}
                  />
                </>
              )}

              <input
                type="email"
                placeholder="E-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
              />

              <div style={{ position: 'relative', marginBottom: '12px' }}>
                <input
                  type={mostrarSenha ? 'text' : 'password'}
                  placeholder="Senha"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  style={{ ...inputStyle, marginBottom: 0, paddingRight: '44px' }}
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                  style={eyeButtonStyle}
                  aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                  title={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {mostrarSenha ? (
                    // Olho aberto: senha visível
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  ) : (
                    // Olho fechado/riscado: senha oculta
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 5c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  )}
                </button>
              </div>

              <button
                onClick={handleAuth}
                disabled={loading}
                style={buttonStyle}
              >
                {loading
                  ? 'Processando...'
                  : isRegistering
                    ? 'Cadastrar'
                    : 'Entrar'}
              </button>

              <p
                style={linkStyle}
                onClick={() => trocarModo('recover')}
              >
                Esqueci minha senha
              </p>

              <button
                type="button"
                onClick={() => trocarModo(isRegistering ? 'login' : 'register')}
                style={secondaryButtonStyle}
              >
                {isRegistering
                  ? 'Voltar para login'
                  : 'Criar nova conta'}
              </button>
            </>
          )}
        </div>

        <p
          style={{ ...linkStyle, marginTop: '20px' }}
          onClick={() => navigateAnimated('/', { expand: false })}
        >
          Voltar ao menu
        </p>
      </div>
    </div>
  );
}

/* ESTILOS REUTILIZÁVEIS */
const inputStyle = {
  width: '100%',
  padding: '14px',
  marginBottom: '12px',
  borderRadius: '12px',
  border: 'var(--border-width-base) solid var(--color-border)',
  outline: 'none',
  fontSize: '14px',
  boxSizing: 'border-box',
  backgroundColor: 'var(--color-bg-card)',
  color: 'var(--color-text-main)'
};

const buttonStyle = {
  width: '100%',
  padding: '14px',
  backgroundColor: 'var(--color-primary)',
  color: 'var(--color-text-on-primary)',
  border: 'none',
  borderRadius: '12px',
  cursor: 'pointer',
  fontWeight: 'bold',
  marginTop: '5px',
  boxShadow: '0 6px 18px var(--shadow-button-primary)'
};

const secondaryButtonStyle = {
  ...buttonStyle,
  backgroundColor: 'var(--color-border-alt)',
  color: 'var(--color-text-muted)',
  boxShadow: 'none',
  marginTop: '12px'
};

const eyeButtonStyle = {
  position: 'absolute',
  right: '10px',
  top: '50%',
  transform: 'translateY(-50%)',
  background: 'none',
  border: 'none',
  padding: '4px',
  cursor: 'pointer',
  color: 'var(--color-text-muted)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const linkStyle = {
  color: 'var(--color-primary)',
  cursor: 'pointer',
  textDecoration: 'underline',
  fontSize: '13px',
  marginTop: '10px'
};

const labelStyle = { fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: 'bold', marginBottom: '6px', display: 'block' };