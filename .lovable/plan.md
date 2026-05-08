## Objetivo

Resolver dois problemas no slide Personalizado:

1. **Título cortado à direita** quando exportado (a captura PNG está estourando ou o canvas excede a largura útil).
2. **Elementos não editáveis no PowerPoint** — hoje o slide vai como uma única imagem PNG. Quero que cada bloco vire um elemento nativo do PPTX (caixa de texto editável, tabela editável, forma, imagem) que possa ser movido, redimensionado e ter texto alterado direto no PowerPoint.

## Estratégia

Reescrever `src/lib/exportCustomSlide.tsx` para emitir **elementos nativos do pptxgenjs por bloco**, em vez de um único PNG. Isso resolve ambos os problemas: o título passa a ser uma caixa de texto real (sem corte por captura), e tudo fica editável.

Manter o sistema de coordenadas atual (1333×750 → 13.33"×7.5", divisor de 100).

## Mapeamento bloco → elemento PPTX

| Bloco | Elemento PPTX | Editável? |
|---|---|---|
| `title` | `slide.addText` (bold, cor, alinhamento, tamanho) | ✅ texto + caixa |
| `text` | `slide.addText` | ✅ texto + caixa |
| `kpi` | 1 `addShape` (rect arredondado de fundo) + 2 `addText` (label e valor calculado) | ✅ tudo |
| `shape` (rect) | `addShape` (rect/roundRect com fill e radius) | ✅ |
| `shape` (line) | `addShape` line | ✅ |
| `image` | `addImage` com data URL | ✅ (mover/redimensionar) |
| `table` | `slide.addTable` com linhas/colunas calculadas via `computePivot` (mesmas medidas/dims do editor) | ✅ tabela nativa, células editáveis |
| `chart` | `slide.addChart` (LINE ou BAR) com séries calculadas via `computeChartSeries` | ✅ gráfico nativo do PPT |
| `topSku` | `slide.addTable` com ranking calculado via `computeTopRanking` | ✅ tabela nativa |
| `bridge` | `slide.addChart` BAR empilhada (waterfall manual) usando dados do `calcPVM`. *Fallback*: se a montagem ficar ruim, capturar **apenas o bounding box do bloco** como PNG via host off-screen e inserir como imagem dimensionada — assim só a Bridge vira imagem, não o slide inteiro. | Parcial (gráfico nativo) ou imagem (fallback) |

Footer Harald continua como `addImage` no rodapé.

## Detalhes do título cortado

Hoje o título usa `w: 900, h: 70` em x=40, mas com `overflow: hidden` no DOM e `whiteSpace: nowrap` implícito quando vai pra captura escalada. Ao virar `addText` nativo, o PowerPoint controla wrap/auto-fit nativamente. Adicionalmente, ajustar default do título novo para `w: 1200` (margem segura ≈ 60 de cada lado).

## Cálculo dos dados no export

A função export precisa ler os stores Zustand (`usePricing.getState()`, `useBudget.getState()`) — fora de componentes — para alimentar tabela/chart/bridge/topSku/kpi sem montar React. Reusar:
- `computeKpiBlock` (já existe em `customKpi.ts`)
- `computePivot` + `buildUnifiedRows`
- `computeChartSeries`
- `computeTopRanking`
- `applyFilters` + `calcPVM` para Bridge

## Arquivos a editar

- `src/lib/exportCustomSlide.tsx` — reescrita completa: nova função `addCustomSlide` que itera blocos e mapeia cada um para chamadas nativas pptxgenjs. Remover dependência de `html-to-image`/`createRoot` para o caminho principal.
- `src/lib/customSlide.ts` — ajustar default do `TitleBlock` em `defaultCustomSlide` e `newBlock("title")` para `w: 1200` (evita corte mesmo na pré-visualização).
- (Opcional) `src/components/pricing/custom/CustomSlideEditor.tsx` — pequenos ajustes visuais se necessário, mas a captura ao vivo deixa de ser o caminho principal.

Não mexer em `BlockRenderer.tsx` (continua sendo a fonte da renderização visual no editor).

## Validação

1. Criar um slide com título longo + KPI + tabela + bridge.
2. Exportar PPT, abrir e confirmar:
   - Título inteiro visível, sem corte.
   - Clicar no título e editar texto.
   - Selecionar tabela e arrastar célula/redimensionar.
   - Mover blocos livremente.
3. Verificar que valores numéricos batem com o que o editor mostra.

## Não-objetivo

- Não vou redesenhar o editor.
- Não vou trocar pptxgenjs por outra lib.
- Bridge nativa pode ficar como gráfico de barras simplificado; se ficar visualmente ruim, usar fallback de imagem só para esse bloco.
