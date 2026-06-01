import {
  SIZE_OPTIONS,
  buildTryOnUrl,
  fetchCatalogData,
  normalizeSelection,
  readSelectionFromQuery,
} from "/static/js/catalog.js";
const state = {
  products: [],
  selectedProductIndex: 0,
  selectedVariantIndex: 0,
  selectedSize: "M",
  cartCount: 0,
  toastTimer: null,
};

const SEASON_TRENDS = [
  {
    key: "spring",
    season: "Xuân",
    title: "Layer Mỏng",
    note: "Áo khoác nhẹ, màu sáng, hợp những ngày chuyển mùa.",
    image: "/season/spring/download%20(10).png",
    width: 736,
    height: 1308,
  },
  {
    key: "spring",
    season: "Xuân",
    title: "Pastel Dạo Phố",
    note: "Phom mềm và gam sạch để phối cùng denim hoặc chân váy.",
    image: "/season/spring/download%20(9).png",
    width: 675,
    height: 1200,
  },
  {
    key: "summer",
    season: "Hè",
    title: "Vacation Fit",
    note: "Mỏng, thoáng, dễ lên hình cho lịch đi chơi cuối tuần.",
    image: "/season/summer/download%20(7).png",
    width: 675,
    height: 1200,
  },
  {
    key: "summer",
    season: "Hè",
    title: "Clean Summer",
    note: "Tối giản nhưng đủ nổi bật khi thử với nhiều dáng người.",
    image: "/season/summer/download%20(8).png",
    width: 655,
    height: 1164,
  },
  {
    key: "fall",
    season: "Thu",
    title: "Soft Fall",
    note: "Tông ấm, layer vừa phải, hợp ảnh lookbook nhẹ nhàng.",
    image: "/season/fall/Fall%20outfit%20(not%20mine%F0%9F%98%8A).png",
    width: 736,
    height: 1308,
  },
  {
    key: "fall",
    season: "Thu",
    title: "Neutral Street",
    note: "Nâu, xám và denim tạo cảm giác trưởng thành hơn.",
    image: "/season/fall/z7888108544403_707af33382445a241a2da4ce47e6a9dc.jpg",
    width: 2000,
    height: 2000,
  },
  {
    key: "winter",
    season: "Đông",
    title: "Warm Minimal",
    note: "Đồ ấm vừa vặn, dễ kiểm tra phom khi thử ảo.",
    image: "/season/winter/Look%20book.png",
    width: 736,
    height: 1104,
  },
  {
    key: "winter",
    season: "Đông",
    title: "Cozy Soft Girl",
    note: "Layer dày hơn nhưng vẫn giữ dáng gọn trong ảnh.",
    image: "/season/winter/_winter_simple_comfy_Aesthetic_soft%20girl_%20pretty_Outfit%20inspo_warm_.png",
    width: 736,
    height: 1308,
  },
];

function getCurrentSeasonKey(date = new Date()) {
  const month = date.getMonth() + 1;
  if (month >= 3 && month <= 5) {
    return "spring";
  }
  if (month >= 6 && month <= 8) {
    return "summer";
  }
  if (month >= 9 && month <= 11) {
    return "fall";
  }
  return "winter";
}

function getCurrentSeasonTrends() {
  const currentSeasonKey = getCurrentSeasonKey();
  return SEASON_TRENDS.filter((trend) => trend.key === currentSeasonKey);
}

const heroImage = document.getElementById("shopHeroImage");
const heroMeta = document.getElementById("shopHeroMeta");
const productGrid = document.getElementById("productGrid");
const seasonTrendRow = document.getElementById("seasonTrendRow");
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

function previewSeasonTrend(trend) {
  heroImage.src = trend.image;
  heroImage.alt = `${trend.title} - ${trend.season}`;
  heroMeta.textContent = `${trend.season} / ${trend.title}`;
  showToast(`${trend.title} đã được đưa lên khung xem trước.`);
}

function addSeasonTrendToCart(trend) {
  state.cartCount += 1;
  updateCartBadge();
  heroImage.src = trend.image;
  heroImage.alt = `${trend.title} - ${trend.season}`;
  heroMeta.textContent = `${trend.season} / ${trend.title}`;
  showToast(`${trend.title} mùa ${trend.season} đã vào giỏ hàng.`);
}

function renderSeasonTrends() {
  seasonTrendRow.replaceChildren();
  const currentSeasonTrends = getCurrentSeasonTrends();

  currentSeasonTrends.forEach((trend) => {
    const card = document.createElement("article");
    const image = document.createElement("img");
    const badge = document.createElement("span");
    const copy = document.createElement("span");
    const title = document.createElement("strong");
    const note = document.createElement("small");
    const actions = document.createElement("span");
    const previewButton = document.createElement("button");
    const cartButton = document.createElement("button");

    card.className = "season-card";

    image.src = trend.image;
    image.alt = `${trend.title} mùa ${trend.season}`;
    image.width = trend.width;
    image.height = trend.height;
    image.loading = "lazy";
    image.decoding = "async";

    badge.className = "season-badge";
    badge.textContent = trend.season;

    copy.className = "season-card-copy";
    title.textContent = trend.title;
    note.textContent = trend.note;

    actions.className = "season-card-actions";
    previewButton.type = "button";
    previewButton.className = "season-action secondary";
    previewButton.textContent = "Xem nhanh";
    previewButton.setAttribute("aria-label", `Xem nhanh ${trend.title} mùa ${trend.season}`);
    previewButton.addEventListener("click", () => previewSeasonTrend(trend));

    cartButton.type = "button";
    cartButton.className = "season-action primary";
    cartButton.textContent = "Thêm vào giỏ";
    cartButton.setAttribute("aria-label", `Thêm ${trend.title} mùa ${trend.season} vào giỏ hàng`);
    cartButton.addEventListener("click", () => addSeasonTrendToCart(trend));

    copy.append(title, note);
    actions.append(previewButton, cartButton);
    card.append(image, badge, copy, actions);
    seasonTrendRow.appendChild(card);
  });
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
  const data = await fetchCatalogData();
  state.products = data.products;

  const selection = normalizeSelection(state.products, readSelectionFromQuery());
  state.selectedProductIndex = selection.productIndex;
  state.selectedVariantIndex = selection.variantIndex;
  state.selectedSize = selection.size;

  renderCollection();
  renderSeasonTrends();
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
