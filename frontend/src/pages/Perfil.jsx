import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import CustomModal from '../components/CustomModal';
import TopBar, { TOPBAR_CLEARANCE } from '../components/TopBar';
import { useAnimatedNavigate, fadeStyle } from '../hooks/useAnimatedNavigate';
import {
  hashPassword,
  uploadAvatar,
  buscarUsuarioPorCredenciais,
  atualizarPerfil,
  excluirConta
} from '../services/authService';
import { useAuthUser } from '../hooks/useAuthUser';
import { useModal } from '../hooks/useModal';

export default function Perfil() {
  const { modalConfig, showAlert, showConfirm, closeModal } = useModal();

  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  // navigate "cru": usado só no guard de rota abaixo, que redireciona antes de
  // qualquer conteúdo renderizar — não há o que dar fade ali.
  const navigate = useNavigate();
  const { expanded, contentVisible, navigateAnimated } = useAnimatedNavigate(true);

  const { usuario, setUsuario, logout } = useAuthUser();

  const [nome, setNome] = useState(usuario?.nome || '');
  const [fotoFile, setFotoFile] = useState(null);

  const [senhaAtual, setSenhaAtual] = useState('');
  const [senhaNova, setSenhaNova] = useState('');
  const [senhaConfirmacaoDelete, setSenhaConfirmacaoDelete] = useState('');

  useEffect(() => {
    // Redireciona para a tela de login caso não esteja logado
    if (!usuario) {
      navigate('/login');
    }
  }, [usuario, navigate]);

  // Bloqueia a renderização de componentes filhos enquanto o useEffect valida o login,
  // impedindo erros de "cannot read property of null"
  if (!usuario) {
    return null;
  }

  // Detecta se a foto foi gravada como 'foto' (seu login atual) ou 'foto_perfil'
  const urlFoto = usuario.foto || usuario.foto_perfil;

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
      const { data: userVerify } = await buscarUsuarioPorCredenciais({
        email: usuario.email,
        senha: senhaAtual
      });

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

      const { error } = await atualizarPerfil({ email: usuario.email, updates });

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
      const { data: userVerify } = await buscarUsuarioPorCredenciais({
        email: usuario.email,
        senha: senhaConfirmacaoDelete
      });

      if (!userVerify) {
        showAlert("Senha incorreta.", "Erro", "error");
        return;
      }

      await excluirConta({ email: usuario.email });

      logout();
      navigateAnimated('/login', { expand: true });
    } catch (error) {
      console.error(error);
      showAlert("Ocorreu um erro ao excluir a conta.", "Erro", "error");
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // LOGOUT
  // =========================
  const handleLogout = () => {
    showConfirm('Deseja mesmo sair?', {
      title: 'Sair da conta',
      type: 'warning',
      onConfirm: () => {
        logout();
        navigateAnimated('/login', { expand: true });
      }
    });
  };

  // =========================
  // UI
  // =========================
  return (
    <div style={pageStyle}>
      <TopBar expanded={expanded} navigateAnimated={navigateAnimated} />
      <CustomModal
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        onConfirm={modalConfig.onConfirm}
        onClose={closeModal}
      />
      <div style={{ ...cardStyle, ...fadeStyle(contentVisible) }}>
        <h1 style={{ color: 'var(--color-primary)' }}>Meu Perfil</h1>

        <p style={{ color: 'var(--color-text-muted)' }}>
          Gerencie sua conta
        </p>

        {/* AVATAR COM FALLBACK SVG LOCAL */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 15 }}>
          {urlFoto ? (
            <img src={urlFoto} style={avatarStyle} alt="Perfil" />
          ) : (
            <div style={{ ...avatarStyle, display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: 'var(--color-border-alt)' }}>
              <svg viewBox="0 0 24 24" width="60" height="60" fill="var(--color-text-slate-2)">
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

            <button style={{ ...buttonStyle, backgroundColor: 'var(--color-border-alt)', color: 'var(--color-text-muted)', marginTop: 10 }} onClick={handleLogout}>
              Sair
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
              style={{ ...inputStyle, border: 'var(--border-width-base) solid var(--color-danger-pure)' }}
              type="password"
              placeholder="Senha atual"
              value={senhaAtual}
              onChange={(e) => setSenhaAtual(e.target.value)}
            />

            <button
              style={{ ...buttonStyle, backgroundColor: 'var(--color-success)' }}
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
              style={{ ...inputStyle, border: 'var(--border-width-base) solid var(--color-danger-pure)' }}
              type="password"
              placeholder="Senha"
              value={senhaConfirmacaoDelete}
              onChange={(e) => setSenhaConfirmacaoDelete(e.target.value)}
            />

            <button
              style={{ ...buttonStyle, backgroundColor: 'var(--color-danger-pure)' }}
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

        <p style={{ ...link, marginTop: 20, display: 'block' }} onClick={() => navigateAnimated('/', { expand: false })}>
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
  background: 'var(--color-bg-page)',
  display: 'flex',
  justifyContent: 'center',
  // flex-start (em vez de center): o card "Meu Perfil" cresce bastante nos modos
  // de edição/exclusão de conta, e centralizar verticalmente empurrava o topo
  // dele para cima da barra de menu. Assim ele sempre começa logo abaixo dela,
  // com o mesmo respiro (TOPBAR_CLEARANCE) das outras telas, não importa o conteúdo.
  alignItems: 'flex-start',
  fontFamily: 'Arial',
  padding: '20px',
  paddingTop: `${TOPBAR_CLEARANCE}px`,
  boxSizing: 'border-box',
  overflowY: 'auto'
};

const cardStyle = {
  width: '100%',
  maxWidth: 420,
  background: 'var(--color-bg-card)',
  padding: 40,
  borderRadius: 24,
  textAlign: 'center',
  boxShadow: '0 15px 40px var(--shadow-card)'
};

const avatarStyle = {
  width: 120,
  height: 120,
  borderRadius: '50%',
  objectFit: 'cover',
  border: '3px solid var(--color-primary)',
  boxSizing: 'border-box'
};

const inputStyle = {
  width: '100%',
  padding: 12,
  marginBottom: 10,
  borderRadius: 10,
  border: 'var(--border-width-base) solid var(--color-border)',
  boxSizing: 'border-box',
  backgroundColor: 'var(--color-bg-card)',
  color: 'var(--color-text-main)'
};

const buttonStyle = {
  width: '100%',
  padding: 14,
  background: 'var(--color-primary)',
  color: 'var(--color-text-on-primary)',
  border: 'none',
  borderRadius: 12,
  cursor: 'pointer',
  fontWeight: 'bold'
};

const link = {
  color: 'var(--color-primary)',
  cursor: 'pointer',
  textDecoration: 'underline',
  fontSize: 13,
  marginTop: 10
};

const danger = {
  color: 'var(--color-danger-pure)',
  cursor: 'pointer',
  textDecoration: 'underline',
  fontSize: 13,
  marginTop: 15
};

const infoBox = {
  textAlign: 'left',
  background: 'var(--color-bg-card-alt)',
  padding: 12,
  borderRadius: 12,
  marginBottom: 15
};