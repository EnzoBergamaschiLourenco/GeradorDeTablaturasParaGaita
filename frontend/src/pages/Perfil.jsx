import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import CustomModal from '../components/CustomModal';

export default function Perfil() {
  const hashPassword = async (password) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });

  const showAlert = (message, title = 'Aviso', type = 'info') => {
    setModalConfig({ isOpen: true, title, message, type });
  };

  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const navigate = useNavigate();

  // Nova estrutura de estado solicitada
  const [usuario, setUsuario] = useState(null);

  const [nome, setNome] = useState('');
  const [fotoFile, setFotoFile] = useState(null);

  const [senhaAtual, setSenhaAtual] = useState('');
  const [senhaNova, setSenhaNova] = useState('');
  const [senhaConfirmacaoDelete, setSenhaConfirmacaoDelete] = useState('');

  useEffect(() => {
    const dadosSalvos = localStorage.getItem('usuarioLogado');
    if (dadosSalvos) {
      const user = JSON.parse(dadosSalvos);
      setUsuario(user);
      setNome(user.nome || '');
    } else {
      // Redireciona para a tela de login caso não esteja logado
      navigate('/login');
    }
  }, [navigate]);

  // Bloqueia a renderização de componentes filhos enquanto o useEffect valida o login,
  // impedindo erros de "cannot read property of null"
  if (!usuario) {
    return null;
  }

  // Detecta se a foto foi gravada como 'foto' (seu login atual) ou 'foto_perfil'
  const urlFoto = usuario.foto || usuario.foto_perfil;

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
      showAlert("Senha atual obrigatória.", "Alerta", "info");
      return;
    }

    setLoading(true);

    try {
      const senhaHasheada = await hashPassword(senhaAtual);
      const { data: userVerify } = await supabase
        .from('usuarios')
        .select('*')
        .eq('email', usuario.email)
        .eq('senha', senhaHasheada)
        .single();

      if (!userVerify) {
        showAlert("Senha incorreta.", "Erro", "error");
        return;
      }

      let foto_perfil_atualizada = urlFoto || '';

      // se enviou nova imagem
      if (fotoFile) {
        const uploadedUrl = await uploadAvatar(fotoFile);
        if (uploadedUrl) foto_perfil_atualizada = uploadedUrl;
      }

      const updates = { nome, foto_perfil: foto_perfil_atualizada };

      if (senhaNova.trim() !== '') {
        updates.senha = await hashPassword(senhaNova);
      }

      const { error } = await supabase
        .from('usuarios')
        .update(updates)
        .eq('email', usuario.email);

      if (error) {
        showAlert(error.message, "Erro", "error");
      } else {
        // Garante compatibilidade total salvando tanto em 'foto' quanto em 'foto_perfil'
        const novoUsuario = {
          ...usuario,
          nome,
          foto: foto_perfil_atualizada,
          foto_perfil: foto_perfil_atualizada
        };

        setUsuario(novoUsuario);
        localStorage.setItem('usuarioLogado', JSON.stringify(novoUsuario));

        showAlert("Perfil atualizado!", "Sucesso", "success");
        setIsEditing(false);
        setSenhaAtual('');
        setSenhaNova('');
        setFotoFile(null);
      }
    } catch (error) {
      console.error(error);
      showAlert("Ocorreu um erro ao atualizar o perfil.", "Erro", "error");
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // DELETE ACCOUNT
  // =========================
  const handleDeleteAccount = async () => {
    if (!senhaConfirmacaoDelete) {
      showAlert("Digite sua senha.", "Aviso", "info");
      return;
    }

    setLoading(true);

    try {
      const senhaHasheada = await hashPassword(senhaConfirmacaoDelete);
      const { data: userVerify } = await supabase
        .from('usuarios')
        .select('*')
        .eq('email', usuario.email)
        .eq('senha', senhaHasheada)
        .single();

      if (!userVerify) {
        showAlert("Senha incorreta.", "Erro", "error");
        return;
      }

      await supabase
        .from('usuarios')
        .delete()
        .eq('email', usuario.email);

      localStorage.removeItem('usuarioLogado');
      navigate('/login');
    } catch (error) {
      console.error(error);
      showAlert("Ocorreu um erro ao excluir a conta.", "Erro", "error");
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // UI
  // =========================
  return (
    <div style={pageStyle}>
      <CustomModal
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
      />
      <div style={cardStyle}>
        <h1 style={{ color: '#007bff' }}>Meu Perfil</h1>

        <p style={{ color: '#666' }}>
          Gerencie sua conta
        </p>

        {/* AVATAR COM FALLBACK SVG LOCAL */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 15 }}>
          {urlFoto ? (
            <img src={urlFoto} style={avatarStyle} alt="Perfil" />
          ) : (
            <div style={{ ...avatarStyle, display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#e2e8f0' }}>
              <svg viewBox="0 0 24 24" width="60" height="60" fill="#64748b">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </div>
          )}
        </div>

        {/* VIEW */}
        {!isEditing && !isDeletingAccount && (
          <>
            <div style={infoBox}>
              <p><b>Nome:</b> {usuario.nome}</p>
              <p><b>Email:</b> {usuario.email}</p>
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
              disabled={loading}
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
              disabled={loading}
            >
              {loading ? 'Excluindo...' : 'Excluir conta'}
            </button>

            <p style={link} onClick={() => setIsDeletingAccount(false)}>
              Cancelar
            </p>
          </>
        )}

        <p style={{ ...link, marginTop: 20, display: 'block' }} onClick={() => navigate('/')}>
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
  boxSizing: 'border-box'
};

const inputStyle = {
  width: '100%',
  padding: 12,
  marginBottom: 10,
  borderRadius: 10,
  border: '1px solid #d8e3f0',
  boxSizing: 'border-box'
};

const buttonStyle = {
  width: '100%',
  padding: 14,
  background: '#007bff',
  color: '#fff',
  border: 'none',
  borderRadius: 12,
  cursor: 'pointer',
  fontWeight: 'bold'
};

const link = {
  color: '#007bff',
  cursor: 'pointer',
  textDecoration: 'underline',
  fontSize: 13,
  marginTop: 10
};

const danger = {
  color: 'red',
  cursor: 'pointer',
  textDecoration: 'underline',
  fontSize: 13,
  marginTop: 15
};

const infoBox = {
  textAlign: 'left',
  background: '#f8fafc',
  padding: 12,
  borderRadius: 12,
  marginBottom: 15
};