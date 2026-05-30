import {
  REMOTE_URL_STORAGE_KEY,
  SIZE_OPTIONS,
  fetchCatalogData,
  fetchTrendData,
  normalizeSelection,
  prettifyAssetName,
  readSelectionFromQuery,
} from "/static/js/catalog.js";

const state = {
  products: [],
  trends: [],
  humans: [],
  catalogHeroImage: "",
  selectedProductIndex: 0,
  selectedVariantIndex: 0,
  selectedTrendId: "",
  selectedSize: "M",
  garmentMode: "shop",
  uploadedGarmentSource: null,
  humanSource: null,
  drawing: false,
  lastPoint: null,
  busy: false,
  hasResult: false,
  hasMaskStroke: false,
  selectedHumanTile: null,
  cartCount: 0,
  cameraStream: null,
  toastTimer: null,
  progressTimer: null,
  progressStartedAt: 0,
};

const tryonHeroImage = document.getElementById("tryonHeroImage");
const tryonHeroNote = document.getElementById("tryonHeroNote");
const selectedGarmentSourceLabel = document.getElementById("selectedGarmentSourceLabel");
const selectedGarmentTitle = document.getElementById("selectedGarmentTitle");
const garmentModeCaption = document.getElementById("garmentModeCaption");
const shopGarmentModeButton = document.getElementById("shopGarmentModeButton");
const uploadGarmentModeButton = document.getElementById("uploadGarmentModeButton");
const shopGarmentBlock = document.getElementById("shopGarmentBlock");
const uploadGarmentBlock = document.getElementById("uploadGarmentBlock");
const garmentPreviewFrame = document.getElementById("garmentPreviewFrame");
const garmentPreview = document.getElementById("garmentPreview");
const garmentDropzone = document.getElementById("garmentDropzone");
const garmentUploadPreview = document.getElementById("garmentUploadPreview");
const garmentInput = document.getElementById("garmentInput");
const uploadGarmentButton = document.getElementById("uploadGarmentButton");
const tryonProductList = document.getElementById("tryonProductList");
const tryonProductSwatches = document.getElementById("tryonProductSwatches");

const headerCartButton = document.getElementById("headerCartButton");
const cartCountBadge = document.getElementById("cartCountBadge");
const cartToast = document.getElementById("cartToast");
const modalSizeOptions = document.getElementById("modalSizeOptions");
const modalAddToCartButton = document.getElementById("modalAddToCartButton");
const loadingOverlay = document.getElementById("loadingOverlay");

const humanDropzone = document.getElementById("humanDropzone");
const humanInput = document.getElementById("humanInput");
const humanPreview = document.getElementById("humanPreview");
const cameraVideo = document.getElementById("cameraVideo");
const uploadTriggerButton = document.getElementById("uploadTriggerButton");
const openCameraButton = document.getElementById("openCameraButton");
const captureButton = document.getElementById("captureButton");
const stopCameraButton = document.getElementById("stopCameraButton");
const humanExamples = document.getElementById("humanExamples");

const remoteUrlInput = document.getElementById("remoteUrlInput");
const checkRemoteButton = document.getElementById("checkRemoteButton");
const pasteRemoteButton = document.getElementById("pasteRemoteButton");
const clearRemoteButton = document.getElementById("clearRemoteButton");
const remoteUrlFeedback = document.getElementById("remoteUrlFeedback");
const apiPresetButtons = document.querySelectorAll(".api-preset-chip[data-remote-url]");
const promptInput = document.getElementById("promptInput");
const autoMaskToggle = document.getElementById("autoMaskToggle");
const autoCropToggle = document.getElementById("autoCropToggle");
const stepsInput = document.getElementById("stepsInput");
const seedInput = document.getElementById("seedInput");
const brushSizeInput = document.getElementById("brushSizeInput");
const brushValue = document.getElementById("brushValue");
const clearMaskButton = document.getElementById("clearMaskButton");

const beforeImage = document.getElementById("beforeImage");
const afterImage = document.getElementById("afterImage");
const afterReveal = document.getElementById("afterReveal");
const compareDivider = document.getElementById("compareDivider");
const compareFrame = document.getElementById("compareFrame");
const compareSlider = document.getElementById("compareSlider");
const runButton = document.getElementById("runButton");
const statusBanner = document.getElementById("statusBanner");
const progressText = document.getElementById("progressText");
const resultProductName = document.getElementById("resultProductName");
const resultProductPrice = document.getElementById("resultProductPrice");
const remoteReadyItem = document.getElementById("remoteReadyItem");
const humanReadyItem = document.getElementById("humanReadyItem");
const garmentReadyItem = document.getElementById("garmentReadyItem");
const maskReadyItem = document.getElementById("maskReadyItem");
const maskCanvas = document.getElementById("maskCanvas");
const maskPreview = document.getElementById("maskPreview");
const seedBadge = document.getElementById("seedBadge");
const maskModeNote = document.getElementById("maskModeNote");

