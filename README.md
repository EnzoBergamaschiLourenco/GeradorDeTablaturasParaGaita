🚀 Projeto Web (React + Supabase)
Este projeto utiliza React com Vite para o frontend e Supabase como solução de Backend-as-a-Service (Banco de dados e Autenticação).

🛠️ Pré-requisitos
Antes de começar, você precisará ter instalado em sua máquina:

Node.js (Recomendado: Versão LTS)

Um gerenciador de pacotes (npm ou yarn)

🏁 Passo a Passo para Rodar Localmente
1. Clonar o repositório
Se você já tem a pasta no seu PC, ignore este passo. Caso contrário:

Bash
git clone https://github.com/seu-usuario/seu-repositorio.git
cd seu-repositorio
2. Entrar na pasta do Frontend
Como o projeto está estruturado com a pasta frontend, entre nela:

Bash
cd frontend
3. Instalar as dependências
Execute este comando para baixar todas as bibliotecas necessárias (React Router, Supabase SDK, etc.) listadas no package.json:

Bash
npm install
4. Configurar Variáveis de Ambiente
Crie um arquivo chamado .env na raiz da pasta frontend e adicione suas credenciais do Supabase:

Plaintext
VITE_SUPABASE_URL=sua_url_aqui
VITE_SUPABASE_ANON_KEY=sua_chave_anon_aqui
5. Rodar o site
Agora, inicie o servidor de desenvolvimento:

Bash
npm run dev
Após rodar o comando, o terminal exibirá um link (geralmente http://localhost:5173). Clique nele ou cole no seu navegador para ver o site rodando.

📂 Estrutura de Pastas Atual
src/main.jsx: Ponto de entrada do React.

src/App.jsx: Definição das rotas (/ para Menu, /login para Login).

src/pages/: Contém os arquivos das telas (Menu, Login, Cadastro).

src/supabaseClient.js: Configuração da conexão com o banco de dados.