Pelo código e pelo print, o sintoma mais provável é este: o export captura o canvas do editor com `html-to-image`, mas o canvas ao vivo está com `transform: scale(...)`. A captura força `transform: none` só no elemento raiz; com isso, dependendo do estado do diálogo/escala e dos filhos SVG/tabela, a imagem pode sair como fundo branco e depois a faixa Harald é adicionada por cima no PPT. Além disso, o fallback de export renderiza o slide em um host oculto sem aguardar explicitamente o React terminar de montar os blocos de bridge/tabela, o que pode gerar uma captura antes dos componentes estarem prontos.

Plano de correção:

1. Tornar o canvas capturável em tamanho real
   - Registrar/capturar um elemento sem `transform` aplicado diretamente.
   - Manter o zoom visual no editor, mas impedir que o elemento usado no export dependa da escala do viewport.

2. Melhorar o snapshot do export
   - Antes de chamar `toPng`, remover temporariamente sombras/outline/transform do canvas capturado e restaurar depois.
   - Aguardar fontes, frames de renderização e dimensões reais do DOM/SVG antes da captura.
   - Adicionar validação: se a captura vier vazia/quase branca, usar fallback confiável em vez de gerar PPT branco.

3. Corrigir fallback off-screen
   - Renderizar o fallback em um container visível para layout (`opacity: 0`, mas com tamanho real e sem `z-index: -1`).
   - Usar `flushSync`/espera de frames para garantir que bridge, tabela e dados dos stores montem antes da captura.
   - Incluir o rodapé Harald dentro da captura fallback só uma vez, evitando divergência visual.

4. Garantir fidelidade de bridge e tabela
   - Revisar `BridgeRender` e `TableRender` para evitar dependência de scroll/overflow que o `html-to-image` possa recortar.
   - Ajustar wrappers para SVG/tabela renderizarem com largura/altura estáveis no export.

5. Validar no navegador
   - Testar export de um slide personalizado contendo bridge + tabela.
   - Confirmar que o PPT exportado contém os blocos visíveis, não apenas a faixa Harald.