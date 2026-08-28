// Heurística compartilhada pra distinguir uma linha de NOTAS de uma linha de
// LETRA no texto da tablatura. Usada tanto na exibição (TablaturaView) quanto
// na exportação (PDF), pra que os dois fiquem sempre iguais.

// Marcações de bend/efeito que podem aparecer no fim de um comando de gaita.
const BEND = "['’`´°º*]{0,3}[b#]?";

// Um número de gaita "simples": "~" (vibrato) opcional, sinal opcional,
// 1-2 dígitos e bend opcional. Ex.: 6  -6  ~6  ~-5  -3''  10  -12
const NOTA_SIMPLES = new RegExp(`^~?[+-]?\\d{1,2}${BEND}$`);

// O que pode existir DENTRO de um grupo entre parênteses (acorde/oitava):
// só números, sinais, "~", bends e espaços. Ex.: "(6 9)"  "-(48)"  "(6 -9)"
const DENTRO_PARENS = /^[~+\-\d\s'’`´°º*b#]+$/;

// Uma linha é "de notas" quando TODOS os seus tokens têm cara de comando de
// gaita. Frases da letra sempre têm alguma palavra que não casa com isso.
// Grupos entre parênteses (mesmo com espaço interno, como "(6 9)") contam
// como um único token de nota, desde que só tenham números lá dentro.
export function pareceLinhaDeNotas(linha) {
  let s = linha.trim();
  if (!s) return false;

  let parenInvalido = false;
  s = s.replace(/~?[+-]?\(([^()]*)\)/g, (_m, dentro) => {
    const d = dentro.trim();
    if (d && /\d/.test(d) && DENTRO_PARENS.test(d)) return ' \x00 '; // acorde válido
    parenInvalido = true; // parêntese com palavra dentro => é letra
    return ' \x00X ';
  });
  if (parenInvalido) return false;

  const tokens = s.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;

  return tokens.every((t) => {
    if (t === '\x00') return true; // acorde já validado acima
    const limpo = t.replace(/[.,;:]+$/, ''); // ignora pontuação solta no fim
    return limpo === '|' || NOTA_SIMPLES.test(limpo); // "|" separa compassos
  });
}
