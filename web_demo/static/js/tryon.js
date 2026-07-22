import {
  SIZE_OPTIONS,
  fetchCatalogData,
  normalizeSelection,
  prettifyAssetName,
  readSelectionFromQuery,
} from "/static/js/catalog.js";
import {
  computeBoundedExportSize,
  computeContainedImageRect,
} from "/static/js/mask_geometry.mjs";

const state = {
  products: [],
  humans: [],
  catalogHeroImage: "",
  selectedProductIndex: 0,
  selectedVariantIndex: 0,
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
  remoteUrl: "",
  resetMaskOnHumanLoad: false,
};

let isCompareDragging = false;

let undoStack = [];
let redoStack = [];
const MAX_STATES = 10;
let brushPreview = null;
let drawQueue = [];
let rafPending = false;

function getOrCreateBrushPreview() {
  if (!brushPreview) {
    brushPreview = document.createElement("div");
    brushPreview.className = "brush-preview-circle";
    brushPreview.setAttribute("aria-hidden", "true");
    humanDropzone.appendChild(brushPreview);
  }
  return brushPreview;
}

function updateBrushPreview(event) {
  if (autoMaskToggle.checked || !state.humanSource) {
    hideBrushPreview();
    return;
  }

  const preview = getOrCreateBrushPreview();
  const rect = maskCanvas.getBoundingClientRect();
  const source = event.touches ? event.touches[0] : event;
  const brushSize = Number(brushSizeInput.value);

  const dropzoneRect = humanDropzone.getBoundingClientRect();
  const dropzoneStyle = window.getComputedStyle(humanDropzone);
  const dropzoneBorderLeft = parseFloat(dropzoneStyle.borderLeftWidth) || 0;
  const dropzoneBorderTop = parseFloat(dropzoneStyle.borderTopWidth) || 0;
  const xClient = source.clientX;
  const yClient = source.clientY;

  if (xClient < rect.left || xClient > rect.right || yClient < rect.top || yClient > rect.bottom) {
    hideBrushPreview();
    return;
  }

  const xDropzone = xClient - dropzoneRect.left - dropzoneBorderLeft;
  const yDropzone = yClient - dropzoneRect.top - dropzoneBorderTop;

  preview.style.width = `${brushSize}px`;
  preview.style.height = `${brushSize}px`;
  preview.style.left = `${xDropzone}px`;
  preview.style.top = `${yDropzone}px`;
  preview.style.display = "block";
}

function hideBrushPreview() {
  if (brushPreview) {
    brushPreview.style.display = "none";
  }
}

function clearUndoRedo() {
  undoStack = [];
  redoStack = [];
  updateUndoRedoButtons();
}

function saveState() {
  redoStack = [];
  const imageData = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
  undoStack.push(imageData);
  if (undoStack.length > MAX_STATES) {
    undoStack.shift();
  }
  updateUndoRedoButtons();
}

function undo() {
  if (undoStack.length === 0) {
    return;
  }
  
  const currentImgData = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
  redoStack.push(currentImgData);
  if (redoStack.length > MAX_STATES) {
    redoStack.shift();
  }
  
  const previousImgData = undoStack.pop();
  ctx.putImageData(previousImgData, 0, 0);
  
  recalculateMaskStrokeReadiness(previousImgData);
  
  updateUndoRedoButtons();
  updateMaskMode();
  updateRunReadiness();
}

function redo() {
  if (redoStack.length === 0) {
    return;
  }
  
  const currentImgData = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
  undoStack.push(currentImgData);
  if (undoStack.length > MAX_STATES) {
    undoStack.shift();
  }
  
  const nextImgData = redoStack.pop();
  ctx.putImageData(nextImgData, 0, 0);
  
  recalculateMaskStrokeReadiness(nextImgData);
  
  updateUndoRedoButtons();
  updateMaskMode();
  updateRunReadiness();
}

function recalculateMaskStrokeReadiness(imageData) {
  const data = imageData.data;
  let hasStroke = false;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > 0) {
      hasStroke = true;
      break;
    }
  }
  state.hasMaskStroke = hasStroke;
}

function updateUndoRedoButtons() {
  const undoBtn = document.getElementById("undoMaskButton");
  const redoBtn = document.getElementById("redoMaskButton");
  if (undoBtn) {
    undoBtn.disabled = state.busy || undoStack.length === 0;
  }
  if (redoBtn) {
    redoBtn.disabled = state.busy || redoStack.length === 0;
  }
}

