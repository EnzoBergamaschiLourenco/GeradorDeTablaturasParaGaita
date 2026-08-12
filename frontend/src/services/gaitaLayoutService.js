import { supabase } from '../supabaseClient';

// Tons cadastrados em layouts_gaita, opcionalmente filtrados por tipo.
// Usado por Menu.jsx (filtro de busca) e MontarTablatura.jsx (seleção de
// tom) — antes cada um reimplementava esta mesma query.
export async function buscarTonsPorTipo(tipo) {
  let query = supabase.from('layouts_gaita').select('tom');

  if (tipo) {
    query = query.eq('tipo', tipo);
  }

  return query;
}

export async function buscarLayoutPorTomETipo({ tom, tipo }) {
  return supabase
    .from('layouts_gaita')
    .select('id')
    .eq('tipo', tipo)
    .eq('tom', tom)
    .single();
}
