import { fetchCatalogData } from "/static/js/catalog.js";

const heroBeforeHuman = document.getElementById("heroBeforeHuman");
const heroBeforeGarment = document.getElementById("heroBeforeGarment");
const heroAfterHuman = document.getElementById("heroAfterHuman");
const heroAfterGarment = document.getElementById("heroAfterGarment");
const heroAfterReveal = document.getElementById("heroAfterReveal");
const heroDivider = document.getElementById("heroDivider");
const landingCompare = document.getElementById("landingCompare");
const stressGallery = document.getElementById("stressGallery");
const techPatternImage = document.getElementById("techPatternImage");
const apiForm = document.querySelector(".api-form");

const stressState = {
  tabs: [],
};
let revealScrollY = window.scrollY;
let isRevealScrollingDown = true;
let revealFrame = null;
let heroCompareValue = 50;
let isHeroCompareDragging = false;

function setupRevealAnimations() {
  window.addEventListener(
    "scroll",
    () => {
      const nextScrollY = window.scrollY;
      isRevealScrollingDown = nextScrollY >= revealScrollY;
      revealScrollY = nextScrollY;
      scheduleRevealUpdate();
    },
    { passive: true }
  );
  window.addEventListener("resize", scheduleRevealUpdate, { passive: true });

  observeRevealItems();
}

function observeRevealItems() {
  const revealItems = Array.from(document.querySelectorAll(".reveal-item"));
  if (revealItems.length === 0) {
    return;
  }

  revealItems.forEach((item, index) => {
    item.style.setProperty("--reveal-delay", `${Math.min(index * 55, 260)}ms`);
  });
  updateRevealItems();
}

function scheduleRevealUpdate() {
  if (revealFrame) {
    return;
  }

  revealFrame = window.requestAnimationFrame(() => {
    revealFrame = null;
    updateRevealItems();
  });
}

function replayReveal(item) {
  item.classList.remove("is-reveal-instant");
  item.classList.add("is-visible");
  item.dataset.revealReplayReady = "false";
}

function showRevealInstantly(item) {
  item.classList.add("is-reveal-instant", "is-visible");
  window.requestAnimationFrame(() => {
    item.classList.remove("is-reveal-instant");
  });
}

function updateRevealItems() {
  const revealLine = window.innerHeight * 0.82;
  const resetLine = window.innerHeight + 24;

  document.querySelectorAll(".reveal-item").forEach((item) => {
    const rect = item.getBoundingClientRect();
    const isInRevealZone = rect.top < revealLine && rect.bottom > 0;

    if (isRevealScrollingDown) {
      if (!isInRevealZone) {
        return;
      }

      if (item.dataset.revealReplayReady === "true") {
        replayReveal(item);
        return;
      }

      item.classList.remove("is-reveal-instant");
      item.classList.add("is-visible");
      return;
    }

    if (rect.top > resetLine) {
      item.dataset.revealReplayReady = "true";
      item.classList.remove("is-reveal-instant", "is-visible");
    }

    if (rect.top < window.innerHeight && rect.bottom > 0) {
      showRevealInstantly(item);
    }
  });
}

function updateHeroCompare(value = heroCompareValue) {
  heroCompareValue = Math.max(0, Math.min(value, 100));
  heroAfterReveal.style.clipPath = `inset(0 ${100 - heroCompareValue}% 0 0)`;
  heroDivider.style.left = `${heroCompareValue}%`;
  landingCompare?.setAttribute("aria-valuenow", String(Math.round(heroCompareValue)));
}

function updateHeroCompareFromPointer(clientX) {
  const rect = landingCompare.getBoundingClientRect();
  const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
  updateHeroCompare((x / rect.width) * 100);
}

function setupHeroCompareDrag() {
  if (!landingCompare) {
    return;
  }

  landingCompare.addEventListener("pointerdown", (event) => {
    isHeroCompareDragging = true;
    landingCompare.setPointerCapture(event.pointerId);
    updateHeroCompareFromPointer(event.clientX);
  });

  landingCompare.addEventListener("pointermove", (event) => {
    if (!isHeroCompareDragging) {
      return;
    }
    updateHeroCompareFromPointer(event.clientX);
  });

  landingCompare.addEventListener("pointerup", () => {
    isHeroCompareDragging = false;
  });

  landingCompare.addEventListener("pointercancel", () => {
    isHeroCompareDragging = false;
  });

  landingCompare.addEventListener("keydown", (event) => {
    const step = event.shiftKey ? 10 : 5;
    if (event.key === "ArrowLeft") {
      updateHeroCompare(heroCompareValue - step);
      event.preventDefault();
    }
    if (event.key === "ArrowRight") {
      updateHeroCompare(heroCompareValue + step);
      event.preventDefault();
    }
  });

  updateHeroCompare(heroCompareValue);
}

function setHeroImages(data) {
  const human = data.humans[0]?.url || data.heroImage;
  const garment = data.products[2]?.variants[0]?.url || data.products[0]?.variants[0]?.url || data.heroImage;

  [heroBeforeHuman, heroAfterHuman].forEach((image) => {
    if (image && human) {
      image.src = human;
      image.decoding = "async";
    }
  });
  [heroBeforeGarment, heroAfterGarment, techPatternImage].forEach((image) => {
    if (image && garment) {
      image.src = garment;
      image.decoding = "async";
    }
  });
}

