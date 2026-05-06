import { useNavigate } from 'react-router-dom';

export default function Menu() {
  const navigate = useNavigate();

  const botoes = [
    { nome: "Perfil", acao: () => {} },
    { nome: "Configurações", acao: () => {} },
    { nome: "Dashboard", acao: () => {} },
    { nome: "Relatórios", acao: () => {} },
    { nome: "Suporte", acao: () => {} },
    { nome: "Login / Conta", acao: () => navigate('/login') }, // Redireciona
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginTop: '50px' }}>
      <h1>Menu Principal</h1>
      <div style={{ display: 'flex', flexDirection: 'column', width: '200px', gap: '15px' }}>
        {botoes.map((btn, index) => (
          <button key={index} onClick={btn.acao} style={{ padding: '10px', cursor: 'pointer' }}>
            {btn.nome}
          </button>
        ))}
      </div>
    </div>
  );
}