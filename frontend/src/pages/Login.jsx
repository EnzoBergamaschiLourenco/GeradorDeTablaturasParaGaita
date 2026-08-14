import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CustomModal from '../components/CustomModal';
import { registrarUsuario, buscarUsuarioPorCredenciais } from '../services/authService';
import { useModal } from '../hooks/useModal';

export default function Login() {
  const { modalConfig, showAlert, closeModal } = useModal();

  const [isRegistering, setIsRegistering] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
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
          setIsRegistering(false);
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

          navigate('/');
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
    setIsRecovering(false);
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
        alignItems: 'center'
      }}
    >
      {/* CARD PRINCIPAL */}
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          backgroundColor: 'var(--color-bg-card)',
          padding: '40px',
          borderRadius: '24px',
          boxShadow: '0 15px 40px var(--shadow-card)',
          textAlign: 'center'
        }}
      >
        <h1 style={{ color: 'var(--color-primary)', marginBottom: '8px' }}>
          HarmonicaTabs
        </h1>

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

            <p style={linkStyle} onClick={() => setIsRecovering(false)}>
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

            <input
              type="password"
              placeholder="Senha"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              style={inputStyle}
            />

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

            {/* Renderização do Modal */}
            <CustomModal
              isOpen={modalConfig.isOpen}
              title={modalConfig.title}
              message={modalConfig.message}
              type={modalConfig.type}
              onConfirm={modalConfig.onConfirm}
              onClose={closeModal}
            />

            <p
              style={linkStyle}
              onClick={() => setIsRecovering(true)}
            >
              Esqueci minha senha
            </p>

            <div style={{ marginTop: '15px' }}>
              <p style={{ color: 'var(--color-text-muted)' }}>
                {isRegistering
                  ? 'Já tem conta?'
                  : 'Não tem conta?'}
              </p>

              <p
                style={linkStyle}
                onClick={() =>
                  setIsRegistering(!isRegistering)
                }
              >
                {isRegistering
                  ? 'Voltar para login'
                  : 'Criar conta'}
              </p>
            </div>
          </>
        )}

        <p
          style={{ ...linkStyle, marginTop: '20px' }}
          onClick={() => navigate('/')}
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

const linkStyle = {
  color: 'var(--color-primary)',
  cursor: 'pointer',
  textDecoration: 'underline',
  fontSize: '13px',
  marginTop: '10px'
};

const labelStyle = { fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: 'bold', marginBottom: '6px', display: 'block' };