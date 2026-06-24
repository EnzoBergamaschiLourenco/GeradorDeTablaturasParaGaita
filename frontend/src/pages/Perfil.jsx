import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

export default function Perfil() {
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const navigate = useNavigate();

  const [userData, setUserData] = useState({
    nome: '',
    email: '',
    foto_perfil: ''
  });

  const [nome, setNome] = useState('');
  const [fotoFile, setFotoFile] = useState(null);

  const [senhaAtual, setSenhaAtual] = useState('');
  const [senhaNova, setSenhaNova] = useState('');
  const [senhaConfirmacaoDelete, setSenhaConfirmacaoDelete] = useState('');

  useEffect(() => {
    const salvo = localStorage.getItem('usuarioLogado');
    if (salvo) {
      const user = JSON.parse(salvo);
      setUserData(user);
      setNome(user.nome);
    }
  }, []);

  // =========================
  // UPLOAD AVATAR
  // =========================
  const uploadAvatar = async (file) => {
    if (!file) return null;

    const fileName = `${Date.now()}-${file.name}`;

    const { error } = await supabase.storage
      .from('Fotos de perfil')
      .upload(fileName, file);

    if (error) {
      console.error(error);
      return null;
    }

    const { data } = supabase.storage
      .from('Fotos de perfil')
      .getPublicUrl(fileName);

    return data.publicUrl;
  };

  // =========================
  // UPDATE PERFIL
  // =========================
  const handleUpdate = async () => {
    if (!senhaAtual) {
      alert("Senha atual obrigatória.");
      return;
    }

    setLoading(true);

    const { data: userVerify } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', userData.email)
      .eq('senha', senhaAtual)
      .single();

    if (!userVerify) {
      alert("Senha incorreta.");
      setLoading(false);
      return;
    }

    let foto_perfil = userData.foto_perfil;

    // se enviou nova imagem
    if (fotoFile) {
      const uploadedUrl = await uploadAvatar(fotoFile);
      if (uploadedUrl) foto_perfil = uploadedUrl;
    }

    const updates = { nome, foto_perfil };

    if (senhaNova.trim() !== '') {
      updates.senha = senhaNova;
    }

    const { error } = await supabase
      .from('usuarios')
      .update(updates)
      .eq('email', userData.email);

    if (error) {
      alert(error.message);
    } else {
      const novoUsuario = {
        ...userData,
        nome,
        foto_perfil
      };

      setUserData(novoUsuario);
      localStorage.setItem('usuarioLogado', JSON.stringify(novoUsuario));

      alert("Perfil atualizado!");
      setIsEditing(false);
      setSenhaAtual('');
      setSenhaNova('');
      setFotoFile(null);
    }

    setLoading(false);
  };

  // =========================
  // DELETE ACCOUNT
  // =========================
  const handleDeleteAccount = async () => {
    if (!senhaConfirmacaoDelete) {
      alert("Digite sua senha.");
      return;
    }

    setLoading(true);

    const { data: userVerify } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', userData.email)
      .eq('senha', senhaConfirmacaoDelete)
      .single();

    if (!userVerify) {
      alert("Senha incorreta.");
      setLoading(false);
      return;
    }

    await supabase
      .from('usuarios')
      .delete()
      .eq('email', userData.email);

    localStorage.removeItem('usuarioLogado');
    navigate('/login');
  };

  // =========================
  // UI
  // =========================
  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={{ color: '#007bff' }}>Meu Perfil</h1>

        <p style={{ color: '#666' }}>
          Gerencie sua conta
        </p>

        {/* AVATAR */}
        <img
          src={
            userData.foto_perfil ||
            'https://via.placeholder.com/150'
          }
          style={avatarStyle}
        />

        {/* VIEW */}
        {!isEditing && !isDeletingAccount && (
          <>
            <div style={infoBox}>
              <p><b>Nome:</b> {userData.nome}</p>
              <p><b>Email:</b> {userData.email}</p>
            </div>

            <button style={buttonStyle} onClick={() => setIsEditing(true)}>
              Editar Perfil
            </button>

            <p style={danger} onClick={() => setIsDeletingAccount(true)}>
              Deletar conta
            </p>
          </>
        )}

        {/* EDIT */}
        {isEditing && (
          <>
            <input
              style={inputStyle}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome"
            />

            {/* FILE INPUT (NOVO) */}
            <input
              type="file"
              accept="image/*"
              style={inputStyle}
              onChange={(e) => setFotoFile(e.target.files[0])}
            />

            <input
              style={inputStyle}
              type="password"
              placeholder="Nova senha"
              value={senhaNova}
              onChange={(e) => setSenhaNova(e.target.value)}
            />

            <input
              style={{ ...inputStyle, border: '1px solid red' }}
              type="password"
              placeholder="Senha atual"
              value={senhaAtual}
              onChange={(e) => setSenhaAtual(e.target.value)}
            />

            <button
              style={{ ...buttonStyle, backgroundColor: '#28a745' }}
              onClick={handleUpdate}
            >
              {loading ? 'Salvando...' : 'Salvar'}
            </button>

            <p style={link} onClick={() => setIsEditing(false)}>
              Cancelar
            </p>
          </>
        )}

        {/* DELETE */}
        {isDeletingAccount && (
          <>
            <input
              style={{ ...inputStyle, border: '1px solid red' }}
              type="password"
              placeholder="Senha"
              value={senhaConfirmacaoDelete}
              onChange={(e) => setSenhaConfirmacaoDelete(e.target.value)}
            />

            <button
              style={{ ...buttonStyle, backgroundColor: 'red' }}
              onClick={handleDeleteAccount}
            >
              Excluir conta
            </button>
          </>
        )}

        <p style={link} onClick={() => navigate('/')}>
          Voltar ao menu
        </p>
      </div>
    </div>
  );
}

/* ===== STYLE ===== */

const pageStyle = {
  position: 'fixed',
  inset: 0,
  background: '#f4f7fb',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  fontFamily: 'Arial'
};

const cardStyle = {
  background: '#fff',
  padding: 40,
  borderRadius: 24,
  width: 420,
  textAlign: 'center',
  boxShadow: '0 15px 40px rgba(0,0,0,0.08)'
};

const avatarStyle = {
  width: 120,
  height: 120,
  borderRadius: '50%',
  objectFit: 'cover',
  border: '3px solid #007bff',
  marginBottom: 15
};

const inputStyle = {
  width: '100%',
  padding: 12,
  marginBottom: 10,
  borderRadius: 10,
  border: '1px solid #d8e3f0'
};

const buttonStyle = {
  width: '100%',
  padding: 14,
  background: '#007bff',
  color: '#fff',
  border: 'none',
  borderRadius: 12,
  cursor: 'pointer'
};

const link = {
  color: '#007bff',
  cursor: 'pointer',
  textDecoration: 'underline',
  fontSize: 13
};

const danger = {
  color: 'red',
  cursor: 'pointer',
  textDecoration: 'underline',
  fontSize: 13,
  marginTop: 10
};

const infoBox = {
  textAlign: 'left',
  background: '#f8fafc',
  padding: 12,
  borderRadius: 12,
  marginBottom: 15
};