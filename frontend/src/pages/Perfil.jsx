import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

export default function Perfil() {
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const navigate = useNavigate();
  
  const [userData, setUserData] = useState({ nome: '', email: '', foto: '' });
  const [nome, setNome] = useState('');
  const [fotoPerfil, setFotoPerfil] = useState('');
  const [senhaAtual, setSenhaAtual] = useState('');
  const [senhaNova, setSenhaNova] = useState('');
  const [senhaConfirmacaoDelete, setSenhaConfirmacaoDelete] = useState('');

  useEffect(() => {
    const salvo = localStorage.getItem('usuarioLogado');
    if (salvo) {
      const user = JSON.parse(salvo);
      setUserData(user);
      setNome(user.nome);
      setFotoPerfil(user.foto);
    }
  }, []);

  const handleUpdate = async () => {
    if (!senhaAtual) {
      alert("Senha atual obrigatória.");
      return;
    }
    setLoading(true);
    const { data: userVerify, error: verifyError } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', userData.email)
      .eq('senha', senhaAtual)
      .single();

    if (verifyError || !userVerify) {
      alert("Senha atual incorreta.");
      setLoading(false);
      return;
    }

    const updates = { nome, foto_perfil: fotoPerfil };
    if (senhaNova.trim() !== "") updates.senha = senhaNova;

    const { error: updateError } = await supabase
      .from('usuarios')
      .update(updates)
      .eq('email', userData.email);

    if (updateError) {
      alert("Erro ao atualizar: " + updateError.message);
    } else {
      alert("Perfil atualizado!");
      const novoUsuario = { ...userData, nome, foto: fotoPerfil };
      setUserData(novoUsuario);
      localStorage.setItem('usuarioLogado', JSON.stringify(novoUsuario));
      setIsEditing(false);
      setSenhaAtual('');
      setSenhaNova('');
    }
    setLoading(false);
  };

  const handleDeleteAccount = async () => {
    if (!senhaConfirmacaoDelete) {
      alert("Digite sua senha para confirmar a exclusão.");
      return;
    }

    const confirmar = window.confirm("TEM CERTEZA? Esta ação não pode ser desfeita.");
    if (!confirmar) return;

    setLoading(true);

    // Valida a senha antes de deletar
    const { data: userVerify, error: verifyError } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', userData.email)
      .eq('senha', senhaConfirmacaoDelete)
      .single();

    if (verifyError || !userVerify) {
      alert("Senha incorreta. Não foi possível deletar a conta.");
      setLoading(false);
      return;
    }

    // Deleta do banco de dados
    const { error: deleteError } = await supabase
      .from('usuarios')
      .delete()
      .eq('email', userData.email);

    if (deleteError) {
      alert("Erro ao deletar: " + deleteError.message);
    } else {
      alert("Conta excluída com sucesso.");
      localStorage.removeItem('usuarioLogado');
      navigate('/login');
    }
    setLoading(false);
  };

  return (
    <div style={{ textAlign: 'center', marginTop: '50px', fontFamily: 'Arial' }}>
      <h2>{isEditing ? 'Editar Perfil' : (isDeletingAccount ? 'Excluir Conta' : 'Meu Perfil')}</h2>

      <div style={{ display: 'flex', flexDirection: 'column', width: '300px', margin: '0 auto', gap: '15px' }}>
        
        {/* Foto de Perfil */}
        <div style={{ marginBottom: '10px' }}>
          <img 
            src={isEditing ? (fotoPerfil || 'https://via.placeholder.com/150') : (userData.foto || 'https://via.placeholder.com/150')} 
            alt="Perfil" 
            style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #007bff' }}
          />
        </div>

        {isEditing && (
          <>
            <input type="text" placeholder="Nome completo" value={nome} onChange={(e) => setNome(e.target.value)} style={{ padding: '8px' }} />
            <input type="text" placeholder="URL da foto" value={fotoPerfil} onChange={(e) => setFotoPerfil(e.target.value)} style={{ padding: '8px' }} />
            <hr style={{ width: '100%' }} />
            <input type="password" placeholder="Nova senha (opcional)" value={senhaNova} onChange={(e) => setSenhaNova(e.target.value)} style={{ padding: '8px' }} />
            <input type="password" placeholder="Senha atual (obrigatória)" value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} style={{ padding: '8px', border: '1px solid red' }} />
            <button onClick={handleUpdate} disabled={loading} style={{ padding: '10px', backgroundColor: '#28a745', color: 'white', border: 'none', cursor: 'pointer' }}>
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </button>
            <button onClick={() => setIsEditing(false)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', textDecoration: 'underline' }}>Cancelar</button>
          </>
        )}

        {isDeletingAccount && !isEditing && (
          <>
            <p style={{ color: 'red', fontSize: '14px' }}>Para deletar sua conta, confirme sua senha atual:</p>
            <input 
              type="password" 
              placeholder="Sua senha atual" 
              value={senhaConfirmacaoDelete}
              onChange={(e) => setSenhaConfirmacaoDelete(e.target.value)}
              style={{ padding: '8px', border: '1px solid red' }}
            />
            <button 
              onClick={handleDeleteAccount} 
              disabled={loading}
              style={{ padding: '10px', backgroundColor: '#dc3545', color: 'white', border: 'none', cursor: 'pointer' }}
            >
              {loading ? 'Deletando...' : 'CONFIRMAR EXCLUSÃO'}
            </button>
            <button 
              onClick={() => { setIsDeletingAccount(false); setSenhaConfirmacaoDelete(''); }}
              style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Voltar
            </button>
          </>
        )}

        {!isEditing && !isDeletingAccount && (
          <>
            <div style={{ textAlign: 'left', padding: '10px', backgroundColor: '#f9f9f9', borderRadius: '5px' }}>
              <p><strong>Nome:</strong> {userData.nome}</p>
              <p><strong>E-mail:</strong> {userData.email}</p>
            </div>
            <button onClick={() => setIsEditing(true)} style={{ padding: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', cursor: 'pointer' }}>
              Editar Perfil
            </button>
            
            {/* Link Deletar Conta solicitado */}
            <span 
              onClick={() => setIsDeletingAccount(true)}
              style={{ color: '#dc3545', cursor: 'pointer', textDecoration: 'underline', fontSize: '13px', marginTop: '5px' }}
            >
              Deletar conta
            </span>
          </>
        )}
      </div>
    </div>
  );
}