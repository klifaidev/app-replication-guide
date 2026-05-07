## Slide Personalizado — correção do export + upgrade

### 1. Bug do export em branco (causa raiz)

Hoje `exportCustomSlide.tsx` cria um `host` off-screen, monta um React root novo e usa `html-to-image` para tirar um PNG. O problema:

- Os blocos `bridge`, `table` e `kpi` dependem dos stores Zustand (`usePricing`, `useBudget`) e do tema/CSS do app. Renderizados num root isolado fora da árvore principal, o CSS Tailwind ainda chega, mas o `html-to-image` em `position: fixed; left: -99999px` frequentemente captura antes do `<Waterfall>` (Recharts) medir tamanho — gerando um SVG 0×0 → imagem em branco.
- O `await requestAnimationFrame` + `setTimeout(120)` não é suficiente para Recharts (precisa de `ResizeObserver` que não dispara fora da viewport).
- Resultado: o PNG enviado ao PPT vem transparente/branco, e só a faixa Harald (adicionada depois como `addImage` nativo) aparece.

**Fix:** capturar o canvas **que já está montado e visível dentro do editor** (via `canvasRef` que já existe no `CustomSlideEditor`, mas hoje não é passado pelo fluxo de export). Passos:

1. Manter um registry `customSlideCanvasRefs: Map<slideId, HTMLDivElement>` em `slidesFlow.ts` populado pelo `CustomSlideEditor` quando montado.
2. No export, antes de chamar `addCustomSlide`, abrir o editor fullscreen daquele slide (ou um host visível temporário renderizando o slide em escala 1:1 dentro do `body` com `opacity:0` mas dimensões reais e mesmo provider tree).
3. Usar `html-to-image` com `pixelRatio: 2`, esperar `await new Promise(r => setTimeout(r, 600))` + duplo `requestAnimationFrame` para Recharts/imagens carregarem.
4. Para Bridge especificamente, renderizar o `<Waterfall>` com `width`/`height` fixos (não 9999) usando o tamanho real do bloco × scale para garantir layout correto.
5. Fallback: se o snapshot retornar dimensões 0, refazer com `dom-to-image-more` (mais tolerante a SVG).

### 2. KPI dinâmico

Estender `KpiBlock` em `customSlide.ts`:

```ts
interface KpiBlock extends BaseBlock {
  kind: "kpi";
  label: string;
  // novo:
  source: "manual" | "dynamic";
  manualValue?: string;          // usado quando source = "manual"
  measure?: KpiMeasureId;        // rol | volume | cm | mb | cv | frete | comissao | cmPct | mbPct | precoMedio
  period?: { mode: "fy"|"month"|"all"; value: string|null };
  filters?: Filters;
  format?: "currency"|"percent"|"tons"|"number"|"auto";
  // visual existente:
  valueSize: number;
  color: string;
}
```

- Catálogo `KPI_MEASURES` reutilizando os mesmos campos do DRE (`rol_real`, `cm_real`, `mb_real`, `volumeKg_real`, `custoVariavel_real`, `frete_real`, `comissao_real`) + derivados (`%CM`, `%MB`, `Preço médio = ROL/Volume`).
- `KpiRender` lê `usePricing`/`useBudget`, aplica `applyFilters` + filtro de período, agrega e formata via `formatBRL`/`%`.
- Inspector ganha um toggle "Manual / Dinâmico". Em Dinâmico mostra: select de medida, modo (FY/Mês/Geral), select de período, mini-painel de filtros (marca, canal, categoria, mercado — usa o `MultiSelectFilter` já existente), formato.
- Compatibilidade: KPIs existentes (sem `source`) viram `manual` por padrão.

### 3. Novos blocos

- **`chart`** — gráfico de linha ou barra ao longo do tempo (eixo X = período, Y = medida escolhida). Quebra opcional por dimensão (marca, canal). Usa Recharts.
- **`topSku`** — lista ranqueada dos top N SKUs (ou top clientes / marcas) por uma medida, com filtros e período. Renderiza como tabela compacta (Posição · Nome · Valor · %total).

Adicionados a `CustomBlockKind`, `newBlock`, `BLOCK_LABELS`, `BlockRenderer` e ao exporter (entram no PNG capturado, sem trabalho extra no PPTX).

### 4. Snap / guias / atalhos

- Snap visual: ao arrastar/redimensionar, calcular linhas-guia (bordas e centros de outros blocos + centro do canvas) e desenhar overlay tracejado quando alinhamento ≤ 6px.
- Atalhos no editor (capturados em `keydown` quando o canvas tem foco):
  - `Delete` / `Backspace` → remover bloco selecionado
  - `Ctrl/Cmd+D` → duplicar
  - `Setas` → mover 1px (`Shift+Setas` → 10px)
  - `Ctrl/Cmd+]` / `[` → trazer pra frente / pra trás
  - `Esc` → desselecionar

### 5. Templates

- **Templates prontos** (built-in): "Capa", "KPIs + Bridge", "Tabela cheia", "3 KPIs + Top SKUs", "Bridge + Tabela lateral". Cada um é um `CustomSlideConfig` predefinido. Mostrados num menu "Modelo" no topo do editor; aplicar substitui blocos atuais (com confirmação).
- **Templates do usuário**: botão "Salvar como modelo" persiste o `CustomSlideConfig` atual no `localStorage` (`harald.customTemplates`) com nome. Lista de "Meus modelos" no mesmo menu, com renomear/excluir.

### 6. Estrutura de arquivos

**Editar**
- `src/lib/customSlide.ts` — novos campos KPI, novos kinds (`chart`, `topSku`), defaults.
- `src/components/pricing/custom/BlockRenderer.tsx` — renderers `KpiDynamic`, `Chart`, `TopSku`; KPI atualizado.
- `src/components/pricing/custom/CustomSlideEditor.tsx` — inspector dinâmico para KPI/Chart/TopSku, snap/guias, atalhos, menu de templates, registro do canvas no registry.
- `src/lib/exportCustomSlide.tsx` — captura do canvas montado (com fallback off-screen melhorado), espera correta de Recharts, fallback `dom-to-image-more`.
- `src/lib/slidesFlow.ts` — registry de refs do canvas custom; passar ref ao `addCustomSlide`.
- `src/pages/SlidesBeta.tsx` — registrar ref ao montar editor; entry de templates built-in.

**Criar**
- `src/lib/customTemplates.ts` — lista built-in + load/save de `localStorage`.
- `src/components/pricing/custom/blocks/ChartBlock.tsx`, `TopSkuBlock.tsx` (se ficar grande; senão inline em `BlockRenderer`).

### 7. Fora do escopo desta entrega
- Edição colaborativa, undo/redo global, animações no PPT.
- Sincronização de templates do usuário entre dispositivos (fica no `localStorage`).
