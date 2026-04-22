
## Resumo do App Analisado

**Pricing Analytics — Harald** é um dashboard de análise de pricing/lucratividade (mercado de chocolate B2B brasileiro), single-page HTML com tema **dark glassmorphism premium** (estilo Apple/Linear). Funciona 100% client-side: usuário faz upload de CSVs mensais exportados do Excel BR (separador `;`, decimal `,`), o app detecta meses, alerta duplicidades, e gera análises.

### Funcionalidades-chave
- **Upload inteligente**: CSV BR/internacional, detecção automática de encoding (UTF-8/Windows-1252), separador, e período fiscal (FY abr–mar). Detecta meses duplicados e pede confirmação antes de sobrescrever.
- **6 telas**: Início (filtros + boas-vindas), Visão Geral (KPIs + bubble + ABC + tabela canais), Bridge PVM (waterfall decompondo Volume/Preço/Custo/Mix entre 2 FYs), Canais, ABC Heróis & Ofensores (top 5 SKUs +/-), Tabela Detalhe (granular SKU×Cliente×Canal com sort/search), Upload/Bases.
- **Toggle de métrica global**: Margem Bruta ⇄ Contribuição Marginal (recalcula tudo).
- **Filtros**: chips de período no topbar (multi-seleção), e dropdowns por marca, canal, categoria, região etc.
- **Visuais**: waterfall SVG (PVM bridge), bubble chart (canais: mg% × share vol × lucro), ABC bars com heróis (verde) / ofensores (vermelho), KPI cards com glow.
- **Layout**: sidebar fixa esquerda com logo, navegação, badge de meses carregados, e toggle de métrica fixo no rodapé. Topbar com chips de período. Conteúdo central rolável.

---

## Plano de Replicação (React + Tailwind + shadcn)

### Stack & estrutura
- React + TS + Vite (já configurado), Tailwind, shadcn/ui, Recharts (substitui SVG manual quando útil), papaparse (parsing CSV robusto), Zustand para estado global.
- Sem backend — tudo client-side, dados vivem em memória + opcional persistência em `localStorage`.

### Design system (dark glassmorphism)
- Background gradiente escuro azulado (`#0a0a14` → `#14142a`), cards com `backdrop-blur` + borda `rgba(255,255,255,0.08)`, hover sutil.
- Acentos: azul `#3b82f6`, verde `#34d399`, vermelho `#f87171`, âmbar `#fbbf24`, roxo `#8b5cf6`.
- Tipografia leve (font-weight 300 em KPIs grandes), letterspacing negativo em títulos. Animações `fadeUp` nas trocas de view.
- Tudo via tokens HSL no `index.css` + `tailwind.config.ts`.

### Layout
- **Sidebar** (220px): logo 🍫 "Pricing Analytics · Harald", grupo "Dashboards" (Início, Visão Geral, Bridge PVM, Canais, ABC Heróis, Tabela Detalhe), grupo "Upload/Bases" com badge de contagem, toggle de métrica fixo no rodapé.
- **Topbar**: título da view + chips de períodos (Todos + um por mês carregado, multi-seleção).
- **Conteúdo**: rolável, usa cards "glass".

### Telas
1. **Início**: zona de upload destacada se vazio; senão mostra resumo + grid de filtros (marca, canal, categoria, subcategoria, SKU, região, mercado, sabor, tecnologia, faixa de peso).
2. **Visão Geral**: 4 KPI cards (ROL, Margem R$/%, Volume t, SKUs ativos) + bubble chart Canais + ABC Heróis/Ofensores side-by-side + tabela "Performance por Canal".
3. **Bridge PVM**: 2 selects de FY (base → comparação) + waterfall (Base, Volume, Preço, Custo, Mix, Atual) + 4 KPIs com efeitos. Mensagem se <2 FYs.
4. **Canais**: bubble grande + tabela detalhada com ROL/kg.
5. **ABC Heróis**: top 5 verdes + top 5 vermelhos (barras horizontais animadas) + ranking completo de SKUs.
6. **Tabela Detalhe**: search + tabela ordenável (sort por coluna), limita 300 linhas visíveis com indicador.
7. **Upload/Bases**: dropzone (drag&drop + click), barra de progresso, lista de meses carregados (cards com mês/ano + nº linhas), lista de arquivos com botão remover, botão "Limpar tudo", e guia de colunas esperadas.

### Lógica de dados
- Parser CSV: detecta `;` vs `,` e decimal BR/EN; mapeia colunas por nome normalizado (sem acento/espaço); filtra `ROL ≤ 0`; extrai período `005.2025` → mês/ano/FY.
- Estado global (Zustand): `allRows`, `loadedMonths`, `metric` ('cm'|'mb'), filtros, view atual, sort de tabela, seleções PVM.
- Funções derivadas: `filteredRows()`, `getKPIs()`, `aggCanal()`, `aggSku()`, `calcPVM(fyBase, fyComp)` (decomposição clássica Volume/Preço/Custo/Mix).
- Toast (sonner) para feedback de upload.

### Entregáveis
- Substituir `Index.tsx` pelo shell (sidebar + topbar + outlet).
- Componentes: `Sidebar`, `Topbar`, `KpiCard`, `GlassCard`, `Waterfall`, `BubbleChart`, `AbcBar`, `UploadZone`, `MonthCalendar`, `FilterGrid`, `DataTable`.
- Hooks: `useCsvParser`, `usePricingStore` (Zustand).
- Utilidades: `formatBRL`, `formatPct`, `parsePeriod`, `calcPVM`.

Resultado: réplica visual e funcional 1:1 do HTML enviado, em React, mantendo a estética glass dark e todo o pipeline analítico.
