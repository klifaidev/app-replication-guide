// Bun consegue importar TS direto. Resolvemos os aliases manualmente via tsconfig-paths-like.
// Truque: preencher um shim do "@/assets/harald-footer.png" via Bun loader.
import { plugin } from "bun";

plugin({
  name: "alias-and-png",
  setup(build) {
    build.onResolve({ filter: /^@\// }, (args) => {
      const fs = require("node:fs");
      const path = require("node:path");
      const resolved = args.path.replace(/^@\//, "/dev-server/src/");
      return { path: resolved };
    });
    build.onLoad({ filter: /\.png$/ }, async (args) => {
      const fs = await import("node:fs/promises");
      const buf = await fs.readFile(args.path);
      return {
        exports: { default: `data:image/png;base64,${buf.toString("base64")}` },
        loader: "object",
      };
    });
  },
});

// Stub mínimo de PVMResult e PricingRow
import type { PVMResult } from "/dev-server/src/lib/analytics";
import type { PricingRow } from "/dev-server/src/lib/types";

// monkey-patch writeFile do pptxgenjs para escrever em /tmp
const PptxGenJS = (await import("pptxgenjs")).default;
const origWrite = PptxGenJS.prototype.writeFile;
PptxGenJS.prototype.writeFile = async function (opts: any) {
  const data = await this.write({ outputType: "nodebuffer" });
  const fs = await import("node:fs/promises");
  await fs.writeFile(`/tmp/${opts.fileName}`, data as any);
  return `/tmp/${opts.fileName}`;
};

const { exportBridgePvmPpt } = await import("/dev-server/src/lib/exportPpt");

// ---- Dados sintéticos -----------------------------------------------------
function makeRows(): PricingRow[] {
  const months = [
    [5, 2025], [6, 2025], [7, 2025], [8, 2025], [9, 2025],
    [10, 2025], [11, 2025], [12, 2025], [1, 2026], [2, 2026],
  ];
  const skus = ["SKU-A", "SKU-B", "SKU-C", "SKU-D"];
  const out: PricingRow[] = [];
  let seed = 1;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  for (const [mes, ano] of months) {
    for (const sku of skus) {
      const vol = 1500 + rnd() * 2000;
      const rolPerKg = 17 + rnd() * 5;
      const rol = vol * rolPerKg;
      const cv = vol * (13 + rnd() * 2);
      const mp = cv * 0.85;
      const emb = cv * 0.05;
      const cif = vol * (rnd() * 1.5);
      const frete = vol * (0.7 + rnd() * 0.3);
      const com = rol * 0.02;
      const cm = rol - cv - frete - com;
      out.push({
        periodo: `${String(mes).padStart(3, "0")}.${ano}`,
        mes, ano,
        fy: mes >= 4 ? `FY${String(ano).slice(-2)}/${String(ano + 1).slice(-2)}` : `FY${String(ano - 1).slice(-2)}/${String(ano).slice(-2)}`,
        fyNum: ano * 100,
        sku,
        rol, volumeKg: vol,
        cogs: cv, custoVariavel: cv, custoFixo: cif,
        margemBruta: rol - cv, contribMarginal: cm,
        frete, comissao: com,
        materiaPrima: mp, embalagem: emb, cif,
      });
    }
  }
  return out;
}

const rows = makeRows();
// Calcular um PVMResult sintético (usando o calcPVM real)
const { calcPVM } = await import("/dev-server/src/lib/analytics");
const result = calcPVM(rows, "cm", "005.2025", "002.2026", "month",
  { base: "mai/25", comp: "fev/26" });

console.log("Base:", result.base, "Atual:", result.current);
console.log("Δ V/P/C/F/Co/O:", result.volume, result.price, result.cost, result.freight, result.commission, result.others);

const filePath = await exportBridgePvmPpt(result, rows);
console.log("Wrote:", filePath);