const ctx = maskCanvas.getContext("2d");
const PROGRESS_MESSAGES = [
  { at: 0, text: "Đang phân tích form dáng cơ thể…" },
  { at: 3500, text: "Đang xử lý nếp gấp và độ rủ của vải…" },
  { at: 7500, text: "Đang đồng bộ ánh sáng và hoàn thiện hoa văn…" },
  { at: 12000, text: "Đang xuất ảnh thử đồ cuối cùng…" },
];
const REMOTE_URL_PATTERN = /https?:\/\/[^\s'"<>]+/i;
const KNOWN_REMOTE_SUFFIXES = ["/api/tryon", "/api/health"];
const busyControls = [
  garmentInput,
  humanInput,
  remoteUrlInput,
  promptInput,
  autoMaskToggle,
  autoCropToggle,
  stepsInput,
  seedInput,
  openCameraButton,
  uploadTriggerButton,
  uploadGarmentButton,
];

function getSelectedProduct() {
  return state.products[state.selectedProductIndex] || null;
}

function getSelectedVariant() {
  const product = getSelectedProduct();
  return product?.variants[state.selectedVariantIndex] || null;
}

function getSelectedTrend() {
  return state.trends.find((trend) => trend.id === state.selectedTrendId) || null;
}

function makeUrlSource(url, name) {
  return {
    url,
    previewUrl: url,
    name,
  };
}

function makeFileSource(file) {
  return {
    file,
    previewUrl: URL.createObjectURL(file),
    name: file.name,
  };
}

function revokeObjectSource(source) {
  if (source?.file && source.previewUrl) {
    URL.revokeObjectURL(source.previewUrl);
  }
}

function getCurrentGarmentSource() {
  if (state.garmentMode === "upload") {
    return state.uploadedGarmentSource;
  }

  const variant = getSelectedVariant();
  return variant ? makeUrlSource(variant.url, variant.name) : null;
}

function getCurrentGarmentLabel() {
  if (state.garmentMode === "upload") {
    return state.uploadedGarmentSource ? prettifyAssetName(state.uploadedGarmentSource.name) : "Chưa có áo";
  }

  const product = getSelectedProduct();
  const variant = getSelectedVariant();
  if (!product || !variant) {
    return "Chưa có sản phẩm";
  }
  return `${product.name} / ${variant.label}`;
}

function setStatus(message, kind = "idle") {
  statusBanner.textContent = message;
  statusBanner.className = `status-banner ${kind}`;
}

function getRemoteUrl() {
  return normalizeRemoteUrlValue(remoteUrlInput.value);
}

function extractRemoteUrl(rawValue) {
  const raw = (rawValue || "").trim();
  if (!raw) {
    return "";
  }

  const matchedUrl = raw.match(REMOTE_URL_PATTERN)?.[0];
  const candidate = matchedUrl || raw.split(/\s+/)[0];
  return candidate.replace(/[),.;]+$/g, "").replace(/^['"]|['"]$/g, "");
}

function normalizeRemoteUrlValue(rawValue) {
  let candidate = extractRemoteUrl(rawValue);
  if (!candidate) {
    return "";
  }

  if (/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/.*)?$/i.test(candidate)) {
    candidate = `http://${candidate}`;
  } else if (!/^https?:\/\//i.test(candidate) && /\.[a-z]{2,}(?::\d+)?(?:\/.*)?$/i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  try {
    const url = new URL(candidate);
    url.hash = "";
    url.search = "";
    url.pathname = url.pathname.replace(/\/+$/g, "");
    for (const suffix of KNOWN_REMOTE_SUFFIXES) {
      if (url.pathname.endsWith(suffix)) {
        url.pathname = url.pathname.slice(0, -suffix.length) || "/";
        break;
      }
    }
    return url.toString().replace(/\/$/g, "");
  } catch (error) {
    return "";
  }
}

function setRemoteFeedback(message, kind = "idle") {
  if (!remoteUrlFeedback) {
    return;
  }
  remoteUrlFeedback.textContent = message;
  remoteUrlFeedback.className = `api-feedback ${kind}`;
}

function validateRemoteUrl({ showEmpty = false } = {}) {
  const raw = remoteUrlInput.value.trim();
  const normalized = getRemoteUrl();
  let error = "";

  if (!raw) {
    error = showEmpty ? "Dán link Colab bridge hoặc chọn preset local." : "";
  } else if (!normalized) {
    error = "URL chưa đúng. Dùng dạng https://… hoặc http://127.0.0.1:7862.";
  }

  const isValid = Boolean(normalized && !error);
  remoteUrlInput.classList.toggle("has-error", Boolean(error));
  remoteUrlInput.setAttribute("aria-invalid", error ? "true" : "false");

  if (error) {
    setRemoteFeedback(error, "error");
  } else if (isValid) {
    setRemoteFeedback(`API sẽ gọi qua ${normalized}`, "ok");
  } else {
    setRemoteFeedback("Chưa kết nối API.", "idle");
  }

  return {
    ok: isValid,
    url: normalized,
    error,
  };
}

function commitRemoteUrl({ showEmpty = false } = {}) {
  const validation = validateRemoteUrl({ showEmpty });
  if (validation.ok) {
    remoteUrlInput.value = validation.url;
  }
  return validation;
}

function setRemoteUrlValue(value, { persist = true } = {}) {
  remoteUrlInput.value = value || "";
  const validation = commitRemoteUrl({ showEmpty: false });
  if (persist) {
    storeRemoteUrl();
  }
  updateRunReadiness();
  return validation;
}

function setReadyItem(element, ready) {
  element.classList.toggle("is-ready", ready);
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

function updateCompareSlider() {
  const value = `${compareSlider.value}%`;
  afterReveal.style.width = value;
  compareDivider.style.left = value;
}

function updateMaskMode() {
  humanDropzone.classList.toggle("auto-mask-mode", autoMaskToggle.checked);
  brushValue.textContent = `${brushSizeInput.value}px`;

  if (!state.humanSource) {
    maskModeNote.textContent = "Chọn ảnh trước";
  } else if (autoMaskToggle.checked) {
    maskModeNote.textContent = "Đang dùng auto-mask";
  } else if (state.hasMaskStroke) {
    maskModeNote.textContent = "Mask thủ công đã sẵn sàng";
  } else {
    maskModeNote.textContent = "Tô vùng áo";
  }
}

function updateTryOnSummary() {
  const garmentSource = getCurrentGarmentSource();
  const garmentLabel = getCurrentGarmentLabel();
  const shopVariant = getSelectedVariant();
  const shopProduct = getSelectedProduct();
  const selectedTrend = getSelectedTrend();

  selectedGarmentTitle.textContent = garmentLabel;
  selectedGarmentSourceLabel.textContent = state.garmentMode === "shop" ? "Từ shop" : "Ảnh tải lên";
  resultProductName.textContent = state.garmentMode === "shop" && shopProduct ? shopProduct.name : garmentLabel;
  resultProductPrice.textContent = state.garmentMode === "shop" && shopProduct ? shopProduct.price : "Ảnh áo riêng";
  garmentModeCaption.textContent =
    state.garmentMode === "shop"
      ? selectedTrend
        ? `Style gợi ý: ${selectedTrend.title}.`
        : "Dùng sản phẩm đang chọn từ shop."
      : "Dùng ảnh áo bạn tải lên.";

  shopGarmentModeButton.classList.toggle("is-selected", state.garmentMode === "shop");
  uploadGarmentModeButton.classList.toggle("is-selected", state.garmentMode === "upload");
  shopGarmentBlock.hidden = false;
  uploadGarmentBlock.hidden = state.garmentMode !== "upload";

  if (garmentSource) {
    tryonHeroImage.src = garmentSource.previewUrl;
    tryonHeroNote.textContent =
      state.garmentMode === "shop"
        ? `${shopProduct.name} / ${shopVariant.label} / size ${state.selectedSize}`
        : `${garmentLabel} / ảnh tải lên`;
  } else if (state.catalogHeroImage) {
    tryonHeroImage.src = state.catalogHeroImage;
    tryonHeroNote.textContent = "Chọn sản phẩm từ shop hoặc tải ảnh áo riêng để bắt đầu.";
  }

  if (state.garmentMode === "shop" && shopVariant) {
    garmentPreview.src = shopVariant.url;
    garmentPreviewFrame.classList.add("has-garment");
  } else {
    garmentPreview.removeAttribute("src");
    garmentPreviewFrame.classList.remove("has-garment");
  }

  if (state.uploadedGarmentSource) {
    garmentUploadPreview.src = state.uploadedGarmentSource.previewUrl;
    garmentDropzone.classList.add("has-garment");
  } else {
    garmentUploadPreview.removeAttribute("src");
    garmentDropzone.classList.remove("has-garment");
  }

  modalAddToCartButton.disabled = state.garmentMode !== "shop";
  modalAddToCartButton.textContent = state.garmentMode === "shop" ? "Thêm vào giỏ" : "Không phải sản phẩm shop";
  uploadGarmentButton.textContent = state.garmentMode === "upload" ? "Đổi ảnh áo riêng" : "Dùng ảnh áo riêng";
}

function updateRunReadiness() {
  const remoteValidation = validateRemoteUrl({ showEmpty: false });
  const remoteReady = remoteValidation.ok;
  const humanReady = Boolean(state.humanSource);
  const garmentReady = Boolean(getCurrentGarmentSource());
  const maskReady = autoMaskToggle.checked || state.hasMaskStroke;
  const canRun = remoteReady && humanReady && garmentReady && maskReady && !state.busy;

  setReadyItem(remoteReadyItem, remoteReady);
  setReadyItem(humanReadyItem, humanReady);
  setReadyItem(garmentReadyItem, garmentReady);
  setReadyItem(maskReadyItem, maskReady);

  runButton.disabled = !canRun;
  runButton.textContent = state.busy ? "Đang tạo…" : canRun ? "Tạo ảnh thử đồ" : "Chưa sẵn sàng";
  checkRemoteButton.disabled = state.busy || !remoteReady;
  captureButton.disabled = state.busy || !state.cameraStream;
  clearMaskButton.disabled = state.busy || !state.hasMaskStroke;
  brushSizeInput.disabled = state.busy || autoMaskToggle.checked || !humanReady;

  if (!state.busy && !state.hasResult) {
    if (!garmentReady) {
      setStatus("Chọn áo từ shop hoặc tải ảnh áo riêng.", "idle");
    } else if (!humanReady) {
      setStatus("Thêm ảnh người mặc để tiếp tục.", "idle");
    } else if (!remoteReady) {
      setStatus("Dán Colab bridge ở khối Kết nối API.", "error");
    } else if (!maskReady) {
      setStatus("Bật auto-mask hoặc tô vùng áo trong Cài đặt nâng cao.", "error");
    } else {
      setStatus("Sẵn sàng tạo ảnh thử đồ.", "idle");
    }
  }
}

function setBusy(isBusy) {
  state.busy = isBusy;
  busyControls.forEach((control) => {
    if (control) {
      control.disabled = isBusy;
    }
  });
  if (loadingOverlay) {
    loadingOverlay.hidden = !isBusy;
  }
  compareFrame.classList.toggle("is-generating", isBusy);
  if (isBusy) {
    startProgressMessages();
  } else {
    stopProgressMessages();
  }
  updateRunReadiness();
}

function startProgressMessages() {
  state.progressStartedAt = Date.now();
  updateProgressMessage();
  clearInterval(state.progressTimer);
  state.progressTimer = setInterval(updateProgressMessage, 700);
}

function stopProgressMessages() {
  clearInterval(state.progressTimer);
  state.progressTimer = null;
}

function updateProgressMessage() {
  if (!progressText) {
    return;
  }
  const elapsed = Date.now() - state.progressStartedAt;
  const message = PROGRESS_MESSAGES.reduce((current, item) => (elapsed >= item.at ? item.text : current), PROGRESS_MESSAGES[0].text);
  progressText.textContent = message;
}

function storeRemoteUrl() {
  const validation = commitRemoteUrl({ showEmpty: false });
  if (validation.ok) {
    localStorage.setItem(REMOTE_URL_STORAGE_KEY, validation.url);
  } else {
    localStorage.removeItem(REMOTE_URL_STORAGE_KEY);
  }
}

function renderProductPills() {
  tryonProductList.replaceChildren();

  state.products.forEach((product, index) => {
    const variant = product.variants[0];
    const button = document.createElement("button");
    const image = document.createElement("img");
    const name = document.createElement("strong");
    const price = document.createElement("small");

    button.type = "button";
    button.className = "product-pill";
    button.classList.toggle("is-selected", index === state.selectedProductIndex);
    button.setAttribute("aria-pressed", index === state.selectedProductIndex ? "true" : "false");
    button.setAttribute("aria-label", `Chọn ${product.name}`);
    image.src = variant?.url || "";
    image.alt = product.name;
    image.width = 320;
    image.height = 400;
    image.loading = "lazy";
    image.decoding = "async";
    name.textContent = product.name;
    price.textContent = product.price;
    button.append(image, name, price);
    button.addEventListener("click", () => setSelectedProduct(index));
    tryonProductList.appendChild(button);
  });
}

function renderSwatches() {
  const product = getSelectedProduct();
  if (!product) {
    return;
  }

  tryonProductSwatches.replaceChildren();

  product.variants.forEach((variant, variantIndex) => {
    const button = document.createElement("button");
    const dot = document.createElement("span");
    const label = document.createElement("span");

    button.type = "button";
    button.className = "swatch";
    button.classList.toggle("is-selected", variantIndex === state.selectedVariantIndex);
    button.setAttribute("aria-pressed", variantIndex === state.selectedVariantIndex ? "true" : "false");
    button.setAttribute("aria-label", `Chọn màu ${variant.label}`);

    dot.className = "swatch-dot";
    dot.style.background = variant.color;

    label.className = "swatch-label";
    label.textContent = variant.label;

    button.append(dot, label);
    button.addEventListener("click", () => setSelectedVariant(variantIndex));

    tryonProductSwatches.appendChild(button);
  });
}

function renderSizeOptions() {
  modalSizeOptions.replaceChildren();

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
      updateTryOnSummary();
    });
    modalSizeOptions.appendChild(button);
  });
}

