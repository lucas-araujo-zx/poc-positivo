import catalogo from "./catalogo.json";

export const catalog = catalogo;

export const CATEGORIES = {
  notebooks: "Notebooks",
  computadores: "Computadores",
};

export const GROUPS = [
  ["linha", "Linha"],
  ["processador", "Processadores"],
  ["sistema", "Sistema operacional"],
  ["armazenamento", "Armazenamento"],
  ["memoria", "Memória"],
  ["tela", "Tamanho da tela"],
  ["marca", "Marca"],
];

export const CANON = {
  memoria: ["32GB", "16GB", "8GB", "4GB"],
  armazenamento: ["512GB SSD", "256GB SSD", "512GB"],
  processador: [
    "Intel Core Ultra 5",
    "Intel Core i7",
    "Intel Core i5",
    "Intel Core i3",
    "AMD Ryzen 7",
    "AMD Ryzen 5 PRO",
    "AMD Ryzen 5",
  ],
  sistema: ["Windows 11 Pro", "Windows 11 Home", "Linux", "Shell EFI"],
  tela: ['16"', '15.6"', '14"', '23.8"', "N/A"],
  marca: ["Positivo", "Vaio"],
  linha: [
    "Copilot+ PC",
    "Vaio",
    "Positivo Master",
    "Positivo",
    "All in One",
    "Desktops",
    "Mini desktops",
  ],
};

const NOTEBOOK_ONLY = new Set([
  "Copilot+ PC",
  "Vaio",
  "Positivo",
  "Shell EFI",
  '14"',
  '15.6"',
  '16"',
  "32GB",
  "Intel Core Ultra 5",
  "AMD Ryzen 7",
  "AMD Ryzen 5",
]);

const COMPUTER_ONLY = new Set([
  "All in One",
  "Desktops",
  "Mini desktops",
  "AMD Ryzen 5 PRO",
  "4GB",
  '23.8"',
  "N/A",
]);

export function blankFilters() {
  return {
    linha: [],
    processador: [],
    sistema: [],
    armazenamento: [],
    memoria: [],
    tela: [],
    marca: [],
    precoMax: null,
  };
}

