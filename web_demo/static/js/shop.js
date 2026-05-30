import {
  SIZE_OPTIONS,
  buildTryOnUrl,
  fetchCatalogData,
  fetchTrendData,
  normalizeSelection,
  readSelectionFromQuery,
} from "/static/js/catalog.js";
const state = {
  products: [],
  trends: [],
  selectedProductIndex: 0,
  selectedVariantIndex: 0,
  selectedSize: "M",
  selectedTrendId: "",
  cartCount: 0,
  toastTimer: null,
};

const heroImage = document.getElementById("shopHeroImage");
const heroMeta = document.getElementById("shopHeroMeta");
const trendGrid = document.getElementById("trendGrid");
const trendUpdated = document.getElementById("trendUpdated");
const productGrid = document.getElementById("productGrid");
const pdpImage = document.getElementById("pdpImage");
const pdpProductName = document.getElementById("pdpProductName");
const pdpProductPrice = document.getElementById("pdpProductPrice");
const pdpProductDescription = document.getElementById("pdpProductDescription");
const pdpSwatches = document.getElementById("pdpSwatches");
const pageSizeOptions = document.getElementById("pageSizeOptions");
const pdpAddToCartButton = document.getElementById("pdpAddToCartButton");
const openTryOnButton = document.getElementById("openTryOnButton");
const openTryOnButtonSecondary = document.getElementById("openTryOnButtonSecondary");
const headerTryOnButton = document.getElementById("headerTryOnButton");
const headerCartButton = document.getElementById("headerCartButton");
const cartCountBadge = document.getElementById("cartCountBadge");
const cartToast = document.getElementById("cartToast");

function getSelectedProduct() {
  return state.products[state.selectedProductIndex] || null;
}

function getSelectedVariant() {
  const product = getSelectedProduct();
  return product?.variants[state.selectedVariantIndex] || null;
}

function updateHero() {
  const product = getSelectedProduct();
  const variant = getSelectedVariant();
  if (!product || !variant) {
    return;
  }

  heroImage.src = variant.url;
  heroMeta.textContent = `${product.name} / ${variant.label} / size ${state.selectedSize}`;
}

function showToast(message) {
  cartToast.textContent = message;
  cartToast.classList.add("is-visible");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => {
    cartToast.classList.remove("is-visible");
  }, 2600);
}

function updateCartBadge() {
  cartCountBadge.textContent = String(state.cartCount);
}

function addToCart() {
  const product = getSelectedProduct();
  const variant = getSelectedVariant();
  if (!product || !variant) {
    return;
  }

  state.cartCount += 1;
  updateCartBadge();
  showToast(`${product.name} / ${variant.label} / size ${state.selectedSize} đã vào giỏ hàng.`);
}

function goToTryOn() {
  window.location.href = buildTryOnUrl({
    productIndex: state.selectedProductIndex,
    variantIndex: state.selectedVariantIndex,
    size: state.selectedSize,
    trendId: state.selectedTrendId,
  });
}

function renderSizeOptions() {
  pageSizeOptions.replaceChildren();

  SIZE_OPTIONS.forEach((size) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "size-chip";
    button.classList.toggle("is-selected", size === state.selectedSize);
    button.setAttribute("aria-pressed", size === state.selectedSize ? "true" : "false");
    button.setAttribute("aria-label", `Chọn size ${size}`);
    button.textContent = size;
    button.addEventListener("click", () => {
      state.selectedSize = size;
      renderSizeOptions();
      updateHero();
    });
    pageSizeOptions.appendChild(button);
  });
}

function renderSwatches() {
  const product = getSelectedProduct();
  if (!product) {
    return;
  }

  pdpSwatches.replaceChildren();

  product.variants.forEach((variant, variantIndex) => {
    const button = document.createElement("button");
    const dot = document.createElement("span");
    const label = document.createElement("span");

    button.type = "button";
    button.className = "swatch";
    button.classList.toggle("is-selected", variantIndex === state.selectedVariantIndex);
    button.setAttribute("aria-pressed", variantIndex === state.selectedVariantIndex ? "true" : "false");
    button.setAttribute("aria-label", `Chọn phiên bản ${variant.label}`);

    dot.className = "swatch-dot";
    dot.style.background = variant.color;

    label.className = "swatch-label";
    label.textContent = variant.label;

    button.append(dot, label);
    button.addEventListener("click", () => setSelectedVariant(variantIndex));

    pdpSwatches.appendChild(button);
  });
}

function renderCollection() {
  productGrid.replaceChildren();

  state.products.forEach((product, index) => {
    const button = document.createElement("button");
    const imageWrap = document.createElement("div");
    const image = document.createElement("img");
    const badge = document.createElement("span");
    const copy = document.createElement("div");
    const name = document.createElement("h3");
    const description = document.createElement("p");
    const price = document.createElement("strong");

    button.type = "button";
    button.className = "product-card";
    button.classList.toggle("is-selected", index === state.selectedProductIndex);
    button.setAttribute("aria-pressed", index === state.selectedProductIndex ? "true" : "false");
    button.setAttribute("aria-label", `Xem ${product.name}`);

    imageWrap.className = "product-card-image";
    image.src = product.variants[0].url;
    image.alt = product.name;
    image.width = 480;
    image.height = 600;
    image.loading = "lazy";
    image.decoding = "async";

    badge.className = "product-card-badge";
    badge.textContent = "Hỗ trợ thử ảo";

    copy.className = "product-card-copy";
    name.textContent = product.name;
    description.textContent = product.description;
    price.textContent = product.price;

    imageWrap.append(image, badge);
    copy.append(name, description, price);
    button.append(imageWrap, copy);

    button.addEventListener("click", () => {
      setSelectedProduct(index, 0, true);
    });

    productGrid.appendChild(button);
  });
}

