// Snapshot da tela de resultados do Menu, guardado em sessionStorage (escopo
// de aba — some ao fechar a aba, não persiste entre sessões).
//
// Serve pra que, ao entrar numa tablatura a partir de um resultado de busca e
// depois VOLTAR (botão do navegador ou o ✕ em VisualizarTabs), o usuário caia
// de novo na MESMA lista, com os mesmos filtros/página/ordenação e na mesma
// posição de rolagem — em vez de num Menu zerado.
//
// O Menu lê isto como estado inicial "lazy" (sem flash da tela inicial) e
// restaura o scroll depois que a lista pinta. O snapshot é criado só quando se
// clica num card de resultado e é apagado quando o usuário volta pra home de
// propósito (clique no título "HarmonicaTabs" ou no ✕ do cabeçalho dos
// resultados).

const CHAVE = 'harmonicaTabs:menuSnapshot';

export function salvarSnapshotMenu(snapshot) {
  try {
    sessionStorage.setItem(CHAVE, JSON.stringify(snapshot));
  } catch {
    // sessionStorage indisponível (modo privado, cota) — sem snapshot, o
    // comportamento antigo (Menu zerado no voltar) continua valendo.
  }
}

export function lerSnapshotMenu() {
  try {
    const bruto = sessionStorage.getItem(CHAVE);
    if (!bruto) return null;
    const dados = JSON.parse(bruto);
    // Só é um snapshot "válido" (que dispara a restauração) se tiver mesmo uma
    // lista de resultados pra mostrar.
    if (!dados || !Array.isArray(dados.resultados) || dados.resultados.length === 0) {
      return null;
    }
    return dados;
  } catch {
    return null;
  }
}

export function limparSnapshotMenu() {
  try {
    sessionStorage.removeItem(CHAVE);
  } catch {
    // ignore
  }
}

// true se existe um snapshot de resultados guardado — usado por VisualizarTabs
// pra decidir se mostra o ✕ de "voltar aos resultados".
export function temSnapshotMenu() {
  return lerSnapshotMenu() !== null;
}
