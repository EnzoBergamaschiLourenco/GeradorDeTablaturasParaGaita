import { supabase } from '../supabaseClient';

// Criptografa a senha em SHA-256 (nativo do navegador). Usado tanto para
// cadastrar/comparar senha quanto para confirmar a senha atual em ações
// sensíveis (trocar senha, deletar conta).
export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Upload de foto de perfil no bucket "Fotos de perfil". Usado no cadastro
// (Login) e na edição de perfil (Perfil).
export async function uploadAvatar(file) {
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
}

// Busca um usuário pelo par email+senha (hash comparado no banco). Usado no
// login e nas duas confirmações de "senha atual" em Perfil.jsx — antes,
// cada chamador reimplementava a mesma query.
export async function buscarUsuarioPorCredenciais({ email, senha }) {
  const senhaHasheada = await hashPassword(senha);

  return supabase
    .from('usuarios')
    .select('*')
    .eq('email', email)
    .eq('senha', senhaHasheada)
    .single();
}

// Cadastra um novo usuário, hasheando a senha e (se enviada) subindo a foto.
export async function registrarUsuario({ nome, email, senha, fotoFile }) {
  let urlFoto = '';

  if (fotoFile) {
    const uploadedUrl = await uploadAvatar(fotoFile);
    if (uploadedUrl) urlFoto = uploadedUrl;
  }

  const senhaHasheada = await hashPassword(senha);

  return supabase
    .from('usuarios')
    .insert([{ nome, email, senha: senhaHasheada, foto_perfil: urlFoto }]);
}

// Aplica atualizações já preparadas pelo chamador (ex.: nome, foto_perfil,
// senha já hasheada) na linha do usuário identificado por email.
export async function atualizarPerfil({ email, updates }) {
  return supabase.from('usuarios').update(updates).eq('email', email);
}

export async function excluirConta({ email }) {
  return supabase.from('usuarios').delete().eq('email', email);
}
