import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [fotoPerfil, setFotoPerfil] = useState('');

  const handleAuth = async () => {
    setLoading(true);

    if (isRegistering) {
      const { error } = await supabase
        .from('usuarios')
        .insert([
          { nome, email, senha, foto: fotoPerfil }
        ]);

      if (error) {
        alert("Erro ao registrar: Email já cadastrado ou dados inválidos.");
      } else {
        alert("Conta criada com sucesso!");
        setIsRegistering(false);
      }
    } else {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('email', email)
        .eq('senha', senha)
        .single();

      if (error || !data) {
        alert("E-mail ou senha incorretos.");
      } else {
        alert("Login realizado!");

        localStorage.setItem(
          'usuarioLogado',
          JSON.stringify({
            id: data.id,
            nome: data.nome,
            email: data.email,
            foto_perfil: data.foto_perfil
          })
        );

        navigate('/');
      }
    }

    setLoading(false);
  };

  const handleRecoverPassword = (e) => {
    e.preventDefault();
    alert("Um email com orientações de redefinição de senha foi enviado!");
    setIsRecovering(false);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: '#f4f7fb',
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
          backgroundColor: 'white',
          padding: '40px',
          borderRadius: '24px',
          boxShadow: '0 15px 40px rgba(0,0,0,0.08)',
          textAlign: 'center'
        }}
      >
        <h1 style={{ color: '#007bff', marginBottom: '8px' }}>
          HarmonicaTabs
        </h1>

        <p style={{ color: '#666', marginBottom: '25px' }}>
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

                <input
                  type="text"
                  placeholder="URL da foto"
                  value={fotoPerfil}
                  onChange={(e) => setFotoPerfil(e.target.value)}
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

            <p
              style={linkStyle}
              onClick={() => setIsRecovering(true)}
            >
              Esqueci minha senha
            </p>

            <div style={{ marginTop: '15px' }}>
              <p style={{ color: '#666' }}>
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
  border: '1px solid #d8e3f0',
  outline: 'none',
  fontSize: '14px',
  boxSizing: 'border-box'
};

const buttonStyle = {
  width: '100%',
  padding: '14px',
  backgroundColor: '#007bff',
  color: 'white',
  border: 'none',
  borderRadius: '12px',
  cursor: 'pointer',
  fontWeight: 'bold',
  marginTop: '5px',
  boxShadow: '0 6px 18px rgba(0,123,255,0.25)'
};

const linkStyle = {
  color: '#007bff',
  cursor: 'pointer',
  textDecoration: 'underline',
  fontSize: '13px',
  marginTop: '10px'
};