function processDrawQueue() {
  rafPending = false;
  while (drawQueue.length > 0) {
    const segment = drawQueue.shift();
    drawStroke(segment.from, segment.to);
  }
}


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
const remoteUrlFeedback = document.getElementById("remoteUrlFeedback");
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
const REMOTE_HEALTH_TIMEOUT_MS = 12000;
const REMOTE_RESTART_MESSAGE = "Nhập URL Colab bridge trong Cài đặt nâng cao hoặc dùng --remote-url / IDM_VTON_REMOTE_URL.";
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

function setRemoteFeedback(message, kind = "idle") {
  if (!remoteUrlFeedback) {
    return;
  }
  remoteUrlFeedback.textContent = message;
  remoteUrlFeedback.className = `api-feedback ${kind}`;
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
  const value = Number(compareSlider.value);
  afterReveal.style.clipPath = `inset(0 ${100 - value}% 0 0)`;
  compareDivider.style.left = `${value}%`;
}

function updateCompareFromPointer(clientX) {
  const rect = compareFrame.getBoundingClientRect();
  const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
  const percent = (x / rect.width) * 100;
  compareSlider.value = percent;
  updateCompareSlider();
}

function setupCompareFrameDrag() {
  if (!compareFrame) return;

  compareFrame.addEventListener("pointerdown", (event) => {
    if (!state.hasResult || state.busy) return;
    isCompareDragging = true;
    try {
      compareFrame.setPointerCapture(event.pointerId);
    } catch (e) {
      console.warn("Failed to set pointer capture:", e);
    }

    const rect = compareFrame.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickPercent = (clickX / rect.width) * 100;
    const currentVal = Number(compareSlider.value);

    if (Math.abs(clickPercent - currentVal) > 3) {
      compareFrame.classList.add("is-animating");
    }
    compareSlider.value = clickPercent;
    updateCompareSlider();
  });

  compareFrame.addEventListener("pointermove", (event) => {
    if (!isCompareDragging) return;
    compareFrame.classList.remove("is-animating");
    updateCompareFromPointer(event.clientX);
  });

  compareFrame.addEventListener("pointerup", (event) => {
    isCompareDragging = false;
    compareFrame.classList.remove("is-animating");
    try {
      compareFrame.releasePointerCapture(event.pointerId);
    } catch (e) {
      console.warn("Failed to release pointer capture:", e);
    }
  });

  compareFrame.addEventListener("pointercancel", (event) => {
    isCompareDragging = false;
    compareFrame.classList.remove("is-animating");
    try {
      compareFrame.releasePointerCapture(event.pointerId);
    } catch (e) {
      console.warn("Failed to release pointer capture:", e);
    }
  });
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

  selectedGarmentTitle.textContent = garmentLabel;
  selectedGarmentSourceLabel.textContent = state.garmentMode === "shop" ? "Từ shop" : "Ảnh tải lên";
  resultProductName.textContent = state.garmentMode === "shop" && shopProduct ? shopProduct.name : garmentLabel;
  resultProductPrice.textContent = state.garmentMode === "shop" && shopProduct ? shopProduct.price : "Ảnh áo riêng";
  garmentModeCaption.textContent =
    state.garmentMode === "shop"
      ? "Dùng sản phẩm đang chọn từ shop."
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
  const remoteReady = Boolean(state.remoteUrl);
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
  checkRemoteButton.disabled = state.busy;
  captureButton.disabled = state.busy || !state.cameraStream;
  clearMaskButton.disabled = state.busy || !state.hasMaskStroke;
  brushSizeInput.disabled = state.busy || autoMaskToggle.checked || !humanReady;

  if (!state.busy && !state.hasResult) {
    if (!remoteReady) {
      setStatus(REMOTE_RESTART_MESSAGE, "error");
    } else if (!garmentReady) {
      setStatus("Chọn áo từ shop hoặc tải ảnh áo riêng.", "idle");
    } else if (!humanReady) {
      setStatus("Thêm ảnh người mặc để tiếp tục.", "idle");
    } else if (!maskReady) {
      setStatus("Bật auto-mask hoặc tô vùng áo trong Cài đặt nâng cao.", "error");
    } else {
      setStatus("Sẵn sàng tạo ảnh thử đồ.", "idle");
    }
  }

  updateUndoRedoButtons();
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
    state.resetMaskOnHumanLoad = true;
    humanPreview.src = source.previewUrl;
    humanDropzone.classList.add("has-human");
  } else {
    state.resetMaskOnHumanLoad = false;
    humanPreview.removeAttribute("src");
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

}

