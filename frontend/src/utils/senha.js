// Política de senha compartilhada — usada no cadastro (Login) e na troca de
// senha (Perfil). Cada regra alimenta tanto a validação de submit quanto a
// checklist ao vivo abaixo do campo.
export const REGRAS_SENHA = [
  { chave: 'tamanho', label: 'Mínimo de 8 caracteres', teste: (s) => s.length >= 8 },
  { chave: 'maiuscula', label: 'Uma letra maiúscula', teste: (s) => /[A-Z]/.test(s) },
  { chave: 'minuscula', label: 'Uma letra minúscula', teste: (s) => /[a-z]/.test(s) },
  { chave: 'numero', label: 'Um número', teste: (s) => /[0-9]/.test(s) },
  { chave: 'especial', label: 'Um caractere especial', teste: (s) => /[^A-Za-z0-9]/.test(s) }
];

export const requisitosNaoAtendidos = (senha) => REGRAS_SENHA.filter((r) => !r.teste(senha));
export const senhaAtendeRequisitos = (senha) => requisitosNaoAtendidos(senha).length === 0;