function buildStressTabs(data) {
  const humans = data.humans;
  const products = data.products;
  const cloth = products.flatMap((product) => product.variants.map((variant) => ({
    product,
    variant,
  })));
  const getHuman = (index) => humans[index % Math.max(humans.length, 1)]?.url || data.heroImage;
  const getCloth = (index) => cloth[index % Math.max(cloth.length, 1)]?.variant?.url || data.heroImage;

  stressState.tabs = [
    {
      kicker: "Detail Preservation",
      label: "Chất liệu & Họa tiết",
      title: "Bài toán Chất liệu & Họa tiết phức tạp",
      description: "Logo, áo dài lụa và các lớp xếp ly là nơi AI thử đồ cũ thường làm méo chữ, vỡ pattern hoặc làm mất nếp gấp.",
      layout: "cards",
      items: [
        {
          title: "Logo to bản",
          note: "Giữ chữ sắc nét, không kéo giãn sai hình học.",
          human: getHuman(0),
          garment: getCloth(4),
        },
        {
          title: "Áo dài hoa chìm",
          note: "Tà lụa rủ tự nhiên, họa tiết chạy theo thân áo.",
          human: getHuman(1),
          garment: getCloth(7),
        },
        {
          title: "Nếp gấp nhiều tầng",
          note: "Giữ khối 3D ở váy xếp ly hoặc áo phao.",
          human: getHuman(2),
          garment: getCloth(10),
        },
      ],
    },
    {
      kicker: "Body Inclusivity",
      label: "Đa dạng hình thể",
      title: "Một bộ trang phục, nhiều dáng người",
      description: "Chủ shop không chỉ bán cho người mẫu lookbook. Khách cần nhìn thấy chính form dáng của họ trước khi chốt đơn.",
      layout: "orbit",
      items: [
        { title: "Plus-size", note: "Không bóp méo tỉ lệ cơ thể.", human: getHuman(0), garment: getCloth(8) },
        { title: "Petite", note: "Giữ chiều dài váy hợp dáng thấp bé.", human: getHuman(1), garment: getCloth(8) },
        { title: "Cao gầy", note: "Độ rủ kéo dài tự nhiên.", human: getHuman(2), garment: getCloth(8) },
        { title: "Vòng eo mềm", note: "Fit thật hơn lookbook studio.", human: getHuman(3), garment: getCloth(8) },
      ],
    },
    {
      kicker: "Complex Poses",
      label: "Tư thế khó",
      title: "Không chỉ xử lý dáng đứng thẳng",
      description: "Tay vắt chéo, đứng nghiêng 45 độ hay dang tay đều là các vùng khuất khiến AI cũ tạo lỗi xuyên áo hoặc dính nét.",
      layout: "cards",
      items: [
        { title: "Tay vắt chéo", note: "Ống tay áo luồn qua vùng khuất sạch hơn.", human: getHuman(2), garment: getCloth(2) },
        { title: "Nghiêng 45 độ", note: "Giữ phối cảnh thân áo theo hướng người.", human: getHuman(3), garment: getCloth(5) },
        { title: "Dang tay tự nhiên", note: "Không tạo lỗi xuyên thấu ở phần nách và tay.", human: getHuman(4), garment: getCloth(1) },
      ],
    },
  ];
}

function createStressEditorialPanel({ tab, item, caseNumber }) {
  const panel = document.createElement("article");
  const copy = document.createElement("div");
  const eyebrow = document.createElement("span");
  const title = document.createElement("h3");
  const note = document.createElement("p");
  const proof = document.createElement("strong");
  const media = document.createElement("div");
  const human = document.createElement("img");
  const scan = document.createElement("span");
  const garment = document.createElement("img");
  const mediaLabel = document.createElement("span");

  panel.className = "stress-editorial-card reveal-item";
  copy.className = "stress-editorial-copy";
  eyebrow.textContent = `${String(caseNumber).padStart(2, "0")} / ${tab.label}`;
  title.textContent = item.title;
  note.textContent = item.note;
  proof.textContent = tab.kicker;
  media.className = "stress-editorial-media";
  media.tabIndex = 0;
  media.setAttribute("aria-label", `${item.title}: ${item.note}`);
  media.addEventListener("pointerenter", () => media.classList.add("is-compositing"));
  media.addEventListener("pointerleave", () => media.classList.remove("is-compositing"));
  media.addEventListener("focus", () => media.classList.add("is-compositing"));
  media.addEventListener("blur", () => media.classList.remove("is-compositing"));
  human.src = item.human;
  human.alt = `${item.title} - người mẫu stress-test`;
  human.className = "stress-editorial-human";
  human.width = 720;
  human.height = 900;
  human.loading = "lazy";
  human.decoding = "async";
  scan.className = "stress-editorial-scan";
  garment.src = item.garment;
  garment.alt = `${item.title} - trang phục cần giữ chi tiết`;
  garment.className = "stress-editorial-garment";
  garment.width = 360;
  garment.height = 450;
  garment.loading = "lazy";
  garment.decoding = "async";
  mediaLabel.textContent = tab.kicker;

  copy.append(eyebrow, title, note, proof);
  media.append(human, scan, garment, mediaLabel);
  panel.append(copy, media);
  return panel;
}

function renderStressPanel() {
  if (stressState.tabs.length === 0) {
    return;
  }

  const panels = stressState.tabs.map((tab) => ({
    tab,
    item: tab.items[0],
  }));

  stressGallery.replaceChildren(
    ...panels.map((panel, index) => createStressEditorialPanel({
      ...panel,
      caseNumber: index + 1,
    }))
  );
  observeRevealItems();
}

async function boot() {
  setupRevealAnimations();
  setupHeroCompareDrag();
  apiForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const button = apiForm.querySelector("button");
    button.textContent = "Đã ghi nhận email";
    button.disabled = true;
  });

  try {
    const data = await fetchCatalogData();
    setHeroImages(data);
    buildStressTabs(data);
    renderStressPanel();
    updateHeroCompare();
  } catch (error) {
    console.error(error);
    stressGallery.textContent = "Không tải được dữ liệu stress-test.";
  }
}

boot();
