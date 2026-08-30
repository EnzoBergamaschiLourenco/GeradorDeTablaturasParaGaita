import { useMemo } from 'react';

import { pareceLinhaDeNotas } from '../utils/tablatura';

// Exibição da tablatura: mantém o texto exatamente como está, só pinta as
// linhas de notas numa cor e as linhas de letra em outra, pra dar pra
// separar as duas coisas de relance. Não mexe no conteúdo salvo nem no
// modo de edição.
// - nowrap: usa white-space:pre (não quebra linha) — para telas estreitas,
//   onde quem chama envolve num container com overflowX:auto, preservando o
//   alinhamento nota/letra. Sem a prop, mantém o pre-wrap de sempre.
// - fontSize: fluido por padrão (= 18px no desktop, menor em telas pequenas).
export default function TablaturaView({ conteudo, nowrap = false, fontSize = 'clamp(13px, 3.5vw, 18px)' }) {
  const linhas = useMemo(
    () => (conteudo ?? '').replace(/\r\n/g, '\n').split('\n'),
    [conteudo]
  );

  return (
    <div style={{ fontFamily: 'monospace', fontSize, lineHeight: '1.6', whiteSpace: nowrap ? 'pre' : 'pre-wrap' }}>
      {linhas.map((linha, i) => {
        const vazia = linha.trim() === '';
        const ehNota = !vazia && pareceLinhaDeNotas(linha);

        return (
          <div
            key={i}
            style={{
              // Notas na cor normal do texto (preto/branco conforme o tema);
              // a letra fica na mesma cor mas com uma leve transparência, pra
              // dar pra separar as duas de relance.
              color: 'var(--color-text-main)',
              fontWeight: ehNota ? 700 : 400,
              opacity: ehNota ? 1 : 0.6
            }}
          >
            {vazia ? ' ' : linha}
          </div>
        );
      })}
    </div>
  );
}
