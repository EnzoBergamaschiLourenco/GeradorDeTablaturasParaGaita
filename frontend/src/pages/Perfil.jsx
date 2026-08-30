import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import CustomModal from '../components/CustomModal';
import TopBar, { TOPBAR_CLEARANCE } from '../components/TopBar';
import { useAnimatedNavigate, fadeStyle } from '../hooks/useAnimatedNavigate';
import { useCarregamentoMinimo, usePontinhos } from '../hooks/useCarregamento';
import {
  hashPassword,
  uploadAvatar,
  buscarUsuarioPorCredenciais,
  atualizarPerfil,
  excluirConta
} from '../services/authService';
import { useAuthUser } from '../hooks/useAuthUser';
import { useModal } from '../hooks/useModal';
import { REGRAS_SENHA, requisitosNaoAtendidos } from '../utils/senha';

// Botão de olho (mostrar/ocultar) reutilizado nos três campos do popup de
// troca de senha e no campo de nova senha da edição — cada um com seu
// próprio estado de visibilidade.
function BotaoOlho({ mostrar, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={eyeButtonStyle}
      aria-label={mostrar ? 'Ocultar senha' : 'Mostrar senha'}
      title={mostrar ? 'Ocultar senha' : 'Mostrar senha'}
    >
      {mostrar ? (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 5c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
      )}
    </button>
  );
}

