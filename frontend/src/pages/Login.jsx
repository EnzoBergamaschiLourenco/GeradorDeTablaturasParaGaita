import { useState, useRef, useEffect } from 'react';
import CustomModal from '../components/CustomModal';
import TopBar, { TOPBAR_CLEARANCE } from '../components/TopBar';
import { useAnimatedNavigate, fadeStyle } from '../hooks/useAnimatedNavigate';
import { useCarregamentoMinimo, usePontinhos } from '../hooks/useCarregamento';
import { registrarUsuario, buscarUsuarioPorCredenciais } from '../services/authService';
import { useModal } from '../hooks/useModal';

// Duração do fade usado ao trocar entre os modos (login/cadastro/esqueci
// senha) DENTRO do mesmo card — mais curta que CONTENT_FADE_MS (que é do
// fade da página inteira ao navegar de rota) porque aqui não há troca de
// tela, só de conteúdo interno.
const MODE_FADE_MS = 200;

// Exige algo@algo.algo — mais rígido que só checar a presença de "@".
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const emailValido = (valor) => EMAIL_REGEX.test(valor.trim());

// Política de senha do cadastro (não se aplica ao login, que só confere uma
// senha já existente). Cada regra alimenta tanto a validação de submit
// quanto a checklist ao vivo abaixo do campo.
const REGRAS_SENHA = [
  { chave: 'tamanho', label: 'Mínimo de 8 caracteres', teste: (s) => s.length >= 8 },
  { chave: 'maiuscula', label: 'Uma letra maiúscula', teste: (s) => /[A-Z]/.test(s) },
  { chave: 'minuscula', label: 'Uma letra minúscula', teste: (s) => /[a-z]/.test(s) },
  { chave: 'numero', label: 'Um número', teste: (s) => /[0-9]/.test(s) },
  { chave: 'especial', label: 'Um caractere especial', teste: (s) => /[^A-Za-z0-9]/.test(s) }
];
const requisitosNaoAtendidos = (senha) => REGRAS_SENHA.filter((r) => !r.teste(senha));
const senhaAtendeRequisitos = (senha) => requisitosNaoAtendidos(senha).length === 0;

const bordaInvalida = { border: '2px solid var(--color-danger)' };
const bordaValida = { border: '2px solid var(--color-success)' };