function setSelectedProduct(productIndex) {
  if (!state.products[productIndex]) {
    return;
  }

  state.selectedProductIndex = productIndex;
  state.selectedVariantIndex = 0;
  state.garmentMode = "shop";
  renderProductPills();
  renderSwatches();
  updateTryOnSummary();
  updateRunReadiness();

  if (!state.busy) {
    resetResult();
  }
}

function setSelectedVariant(variantIndex) {
  const product = getSelectedProduct();
  if (!product || !product.variants[variantIndex]) {
    return;
  }

  state.selectedVariantIndex = variantIndex;
  renderSwatches();
  updateTryOnSummary();
  updateRunReadiness();

  if (!state.busy) {
    resetResult();
  }
}

function setGarmentMode(mode) {
  state.garmentMode = mode;
  updateTryOnSummary();
  updateRunReadiness();

  if (!state.busy) {
    resetResult();
  }
}

function setUploadedGarmentSource(source) {
  revokeObjectSource(state.uploadedGarmentSource);
  state.uploadedGarmentSource = source;
  setGarmentMode("upload");
}

function setHumanSource(source, { fromExampleTile = null } = {}) {
  revokeObjectSource(state.humanSource);
  state.humanSource = source;
  state.hasMaskStroke = false;

  stopCamera();

  if (source) {
    humanPreview.src = source.previewUrl;
    beforeImage.src = source.previewUrl;
    humanDropzone.classList.add("has-human");
  } else {
    humanPreview.removeAttribute("src");
    beforeImage.removeAttribute("src");
    humanDropzone.classList.remove("has-human");
  }

  if (fromExampleTile) {
    if (state.selectedHumanTile) {
      state.selectedHumanTile.classList.remove("is-selected");
      state.selectedHumanTile.setAttribute("aria-pressed", "false");
    }
    state.selectedHumanTile = fromExampleTile;
    fromExampleTile.classList.add("is-selected");
    fromExampleTile.setAttribute("aria-pressed", "true");
  } else if (state.selectedHumanTile) {
    state.selectedHumanTile.classList.remove("is-selected");
    state.selectedHumanTile.setAttribute("aria-pressed", "false");
    state.selectedHumanTile = null;
  }

  resetResult();
  clearMaskCanvas(false);
  updateMaskMode();
  updateRunReadiness();

  requestAnimationFrame(() => resizeMaskCanvas({ preserve: false }));
}

