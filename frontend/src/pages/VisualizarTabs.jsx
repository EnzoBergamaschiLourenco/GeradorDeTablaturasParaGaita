import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import CustomModal from '../components/CustomModal';
import TablaturaView from '../components/TablaturaView';
import TopBar, { TOPBAR_CLEARANCE } from '../components/TopBar';
import { useAnimatedNavigate, fadeStyle } from '../hooks/useAnimatedNavigate';
import { useIsStacked } from '../hooks/useMediaQuery';
import { useAuthUser } from '../hooks/useAuthUser';
import { useModal } from '../hooks/useModal';
import { useCarregamentoMinimo, usePontinhos } from '../hooks/useCarregamento';
import {
  contarCurtidas,
  usuarioCurtiu,
  removerCurtida,
  adicionarCurtida,
  atualizarTextoTablatura,
  excluirTablatura,
  buscarTablaturaPorId
} from '../services/tablaturaService';
import { pareceLinhaDeNotas } from '../utils/tablatura';
import { temSnapshotMenu } from '../utils/menuSnapshot';

export default function VisualizarTabs() {
  const { modalConfig, showAlert, showConfirm, closeModal } = useModal();

  const { expanded, contentVisible, navigateAnimated } = useAnimatedNavigate(true);
  const isStacked = useIsStacked();
  const location = useLocation();
  const navigate = useNavigate();
  const tabRecebida = location.state?.tab;

  // Só mostra o ✕ "voltar aos resultados" quando o usuário chegou aqui a
  // partir de um resultado de busca (o Menu deixa um snapshot em
  // sessionStorage nesse caso). Lido uma vez no mount — não muda enquanto a
  // tela está aberta.
  const [veioDosResultados] = useState(temSnapshotMenu);

  // Volta pra tela de resultados exatamente de onde o usuário saiu. navigate(-1)
  // remonta o Menu, que restaura filtros/página/ordenação/rolagem pelo
  // snapshot; o fallback cobre o caso raro de não haver histórico.
  const voltarAosResultados = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  // Link compartilhável: /VisualizarTabs?id=123 abre a tela sem passar pelo
  // state de navegação — nesse caso a tablatura é buscada no banco pelo id.
  const idDaUrl = new URLSearchParams(location.search).get('id');
  const [tabCarregada, setTabCarregada] = useState(null);
  const [carregandoPorId, setCarregandoPorId] = useState(Boolean(idDaUrl && !tabRecebida));
  const [linkCopiado, setLinkCopiado] = useState(false);

  // Tela de "Carregando" respeita o tempo mínimo pra não piscar; "..." animado.
  const carregandoTabMin = useCarregamentoMinimo(carregandoPorId);
  const pontinhos = usePontinhos(carregandoTabMin);

  const { usuario } = useAuthUser();
  const [curtido, setCurtido] = useState(false);
  const [totalCurtidas, setTotalCurtidas] = useState(0);
  // Trava anti-clique-múltiplo do botão de curtir: `processandoCurtida` só
  // desabilita o botão na UI (aplicado depois do re-render), enquanto o ref é
  // checado de forma síncrona no início do handler — fecha a janela entre o
  // clique e o React re-renderizar em que cliques muito rápidos ainda
  // disparariam requisições repetidas.
  const curtindoRef = useRef(false);
  const [processandoCurtida, setProcessandoCurtida] = useState(false);

  // Estados para edição
  const [editando, setEditando] = useState(false);
  const [textoTablatura, setTextoTablatura] = useState('');
  const [salvando, setSalvando] = useState(false);
  // Conteúdo já salvo nesta sessão (o objeto `tab` que veio na navegação não
  // é atualizado após um save). Serve de referência pra saber se há
  // alterações não salvas depois de salvar e reentrar em edição.
  const [conteudoSalvoLocal, setConteudoSalvoLocal] = useState(null);

  // Modo tela cheia da área da tablatura (mesma ideia do "maximizar" das
  // Partes Ativas na tela de montar tablatura).
  const [tablaturaMaximizada, setTablaturaMaximizada] = useState(false);

  // Fonte dos dados: o que veio na navegação, ou o que foi buscado pelo id da URL.
  const tab = tabRecebida || tabCarregada;

  // Fallback e Mapeamento
  const tabData = {
    id: tab?.id || null,
    usuario_id: tab?.usuario_id || null,
    criador: tab?.autor_tab || tab?.usuarios?.nome || "João da Gaita",
    musica: tab?.nome_musica || tab?.musicas?.nome || "Hallelujah",
    autorMusica: tab?.autor_musica || tab?.musicas?.autor || "Leonard Cohen",
    midiUtilizado: tab?.midi_utilizado || tab?.arquivos_midi?.arquivo_midi || "Sem MIDI",
    tomGaita: tab?.tom_gaita || tab?.layouts_gaita?.tom || "C",
    tipoGaita: tab?.tipo_gaita || tab?.layouts_gaita?.tipo || "Diatônica",
    dataCriacao: tab?.created_at
      ? new Date(tab.created_at).toLocaleDateString()
      : (tab?.data ? new Date(tab.data).toLocaleDateString() : "01/01/2026"),
    conteudoOriginal: tab?.conteudo || tab?.tablatura || `
+5   -5   -5   -5   -5   +5
That Da-vid played and it

  +5     -4    -4
Pleased the Lord
    `
  };

  const isOwner = usuario && tabData.usuario_id && usuario.id === tabData.usuario_id;

  // Referência "verdadeira" do conteúdo (o último salvo nesta sessão, ou o
  // que veio na navegação) e flag de alterações não salvas em edição.
  const conteudoBase = conteudoSalvoLocal ?? tabData.conteudoOriginal;
  const temAlteracoesNaoSalvas = editando && textoTablatura !== conteudoBase;

  // Quando aberto por link (?id=), busca a tablatura no banco. O estado de
  // "carregando" já nasce true pelo useState acima nesse cenário.
  useEffect(() => {
    if (tabRecebida || !idDaUrl) return;
    let ativo = true;
    buscarTablaturaPorId(idDaUrl)
      .then(({ data }) => { if (ativo) setTabCarregada(data || null); })
      .finally(() => { if (ativo) setCarregandoPorId(false); });
    return () => { ativo = false; };
  }, [idDaUrl, tabRecebida]);

  // Deixa a URL como link compartilhável (?id=<id>) mesmo quando a tela foi
  // aberta pela navegação interna (que passa a tablatura pelo state, sem id
  // na URL). Assim, copiar a URL da barra já compartilha corretamente.
  // Usa replaceState pra não recarregar nem perder o state atual.
  useEffect(() => {
    const id = tabData.id;
    if (!id) return;
    const jaTem = new URLSearchParams(window.location.search).get('id');
    if (jaTem === String(id)) return;
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}?id=${id}`
    );
  }, [tabData.id]);

  useEffect(() => {
    if (!editando) setTextoTablatura(conteudoBase);
  }, [conteudoBase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Esc fecha o modo tela cheia da tablatura.
  useEffect(() => {
    if (!tablaturaMaximizada) return;
    const onKey = (e) => { if (e.key === 'Escape') setTablaturaMaximizada(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tablaturaMaximizada]);

  // Conteúdo da tablatura (edição ou leitura), reaproveitado no card normal
  // e no overlay de tela cheia.
  const conteudoTablatura = editando ? (
    <textarea
      value={textoTablatura}
      onChange={(e) => setTextoTablatura(e.target.value)}
      style={{
        flex: 1,
        padding: '20px',
        border: 'none',
        outline: 'none',
        backgroundColor: 'transparent', // fundo transparente (herda o amarelado)
        fontFamily: 'monospace',
        fontSize: 'clamp(13px, 3.5vw, 18px)',
        resize: 'none',
        lineHeight: '1.6',
        color: 'var(--color-text-main)'
      }}
    />
  ) : (
    <div
      style={{
        flex: 1,
        padding: '20px',
        overflowY: 'auto',
        // Em coluna estreita, a tablatura rola na horizontal (mantendo o
        // alinhamento nota/letra) em vez de quebrar linha. No desktop segue
        // com o pre-wrap de sempre.
        overflowX: isStacked ? 'auto' : 'visible'
      }}
    >
      <TablaturaView conteudo={textoTablatura} nowrap={isStacked} />
    </div>
  );

  const btnIconeStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    padding: 0,
    backgroundColor: 'var(--color-border-alt)',
    color: 'var(--color-text-muted)',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    flexShrink: 0
  };

  // Busca o status de curtida e o total atualizado no banco ao carregar
  useEffect(() => {
    const carregarCurtidas = async () => {
      if (!tabData.id) return;

      // Busca total de curtidas reais
      const { count } = await contarCurtidas(tabData.id);

      setTotalCurtidas(count || 0);

      // Checa se o usuário atual curtiu
      if (usuario) {
        const { data } = await usuarioCurtiu({ tablaturaId: tabData.id, usuarioId: usuario.id });

        setCurtido(Boolean(data));
      } else {
        setCurtido(false);
      }
    };

    carregarCurtidas();
  }, [usuario, tabData.id]);

  const handleCurtida = async () => {
    if (!usuario) {
      // Não empurra pro login direto: o usuário decide se vai fazer login
      // agora ou se fecha o popup (✕) e continua onde estava.
      showConfirm('Você precisa estar logado para curtir esta tablatura.', {
        title: 'Entrar na conta',
        type: 'info',
        confirmLabel: 'Fazer login',
        onConfirm: () => {
          closeModal();
          navigateAnimated('/login', { expand: true });
        }
      });
      return;
    }

    if (!tabData.id) return;

    // Uma operação por vez: cliques enquanto a anterior ainda está no ar são
    // ignorados. É isso que impede o contador de subir (ou descer) várias
    // vezes com cliques rápidos.
    if (curtindoRef.current) return;
    curtindoRef.current = true;
    setProcessandoCurtida(true);

    const iaCurtir = !curtido;

    try {
      const { error } = iaCurtir
        ? await adicionarCurtida({ usuarioId: usuario.id, tablaturaId: tabData.id })
        : await removerCurtida({ usuarioId: usuario.id, tablaturaId: tabData.id });

      if (error) throw error;

      setCurtido(iaCurtir);

      // O número exibido vem sempre da contagem real do banco, nunca de um
      // "prev ± 1" local (que era o que permitia acumular curtidas).
      const { count } = await contarCurtidas(tabData.id);
      if (typeof count === 'number') setTotalCurtidas(count);
    } catch (error) {
      console.error("Erro ao curtir:", error);
    } finally {
      curtindoRef.current = false;
      setProcessandoCurtida(false);
    }
  };

  // Retorna true se salvou. `silencioso` pula o alerta de sucesso (usado no
  // fluxo "Salvar e sair", onde logo em seguida a tela navega pra fora).
  const handleSalvarEdicao = async ({ silencioso = false } = {}) => {
    if (!textoTablatura.trim()) {
      showAlert("A tablatura não pode estar vazia.");
      return false;
    }

    setSalvando(true);
    const { error } = await atualizarTextoTablatura({ id: tabData.id, tablatura: textoTablatura });

    setSalvando(false);

    if (error) {
      console.error("Erro ao salvar:", error);
      showAlert("Erro ao salvar alterações.");
      return false;
    }

    setEditando(false);
    setConteudoSalvoLocal(textoTablatura);
    if (!silencioso) showAlert("Tablatura atualizada com sucesso!");
    return true;
  };

  // ═══════════ GUARDA DE SAÍDA DURANTE A EDIÇÃO ═══════════
  // Quando o dono está editando a própria tablatura e tem alterações não
  // salvas, qualquer tentativa de sair — título "HarmonicaTabs", chip de
  // perfil, botão de login, o ✕ "voltar aos resultados", o Voltar do
  // navegador e recarregar/fechar a aba — abre um diálogo com três opções:
  // "Salvar e sair", "Descartar alterações" e "Cancelar".
  const guardaEdicaoDesarmadaRef = useRef(false); // saída intencional em curso
  const sentinelaEdicaoRef = useRef(false);       // sentinela nossa está no histórico?
  const ignorarPopRef = useRef(false);            // próximo popstate é nosso (ignorar)
  const temAlteracoesRef = useRef(false);
  useEffect(() => { temAlteracoesRef.current = temAlteracoesNaoSalvas; }, [temAlteracoesNaoSalvas]);

  // Abre o diálogo de saída; `aoSair` executa a navegação de fato.
  const abrirDialogoSaidaEdicao = (aoSair) => {
    showConfirm('Você tem alterações não salvas nesta tablatura.', {
      title: 'Sair da edição?',
      type: 'info',
      confirmLabel: 'Salvar e sair',
      secondaryLabel: 'Descartar alterações',
      onConfirm: async () => {
        const ok = await handleSalvarEdicao({ silencioso: true });
        if (!ok) return; // erro já avisado; permanece na edição
        closeModal();
        aoSair();
      },
      onSecondary: () => {
        closeModal();
        setTextoTablatura(conteudoBase);
        setEditando(false);
        aoSair();
      }
    });
  };

  // Descarta a sentinela do histórico (se houver) e só então navega, pra não
  // sobrar uma entrada duplicada de VisualizarTabs acessível pelo Voltar.
  const sairDescartandoSentinela = (aoSair) => {
    guardaEdicaoDesarmadaRef.current = true;
    if (sentinelaEdicaoRef.current && window.history.state === null) {
      sentinelaEdicaoRef.current = false;
      ignorarPopRef.current = true;
      window.history.go(-1);          // remove a sentinela (mesma URL, sem re-render)
      setTimeout(aoSair, 0);
    } else {
      aoSair();
    }
  };

  // Envolve uma navegação de saída: pergunta antes se há alterações não salvas.
  const sairComGuardaEdicao = (aoSair) => {
    if (!temAlteracoesNaoSalvas || guardaEdicaoDesarmadaRef.current) {
      aoSair();
      return;
    }
    abrirDialogoSaidaEdicao(() => sairDescartandoSentinela(aoSair));
  };

  // Vai no lugar de `navigateAnimated` no TopBar (título / perfil / login).
  const navegarComGuardaEdicao = (path, opts) =>
    sairComGuardaEdicao(() => navigateAnimated(path, opts));

  // Mantém uma entrada-sentinela no histórico enquanto há alterações não
  // salvas, pra poder interceptar o botão Voltar do navegador.
  useEffect(() => {
    if (guardaEdicaoDesarmadaRef.current) return;

    if (temAlteracoesNaoSalvas && !sentinelaEdicaoRef.current) {
      window.history.pushState(null, '', window.location.href);
      sentinelaEdicaoRef.current = true;
    } else if (!temAlteracoesNaoSalvas && sentinelaEdicaoRef.current) {
      // Salvou/descartou ficando na tela: descarta a sentinela.
      sentinelaEdicaoRef.current = false;
      ignorarPopRef.current = true;
      window.history.back();
    }
  }, [temAlteracoesNaoSalvas]);

  useEffect(() => {
    const onPopState = () => {
      if (ignorarPopRef.current) { ignorarPopRef.current = false; return; }
      if (guardaEdicaoDesarmadaRef.current || !temAlteracoesRef.current) return;
      // Voltou com alterações não salvas: repõe a sentinela e abre o diálogo.
      window.history.pushState(null, '', window.location.href);
      sentinelaEdicaoRef.current = true;
      abrirDialogoSaidaEdicao(() => {
        guardaEdicaoDesarmadaRef.current = true;
        window.history.go(-2); // sentinela reposta + a própria entrada
      });
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (guardaEdicaoDesarmadaRef.current || !temAlteracoesRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  const handleExcluir = async () => {
    showConfirm('Tem certeza que deseja excluir esta tablatura? Essa ação não pode ser desfeita.', {
      title: 'Excluir tablatura',
      type: 'warning',
      onConfirm: async () => {
        try {
          const { error } = await excluirTablatura(tabData.id);

          if (error) throw error;

          showAlert("Tablatura excluída com sucesso!");
          sairDescartandoSentinela(() => navigateAnimated('/', { expand: false }));
        } catch (error) {
          console.error("Erro ao excluir:", error);
          showAlert("Ocorreu um erro ao excluir a tablatura.");
        }
      }
    });
  };

  // Copia um link direto pra esta tablatura (/VisualizarTabs?id=<id>).
  const handleCopiarLink = async () => {
    if (!tabData.id) {
      showAlert("Abra a tablatura pelo site (pela busca ou logo após criá-la) para gerar um link compartilhável.");
      return;
    }
    const link = `${window.location.origin}/VisualizarTabs?id=${tabData.id}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        const ta = document.createElement('textarea');
        ta.value = link;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      setLinkCopiado(true);
      setTimeout(() => setLinkCopiado(false), 2000);
    } catch {
      showAlert(`Não consegui copiar automaticamente. Link:\n${link}`);
    }
  };

  // Monta os dados de exportação: título, lista de detalhes disponíveis,
  // conteúdo das notas e um nome de arquivo.
  const montarConteudoExport = () => {
    const SEM_VALOR = ['', 'Sem MIDI', 'Nenhum', 'N/A', '-'];
    const detalhes = [];
    const add = (rotulo, valor) => {
      const v = (valor ?? '').toString().trim();
      if (v && !SEM_VALOR.includes(v)) detalhes.push({ rotulo, valor: v });
    };

    add('Autor da Música', tabData.autorMusica);
    add('Autor da Tab', tabData.criador);
    add('MIDI Utilizado', tabData.midiUtilizado);
    if ((tabData.tomGaita || '').trim() || (tabData.tipoGaita || '').trim()) {
      detalhes.push({ rotulo: 'Tom / Tipo', valor: `Gaita ${tabData.tomGaita || '?'} (${tabData.tipoGaita || '?'})` });
    }
    add('Data de Criação', tabData.dataCriacao);

    const nomeBase = `${tabData.musica || 'tablatura'}${tabData.criador ? ' - ' + tabData.criador : ''}`
      .replace(/[^\p{L}\p{N}_ -]/gu, '')
      .trim()
      .replace(/\s+/g, '_') || 'tablatura';

    return {
      titulo: tabData.musica || 'Tablatura',
      detalhes,
      notas: (textoTablatura || '').replace(/\r\n/g, '\n').trim(),
      nomeBase
    };
  };

  // Exporta como .pdf usando a impressão do navegador: monta uma página
  // limpa num iframe oculto e dispara o print (o usuário escolhe
  // "Salvar como PDF" no diálogo). Sem dependência externa.
  const handleExportarPdf = () => {
    const { titulo, detalhes, notas, nomeBase } = montarConteudoExport();
    const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

    // Mesmo esquema da tela: linha de notas em destaque (negrito) e linha de
    // letra com uma leve transparência.
    const linhasTab = notas
      .split('\n')
      .map((l) => {
        if (l.trim() === '') return '<div class="linha">&nbsp;</div>';
        const classe = pareceLinhaDeNotas(l) ? 'nota' : 'letra';
        return `<div class="linha ${classe}">${esc(l)}</div>`;
      })
      .join('');

    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(nomeBase)}</title>
