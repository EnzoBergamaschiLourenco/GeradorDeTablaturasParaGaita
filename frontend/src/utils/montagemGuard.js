// Autorização de entrada na tela de Montar Tablatura.
//
// A montagem só faz sentido quando aberta a partir de "Criar Tabs", que passa
// nome / autor / letra / MIDI pelo state da navegação e constrói todo o resto
// (partes, notas, tradução, configuração da gaita) em memória. Abrir
// /MontarTablatura por link direto — ou recarregar a aba no meio da montagem —
// perde esse estado em memória e deixa a tela quebrada, faltando informações e
// partes. Nesses casos a própria tela redireciona de volta pra /CriarTabs.
//
// O sinal é uma flag em memória deste módulo: nasce `false` a cada boot da
// aplicação (portanto sempre `false` logo após um F5) e só vira `true` quando o
// Criar Tabs chama `autorizarMontagem()` imediatamente antes de navegar.
// `entradaMontagemAutorizada` consome essa flag uma única vez, mas é idempotente
// por `location.key` pra sobreviver ao mount duplo do StrictMode em dev.

let autorizada = false;
let keyConsumida = null;

// Chamado pelo Criar Tabs logo antes de navegar para /MontarTablatura.
export function autorizarMontagem() {
  autorizada = true;
  // Rede de segurança: se a navegação não chegar a acontecer (usuário desistiu
  // durante a animação de transição), a autorização não fica "vazando" para uma
  // visita futura por link direto. A montagem real consome a flag muito antes
  // disso e fixa `keyConsumida`, então o StrictMode continua coberto.
  setTimeout(() => { autorizada = false; }, 4000);
}

// Chamado uma vez pela tela de Montar Tablatura ao montar. Retorna true só se
// esta navegação foi autorizada nesta sessão (não um link direto nem um
// reload). A checagem por `locationKey` garante a mesma resposta se o React
// reexecutar o inicializador (StrictMode).
export function entradaMontagemAutorizada(locationKey) {
  if (keyConsumida !== null && keyConsumida === locationKey) return true;
  if (autorizada) {
    autorizada = false;
    keyConsumida = locationKey;
    return true;
  }
  return false;
}