// Botão de olho reutilizado tanto no campo "Senha" quanto em "Confirmar
// senha" — cada um com seu próprio estado de visibilidade, independente um
// do outro.
function BotaoMostrarSenha({ mostrar, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={eyeButtonStyle}
      aria-label={mostrar ? 'Ocultar senha' : 'Mostrar senha'}
      title={mostrar ? 'Ocultar senha' : 'Mostrar senha'}
    >
      {mostrar ? (
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
  );
}

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
    // Limpa os destaques de erro do modo anterior — trocar de tela é um
    // recomeço, não deve carregar borda vermelha de uma tentativa passada.
    setEmailInvalido(false);
    setSenhaInvalida(false);
    setConfirmarSenhaInvalida(false);
    clearTimeout(modoTimeoutRef.current);
    modoTimeoutRef.current = setTimeout(() => {
      setModoExibido(novoModo);
      requestAnimationFrame(() => setModoVisivel(true));
    }, MODE_FADE_MS);
  };

  const isRegistering = modoExibido === 'register';
  const isRecovering = modoExibido === 'recover';

  const [loading, setLoading] = useState(false);
  // "Processando" fica no tempo mínimo (CARREGAMENTO_MINIMO_MS) com "..." animado.
  const processandoMin = useCarregamentoMinimo(loading);
  const pontosProc = usePontinhos(processandoMin);
  const { expanded, contentVisible, navigateAnimated } = useAnimatedNavigate(true);

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmarSenha, setMostrarConfirmarSenha] = useState(false);
  const [nome, setNome] = useState('');
  const [fotoFile, setFotoFile] = useState(null); // Mudança para receber o arquivo

  // Destaques de erro (borda vermelha) por campo — setados só na tentativa
  // de submit, e limpos assim que o usuário volta a editar o campo em
  // questão (ver onChange de cada input).
  const [emailInvalido, setEmailInvalido] = useState(false);
  const [senhaInvalida, setSenhaInvalida] = useState(false);
  const [confirmarSenhaInvalida, setConfirmarSenhaInvalida] = useState(false);

  // Guarda o usuário logado e vai pro menu — usado tanto após um login
  // quanto após um cadastro bem-sucedido (a conta acabou de ser criada com
  // dados já validados, não faz sentido mandar confirmar de novo na tela
  // de login).
  const efetuarLogin = (usuario) => {
    localStorage.setItem(
      'usuarioLogado',
      JSON.stringify({
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        foto_perfil: usuario.foto_perfil || usuario.foto
      })
    );

    navigateAnimated('/', { expand: false });
  };

  // =========================
  // AUTENTICAÇÃO
  // =========================
  const handleAuth = async () => {
    // Validação em sequência — email, depois (só no cadastro) política de
    // senha, depois confirmação — parando no primeiro problema encontrado.
    // Mesmo se os três campos estiverem errados ao mesmo tempo, só o
    // primeiro da fila ganha popup + borda vermelha; os demais só aparecem
    // nas tentativas seguintes, um de cada vez, até não sobrar nenhum.
    if (!emailValido(email)) {
      setEmailInvalido(true);
      showAlert('Digite um endereço de e-mail válido (ex.: nome@dominio.com).', 'E-mail inválido', 'error');
      return;
    }
    setEmailInvalido(false);

    if (isRegistering) {
      const faltando = requisitosNaoAtendidos(senha);
      if (faltando.length > 0) {
        setSenhaInvalida(true);
        showAlert(
          `Sua senha ainda precisa ter: ${faltando.map((r) => r.label.toLowerCase()).join(', ')}.`,
          'Senha inválida',
          'error'
        );
        return;
      }
      setSenhaInvalida(false);

      if (confirmarSenha !== senha) {
        setConfirmarSenhaInvalida(true);
        showAlert('A confirmação de senha não é igual à senha digitada.', 'Senhas não conferem', 'error');
        return;
      }
      setConfirmarSenhaInvalida(false);
    }

    setLoading(true);

    try {
      if (isRegistering) {
        const { data, error } = await registrarUsuario({ nome, email, senha, fotoFile });

        if (error) {
          showAlert("Erro ao registrar: Email já cadastrado ou dados inválidos.", "Erro no cadastro", "error");
        } else {
          // Conta criada com dados válidos: loga direto, sem passar pela
          // tela de login de novo pra confirmar as mesmas credenciais.
          efetuarLogin(data);
        }
      } else {
        const { data, error } = await buscarUsuarioPorCredenciais({ email, senha });

        if (error || !data) {
          showAlert("E-mail ou senha incorretos.", "Erro no login", "error");
        } else {
          efetuarLogin(data);
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

    if (!emailValido(email)) {
      setEmailInvalido(true);
      showAlert('Digite um endereço de e-mail válido (ex.: nome@dominio.com).', 'E-mail inválido', 'error');
      return;
    }
    setEmailInvalido(false);

    showAlert("Um email com orientações de redefinição de senha foi enviado!", "Recuperação de Senha", "info");
    trocarModo('login');
  };

  // Borda ao vivo do campo "Senha" no cadastro — atualiza a cada tecla,
  // antes mesmo de tentar enviar o formulário. Vazio fica neutro (usuário
  // ainda nem começou a digitar); senhaInvalida (setado só na tentativa de
  // submit) sempre vence, pra sinalizar erro mesmo com o campo vazio.
  const bordaSenhaCadastro = !isRegistering
    ? {}
    : senhaInvalida
      ? bordaInvalida
      : senha === ''
        ? {}
        : senhaAtendeRequisitos(senha)
          ? bordaValida
          : bordaInvalida;

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
        confirmLabel={modalConfig.confirmLabel}
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
            // noValidate: sem isso, a validação nativa do navegador (por
            // causa do type="email" + required) intercepta o submit antes
            // do handleRecoverPassword rodar, e mostra um tooltip nativo em
            // vez do nosso popup + borda vermelha customizados.
            <form onSubmit={handleRecoverPassword} noValidate>
              <input
                type="email"
                placeholder="Seu e-mail"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setEmailInvalido(false); }}
                style={{ ...inputStyle, ...(emailInvalido ? bordaInvalida : {}) }}
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
                onChange={(e) => { setEmail(e.target.value); setEmailInvalido(false); }}
                style={{ ...inputStyle, ...(emailInvalido ? bordaInvalida : {}) }}
              />

              <div style={{ position: 'relative', marginBottom: '12px' }}>
                <input
                  type={mostrarSenha ? 'text' : 'password'}
                  placeholder="Senha"
                  value={senha}
                  onChange={(e) => { setSenha(e.target.value.replace(/\s/g, '')); setSenhaInvalida(false); }}
                  style={{ ...inputStyle, marginBottom: 0, paddingRight: '44px', ...bordaSenhaCadastro }}
                />
                <BotaoMostrarSenha mostrar={mostrarSenha} onToggle={() => setMostrarSenha(!mostrarSenha)} />
              </div>

              {/* Checklist ao vivo da política de senha — cada regra troca
                  entre neutra/verde/vermelha a cada tecla digitada, junto
                  com a borda do campo acima. Só no cadastro. */}
              {isRegistering && (
                <ul style={checklistStyle}>
                  {REGRAS_SENHA.map((regra) => {
                    const ok = regra.teste(senha);
                    const cor = senha === ''
                      ? 'var(--color-text-muted)'
                      : ok
                        ? 'var(--color-text-success)'
                        : 'var(--color-text-danger-strong)';

                    return (
                      <li key={regra.chave} style={{ color: cor }}>
                        {senha === '' ? '•' : ok ? '✓' : '✗'} {regra.label}
                      </li>
                    );
                  })}
                </ul>
              )}

              {isRegistering && (
                <div style={{ position: 'relative', marginBottom: '12px' }}>
                  <input
                    type={mostrarConfirmarSenha ? 'text' : 'password'}
                    placeholder="Confirmar senha"
                    value={confirmarSenha}
                    onChange={(e) => { setConfirmarSenha(e.target.value.replace(/\s/g, '')); setConfirmarSenhaInvalida(false); }}
                    style={{ ...inputStyle, marginBottom: 0, paddingRight: '44px', ...(confirmarSenhaInvalida ? bordaInvalida : {}) }}
                  />
                  <BotaoMostrarSenha mostrar={mostrarConfirmarSenha} onToggle={() => setMostrarConfirmarSenha(!mostrarConfirmarSenha)} />
                </div>
              )}

              <button
                onClick={handleAuth}
                disabled={processandoMin}
                style={buttonStyle}
              >
                {processandoMin
                  ? `Processando${pontosProc}`
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

const checklistStyle = {
  listStyle: 'none',
  padding: 0,
  margin: '8px 0 14px',
  fontSize: '12.5px',
  textAlign: 'left',
  display: 'flex',
  flexDirection: 'column',
  gap: '3px'
};