import { useMemo } from 'react';

import { pareceLinhaDeNotas } from '../utils/tablatura';

// Exibição da tablatura: mantém o texto exatamente como está, só pinta as
// linhas de notas numa cor e as linhas de letra em outra, pra dar pra
// separar as duas coisas de relance. Não mexe no conteúdo salvo nem no
// modo de edição.
export default function TablaturaView({ conteudo }) {
  const linhas = useMemo(
    () => (conteudo ?? '').replace(/\r\n/g, '\n').split('\n'),
    [conteudo]
  );

  return (
    <div style={{ fontFamily: 'monospace', fontSize: '18px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
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
