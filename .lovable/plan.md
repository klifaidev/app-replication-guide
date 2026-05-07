# Slides (Beta) — Slide "Personalizado" com canvas livre

## Objetivo
Adicionar um novo tipo no catálogo chamado **Personalizado**, onde o usuário monta o slide arrastando, redimensionando e configurando blocos (bridge, tabela, título, texto, KPI, imagem) num canvas WYSIWYG. A exportação para PPTX reproduz fielmente o layout desenhado, já incluindo a faixa vermelha + logo Harald no rodapé (igual aos slides padrão de Bridge e Budget Evolutivo).

## Como vai funcionar (visão do usuário)

1. Em `/slides`, no catálogo aparece um novo card **Personalizado** (ícone `LayoutTemplate`).
2. Ao adicionar, abre um editor de canvas em proporção 16:9 (1920×1080 internos, escalado).
3. **Paleta de blocos** lateral com:
   - **Título** (texto grande, fonte/tamanho/cor)
   - **Texto** (parágrafo livre)
   - **KPI** (valor + label, formato moeda/%/número)
   - **Bridge PVM** (mini gráfico waterfall — usa filtros + período base/comp do bloco)
   - **Tabela dinâmica** (linhas/colunas/medidas configuráveis, igual ao Pivot Studio mas embutido)
   - **Imagem** (upload local, base64)
   - **Forma** (retângulo/linha com cor)
4. Cada bloco é **arrastável** (drag) e **redimensionável** (resize handles nos cantos), com snap-to-grid de 10px e guias de alinhamento.
5. Painel direito (**Inspector**) mostra propriedades do bloco selecionado: posição (x/y/w/h), z-index, e props específicas do tipo.
6. **Faixa Harald** (faixa vermelha + logo no rodapé) já vem renderizada no canvas como camada fixa, não editável — confirmando o que será exportado.
7. Toolbar do editor: desfazer/refazer, duplicar, deletar, trazer pra frente / mandar pra trás, snap on/off.
8. O slide personalizado entra no fluxo normal do `SlidesFlow`: aparece na lista, pode ser reordenado, salvo em preset, e exportado junto com os demais.

## Exportação fiel
- Coordenadas do canvas (1920×1080) convertidas para polegadas (10" × 5.625") na hora de gerar com `pptxgenjs`.
- Cada bloco vira o equivalente nativo no PPTX:
  - Título/Texto → `slide.addText`
  - KPI → dois `addText` (valor grande + label)
  - Imagem → `addImage` base64
  - Forma → `addShape`
  - Tabela → `addTable` com mesma config de medidas
  - Bridge → render para PNG via `html-to-image` no momento do export e inserido como `addImage` (fidelidade total ao visual do app, sem reimplementar waterfall em PPT)
- A faixa Harald é desenhada por uma função utilitária já existente (reuso da lógica de Bridge/Budget) — garantindo paridade visual.

## Estrutura técnica

### Novos arquivos
- `src/lib/customSlide.ts` — tipos `CustomBlock` (union: title/text/kpi/bridge/table/image/shape), `CustomSlideConfig`, helpers de coordenada e defaults.
- `src/components/pricing/custom/CustomSlideEditor.tsx` — canvas WYSIWYG (drag + resize com `react-rnd` ou implementação manual leve).
- `src/components/pricing/custom/BlockPalette.tsx` — paleta lateral de blocos.
- `src/components/pricing/custom/BlockInspector.tsx` — painel de propriedades.
- `src/components/pricing/custom/blocks/` — renderers de cada tipo de bloco (Title/Text/Kpi/Bridge/Table/Image/Shape).
- `src/lib/exportCustomSlide.ts` — função `addCustomSlide(pptx, cfg, ctx)` que constrói o slide PPTX.

### Arquivos editados
- `src/lib/slidesFlow.ts` — novo `SlideKind = "custom"`, entry no `SLIDE_CATALOG`, `defaultItem("custom")`, `itemToFlow` chamando `addCustomSlide`, `isItemReady`.
- `src/lib/exportPpt.ts` — extrair função `addHaraldFooter(slide)` (faixa vermelha + logo) reutilizável; usar em Bridge/Budget e no Custom.
- `src/pages/SlidesBeta.tsx` — registrar tipo no catálogo e roteamento de editor (quando o item selecionado for `custom`, mostrar `CustomSlideEditor` no lugar do form padrão).
- `src/components/pricing/SlidePreview.tsx` — case `custom` que renderiza o canvas em modo somente-leitura escalado.

### Dependências
- `react-rnd` para drag + resize (leve, mantida, ~30kb). Alternativa: implementação manual com pointer events se preferir zero dependência — recomendo `react-rnd` pela velocidade.

## Faixa Harald
A função `addHaraldFooter(slide, pptx)` será extraída do código atual de Bridge/Budget (mesma logo base64 + retângulo vermelho `#C8102E` + posição rodapé). Usada em **todos** os slides personalizados automaticamente, sem o usuário precisar configurar.

## Escopo desta entrega
Vou implementar tudo descrito acima em uma única passada. A tabela embutida no Custom usa um subconjunto simplificado do Pivot (escolha de linhas/colunas/medidas via popovers — não o Studio inteiro) para manter o escopo gerenciável. O Bridge embutido reaproveita o componente `Waterfall` existente e exporta como imagem renderizada.

## O que NÃO está incluído
- Templates pré-prontos de slide personalizado (pode vir num próximo passo via "Salvar como template").
- Animações entre blocos no PPTX.
- Edição colaborativa em tempo real.
