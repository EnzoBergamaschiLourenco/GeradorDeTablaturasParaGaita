import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

export default function Menu() {
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState(null);

  // Verifica se existe um usuário no localStorage ao carregar a página
  useEffect(() => {
    const dadosSalvos = localStorage.getItem('usuarioLogado');
    if (dadosSalvos) {
      setUsuario(JSON.parse(dadosSalvos));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('usuarioLogado');
    setUsuario(null);
    navigate('/login');
  };

  // Lista base de botões
  const botoes = [
    { nome: "Meu perfil", acao: () => navigate('/perfil'), mostrar: !!usuario }, // Só mostra se tiver usuário
    { nome: "Configurações", acao: () => {}, mostrar: true },
    { nome: "Dashboard", acao: () => {}, mostrar: true },
    { nome: "Relatórios", acao: () => {}, mostrar: true },
    { nome: "Suporte", acao: () => {}, mostrar: true },
    { nome: "Login / Sign-In", acao: () => navigate('/login'), mostrar: !usuario }, // Só mostra se NÃO tiver usuário
  ];

  return (
    <div style={{ textAlign: 'center', marginTop: '50px', fontFamily: 'Arial' }}>
      <h1>Menu Principal</h1>
      
      {usuario && <p>Bem-vindo, <strong>{usuario.nome}</strong>!</p>}

      <div style={{ display: 'flex', flexDirection: 'column', width: '300px', margin: '0 auto', gap: '10px' }}>
        
        {botoes.map((btn, index) => (
          // Renderização condicional baseada na propriedade 'mostrar'
          btn.mostrar && (
            <button 
              key={index} 
              onClick={btn.acao} 
              style={{ 
                padding: '10px', 
                backgroundColor: '#007bff', 
                color: 'white', 
                border: 'none', 
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              {btn.nome}
            </button>
          )
        ))}

        {/* Botão de Sair extra que aparece apenas quando logado */}
        {usuario && (
          <>
            <hr style={{ width: '100%', margin: '10px 0' }} />
            <button 
              onClick={handleLogout}
              style={{ background: 'none', border: 'none', color: '#ff4d4d', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Sair da conta
            </button>
          </>
        )}
      </div>
    </div>
  );
}