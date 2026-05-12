import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Estados para os campos do formulário
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [fotoPerfil, setFotoPerfil] = useState('');

  const handleAuth = async () => {
    setLoading(true);
    
    if (isRegistering) {
      // Lógica de Registro na tabela 'usuarios'
      const { data, error } = await supabase
        .from('usuarios')
        .insert([
          { nome, email, senha, foto_perfil: fotoPerfil }
        ]);

      if (error) {
        alert("Erro ao registrar: " + error.message);
      } else {
        alert("Conta criada com sucesso!");
        setIsRegistering(false);
      }
    } else {
      // Lógica de Login simples (checando na tabela 'usuarios')
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
        localStorage.setItem('usuarioLogado', JSON.stringify({ nome: data.nome, email: data.email, foto: data.foto_perfil }));
        navigate('/'); // Volta para o menu
      }
    }
    setLoading(false);
  };

  return (
    <div style={{ textAlign: 'center', marginTop: '50px', fontFamily: 'Arial' }}>
      <h2>{isRegistering ? 'Criar nova conta' : 'Página de Login'}</h2>
      
      <div style={{ display: 'flex', flexDirection: 'column', width: '300px', margin: '0 auto', gap: '10px' }}>
        
        {/* Campos revelados apenas no Registro */}
        {isRegistering && (
          <>
            <input 
              type="text" 
              placeholder="Nome completo" 
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              style={{ padding: '8px' }}
            />
            <input 
              type="text" 
              placeholder="URL da foto de perfil" 
              value={fotoPerfil}
              onChange={(e) => setFotoPerfil(e.target.value)}
              style={{ padding: '8px' }}
            />
          </>
        )}

        <input 
          type="email" 
          placeholder="E-mail" 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ padding: '8px' }}
        />
        <input 
          type="password" 
          placeholder="Senha" 
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          style={{ padding: '8px' }}
        />

        <button 
          onClick={handleAuth} 
          disabled={loading}
          style={{ padding: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', cursor: 'pointer' }}
        >
          {loading ? 'Processando...' : (isRegistering ? 'Cadastrar' : 'Entrar')}
        </button>

        <hr style={{ width: '100%', margin: '20px 0' }} />

        <p>{isRegistering ? 'Já tem uma conta?' : 'Não tem uma conta?'}</p>
        <button 
          onClick={() => setIsRegistering(!isRegistering)}
          style={{ background: 'none', border: 'none', color: '#007bff', cursor: 'pointer', textDecoration: 'underline' }}
        >
          {isRegistering ? 'Voltar para o Login' : 'Criar uma conta agora'}
        </button>

        {/* OPÇÃO ADICIONADA: Link para Voltar ao Menu */}
        <span 
          onClick={() => navigate('/')}
          style={{ color: '#666', cursor: 'pointer', textDecoration: 'underline', fontSize: '13px', marginTop: '15px' }}
        >
          Voltar ao Menu
        </span>

      </div>
    </div>
  );
}