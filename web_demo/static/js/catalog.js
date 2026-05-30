export const SIZE_OPTIONS = ["XS", "S", "M", "L", "XL"];
export const REMOTE_URL_STORAGE_KEY = "idm_vton_remote_url";

export function prettifyAssetName(name) {
  const withoutExtension = name.replace(/\.[a-z0-9]+$/i, "");
  const cleaned = withoutExtension.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return name;
  }
  return cleaned.replace(/\b\w/g, (char) => char.toUpperCase());
}

export async function fetchCatalogData() {
  const [catalogResponse, configResponse] = await Promise.all([fetch("/api/catalog"), fetch("/api/config")]);

  if (!catalogResponse.ok || !configResponse.ok) {
    throw new Error("Không tải được dữ liệu catalog.");
  }

  const payload = await catalogResponse.json();
  const config = await configResponse.json();

  return {
    heroImage: payload.heroImage || "",
    humans: payload.human || [],
    products: payload.products || [],
    defaultRemoteUrl: config.defaultRemoteUrl || "",
  };
}

export async function fetchTrendData({ season = "summer", region = "VN", limit = 8 } = {}) {
  const params = new URLSearchParams({
    season,
    region,
    limit: String(limit),
  });
  const response = await fetch(`/api/trends?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Không tải được dữ liệu xu hướng.");
  }
  return response.json();
}

export function readSelectionFromQuery(search = window.location.search) {
  const params = new URLSearchParams(search);
  return {
    productIndex: Number.parseInt(params.get("product") || "0", 10),
    variantIndex: Number.parseInt(params.get("variant") || "0", 10),
    size: params.get("size") || "M",
  };
}

export function normalizeSelection(products, selection = {}) {
  const safeProductIndex = Number.isInteger(selection.productIndex) ? selection.productIndex : 0;
  const boundedProductIndex = Math.max(0, Math.min(safeProductIndex, products.length - 1));
  const product = products[boundedProductIndex] || null;
  const safeVariantIndex = Number.isInteger(selection.variantIndex) ? selection.variantIndex : 0;
  const boundedVariantIndex = product
    ? Math.max(0, Math.min(safeVariantIndex, product.variants.length - 1))
    : 0;
  const size = SIZE_OPTIONS.includes(selection.size) ? selection.size : "M";

  return {
    productIndex: boundedProductIndex,
    variantIndex: boundedVariantIndex,
    size,
  };
}

export function buildTryOnUrl({ productIndex = 0, variantIndex = 0, size = "M", trendId = "" } = {}) {
  const params = new URLSearchParams({
    product: String(productIndex),
    variant: String(variantIndex),
    size,
  });
  if (trendId) {
    params.set("trend", trendId);
  }
  return `/try-on?${params.toString()}`;
}