function findProductIndexForTrend(trend) {
  const text = [trend.title, trend.summary, ...(trend.keywords || [])].join(" ").toLowerCase();
  const rules = [
    { terms: ["graphic", "họa tiết", "street", "thun"], productTerms: ["thun", "họa tiết"] },
    { terms: ["office", "sơ mi", "smart", "capsule"], productTerms: ["sơ mi", "studio"] },
    { terms: ["linen", "resort", "polo"], productTerms: ["polo"] },
    { terms: ["dệt", "knit", "mềm"], productTerms: ["dệt", "mềm"] },
  ];

  for (const rule of rules) {
    if (!rule.terms.some((term) => text.includes(term))) {
      continue;
    }
    const matchedIndex = state.products.findIndex((product) => {
      const productText = `${product.name} ${product.description}`.toLowerCase();
      return rule.productTerms.some((term) => productText.includes(term));
    });
    if (matchedIndex >= 0) {
      return matchedIndex;
    }
  }

  return 0;
}

function renderTrendCards() {
  trendGrid.replaceChildren();

  if (!state.trends.length) {
    const empty = document.createElement("p");
    empty.className = "trend-empty";
    empty.textContent = "Chưa có style trend được publish cho mùa này.";
    trendGrid.appendChild(empty);
    trendUpdated.textContent = "Dữ liệu trend đang chờ cập nhật.";
    return;
  }

  state.trends.forEach((trend) => {
    const card = document.createElement("article");
    const score = document.createElement("span");
    const title = document.createElement("h3");
    const summary = document.createElement("p");
    const keywordRow = document.createElement("div");
    const colorRow = document.createElement("div");
    const footer = document.createElement("div");
    const source = document.createElement("small");
    const button = document.createElement("button");

    card.className = "trend-card";
    score.className = "trend-score";
    score.textContent = `${Math.round(Number(trend.score || 0))}`;
    title.textContent = trend.title;
    summary.textContent = trend.summary;

    keywordRow.className = "trend-keywords";
    (trend.keywords || []).slice(0, 4).forEach((keyword) => {
      const chip = document.createElement("span");
      chip.textContent = keyword;
      keywordRow.appendChild(chip);
    });

    colorRow.className = "trend-colors";
    (trend.colors || []).slice(0, 4).forEach((color) => {
      const swatch = document.createElement("span");
      swatch.title = color.label || color.value;
      swatch.style.background = color.value || "#d9d3c7";
      colorRow.appendChild(swatch);
    });

    footer.className = "trend-footer";
    source.textContent = trend.sourceLabel || "Trend source";
    button.type = "button";
    button.className = "trend-action";
    button.textContent = "Thử style này";
    button.addEventListener("click", () => {
      const productIndex = findProductIndexForTrend(trend);
      state.selectedTrendId = trend.id || "";
      setSelectedProduct(productIndex, 0, true);
      showToast(`${trend.title} đang gợi ý ${state.products[productIndex]?.name || "sản phẩm đầu tiên"}.`);
    });

    footer.append(source, button);
    card.append(score, title, summary, keywordRow, colorRow, footer);
    trendGrid.appendChild(card);
  });

  trendUpdated.textContent = `${state.trends.length} style đã publish cho mùa hè / VN.`;
}

function renderPdp() {
  const product = getSelectedProduct();
  const variant = getSelectedVariant();
  if (!product || !variant) {
    return;
  }

  pdpImage.src = variant.url;
  pdpProductName.textContent = product.name;
  pdpProductPrice.textContent = product.price;
  pdpProductDescription.textContent = product.description;

  Array.from(productGrid.children).forEach((card, index) => {
    card.classList.toggle("is-selected", index === state.selectedProductIndex);
  });

  renderSwatches();
  updateHero();
}

function setSelectedVariant(variantIndex) {
  const product = getSelectedProduct();
  if (!product || !product.variants[variantIndex]) {
    return;
  }

  state.selectedVariantIndex = variantIndex;
  renderPdp();
}

function setSelectedProduct(productIndex, variantIndex = 0, scrollToPdp = false) {
  if (!state.products[productIndex]) {
    return;
  }

  state.selectedProductIndex = productIndex;
  state.selectedVariantIndex = Math.min(variantIndex, state.products[productIndex].variants.length - 1);
  renderCollection();
  renderPdp();

  if (scrollToPdp) {
    document.getElementById("pdp")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

async function boot() {
  const [data, trendPayload] = await Promise.all([
    fetchCatalogData(),
    fetchTrendData({ season: "summer", region: "VN", limit: 6 }).catch((error) => {
      console.error(error);
      return { items: [] };
    }),
  ]);
  state.products = data.products;
  state.trends = trendPayload.items || [];

  const selection = normalizeSelection(state.products, readSelectionFromQuery());
  state.selectedProductIndex = selection.productIndex;
  state.selectedVariantIndex = selection.variantIndex;
  state.selectedSize = selection.size;

  renderTrendCards();
  renderCollection();
  renderSizeOptions();
  renderPdp();
  updateCartBadge();
}

pdpAddToCartButton.addEventListener("click", addToCart);
openTryOnButton.addEventListener("click", goToTryOn);
openTryOnButtonSecondary.addEventListener("click", goToTryOn);
headerTryOnButton.addEventListener("click", goToTryOn);
headerCartButton.addEventListener("click", () => {
  showToast(`Giỏ hàng hiện có ${state.cartCount} sản phẩm.`);
});

boot().catch((error) => {
  console.error(error);
  showToast(`Không tải được dữ liệu shop: ${error.message}`);
});