function resetResult() {
  state.hasResult = false;
  afterImage.removeAttribute("src");
  maskPreview.removeAttribute("src");
  compareFrame.classList.add("empty");
  compareFrame.classList.remove("has-result");
  compareSlider.disabled = true;
  seedBadge.textContent = `seed ${seedInput.value || 42}`;
}

function clearMaskCanvas(markEmpty = true) {
  ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
  if (markEmpty) {
    state.hasMaskStroke = false;
    updateMaskMode();
    updateRunReadiness();
  }
}

function resizeMaskCanvas({ preserve = true } = {}) {
  const rect = humanDropzone.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const previous = preserve && maskCanvas.width && maskCanvas.height ? document.createElement("canvas") : null;

  if (previous) {
    previous.width = maskCanvas.width;
    previous.height = maskCanvas.height;
    previous.getContext("2d").drawImage(maskCanvas, 0, 0);
  }

  maskCanvas.width = Math.max(1, Math.floor(rect.width * ratio));
  maskCanvas.height = Math.max(1, Math.floor(rect.height * ratio));
  maskCanvas.style.width = `${rect.width}px`;
  maskCanvas.style.height = `${rect.height}px`;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (previous) {
    ctx.drawImage(previous, 0, 0, previous.width, previous.height, 0, 0, maskCanvas.width, maskCanvas.height);
  }

  ctx.scale(ratio, ratio);
}