<style>
  @page { margin: 20mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; margin: 0; }
  h1 { font-size: 20pt; margin: 0 0 6pt; }
  hr { border: 0; border-top: 1pt solid #000; margin: 10pt 0; }
  .detalhes p { margin: 2pt 0; font-size: 11pt; }
  .tab { font-family: "Courier New", Courier, monospace; font-size: 12.5pt; line-height: 1.55; }
  .tab .linha { white-space: pre-wrap; word-break: break-word; }
  .tab .nota { font-weight: bold; }
  .tab .letra { opacity: 0.78; }
</style></head><body>
  <h1>${esc(titulo)}</h1>
  <hr>
  <div class="detalhes">${detalhes.map((d) => `<p><strong>${esc(d.rotulo)}:</strong> ${esc(d.valor)}</p>`).join('')}</div>
  <hr>
  <div class="tab">${linhasTab}</div>
</body></html>`;

    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    iframe.onload = () => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } finally {
        setTimeout(() => iframe.remove(), 1000);
      }
    };
    iframe.srcdoc = html;
    document.body.appendChild(iframe);
  };

  // Aberto por link (?id=): tela de carregando (tempo mínimo) e de "não encontrada",
  // pra não cair no fallback de exemplo nem piscar.
  if (idDaUrl && !tabRecebida && (carregandoTabMin || !tabCarregada)) {
    return (
      <div style={{
        position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'var(--color-bg-page)', color: 'var(--color-text-muted)',
        fontFamily: 'Arial, sans-serif', fontSize: '18px'
      }}>
        <TopBar expanded={expanded} navigateAnimated={navigateAnimated} />
        {carregandoTabMin
          ? <>Carregando tablatura<span style={{ display: 'inline-block', width: '1.4em', textAlign: 'left' }}>{pontinhos}</span></>
          : 'Tablatura não encontrada.'}
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'var(--color-bg-page)',
        fontFamily: 'Arial, sans-serif',
        display: 'flex',
        // Abaixo de BP_STACK as duas colunas (tablatura / info) empilham e a
        // própria página passa a rolar, em vez do split 50/50 sem scroll.
        flexDirection: isStacked ? 'column' : 'row',
        overflowY: isStacked ? 'auto' : 'hidden',
        overflowX: 'hidden'
      }}
    >
      <CustomModal
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        onConfirm={modalConfig.onConfirm}
        confirmLabel={modalConfig.confirmLabel}
        onSecondary={modalConfig.onSecondary}
        secondaryLabel={modalConfig.secondaryLabel}
        onClose={closeModal}
      />
      {/* navegarComGuardaEdicao: título / perfil / login pedem "Salvar e sair /
          Descartar" se houver edição não salva. */}
      <TopBar expanded={expanded} navigateAnimated={navegarComGuardaEdicao} />
      {/* COLUNA DA ESQUERDA (Texto da Tablatura) */}
      {/* Espaçamentos referenciados na barra de menu: 20px do topo (respiro
          embaixo da barra, já embutido no TOPBAR_CLEARANCE), 20px das bordas
          e da base, 20px entre os dois retângulos (10 + 10 nas laterais
          internas). */}
      <div
        style={{
          width: isStacked ? '100%' : '50%',
          height: isStacked ? 'auto' : '100%',
          display: 'flex',
          justifyContent: isStacked ? 'center' : 'flex-end',
          alignItems: 'center',
          padding: '20px',
          paddingTop: `${TOPBAR_CLEARANCE}px`,
          paddingRight: isStacked ? '20px' : '10px',
          boxSizing: 'border-box',
          backgroundColor: 'var(--color-bg-page)',
          ...fadeStyle(contentVisible)
        }}
      >
        <div style={{
          width: '100%',
          height: isStacked ? 'auto' : '100%',
          minHeight: isStacked ? '60vh' : undefined,
          maxWidth: '820px',
          backgroundColor: 'var(--color-bg-paper)',
          borderRadius: '16px',
          border: 'var(--border-width-base) solid var(--color-border-paper)',
          boxShadow: '0 10px 30px var(--shadow-card-soft)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden' // para garantir que o conteúdo não vaze
        }}>
          {/* Cabeçalho enxuto: só o botão de maximizar no canto */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 10px 0' }}>
            <button
              type="button"
              onClick={() => setTablaturaMaximizada(true)}
              style={btnIconeStyle}
              title="Maximizar tablatura"
              aria-label="Maximizar tablatura"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            </button>
          </div>
          {/* Quando maximizado, o conteúdo vai pro overlay (evita textarea/estado duplicado) */}
          {!tablaturaMaximizada && conteudoTablatura}
        </div>
      </div>

      {/* COLUNA DA DIREITA (Card de Informações e Ações) */}
      <div
        style={{
          width: isStacked ? '100%' : '50%',
          height: isStacked ? 'auto' : '100%',
          display: 'flex',
          justifyContent: isStacked ? 'center' : 'flex-start',
          alignItems: 'center',
          padding: '20px',
          paddingTop: isStacked ? '20px' : `${TOPBAR_CLEARANCE}px`,
          paddingLeft: isStacked ? '20px' : '10px',
          boxSizing: 'border-box',
          backgroundColor: 'var(--color-bg-page)',
          overflow: 'hidden',
          ...fadeStyle(contentVisible)
        }}
      >
        {/* O card tem altura fixa e rola por dentro (mesmo padrão do card da
            esquerda e da tela de Criar Tabs) — o scroll fica dentro do
            retângulo arredondado, não o retângulo dentro de um scroll. */}
        <div style={{
          width: '100%',
          height: isStacked ? 'auto' : '100%',
          maxWidth: '620px',
          padding: 'clamp(20px, 4vw, 28px) clamp(20px, 5vw, 32px)',
          borderRadius: '24px',
          boxShadow: '0 15px 40px var(--shadow-card)',
          backgroundColor: 'var(--color-bg-card)',
          boxSizing: 'border-box',
          overflowY: 'auto'
        }}>

          {/* Topo do Card - Informações. Grid de 3 colunas (espaçador | título |
              ✕) pra manter o título centralizado no card e o ✕ encostado na
              direita, sem um sobrepor o outro. O ✕ volta pra tela de resultados
              (mesmo efeito do botão Voltar do navegador) e só aparece quando se
              chegou aqui por uma busca. */}
          <div style={{ display: 'grid', gridTemplateColumns: '38px 1fr 38px', alignItems: 'start', gap: '12px', margin: '0 0 10px 0' }}>
            <span aria-hidden="true" />

            <h2 style={{ margin: 0, color: 'var(--color-primary)', fontSize: 'clamp(24px, 6vw, 36px)', textAlign: 'center', minWidth: 0, overflowWrap: 'anywhere' }}>
              {tabData.musica}
            </h2>

            {veioDosResultados ? (
              <button
                type="button"
                onClick={() => sairComGuardaEdicao(voltarAosResultados)}
                title="Voltar aos resultados da busca"
                aria-label="Voltar aos resultados da busca"
                style={{
                  justifySelf: 'end',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '38px',
                  height: '38px',
                  marginTop: '4px',
                  fontSize: '18px',
                  lineHeight: 1,
                  background: 'none',
                  color: 'var(--color-text-muted)',
                  border: 'var(--border-width-base) solid var(--color-border)',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  transition: '0.2s'
                }}
                onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.color = 'var(--color-primary)'; }}
                onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-text-muted)'; }}
              >
                ✕
              </button>
            ) : (
              <span aria-hidden="true" />
            )}
          </div>
          <hr style={{ border: 'none', borderTop: '2px solid var(--color-border-divider-alt)', marginBottom: '20px' }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '16px', color: 'var(--color-text-secondary)' }}>
            <p style={{ margin: 0 }}><strong>Autor da Música:</strong> {tabData.autorMusica}</p>
            <p style={{ margin: 0 }}><strong>Autor da Tab:</strong> {tabData.criador}</p>
            <p style={{ margin: 0 }}><strong>MIDI Utilizado:</strong> {tabData.midiUtilizado}</p>
            <p style={{ margin: 0 }}><strong>Tom / Tipo:</strong> Gaita {tabData.tomGaita} ({tabData.tipoGaita})</p>
            <p style={{ margin: 0 }}><strong>Data de Criação:</strong> {tabData.dataCriacao}</p>
          </div>

          <hr style={{ border: 'none', borderTop: '2px solid var(--color-border-divider-alt)', margin: '30px 0' }} />

          {/* Base do Card - Ações */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>

            {/* Botão de Curtida */}
            <button
              onClick={handleCurtida}
              disabled={processandoCurtida}
              style={{
                padding: '16px',
                backgroundColor: curtido ? 'var(--color-bg-liked)' : 'var(--color-bg-not-liked)',
                color: curtido ? 'var(--color-text-success)' : 'var(--color-text-main)',
                border: curtido ? '2px solid var(--color-border-liked)' : '2px solid var(--color-border)',
                // Sem cursor "wait" nem mudança de opacidade: a trava contra
                // cliques repetidos é o `disabled` + `curtindoRef`, que
                // engolem o clique extra em silêncio, sem feedback visual.
                cursor: 'pointer',
                fontSize: '18px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                borderRadius: '14px',
                transition: '0.2s ease'
              }}
            >
              {curtido ? '💚 Curtido' : '🤍 Curtir'}
              <span style={{ backgroundColor: curtido ? 'var(--color-bg-liked-badge)' : 'var(--color-border-alt)', padding: '4px 10px', borderRadius: '20px', fontSize: '14px' }}>
                {totalCurtidas}
              </span>
            </button>

            {/* Compartilhar e Exportar lado a lado, cada um com metade do espaço
                (empilham quando não cabem os dois na largura). */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                onClick={handleCopiarLink}
                style={{
                  flex: '1 1 140px',
                  minWidth: 0,
                  padding: '14px',
                  backgroundColor: linkCopiado ? 'var(--color-bg-liked)' : 'transparent',
                  color: linkCopiado ? 'var(--color-text-success)' : 'var(--color-text-main)',
                  border: `2px solid ${linkCopiado ? 'var(--color-border-liked)' : 'var(--color-border)'}`,
                  cursor: 'pointer',
                  fontSize: '15px',
                  fontWeight: 'bold',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: '0.2s'
                }}
              >
                {linkCopiado ? '✅ Link copiado!' : '🔗 Compartilhar'}
              </button>

              <button
                onClick={handleExportarPdf}
                style={{
                  flex: '1 1 140px',
                  minWidth: 0,
                  padding: '14px',
                  backgroundColor: 'transparent',
                  color: 'var(--color-text-main)',
                  border: '2px solid var(--color-border)',
                  cursor: 'pointer',
                  fontSize: '15px',
                  fontWeight: 'bold',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: '0.2s'
                }}
              >
                📄 Exportar
              </button>
            </div>

            {/* Controles do Dono da Tablatura */}
            {isOwner && (
              <>
                {editando ? (
                  <button
                    onClick={() => handleSalvarEdicao()}
                    disabled={salvando}
                    style={{
                      padding: '14px',
                      backgroundColor: 'var(--color-success)',
                      color: 'var(--color-text-on-primary)',
                      border: 'none',
                      cursor: salvando ? 'not-allowed' : 'pointer',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      borderRadius: '12px',
                      boxShadow: '0 4px 12px var(--shadow-button-success)'
                    }}
                  >
                    {salvando ? 'Salvando...' : '💾 Salvar alterações'}
                  </button>
                ) : (
                  <button
                    onClick={() => setEditando(true)}
                    style={{
                      padding: '14px',
                      backgroundColor: 'var(--color-warning)',
                      color: 'var(--color-text-on-warning)',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      borderRadius: '12px',
                      boxShadow: '0 4px 12px var(--shadow-button-warning)'
                    }}
                  >
                    ✏️ Editar Tablatura
                  </button>
                )}

                <button
                  onClick={handleExcluir}
                  style={{
                    padding: '14px',
                    backgroundColor: 'transparent',
                    color: 'var(--color-danger-strong)',
                    border: '2px solid var(--color-danger-strong)',
                    cursor: 'pointer',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    borderRadius: '12px',
                    transition: '0.2s'
                  }}
                  onMouseEnter={(e) => { e.target.style.backgroundColor = 'var(--color-danger-strong)'; e.target.style.color = 'var(--color-text-on-primary)'; }}
                  onMouseLeave={(e) => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = 'var(--color-danger-strong)'; }}
                >
                  🗑️ Deletar Tablatura
                </button>
              </>
            )}

          </div>
        </div>
      </div>

      {/* Modo tela cheia da tablatura */}
      {tablaturaMaximizada && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 500,
            backgroundColor: 'var(--color-bg-paper)',
            display: 'flex',
            flexDirection: 'column',
            padding: '24px 30px',
            boxSizing: 'border-box'
          }}
        >
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
            marginBottom: '16px',
            paddingBottom: '16px',
            borderBottom: 'var(--border-width-base) solid var(--color-border-paper)'
          }}>
            <h2 style={{ margin: 0, color: 'var(--color-primary)', fontSize: '24px', fontWeight: 'bold' }}>
              {tabData.musica}
            </h2>
            <button
              type="button"
              onClick={() => setTablaturaMaximizada(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                backgroundColor: 'var(--color-border-alt)',
                color: 'var(--color-text-muted)',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '13px'
              }}
              title="Voltar ao tamanho padrão"
              aria-label="Minimizar tablatura"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 14 10 14 10 20" />
                <polyline points="20 10 14 10 14 4" />
                <line x1="14" y1="10" x2="21" y2="3" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
              Minimizar
            </button>
          </div>

          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {conteudoTablatura}
          </div>
        </div>
      )}
    </div>
  );
}