export default function Perfil() {
  const { modalConfig, showAlert, showConfirm, closeModal } = useModal();

  const [loading, setLoading] = useState(false);
  // Botões de ação (Salvar / Excluir) respeitam o tempo mínimo com "..." (anti-flash).
  const carregandoMin = useCarregamentoMinimo(loading);
  const pontos = usePontinhos(carregandoMin);
  const [isEditing, setIsEditing] = useState(false);
  // isDeletingAccount: se o popup de exclusão de conta está aberto (por
  // cima da tela, não trocando o conteúdo dela). deleteStep controla qual
  // dos dois passos aparece dentro dele: confirmação inicial, depois o
  // campo de senha.
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteStep, setDeleteStep] = useState('confirmar');
  // navigate "cru": usado só no guard de rota abaixo, que redireciona antes de
  // qualquer conteúdo renderizar — não há o que dar fade ali.
  const navigate = useNavigate();
  const { expanded, contentVisible, navigateAnimated } = useAnimatedNavigate(true);

  const { usuario, setUsuario, logout } = useAuthUser();

  const [nome, setNome] = useState(usuario?.nome || '');
  const [fotoFile, setFotoFile] = useState(null);

  // isTrocandoSenha: se o popup de troca de senha está aberto. Os três
  // campos (senha atual / nova / confirmação) e seus toggles de olho vivem
  // aqui — o popup usa de referência a seção de senha do cadastro (checklist
  // ao vivo + feedback de borda), só que com o campo da senha atual a mais.
  const [isTrocandoSenha, setIsTrocandoSenha] = useState(false);
  const [mostrarSenhaNova, setMostrarSenhaNova] = useState(false);
  const [mostrarSenhaAtual, setMostrarSenhaAtual] = useState(false);
  const [mostrarSenhaConfirmacao, setMostrarSenhaConfirmacao] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [senhaNova, setSenhaNova] = useState('');
  const [senhaConfirmacao, setSenhaConfirmacao] = useState('');
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
  // UPDATE PERFIL (nome + foto)
  // =========================
  // A troca de senha saiu daqui e virou o popup próprio (handleTrocarSenha),
  // então editar nome/foto não pede mais a senha atual.
  const handleUpdate = async () => {
    setLoading(true);

    try {
      let foto_perfil_atualizada = urlFoto || '';

      // se enviou nova imagem
      if (fotoFile) {
        const uploadedUrl = await uploadAvatar(fotoFile);
        if (uploadedUrl) foto_perfil_atualizada = uploadedUrl;
      }

      const updates = { nome, foto_perfil: foto_perfil_atualizada };

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
  // TROCAR SENHA (popup)
  // =========================
  const abrirTrocarSenha = () => {
    setSenhaAtual('');
    setSenhaNova('');
    setSenhaConfirmacao('');
    setMostrarSenhaAtual(false);
    setMostrarSenhaNova(false);
    setMostrarSenhaConfirmacao(false);
    setIsTrocandoSenha(true);
  };

  const fecharTrocarSenha = () => {
    setIsTrocandoSenha(false);
    setSenhaAtual('');
    setSenhaNova('');
    setSenhaConfirmacao('');
  };

  const handleTrocarSenha = async () => {
    if (!senhaAtual || !senhaNova || !senhaConfirmacao) {
      showAlert("Preencha todos os campos.", "Aviso", "info");
      return;
    }

    if (requisitosNaoAtendidos(senhaNova).length > 0) {
      showAlert("A nova senha não atende a todos os requisitos.", "Senha inválida", "error");
      return;
    }

    if (senhaConfirmacao !== senhaNova) {
      showAlert("A confirmação de senha não é igual à nova senha digitada.", "Senhas não conferem", "error");
      return;
    }

    setLoading(true);

    try {
      const { data: userVerify } = await buscarUsuarioPorCredenciais({
        email: usuario.email,
        senha: senhaAtual
      });

      if (!userVerify) {
        showAlert("Senha atual incorreta.", "Erro", "error");
        return;
      }

      const { error } = await atualizarPerfil({
        email: usuario.email,
        updates: { senha: await hashPassword(senhaNova) }
      });

      if (error) {
        showAlert(error.message, "Erro", "error");
      } else {
        showAlert("Senha alterada com sucesso!", "Sucesso", "success");
        fecharTrocarSenha();
      }
    } catch (error) {
      console.error(error);
      showAlert("Ocorreu um erro ao trocar a senha.", "Erro", "error");
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // DELETE ACCOUNT
  // =========================
  // Abre o popup de exclusão, sempre começando pelo passo de confirmação
  // (não pelo campo de senha, mesmo que tenha ficado aberto nele antes).
  const handleDeleteAccountClick = () => {
    setDeleteStep('confirmar');
    setIsDeletingAccount(true);
  };

  const fecharModalExcluir = () => {
    setIsDeletingAccount(false);
    setDeleteStep('confirmar');
    setSenhaConfirmacaoDelete('');
  };

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
        confirmLabel={modalConfig.confirmLabel}
        onClose={closeModal}
      />

      {/* Popup de exclusão de conta, em dois passos dentro do mesmo overlay
          (visual igual ao CustomModal, mas com campo de senha no segundo
          passo — por isso não é o CustomModal genérico). */}
      {isDeletingAccount && (
        <div style={modalOverlayStyle}>
          <div style={modalBoxStyle}>
            {deleteStep === 'confirmar' ? (
              <>
                <h3 style={{ color: 'var(--color-danger-strong)', marginBottom: '10px' }}>
                  Excluir conta
                </h3>
                <p style={{ color: 'var(--color-text-main)', marginBottom: '20px', fontSize: '15px' }}>
                  Tem certeza que deseja excluir sua conta? Essa ação não pode ser desfeita.
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
                  <button style={modalCancelButtonStyle} onClick={fecharModalExcluir}>
                    Cancelar
                  </button>
                  <button
                    style={{ ...modalConfirmButtonStyle, backgroundColor: 'var(--color-danger-strong)' }}
                    onClick={() => setDeleteStep('senha')}
                  >
                    Sim, excluir todos os meus dados
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 style={{ color: 'var(--color-danger-strong)', marginBottom: '10px' }}>
                  Confirme sua senha
                </h3>
                <p style={{ color: 'var(--color-text-main)', marginBottom: '16px', fontSize: '15px' }}>
                  Digite sua senha atual pra excluir a conta definitivamente.
                </p>

                <input
                  style={{ ...inputStyle, marginBottom: '18px', border: 'var(--border-width-base) solid var(--color-danger-pure)' }}
                  type="password"
                  placeholder="Senha"
                  value={senhaConfirmacaoDelete}
                  onChange={(e) => setSenhaConfirmacaoDelete(e.target.value)}
                />

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
                  <button style={modalCancelButtonStyle} onClick={fecharModalExcluir}>
                    Cancelar
                  </button>
                  <button
                    style={{ ...modalConfirmButtonStyle, backgroundColor: 'var(--color-danger-pure)' }}
                    onClick={handleDeleteAccount}
                    disabled={carregandoMin}
                  >
                    {carregandoMin ? `Excluindo${pontos}` : 'Excluir conta'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Popup de troca de senha — mesmo overlay/caixa do popup de exclusão.
          Espelha a seção de senha do cadastro (checklist ao vivo + borda
          verde/vermelha + confirmação), acrescentando o campo "senha atual". */}
      {isTrocandoSenha && (
        <div style={modalOverlayStyle}>
          <div style={{ ...modalBoxStyle, maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ color: 'var(--color-primary)', marginBottom: '10px' }}>
              Trocar senha
            </h3>
            <p style={{ color: 'var(--color-text-main)', marginBottom: '16px', fontSize: '15px' }}>
              Confirme sua senha atual e escolha uma nova.
            </p>

            <div style={{ position: 'relative', marginBottom: '12px' }}>
              <input
                type={mostrarSenhaAtual ? 'text' : 'password'}
                placeholder="Senha atual"
                value={senhaAtual}
                onChange={(e) => setSenhaAtual(e.target.value)}
                style={{ ...inputStyle, marginBottom: 0, paddingRight: '44px' }}
              />
              <BotaoOlho mostrar={mostrarSenhaAtual} onToggle={() => setMostrarSenhaAtual(!mostrarSenhaAtual)} />
            </div>

            <div style={{ position: 'relative', marginBottom: 0 }}>
              <input
                type={mostrarSenhaNova ? 'text' : 'password'}
                placeholder="Nova senha"
                value={senhaNova}
                onChange={(e) => setSenhaNova(e.target.value.replace(/\s/g, ''))}
                style={{
                  ...inputStyle,
                  marginBottom: 0,
                  paddingRight: '44px',
                  ...(senhaNova === ''
                    ? {}
                    : requisitosNaoAtendidos(senhaNova).length === 0
                      ? bordaValida
                      : bordaInvalida)
                }}
              />
              <BotaoOlho mostrar={mostrarSenhaNova} onToggle={() => setMostrarSenhaNova(!mostrarSenhaNova)} />
            </div>

            <ul style={checklistStyle}>
              {REGRAS_SENHA.map((regra) => {
                const ok = regra.teste(senhaNova);
                const cor = senhaNova === ''
                  ? 'var(--color-text-muted)'
                  : ok
                    ? 'var(--color-text-success)'
                    : 'var(--color-text-danger-strong)';
                return (
                  <li key={regra.chave} style={{ color: cor }}>
                    {senhaNova === '' ? '•' : ok ? '✓' : '✗'} {regra.label}
                  </li>
                );
              })}
            </ul>

            <div style={{ position: 'relative', marginBottom: 0 }}>
              <input
                type={mostrarSenhaConfirmacao ? 'text' : 'password'}
                placeholder="Confirmar nova senha"
                value={senhaConfirmacao}
                onChange={(e) => setSenhaConfirmacao(e.target.value.replace(/\s/g, ''))}
                style={{
                  ...inputStyle,
                  marginBottom: 0,
                  paddingRight: '44px',
                  ...(senhaConfirmacao === ''
                    ? {}
                    : senhaConfirmacao === senhaNova
                      ? bordaValida
                      : bordaInvalida)
                }}
              />
              <BotaoOlho mostrar={mostrarSenhaConfirmacao} onToggle={() => setMostrarSenhaConfirmacao(!mostrarSenhaConfirmacao)} />
            </div>
            {senhaConfirmacao !== '' && senhaConfirmacao !== senhaNova && (
              <p style={{ color: 'var(--color-text-danger-strong)', fontSize: '12.5px', margin: '6px 0 0' }}>
                As senhas não conferem.
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap', marginTop: '18px' }}>
              <button style={modalCancelButtonStyle} onClick={fecharTrocarSenha}>
                Cancelar
              </button>
              <button
                style={{ ...modalConfirmButtonStyle, backgroundColor: 'var(--color-primary)' }}
                onClick={handleTrocarSenha}
                disabled={carregandoMin}
              >
                {carregandoMin ? `Salvando${pontos}` : 'Salvar nova senha'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ ...cardStyle, ...fadeStyle(contentVisible) }}>
        <h1 style={{ color: 'var(--color-primary)', fontSize: 'clamp(28px, 7vw, 56px)' }}>Meu Perfil</h1>

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
        {!isEditing && (
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

            <p style={danger} onClick={handleDeleteAccountClick}>
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

            <button
              type="button"
              onClick={abrirTrocarSenha}
              style={{
                ...buttonStyle,
                background: 'transparent',
                color: 'var(--color-primary)',
                border: 'var(--border-width-base) solid var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                marginBottom: 12
              }}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Trocar senha
            </button>

            <button
              style={{ ...buttonStyle, backgroundColor: 'var(--color-success)' }}
              onClick={handleUpdate}
              disabled={carregandoMin}
            >
              {carregandoMin ? `Salvando${pontos}` : 'Salvar'}
            </button>

            <p style={link} onClick={() => setIsEditing(false)}>
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

// Mesmo visual do CustomModal genérico (overlay + caixa) — replicado aqui
// porque o popup de exclusão de conta tem duas etapas (confirmação e depois
// campo de senha), o que o CustomModal não suporta.
const modalOverlayStyle = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'var(--color-overlay-modal)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 1000
};

const modalBoxStyle = {
  backgroundColor: 'var(--color-bg-card)',
  padding: '24px',
  borderRadius: '16px',
  width: '100%',
  maxWidth: '380px',
  boxShadow: '0 10px 25px var(--shadow-note-default)',
  textAlign: 'left'
};

const modalConfirmButtonStyle = {
  padding: '10px 20px',
  color: 'var(--color-text-on-primary)',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 'bold'
};

const modalCancelButtonStyle = {
  padding: '10px 20px',
  backgroundColor: 'var(--color-border-alt)',
  color: 'var(--color-text-main)',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 'bold'
};

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
  padding: 'clamp(24px, 6vw, 40px)',
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

// Feedback de borda dos campos de senha do popup — mesmo padrão do cadastro.
const bordaValida = { border: '2px solid var(--color-success)' };
const bordaInvalida = { border: '2px solid var(--color-danger)' };

// Checklist ao vivo das regras de senha, abaixo do campo "nova senha".
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