function getCanvasPoint(event) {
  const rect = maskCanvas.getBoundingClientRect();
  const source = event.touches ? event.touches[0] : event;
  return {
    x: source.clientX - rect.left,
    y: source.clientY - rect.top,
  };
}

function markMaskStroke() {
  state.hasMaskStroke = true;
  updateMaskMode();
  updateRunReadiness();
}

function drawStroke(from, to) {
  const brushSize = Number(brushSizeInput.value);
  ctx.strokeStyle = "#ffffff";
  ctx.fillStyle = "#ffffff";
  ctx.lineWidth = brushSize;

  if (from.x === to.x && from.y === to.y) {
    ctx.beginPath();
    ctx.arc(from.x, from.y, brushSize / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }

  markMaskStroke();
}

function beginDraw(event) {
  if (autoMaskToggle.checked || !state.humanSource) {
    return;
  }
  state.drawing = true;
  state.lastPoint = getCanvasPoint(event);
  drawStroke(state.lastPoint, state.lastPoint);
  event.preventDefault();
}

function moveDraw(event) {
  if (!state.drawing || autoMaskToggle.checked) {
    return;
  }
  const next = getCanvasPoint(event);
  drawStroke(state.lastPoint, next);
  state.lastPoint = next;
  event.preventDefault();
}

function endDraw() {
  state.drawing = false;
  state.lastPoint = null;
}

function createMaskBlob() {
  if (autoMaskToggle.checked || !state.hasMaskStroke) {
    return null;
  }

  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = maskCanvas.width;
  exportCanvas.height = maskCanvas.height;
  const exportCtx = exportCanvas.getContext("2d");
  exportCtx.fillStyle = "#000000";
  exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
  exportCtx.drawImage(maskCanvas, 0, 0);

  return new Promise((resolve) => {
    exportCanvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

async function sourceToFile(source, filename) {
  if (!source) {
    return null;
  }
  if (source.file) {
    return source.file;
  }

  const response = await fetch(source.url);
  const blob = await response.blob();
  return new File([blob], filename, { type: blob.type || "image/jpeg" });
}

function buildHumanExampleTile(item) {
  const button = document.createElement("button");
  const image = document.createElement("img");
  const meta = document.createElement("div");
  const kicker = document.createElement("span");
  const name = document.createElement("strong");
  const prettyName = prettifyAssetName(item.name);

  button.type = "button";
  button.className = "example-tile";
  button.setAttribute("aria-pressed", "false");
  button.setAttribute("aria-label", `Chọn mẫu người ${prettyName}`);

  image.src = item.url;
  image.alt = prettyName;
  image.width = 128;
  image.height = 128;
  image.loading = "lazy";
  image.decoding = "async";

  meta.className = "example-meta";
  kicker.className = "example-kicker";
  name.className = "example-name";
  kicker.textContent = "Mẫu";
  name.textContent = prettyName;

  meta.append(kicker, name);
  button.append(image, meta);

  button.addEventListener("click", () => {
    setHumanSource(makeUrlSource(item.url, item.name), { fromExampleTile: button });
  });

  return button;
}

async function openCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus("Thiết bị không hỗ trợ camera trong trình duyệt này.", "error");
    return;
  }

  try {
    stopCamera();
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
      },
      audio: false,
    });
    state.cameraStream = stream;
    cameraVideo.srcObject = stream;
    cameraVideo.play();
    humanDropzone.classList.add("camera-live");
    captureButton.hidden = false;
    stopCameraButton.hidden = false;
    setStatus("Camera đã sẵn sàng. Chụp ảnh để thử đồ.", "idle");
  } catch (error) {
    setStatus("Không mở được camera. Hãy dùng tải ảnh.", "error");
  }
}

