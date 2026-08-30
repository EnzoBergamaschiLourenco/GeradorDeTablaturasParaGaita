// Helpers de busca textual — usados no Menu (barra + filtros) e no
// autocomplete de Criar Tabs. A ideia é fazer a correspondência e o ranking
// no cliente, acento-insensível, sem depender de recursos do banco.

// Normaliza texto para comparação: remove acentos, minúsculo, colapsa
// espaços. Aplicado nos DOIS lados (termo digitado e valor vindo do banco),
// então "joao" casa com "joão" e vice-versa.
export function normalizar(texto) {
  return (texto ?? '')
    .toString()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// Escapa os curingas do LIKE/ILIKE (%, _, \). Fica pronto para qualquer
// filtro que ainda rode no servidor via `.ilike()`.
export function escaparLike(texto) {
  return (texto ?? '').toString().replace(/[\\%_]/g, '\\$&');
}

function escaparRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function bigramas(s) {
  const lista = [];
  for (let i = 0; i < s.length - 1; i++) lista.push(s.slice(i, i + 2));
  return lista;
}

// Similaridade 0..1 pelo coeficiente de Dice sobre bigramas — barata e
// suficiente para "parece com" / tolerância a erro de digitação.
export function similaridade(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const ba = bigramas(a);
  const bb = bigramas(b);
  const mapa = new Map();
  ba.forEach((g) => mapa.set(g, (mapa.get(g) || 0) + 1));

  let intersecao = 0;
  bb.forEach((g) => {
    const n = mapa.get(g) || 0;
    if (n > 0) {
      intersecao += 1;
      mapa.set(g, n - 1);
    }
  });

  return (2 * intersecao) / (ba.length + bb.length);
}

// Só considera fuzzy a partir deste tamanho de termo — abaixo disso o Dice
// fica instável e gera ruído.
const TAM_MIN_FUZZY = 4;
const LIMITE_FUZZY = 0.34;

// Nota de relevância (0..100+) de um campo para um termo JÁ normalizado.
// `termoCru`/`valorCru` servem só para o pequeno bônus de "acento idêntico".
export function pontuar(termoNorm, valorNorm, termoCru = '', valorCru = '') {
  if (!termoNorm || !valorNorm) return 0;

  let nota;
  if (valorNorm === termoNorm) nota = 100;
  else if (valorNorm.startsWith(termoNorm)) nota = 80;
  else if (new RegExp('(^|\\s)' + escaparRegex(termoNorm)).test(valorNorm)) nota = 62;
  else if (valorNorm.includes(termoNorm)) nota = 45;
  else if (termoNorm.length >= TAM_MIN_FUZZY) {
    const sim = similaridade(termoNorm, valorNorm);
    nota = sim >= LIMITE_FUZZY ? Math.round(sim * 35) : 0;
  } else {
    nota = 0;
  }

  if (nota > 0 && termoCru && valorCru && termoCru === valorCru) nota += 3;
  return nota;
}

// Correspondência acento-insensível por substring. Vale tanto para a barra
// de nome quanto para os filtros (autor da música / autor da tab). Erro de
// digitação NÃO entra como resultado — vira "Você quis dizer …?" no Menu,
// via `similaridade`. Assim evita falso-positivo (ex.: "manchester" trazer
// "Manchild").
export function casaTexto(termoNorm, valorNorm) {
  if (!termoNorm) return true;
  if (!valorNorm) return false;
  return valorNorm.includes(termoNorm);
}
