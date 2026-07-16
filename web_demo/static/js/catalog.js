const PRODUCT_BLUEPRINTS = [
  {
    name: "Polo Dáng Gọn",
    price: "890.000đ",
    description: "Cổ polo đứng phom, chất vải mịn và bảng màu dễ mặc cho lịch làm việc lẫn cuối tuần.",
    labels: ["Mực", "Sương", "Đá"],
    colors: ["#243651", "#d9ddd8", "#d8d0c3"],
  },
  {
    name: "Áo Thun Họa Tiết",
    price: "720.000đ",
    description: "Áo thun mềm, hình in sắc nét, tạo điểm nhấn vừa đủ cho những set đồ tối giản.",
    labels: ["Đỏ", "Đen", "Nắng"],
    colors: ["#ef4a4a", "#1c1c1c", "#ffd963"],
  },
  {
    name: "Sơ Mi Studio",
    price: "1.050.000đ",
    description: "Sơ mi tối giản, đường cắt sạch và đủ trang trọng để mặc đi làm hoặc gặp khách.",
    labels: ["Mây", "Navy", "Đất"],
    colors: ["#f2eee8", "#334766", "#c98f7d"],
  },
  {
    name: "Áo Dệt Mềm",
    price: "980.000đ",
    description: "Chất dệt mềm, rủ nhẹ trên cơ thể và giữ cảm giác ấm áp mà không nặng nề.",
    labels: ["Rêu", "Hồng", "Phấn"],
    colors: ["#78896b", "#d89ea3", "#f4f1ea"],
  },
];

export const SIZE_OPTIONS = ["XS", "S", "M", "L", "XL"];

function chunk(items, size) {
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

export function prettifyAssetName(name) {
  const withoutExtension = name.replace(/\.[a-z0-9]+$/i, "");
  const cleaned = withoutExtension.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return name;
  }
  return cleaned.replace(/\b\w/g, (char) => char.toUpperCase());
}

export function buildProducts(clothItems) {
  return chunk(clothItems, 3)
    .slice(0, PRODUCT_BLUEPRINTS.length)
    .map((group, productIndex) => {
      const blueprint = PRODUCT_BLUEPRINTS[productIndex];
      return {
        id: `product-${productIndex}`,
        name: blueprint.name,
        price: blueprint.price,
        description: blueprint.description,
        variants: group.map((item, variantIndex) => ({
          id: `${productIndex}-${variantIndex}`,
          label: blueprint.labels[variantIndex] || `Phiên bản ${variantIndex + 1}`,
          color: blueprint.colors[variantIndex] || "#d9d3c7",
          url: item.url,
          name: item.name,
        })),
      };
    });
}

export async function fetchCatalogData() {
  const [examplesResponse, configResponse] = await Promise.all([fetch("/api/examples"), fetch("/api/config")]);

  if (!examplesResponse.ok || !configResponse.ok) {
    throw new Error("Không tải được dữ liệu mẫu.");
  }

  const payload = await examplesResponse.json();
  const config = await configResponse.json();

  return {
    heroImage: payload.heroImage || "",
    humans: payload.human || [],
    products: buildProducts(payload.cloth || []),
    defaultRemoteUrl: config.defaultRemoteUrl || "",
  };
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

export function buildTryOnUrl({ productIndex = 0, variantIndex = 0, size = "M" } = {}) {
  const params = new URLSearchParams({
    product: String(productIndex),
    variant: String(variantIndex),
    size,
  });
  return `/try-on?${params.toString()}`;
}