function stopCamera() {
  if (state.cameraStream) {
    state.cameraStream.getTracks().forEach((track) => track.stop());
    state.cameraStream = null;
  }
  cameraVideo.pause();
  cameraVideo.srcObject = null;
  humanDropzone.classList.remove("camera-live");
  captureButton.hidden = true;
  stopCameraButton.hidden = true;
}

async function captureCameraFrame() {
  if (!state.cameraStream || !cameraVideo.videoWidth || !cameraVideo.videoHeight) {
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.width = cameraVideo.videoWidth;
  canvas.height = cameraVideo.videoHeight;
  const context = canvas.getContext("2d");
  context.drawImage(cameraVideo, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  if (!blob) {
    setStatus("Không chụp được ảnh từ camera.", "error");
    return;
  }

  const file = new File([blob], "camera-capture.jpg", { type: "image/jpeg" });
  setHumanSource(makeFileSource(file));
  setStatus("Đã chụp ảnh từ camera.", "idle");
}

async function checkRemoteConnection() {
  const remoteValidation = commitRemoteUrl({ showEmpty: true });
  if (!remoteValidation.ok) {
    setStatus(remoteValidation.error || "Nhập Colab API URL trước khi test.", "error");
    remoteUrlInput.focus();
    return;
  }
  const remoteUrl = remoteValidation.url;

  checkRemoteButton.disabled = true;
  setStatus("Đang kiểm tra bridge…", "busy");
  setRemoteFeedback("Đang gọi /api/health…", "busy");

  try {
    storeRemoteUrl();
    const response = await fetch(`/api/remote-health?remote_url=${encodeURIComponent(remoteUrl)}`);
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Kiểm tra bridge thất bại.");
    }
    setStatus(`Bridge sẵn sàng: ${payload.remoteUrl}`, "idle");
    setRemoteFeedback("Kết nối API thành công.", "ok");
  } catch (error) {
    setStatus(error.message || "Không thể kết nối bridge.", "error");
    setRemoteFeedback(error.message || "Không thể kết nối API.", "error");
  } finally {
    updateRunReadiness();
  }
}

async function runTryOn() {
  const remoteValidation = commitRemoteUrl({ showEmpty: true });
  const remoteUrl = remoteValidation.url;
  const garmentSource = getCurrentGarmentSource();
  if (!remoteValidation.ok) {
    setStatus(remoteValidation.error || "Cần Colab API URL.", "error");
    remoteUrlInput.focus();
    return;
  }
  if (!state.humanSource || !garmentSource) {
    setStatus("Cần áo và ảnh người trước khi chạy.", "error");
    return;
  }
  if (!autoMaskToggle.checked && !state.hasMaskStroke) {
    setStatus("Bật auto-mask hoặc tô vùng áo trong Cài đặt nâng cao.", "error");
    return;
  }

  setBusy(true);
  setStatus("Đang tạo ảnh thử đồ…", "busy");

  try {
    storeRemoteUrl();
    const humanFile = await sourceToFile(state.humanSource, "human.jpg");
    const garmentFile = await sourceToFile(garmentSource, "garment.jpg");
    const maskBlob = await createMaskBlob();

    const formData = new FormData();
    formData.append("human_image", humanFile);
    formData.append("garment_image", garmentFile);
    formData.append("garment_description", promptInput.value.trim());
    formData.append("auto_mask", String(autoMaskToggle.checked));
    formData.append("auto_crop", String(autoCropToggle.checked));
    formData.append("denoise_steps", stepsInput.value);
    formData.append("seed", seedInput.value);

    if (maskBlob && maskBlob.size > 0) {
      formData.append("mask_image", maskBlob, "mask.png");
    }

    const response = await fetch(`/api/tryon?remote_url=${encodeURIComponent(remoteUrl)}`, {
      method: "POST",
      body: formData,
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Remote request thất bại.");
    }

    afterImage.src = payload.outputImage;
    if (payload.maskPreview) {
      maskPreview.src = payload.maskPreview;
    } else {
      maskPreview.removeAttribute("src");
    }
    seedBadge.textContent = `seed ${payload.seed}`;
    state.hasResult = true;
    compareFrame.classList.remove("empty");
    compareFrame.classList.add("has-result");
    compareSlider.disabled = false;
    updateCompareSlider();
    setStatus("Đã xong. Kéo thanh trước/sau để so sánh.", "idle");
  } catch (error) {
    setStatus(error.message || "Không tạo được ảnh thử đồ.", "error");
  } finally {
    setBusy(false);
  }
}

function setupDropzone() {
  ["dragenter", "dragover"].forEach((eventName) => {
    humanDropzone.addEventListener(eventName, (event) => {
      if (state.busy) {
        return;
      }
      event.preventDefault();
      humanDropzone.classList.add("drag-over");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    humanDropzone.addEventListener(eventName, () => {
      humanDropzone.classList.remove("drag-over");
    });
  });

  humanDropzone.addEventListener("drop", (event) => {
    if (state.busy) {
      return;
    }
    event.preventDefault();
    const [file] = event.dataTransfer?.files || [];
    handleHumanFile(file);
  });
}

function validateUploadImage(file) {
  if (!file) {
    return Promise.resolve({ ok: false, reason: "" });
  }
  if (!file.type.startsWith("image/")) {
    return Promise.resolve({ ok: false, reason: "Chỉ chấp nhận file ảnh." });
  }
  if (file.size > 8 * 1024 * 1024) {
    return Promise.resolve({ ok: false, reason: "Ảnh quá nặng. Hãy chọn ảnh dưới 8MB." });
  }

  return new Promise((resolve) => {
    const image = new Image();
    const previewUrl = URL.createObjectURL(file);
    image.onload = () => {
      const ratio = image.width / image.height;
      URL.revokeObjectURL(previewUrl);
      if (image.width < 420 || image.height < 560) {
        resolve({ ok: false, reason: "Ảnh hơi nhỏ. Hãy chọn ảnh rõ và lớn hơn." });
        return;
      }
      if (ratio < 0.32 || ratio > 1.25) {
        resolve({ ok: false, reason: "Ảnh cần thấy rõ toàn thân hoặc bán thân, không cắt quá sát." });
        return;
      }
      resolve({ ok: true, reason: "" });
    };
    image.onerror = () => {
      URL.revokeObjectURL(previewUrl);
      resolve({ ok: false, reason: "Không đọc được ảnh này. Hãy chọn ảnh khác." });
    };
    image.src = previewUrl;
  });
}

async function handleHumanFile(file) {
  if (!file) {
    return;
  }
  const validation = await validateUploadImage(file);
  if (!validation.ok) {
    setStatus(validation.reason, "error");
    showToast(validation.reason);
    return;
  }

  setHumanSource(makeFileSource(file));
  setStatus("Ảnh người đã sẵn sàng.", "idle");
}

function handleGarmentFile(file) {
  if (!file) {
    return;
  }
  if (!file.type.startsWith("image/")) {
    setStatus("Ảnh áo phải là file ảnh.", "error");
    return;
  }

  setUploadedGarmentSource(makeFileSource(file));
  updateTryOnSummary();
  updateRunReadiness();
  setStatus("Ảnh áo riêng đã sẵn sàng.", "idle");
}

function addToCart() {
  if (state.garmentMode !== "shop") {
    showToast("Ảnh áo tải lên không thuộc catalog shop để thêm vào giỏ.");
    return;
  }

  const product = getSelectedProduct();
  const variant = getSelectedVariant();
  if (!product || !variant) {
    return;
  }

  state.cartCount += 1;
  updateCartBadge();
  showToast(`${product.name} / ${variant.label} / size ${state.selectedSize} đã vào giỏ hàng.`);
}

function applySelectedTrendPrompt() {
  const selectedTrend = getSelectedTrend();
  if (!selectedTrend || promptInput.value.trim()) {
    return;
  }
  promptInput.value = selectedTrend.keywords.slice(0, 5).join(", ");
}

async function boot() {
  const [data, trendPayload] = await Promise.all([
    fetchCatalogData(),
    fetchTrendData({ season: "summer", region: "VN", limit: 8 }).catch((error) => {
      console.error(error);
      return { items: [] };
    }),
  ]);
  state.products = data.products;
  state.trends = trendPayload.items || [];
  state.humans = data.humans;
  state.catalogHeroImage = data.heroImage;

  const selection = normalizeSelection(state.products, readSelectionFromQuery());
  state.selectedProductIndex = selection.productIndex;
  state.selectedVariantIndex = selection.variantIndex;
  state.selectedSize = selection.size;
  state.selectedTrendId = new URLSearchParams(window.location.search).get("trend") || "";
  applySelectedTrendPrompt();

  const queryRemoteUrl = new URLSearchParams(window.location.search).get("remote_url") || "";
  remoteUrlInput.value = queryRemoteUrl || localStorage.getItem(REMOTE_URL_STORAGE_KEY) || data.defaultRemoteUrl || "";
  commitRemoteUrl({ showEmpty: false });

  renderProductPills();
  renderSwatches();
  renderSizeOptions();
  updateTryOnSummary();
  updateCartBadge();

  humanExamples.replaceChildren();
  state.humans.slice(0, 4).forEach((item) => {
    humanExamples.appendChild(buildHumanExampleTile(item));
  });

  updateMaskMode();
  updateRunReadiness();
  resizeMaskCanvas({ preserve: false });
}

uploadTriggerButton.addEventListener("click", () => humanInput.click());
uploadGarmentButton.addEventListener("click", () => garmentInput.click());

humanInput.addEventListener("change", (event) => {
  const [file] = event.target.files || [];
  handleHumanFile(file);
});

garmentInput.addEventListener("change", (event) => {
  const [file] = event.target.files || [];
  handleGarmentFile(file);
});

openCameraButton.addEventListener("click", openCamera);
captureButton.addEventListener("click", captureCameraFrame);
stopCameraButton.addEventListener("click", stopCamera);
shopGarmentModeButton.addEventListener("click", () => setGarmentMode("shop"));
uploadGarmentModeButton.addEventListener("click", () => setGarmentMode("upload"));
headerCartButton.addEventListener("click", () => {
  showToast(`Giỏ hàng hiện có ${state.cartCount} sản phẩm.`);
});
modalAddToCartButton.addEventListener("click", addToCart);

checkRemoteButton.addEventListener("click", checkRemoteConnection);
runButton.addEventListener("click", runTryOn);
compareSlider.addEventListener("input", updateCompareSlider);
remoteUrlInput.addEventListener("input", updateRunReadiness);
remoteUrlInput.addEventListener("change", storeRemoteUrl);
remoteUrlInput.addEventListener("blur", storeRemoteUrl);
pasteRemoteButton.addEventListener("click", async () => {
  try {
    const text = await navigator.clipboard.readText();
    const validation = setRemoteUrlValue(text);
    setStatus(validation.ok ? "Đã dán và chuẩn hóa API URL." : "Clipboard chưa có URL hợp lệ.", validation.ok ? "idle" : "error");
  } catch (error) {
    remoteUrlInput.focus();
    setStatus("Trình duyệt không cho đọc clipboard. Dán bằng Ctrl+V vào ô API.", "error");
  }
});
clearRemoteButton.addEventListener("click", () => {
  remoteUrlInput.value = "";
  localStorage.removeItem(REMOTE_URL_STORAGE_KEY);
  validateRemoteUrl({ showEmpty: false });
  updateRunReadiness();
  setStatus("Đã xóa API URL.", "idle");
});
apiPresetButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const validation = setRemoteUrlValue(button.dataset.remoteUrl || "");
    setStatus(validation.ok ? `Đã chọn ${button.textContent}.` : "Preset API không hợp lệ.", validation.ok ? "idle" : "error");
  });
});
seedInput.addEventListener("input", () => {
  if (!state.hasResult) {
    seedBadge.textContent = `seed ${seedInput.value || 42}`;
  }
});

clearMaskButton.addEventListener("click", () => {
  clearMaskCanvas();
  setStatus("Đã xóa mask thủ công.", "idle");
});

brushSizeInput.addEventListener("input", updateMaskMode);
autoMaskToggle.addEventListener("change", () => {
  updateMaskMode();
  updateRunReadiness();
});

maskCanvas.addEventListener("mousedown", beginDraw);
maskCanvas.addEventListener("mousemove", moveDraw);
window.addEventListener("mouseup", endDraw);
maskCanvas.addEventListener("touchstart", beginDraw, { passive: false });
maskCanvas.addEventListener("touchmove", moveDraw, { passive: false });
window.addEventListener("touchend", endDraw);
window.addEventListener("touchcancel", endDraw);
window.addEventListener("resize", () => resizeMaskCanvas({ preserve: true }));

document.addEventListener("dragover", (event) => {
  if (event.dataTransfer?.types.includes("Files")) {
    event.preventDefault();
  }
});

document.addEventListener("drop", (event) => {
  if (event.dataTransfer?.types.includes("Files")) {
    event.preventDefault();
  }
});

setupDropzone();
resetResult();
boot().catch((error) => {
  console.error(error);
  setStatus(`Không thể tải samples: ${error.message}`, "error");
});