export function formatBrl(value) {
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function squash(value) {
  return String(value)
    .toLowerCase()
    .replace(/[”″"′']/g, "")
    .replace(/\s+/g, "");
}

export function canonical(key, raw) {
  if (raw == null || String(raw).trim() === "") return null;
  const list = CANON[key];
  if (!list) return null;
  const target = squash(raw);
  return list.find((item) => squash(item) === target) ?? null;
}

export function matches(product, filters) {
  for (const [key] of GROUPS) {
    const selected = filters[key] ?? [];
    if (selected.length === 0) continue;
    const value = product[key];
    const values = Array.isArray(value) ? value : [value];
    if (!selected.some((item) => values.includes(item))) return false;
  }
  if (filters.precoMax != null && product.precoPix > filters.precoMax) return false;
  return true;
}

export function visibleProducts(categoria, filters) {
  return catalog
    .filter((product) => product.categoria === categoria && matches(product, filters))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
}

export function facetOptions(categoria, key) {
  const present = new Set();
  for (const product of catalog) {
    if (product.categoria !== categoria) continue;
    const value = product[key];
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item) present.add(item);
    }
  }
  return CANON[key].filter((item) => present.has(item));
}

export function productBySlug(slug) {
  if (!slug) return null;
  const needle = String(slug).trim().toLowerCase();
  return (
    catalog.find((product) => product.slug.toLowerCase() === needle) ??
    catalog.find((product) => product.slug.toLowerCase().includes(needle)) ??
    catalog.find((product) => needle.includes(product.slug.toLowerCase())) ??
    catalog.find((product) => product.nome.toLowerCase() === needle) ??
    null
  );
}

export function categoryFromPath(pathname) {
  if (pathname.startsWith("/categoria/notebooks")) return "notebooks";
  if (pathname.startsWith("/categoria/computadores")) return "computadores";
  if (pathname.startsWith("/produto/")) {
    const slug = decodeURIComponent(pathname.split("/")[2] ?? "");
    return productBySlug(slug)?.categoria ?? null;
  }
  return null;
}

export function targetCategory(pathname, args) {
  const onList =
    pathname.startsWith("/categoria/notebooks") ||
    pathname.startsWith("/categoria/computadores");
  if (onList) return categoryFromPath(pathname);

  const values = GROUPS.map(([key]) => canonical(key, args?.[key])).filter(Boolean);
  if (values.some((value) => COMPUTER_ONLY.has(value))) return "computadores";
  if (values.some((value) => NOTEBOOK_ONLY.has(value))) return "notebooks";
  return categoryFromPath(pathname) ?? "notebooks";
}

export function cardOf(product) {
  return {
    nome: product.nome,
    preco_pix: formatBrl(product.precoPix),
    memoria: product.memoria,
    processador: product.processador,
    slug: product.slug,
  };
}

export function listPayload(categoria, filters) {
  const products = visibleProducts(categoria, filters);
  return {
    pagina: categoria,
    filtros: describeFilters(filters),
    total: products.length,
    produtos: products.slice(0, 6).map(cardOf),
  };
}

export function productPayload(product) {
  return {
    pagina: "produto",
    nome: product.nome,
    slug: product.slug,
    preco_pix: formatBrl(product.precoPix),
    parcelas: product.parcelas,
    especificacoes: product.especificacoes,
  };
}

export function describeFilters(filters) {
  const parts = [];
  for (const [key, label] of GROUPS) {
    const selected = filters[key] ?? [];
    if (selected.length) parts.push(`${label}: ${selected.join(", ")}`);
  }
  if (filters.precoMax != null) parts.push(`até ${formatBrl(filters.precoMax)}`);
  return parts.length ? parts.join("; ") : "nenhum";
}

export function contextText(pathname, filtersByCategory) {
  if (pathname.startsWith("/produto/")) {
    const product = productBySlug(decodeURIComponent(pathname.split("/")[2] ?? ""));
    if (!product) return "O cliente está numa página de produto que não existe nesta réplica.";
    const specs = product.especificacoes
      .map((item) => `${item.chave}: ${item.valor}`)
      .join("; ");
    return `O cliente está na ficha de ${product.nome}. Preço PIX a partir de ${formatBrl(product.precoPix)} (${product.parcelas}). Especificações: ${specs}`;
  }

  const categoria = categoryFromPath(pathname);
  if (!categoria) {
    return "O cliente está na página inicial da loja. Ainda não há lista filtrada na tela.";
  }

  const filters = filtersByCategory[categoria] ?? blankFilters();
  const payload = listPayload(categoria, filters);
  const linhas = payload.produtos
    .map((item) => `${item.nome} (${item.memoria}, ${item.processador}, ${item.preco_pix} no PIX)`)
    .join("; ");
  const vazio = payload.total === 0 ? " Nenhum produto corresponde aos filtros." : "";
  return `O cliente está na lista de ${CATEGORIES[categoria]}. Filtros ativos: ${payload.filtros}. Resultados: ${payload.total}.${vazio} Visíveis: ${linhas || "nenhum"}.`;
}

export function applyToolFilters(current, args) {
  const next = {
    ...current,
    linha: [...current.linha],
    processador: [...current.processador],
    sistema: [...current.sistema],
    armazenamento: [...current.armazenamento],
    memoria: [...current.memoria],
    tela: [...current.tela],
    marca: [...current.marca],
  };
  const avisos = [];
  const limpar = args?.limpar === true || args?.limpar === "true" || args?.limpar === 1;
  if (limpar) {
    next.linha = [];
    next.processador = [];
    next.sistema = [];
    next.armazenamento = [];
    next.memoria = [];
    next.tela = [];
    next.marca = [];
    next.precoMax = null;
  }

  for (const [key] of GROUPS) {
    if (args?.[key] == null) continue;
    const raw = args[key];
    const pieces = Array.isArray(raw) ? raw : String(raw).split(/[,;/|]/);
    if (pieces.every((piece) => String(piece).trim() === "")) continue;
    const values = [];
    const invalid = [];
    for (const piece of pieces) {
      const text = String(piece).trim();
      if (!text) continue;
      const value = canonical(key, text);
      if (!value) invalid.push(text);
      else if (!values.includes(value)) values.push(value);
    }
    if (invalid.length) avisos.push(`${key} inválido: use ${CANON[key].join(", ")}`);
    if (values.length) next[key] = values;
  }

  if (args?.preco_max != null && String(args.preco_max).trim() !== "") {
    const preco = Number(String(args.preco_max).replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(preco) && preco > 0) next.precoMax = preco;
    else avisos.push("preco_max inválido");
  }

  return { filters: next, avisos };
}