function resetResult() {
  state.hasResult = false;
  beforeImage.removeAttribute("src");
  afterImage.removeAttribute("src");
  maskPreview.removeAttribute("src");
  compareFrame.classList.add("empty");
  compareFrame.classList.remove("has-result");
  compareSlider.disabled = true;
  seedBadge.textContent = `seed ${seedInput.value || 42}`;
}

function clearMaskCanvas(markEmpty = true) {
  if (markEmpty) {
    saveState();
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
  ctx.restore();
  if (markEmpty) {
    state.hasMaskStroke = false;
    updateMaskMode();
    updateRunReadiness();
  } else {
    clearUndoRedo();
  }
}

function scaleImageData(imageData, width, height) {
  if (imageData.width === width && imageData.height === height) {
    return imageData;
  }

  const source = document.createElement("canvas");
  source.width = imageData.width;
  source.height = imageData.height;
  source.getContext("2d").putImageData(imageData, 0, 0);

  const target = document.createElement("canvas");
  target.width = width;
  target.height = height;
  const targetContext = target.getContext("2d");
  targetContext.drawImage(source, 0, 0, width, height);
  return targetContext.getImageData(0, 0, width, height);
}

function configureMaskContext(cssWidth, cssHeight) {
  ctx.setTransform(maskCanvas.width / cssWidth, 0, 0, maskCanvas.height / cssHeight, 0, 0);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

function resizeMaskCanvas({ preserve = true } = {}) {
  if (!state.humanSource || !humanPreview.naturalWidth || !humanPreview.naturalHeight) {
    return;
  }

  const stageStyle = window.getComputedStyle(humanDropzone);
  const paddingLeft = parseFloat(stageStyle.paddingLeft) || 0;
  const paddingRight = parseFloat(stageStyle.paddingRight) || 0;
  const paddingTop = parseFloat(stageStyle.paddingTop) || 0;
  const paddingBottom = parseFloat(stageStyle.paddingBottom) || 0;
  const contentWidth = Math.max(0, humanDropzone.clientWidth - paddingLeft - paddingRight);
  const contentHeight = Math.max(0, humanDropzone.clientHeight - paddingTop - paddingBottom);
  const contained = computeContainedImageRect(
    contentWidth,
    contentHeight,
    humanPreview.naturalWidth,
    humanPreview.naturalHeight,
  );
  if (!contained.width || !contained.height) {
    return;
  }

  maskCanvas.style.left = `${paddingLeft + contained.left}px`;
  maskCanvas.style.top = `${paddingTop + contained.top}px`;
  maskCanvas.style.width = `${contained.width}px`;
  maskCanvas.style.height = `${contained.height}px`;

  const ratio = window.devicePixelRatio || 1;
  const newWidth = Math.max(1, Math.round(contained.width * ratio));
  const newHeight = Math.max(1, Math.round(contained.height * ratio));
  const dimensionsChanged = maskCanvas.width !== newWidth || maskCanvas.height !== newHeight;
  if (!dimensionsChanged) {
    configureMaskContext(contained.width, contained.height);
    return;
  }

  const previous = preserve && maskCanvas.width && maskCanvas.height ? document.createElement("canvas") : null;

  if (previous) {
    previous.width = maskCanvas.width;
    previous.height = maskCanvas.height;
    previous.getContext("2d").drawImage(maskCanvas, 0, 0);
  }

  maskCanvas.width = newWidth;
  maskCanvas.height = newHeight;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (previous) {
    ctx.drawImage(previous, 0, 0, previous.width, previous.height, 0, 0, maskCanvas.width, maskCanvas.height);
    undoStack = undoStack.map((imageData) => scaleImageData(imageData, newWidth, newHeight));
    redoStack = redoStack.map((imageData) => scaleImageData(imageData, newWidth, newHeight));
  } else {
    clearUndoRedo();
  }

  configureMaskContext(contained.width, contained.height);
  updateUndoRedoButtons();
}

function getCanvasPoint(event) {
  const rect = maskCanvas.getBoundingClientRect();
  const source = event.touches ? event.touches[0] : event;
  const scaleX = maskCanvas.width / rect.width;
  const scaleY = maskCanvas.height / rect.height;
  const backingX = Math.max(0, Math.min((source.clientX - rect.left) * scaleX, maskCanvas.width));
  const backingY = Math.max(0, Math.min((source.clientY - rect.top) * scaleY, maskCanvas.height));

  return {
    x: backingX / scaleX,
    y: backingY / scaleY,
  };
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

  state.hasMaskStroke = true;
}

function beginDraw(event) {
  if (autoMaskToggle.checked || !state.humanSource) {
    return;
  }
  saveState();
  state.drawing = true;
  state.lastPoint = getCanvasPoint(event);
  drawQueue.push({ from: state.lastPoint, to: state.lastPoint });
  if (!rafPending) {
    rafPending = true;
    requestAnimationFrame(processDrawQueue);
  }
  event.preventDefault();
}

function moveDraw(event) {
  if (!state.drawing || autoMaskToggle.checked) {
    return;
  }
  const next = getCanvasPoint(event);
  drawQueue.push({ from: state.lastPoint, to: next });
  state.lastPoint = next;
  if (!rafPending) {
    rafPending = true;
    requestAnimationFrame(processDrawQueue);
  }
  event.preventDefault();
}

function endDraw() {
  if (state.drawing) {
    state.drawing = false;
    state.lastPoint = null;
    processDrawQueue();
    updateMaskMode();
    updateRunReadiness();
  }
}

function createMaskBlob() {
  if (autoMaskToggle.checked || !state.hasMaskStroke) {
    return null;
  }

  const exportCanvas = document.createElement("canvas");
  const exportSize = computeBoundedExportSize(humanPreview.naturalWidth, humanPreview.naturalHeight);
  exportCanvas.width = exportSize.width;
  exportCanvas.height = exportSize.height;
  const exportCtx = exportCanvas.getContext("2d");
  exportCtx.fillStyle = "#000000";
  exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
  exportCtx.drawImage(maskCanvas, 0, 0, exportCanvas.width, exportCanvas.height);

  const pixels = exportCtx.getImageData(0, 0, exportCanvas.width, exportCanvas.height);
  for (let index = 0; index < pixels.data.length; index += 4) {
    const value = pixels.data[index] >= 128 ? 255 : 0;
    pixels.data[index] = value;
    pixels.data[index + 1] = value;
    pixels.data[index + 2] = value;
    pixels.data[index + 3] = 255;
  }
  exportCtx.putImageData(pixels, 0, 0);

  return new Promise((resolve, reject) => {
    exportCanvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Không thể xuất mask PNG. Hãy xóa mask và thử vẽ lại."));
      }
    }, "image/png");
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

async function checkRemoteConnection({ automatic = false } = {}) {
  if (!state.remoteUrl) {
    setStatus(REMOTE_RESTART_MESSAGE, "error");
    setRemoteFeedback(REMOTE_RESTART_MESSAGE, "error");
    return false;
  }

  checkRemoteButton.disabled = true;
  setStatus(automatic ? "Đang tự kiểm tra Colab bridge…" : "Đang kiểm tra bridge…", "busy");
  setRemoteFeedback("Đang gọi /api/health…", "busy");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REMOTE_HEALTH_TIMEOUT_MS);
    try {
      const response = await fetch("/api/remote-health", {
        signal: controller.signal,
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Kiểm tra bridge thất bại.");
      }
      updateRunReadiness();
      setStatus(`Bridge sẵn sàng: ${payload.remoteUrl}`, "idle");
      setRemoteFeedback("Kết nối API thành công.", "ok");
      return true;
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    const message =
      error.name === "AbortError"
        ? "Colab bridge phản hồi quá lâu. Kiểm tra cấu hình server rồi khởi động lại nếu cần."
        : error.message || "Không thể kết nối bridge.";
    updateRunReadiness();
    setStatus(message, "error");
    setRemoteFeedback(message, "error");
    return false;
  }
}

async function saveAndCheckRemoteUrl() {
  const remoteUrl = remoteUrlInput.value.trim();
  if (!remoteUrl) {
    setStatus(REMOTE_RESTART_MESSAGE, "error");
    setRemoteFeedback(REMOTE_RESTART_MESSAGE, "error");
    return;
  }

  checkRemoteButton.disabled = true;
  setStatus("Đang lưu cấu hình bridge…", "busy");
  setRemoteFeedback("Đang lưu URL bridge…", "busy");

  try {
    const response = await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ remoteUrl }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Không lưu được URL bridge.");
    }
    state.remoteUrl = payload.defaultRemoteUrl || "";
    remoteUrlInput.value = state.remoteUrl;
    updateRunReadiness();
    await checkRemoteConnection();
  } catch (error) {
    const message = error.message || "Không lưu được URL bridge.";
    setStatus(message, "error");
    setRemoteFeedback(message, "error");
    updateRunReadiness();
  }
}

async function runTryOn() {
  const garmentSource = getCurrentGarmentSource();
  if (!state.remoteUrl) {
    setStatus(REMOTE_RESTART_MESSAGE, "error");
    setRemoteFeedback(REMOTE_RESTART_MESSAGE, "error");
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

    const response = await fetch("/api/tryon", {
      method: "POST",
      body: formData,
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Remote request thất bại.");
    }

    beforeImage.src = payload.beforeImage;
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
    setStatus("Thử đồ hoàn tất. Kéo thanh trước/sau để so sánh.", "idle");
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

function validateImageFile(file) {
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
      URL.revokeObjectURL(previewUrl);
      resolve({ ok: true, reason: "", width: image.naturalWidth, height: image.naturalHeight });
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
  const validation = await validateImageFile(file);
  if (!validation.ok) {
    setStatus(validation.reason, "error");
    showToast(validation.reason);
    return;
  }
  const ratio = validation.width / validation.height;
  if (validation.width < 420 || validation.height < 560) {
    const reason = "Ảnh hơi nhỏ. Hãy chọn ảnh rõ và lớn hơn.";
    setStatus(reason, "error");
    showToast(reason);
    return;
  }
  if (ratio < 0.32 || ratio > 1.25) {
    const reason = "Ảnh cần thấy rõ toàn thân hoặc bán thân, không cắt quá sát.";
    setStatus(reason, "error");
    showToast(reason);
    return;
  }

  setHumanSource(makeFileSource(file));
  setStatus("Ảnh người đã sẵn sàng.", "idle");
}

async function handleGarmentFile(file) {
  if (!file) {
    return;
  }
  const validation = await validateImageFile(file);
  if (!validation.ok) {
    setStatus(validation.reason, "error");
    showToast(validation.reason);
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

async function boot() {
  const data = await fetchCatalogData();
  state.products = data.products;
  state.humans = data.humans;
  state.catalogHeroImage = data.heroImage;
  state.remoteUrl = data.defaultRemoteUrl || "";
  remoteUrlInput.value = state.remoteUrl;
  if (state.remoteUrl) {
    setRemoteFeedback("API được cấu hình bởi server.", "ok");
  } else {
    setRemoteFeedback(REMOTE_RESTART_MESSAGE, "error");
  }

  const selection = normalizeSelection(state.products, readSelectionFromQuery());
  state.selectedProductIndex = selection.productIndex;
  state.selectedVariantIndex = selection.variantIndex;
  state.selectedSize = selection.size;

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

  if (state.remoteUrl) {
    await checkRemoteConnection({ automatic: true });
  }
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

checkRemoteButton.addEventListener("click", saveAndCheckRemoteUrl);
runButton.addEventListener("click", runTryOn);
compareSlider.addEventListener("input", updateCompareSlider);
setupCompareFrameDrag();
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

maskCanvas.addEventListener("click", (event) => {
  if (state.humanSource && !autoMaskToggle.checked) {
    event.preventDefault();
    event.stopPropagation();
  }
});
maskCanvas.addEventListener("mousedown", beginDraw);
maskCanvas.addEventListener("mousemove", (event) => {
  updateBrushPreview(event);
  moveDraw(event);
});
window.addEventListener("mouseup", endDraw);

maskCanvas.addEventListener("mouseenter", updateBrushPreview);
maskCanvas.addEventListener("mouseleave", hideBrushPreview);

maskCanvas.addEventListener("touchstart", (event) => {
  updateBrushPreview(event);
  beginDraw(event);
}, { passive: false });
maskCanvas.addEventListener("touchmove", (event) => {
  updateBrushPreview(event);
  moveDraw(event);
}, { passive: false });
window.addEventListener("touchend", () => {
  hideBrushPreview();
  endDraw();
});
window.addEventListener("touchcancel", () => {
  hideBrushPreview();
  endDraw();
});
humanPreview.addEventListener("load", () => {
  const preserve = !state.resetMaskOnHumanLoad;
  state.resetMaskOnHumanLoad = false;
  resizeMaskCanvas({ preserve });
});
window.addEventListener("resize", () => resizeMaskCanvas({ preserve: true }));

const undoMaskButton = document.getElementById("undoMaskButton");
const redoMaskButton = document.getElementById("redoMaskButton");
if (undoMaskButton) {
  undoMaskButton.addEventListener("click", undo);
}
if (redoMaskButton) {
  redoMaskButton.addEventListener("click", redo);
}

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
