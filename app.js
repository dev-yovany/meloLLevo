const BACKEND_URL = "https://melollevo-backend.dev-yovany.workers.dev";

const currency = {
  format: (v) =>
    new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(v) + " CUP",
};

let data = { categories: [], businesses: [], products: [] };
let activeCategory = "Todos";
let productFromBusiness = false;
let detailScrollY = 0;
let listScrollY = 0;
let activeDetailSync = null;
let detailReturn = null;
const cart = new Map();
const el = (id) => document.getElementById(id);

function bizGradient(id) {
  return "linear-gradient(135deg, #6cbf66, #5DB355)";
}
function productGradient(id) {
  return "linear-gradient(135deg, #d87676, #CE4E4D)";
}
function bizName(businessId) {
  const b = data.businesses.find((x) => x.id === businessId);
  return b ? b.name : "";
}
function getBusiness(id) {
  return data.businesses.find((x) => x.id === id);
}
function getProduct(id) {
  return data.products.find((x) => String(x.id) === String(id));
}
function displayPrice(p) {
  return currency.format(p.price);
}

const DAYS = ["dom", "lun", "mar", "mie", "jue", "vie", "sab"];

function dayInRange(days, d) {
  const ds = days.split("-");
  const start = DAYS.indexOf(ds[0]);
  const end = ds.length > 1 ? DAYS.indexOf(ds[1]) : start;
  if (end >= start) return d >= start && d <= end;
  return d >= start || d <= end;
}

function businessStatus(b) {
  if (!b || !b.schedule || !b.schedule.length) return { open: true, label: "Abierto" };
  const d = new Date().getDay();
  const mins = new Date().getHours() * 60 + new Date().getMinutes();
  for (const rule of b.schedule) {
    if (!dayInRange(rule[0], d)) continue;
    const [oh, om] = rule[1].split(":").map(Number);
    const [ch, cm] = rule[2].split(":").map(Number);
    const open = oh * 60 + om;
    const close = ch * 60 + cm;
    if (close > open) {
      if (mins >= open && mins < close) return { open: true, label: "Abierto" };
    } else {
      if (mins >= open || mins < close) return { open: true, label: "Abierto" };
    }
  }
  return { open: false, label: "Cerrado" };
}

function todayHoursLine(b) {
  if (!b || !b.schedule || !b.schedule.length) return "Disponible todos los días";
  const d = new Date().getDay();
  for (const rule of b.schedule) {
    if (dayInRange(rule[0], d)) return `Hoy: ${rule[1]} a ${rule[2]}`;
  }
  return "Cerrado hoy";
}

const WEEK_LABELS = ["D", "L", "M", "M", "J", "V", "S"];
function businessOpenOnDay(b, d) {
  if (!b || !b.schedule || !b.schedule.length) return true;
  return b.schedule.some((r) => dayInRange(r[0], d));
}
const DAY_RANGE_LABELS = {
  "lun-dom": "Todos los días",
  "lun-vie": "Entre semana",
  "lun-sab": "Lun a Sáb",
  "sab-dom": "Fin de semana",
  "lun": "Lunes", "mar": "Martes", "mie": "Miércoles", "jue": "Jueves",
  "vie": "Viernes", "sab": "Sábado", "dom": "Domingo",
};
function fmt12h(t) {
  if (!t) return t;
  const [h, m] = t.split(":").map(Number);
  if (isNaN(h)) return t;
  const suffix = h < 12 ? "AM" : "PM";
  let hh = h % 12;
  if (hh === 0) hh = 12;
  return `${hh}:${String(m || 0).padStart(2, "0")} ${suffix}`;
}
function scheduleLines(b) {
  if (!b || !b.schedule || !b.schedule.length) {
    return '<span class="sched-row"><span class="sched-day">Todos los días</span><span class="sched-time">24 horas</span></span>';
  }
  return b.schedule
    .map((r) => {
      const label = DAY_RANGE_LABELS[r[0]] || r[0];
      const h = r[1] === "00:00" && r[2] === "00:00" ? "24 horas" : `${fmt12h(r[1])} a ${fmt12h(r[2])}`;
      return `<span class="sched-row"><span class="sched-day">${label}</span><span class="sched-time">${h}</span></span>`;
    })
    .join("");
}
function weekBar(b) {
  if (!b) return "";
  const chips = WEEK_LABELS.map((label, d) =>
    `<span class="day-chip${businessOpenOnDay(b, d) ? " on" : " off"}">${label}</span>`
  ).join("");
  return `<span class="week-bar">${chips}</span>`;
}

function statusInline(b) {
  const st = businessStatus(b);
  return `<span class="biz-status-line"><span class="open-dot ${st.open ? "on" : "off"}" data-bid="${b.id}"></span><span class="status-label">${st.label}</span></span>`;
}

function statusPill(b) {
  const st = businessStatus(b);
  return `<span class="biz-status ${st.open ? "on" : "off"}" data-bid="${b.id}"><span class="open-dot"></span><span class="status-label">${st.label}</span></span>`;
}

function productBizLine(p) {
  const b = getBusiness(p.businessId);
  const st = businessStatus(b);
  return `<span class="open-dot ${st.open ? "on" : "off"}" data-bid="${p.businessId}"></span><span class="status-label">${st.label}</span>`;
}

async function loadData() {
  try {
    const res = await fetch("data.json");
    data = await res.json();
  } catch (e) {
    data = { categories: [], businesses: [], products: [] };
  }
  renderBusinesses();
  renderCategories();
  renderProducts();
  renderFeatured();
  loadCart();
  updateCartUI();
}

function updateStatuses() {
  document.querySelectorAll(".biz-status, .open-dot[data-bid]").forEach((n) => {
    const b = getBusiness(n.dataset.bid);
    const st = businessStatus(b);
    n.classList.toggle("on", st.open);
    n.classList.toggle("off", !st.open);
    const lab = n.querySelector(".status-label");
    if (lab) lab.textContent = st.label;
  });
  document.querySelectorAll(".add-float[data-id]").forEach((n) => {
    const p = getProduct(n.dataset.id);
    const b = p && getBusiness(p.businessId);
    const open = !!(b && businessStatus(b).open);
    n.classList.toggle("off", !open);
    n.setAttribute("aria-disabled", open ? "false" : "true");
  });
}
setInterval(updateStatuses, 60000);

function featuredCard(p, goHome) {
  const card = document.createElement("div");
  card.className = "featured-card";
  const media = p.image
    ? `<img src="${p.image}" alt="${p.name}" loading="lazy" />`
    : `<div class="fc-ph" style="background:${productGradient(p.businessId)}"></div>`;
  card.innerHTML = `
    <div class="fc-media">${media}</div>
    <div class="fc-body">
      <div class="featured-name">${p.name}</div>
      <div class="featured-biz">${bizName(p.businessId)}</div>
      <div class="featured-price">${displayPrice(p)}</div>
    </div>`;
  card.addEventListener("click", () => (goHome ? goToHomeGrid(p.id) : goToProduct(p.id)));
  return card;
}

function startCarousel(viewport, track, dotsBox, items, goHome) {
  track.innerHTML = "";
  dotsBox.innerHTML = items.map((_, i) => `<span class="dot${i === 0 ? " active" : ""}"></span>`).join("");
  const dots = [...dotsBox.children];
  const len = items.length;
  const step = () => {
    const c = track.querySelector(".featured-card");
    return c ? c.getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap) : 0;
  };
  const setWidth = () => len * step();
  [0, 1, 2, 3].forEach(() => items.forEach((p) => track.appendChild(featuredCard(p, goHome))));
  const s = { ready: false, idx: 0, gesture: false, lastAction: 0, lastMove: 0 };
  const showDots = (i) => dots.forEach((d, k) => d.classList.toggle("active", k === i % len));
  const setIdx = () => {
    const w = setWidth();
    if (!w) return;
    const stepW = w / len;
    const cur = Math.round((viewport.scrollLeft - w) / stepW);
    s.idx = ((cur % len) + len) % len;
    showDots(s.idx);
  };
  const center = () => {
    if (s.gesture || !s.ready || Date.now() - s.lastMove < 400) return;
    const w = setWidth();
    if (!w) return;
    let x = viewport.scrollLeft;
    if (x >= w * 2) viewport.scrollLeft = x - w;
    else if (x < w) viewport.scrollLeft = x + w;
    s.lastMove = Date.now();
    setIdx();
  };
  const gestureStart = () => { s.gesture = true; s.lastAction = Date.now(); };
  const gestureEnd = () => { s.gesture = false; s.lastAction = Date.now(); };
  viewport.addEventListener("touchstart", gestureStart, { passive: true });
  viewport.addEventListener("touchend", gestureEnd, { passive: true });
  viewport.addEventListener("touchcancel", gestureEnd, { passive: true });
  viewport.addEventListener("pointerdown", gestureStart, { passive: true });
  window.addEventListener("pointerup", (e) => {
    if (e.pointerType === "touch" || e.pointerType === "mouse") gestureEnd();
  }, { passive: true });
  window.addEventListener("pointercancel", gestureEnd, { passive: true });
  viewport.addEventListener("mousedown", gestureStart);
  window.addEventListener("mouseup", gestureEnd);
  const onScroll = () => { s.lastMove = Date.now(); setIdx(); };
  viewport.addEventListener("scroll", onScroll, { passive: true });
  viewport.addEventListener("scrollend", onScroll, { passive: true });
  const w = setWidth();
  if (w) {
    viewport.style.scrollSnapType = "none";
    viewport.scrollLeft = w;
    viewport.style.scrollSnapType = "x mandatory";
    s.ready = true;
    setIdx();
  }
  const centerTimer = setInterval(center, 300);
  const autoTimer = setInterval(() => {
    if (!s.ready || s.gesture || Date.now() - s.lastAction < 5000) return;
    const cw = setWidth();
    if (!cw) return;
    const next = (s.idx + 1) % len;
    viewport.scrollTo({ left: cw + next * (cw / len), behavior: "smooth" });
    s.idx = next;
    showDots(next);
  }, 4000);
  return { center: centerTimer, auto: autoTimer };
}

let featuredTimer = null;
let featuredRecent = null;
function renderFeatured() {
  const featured = data.products.filter((p) => p.price >= 12000).slice(0, 6);
  if (!featured.length) return;
  const viewport = el("featured-viewport");
  const track = el("featured-track");
  const dotsBox = el("featured-dots");
  if (!viewport || !track || !dotsBox) return;
  if (featuredTimer) clearInterval(featuredTimer);
  if (featuredRecent) clearInterval(featuredRecent);
  const t = startCarousel(viewport, track, dotsBox, featured);
  featuredRecent = t.center;
  featuredTimer = t.auto;
}

let similarTimer = null;
let similarRecent = null;
function renderSimilar(product) {
  if (!product) return;
  const features = new Set(
    data.products.filter((p) => p.price >= 12000).slice(0, 6).map((p) => String(p.id))
  );
  let pool = data.products.filter(
    (p) => String(p.id) !== String(product.id) && !features.has(String(p.id)) && p.category === product.category
  );
  if (pool.length < 4) {
    pool = data.products.filter(
      (p) => String(p.id) !== String(product.id) && !features.has(String(p.id))
    );
  }
  const sim = pool.slice(0, 6);
  const sec = el("similar-section");
  if (!sec || !sim.length) return;
  const viewport = el("similar-viewport");
  const track = el("similar-track");
  const dotsBox = el("similar-dots");
  if (!viewport || !track || !dotsBox) return;
  if (similarTimer) clearInterval(similarTimer);
  if (similarRecent) clearInterval(similarRecent);
  const t = startCarousel(viewport, track, dotsBox, sim, true);
  similarRecent = t.center;
  similarTimer = t.auto;
  sec.classList.remove("hidden");
}

function businessAvatar(b) {
  const initial = b.name.charAt(0).toUpperCase();
  if (b.image) return `<img src="${b.image}" alt="${b.name}" class="biz-photo">`;
  return `<div class="business-avatar" style="background:${bizGradient(b.id)}">${initial}</div>`;
}

function renderBusinesses() {
  const list = el("business-list");
  list.innerHTML = "";
  data.businesses.forEach((b) => {
    const card = document.createElement("div");
    card.className = "business-card";
    card.innerHTML = `
      ${statusPill(b)}
      ${businessAvatar(b)}
      <div class="business-card-name">${b.name}</div>
      <div class="business-card-cat">${b.category || ""}</div>
      <div class="business-card-desc">${b.description || ""}</div>`;
    card.addEventListener("click", () => openBusiness(b));
    list.appendChild(card);
  });
}

function resetHomeHero() {
  document.querySelector("#view-home .brand-hero")?.classList.remove("hidden");
  document.querySelector("#view-home .brand-hero")?.classList.remove("always-mini");
  el("view-home")?.classList.remove("in-business");
  el("business-hero")?.classList.add("hidden");
  el("product-hero")?.classList.add("hidden");
  el("business-hero-back")?.classList.add("hidden");
  el("product-hero-back")?.classList.add("hidden");
  el("featured-section")?.classList.remove("hidden");
  el("similar-section")?.classList.add("hidden");
}
function hideBusiness() {
  el("business-detail").classList.add("hidden");
  el("product-detail").classList.add("hidden");
  resetHomeHero();
}
function openBusiness(business) {
  el("home-tabs").classList.add("hidden");
  el("tab-businesses").classList.add("hidden");
  el("tab-products").classList.add("hidden");
  el("product-detail").classList.add("hidden");
  el("business-detail").classList.remove("hidden");
  el("view-home").classList.add("in-business");
  const homeHero = document.querySelector("#view-home .brand-hero");
  homeHero.classList.add("always-mini");
  homeHero.classList.remove("hero-collapsed");
  heroCollapsed = false;
  el("featured-section").classList.add("hidden");
  el("similar-section")?.classList.add("hidden");
  el("product-hero").classList.add("hidden");
  el("product-hero-back")?.classList.add("hidden");
  el("business-hero-back")?.classList.remove("hidden");
  const heroImg = el("business-hero-img");
  heroImg.style.backgroundImage = business.image ? `url("${business.image}")` : "";
  el("business-hero").classList.remove("hidden");
  el("business-detail-name").textContent = business.name;
  el("business-detail-cat").textContent = business.category || "";
  el("business-detail-pill").innerHTML = statusPill(business);
  el("business-detail-status").innerHTML = `<span class="sched-title">Horario</span>` + weekBar(business) + `<span class="biz-hours">${scheduleLines(business)}</span>`;
  const prods = data.products.filter((p) => p.businessId === business.id);
  const cats = ["Todos", ...new Set(prods.map((p) => p.category))];
  const bar = el("business-category-bar");
  bar.innerHTML = "";
  let activeBizCat = "Todos";
  function renderBizProducts() {
    const grid = el("business-products");
    grid.innerHTML = "";
    const filtered = activeBizCat === "Todos" ? prods : prods.filter((p) => p.category === activeBizCat);
    filtered.forEach((p) => grid.appendChild(createProductCard(p)));
  }
  cats.forEach((cat) => {
    const btn = document.createElement("button");
    btn.className = "cat-pill" + (cat === "Todos" ? " active" : "");
    btn.textContent = cat;
    btn.addEventListener("click", () => {
      activeBizCat = cat;
      bar.querySelectorAll(".cat-pill").forEach((p) =>
        p.classList.toggle("active", p.textContent === cat)
      );
      renderBizProducts();
    });
    bar.appendChild(btn);
  });
  renderBizProducts();
  const rec = el("recommended-list");
  rec.innerHTML = "";
  const others = data.businesses.filter((b) => b.id !== business.id);
  const shuffled = others.sort(() => Math.random() - 0.5).slice(0, 6);
  shuffled.forEach((b) => {
    const card = document.createElement("div");
    card.className = "business-card";
    card.innerHTML = `
      ${statusPill(b)}
      ${businessAvatar(b)}
      <div class="business-card-name">${b.name}</div>
      <div class="business-card-cat">${b.category || ""}</div>
      <div class="business-card-desc">${b.description || ""}</div>`;
    card.addEventListener("click", () => openBusiness(b));
    rec.appendChild(card);
  });
  listScrollY = window.scrollY;
  window.scrollTo(0, 0);
  armDetailBack();
}

function closeBusiness() {
  el("home-tabs").classList.remove("hidden");
  resetHomeHero();
  const active = document.querySelector(".home-tab.active").dataset.tab;
  el("tab-businesses").classList.toggle("hidden", active !== "businesses");
  el("tab-products").classList.toggle("hidden", active !== "products");
  el("business-detail").classList.add("hidden");
  window.scrollTo(0, listScrollY);
  setHeroCollapsed(listScrollY >= heroRef() * 0.7);
}

function renderProductOptions(product, sel) {
  const box = el("product-options");
  if (!box) return;
  box.innerHTML = "";
  if (!product.groups || !product.groups.length) {
    box.classList.add("hidden");
    return;
  }
  box.classList.remove("hidden");
  box.innerHTML =
    `<div class="opt-note">Elige los añadidos que prefieras (1 de cada uno).</div>` +
    product.groups
      .map(
        (g, gi) => `
      <div class="opt-group">
        <div class="opt-title">${g.name}</div>
        <div class="opt-list">
          ${g.options
            .map(
              (o, oi) => `
            <button type="button" class="opt-item" data-g="${gi}" data-o="${oi}" aria-pressed="false">
              <span class="opt-name">${o.name}</span>
              <span class="opt-extra">${o.extra ? "+" + currency.format(o.extra) : ""}</span>
              <span class="opt-tick">✓</span>
            </button>`
            )
            .join("")}
        </div>
      </div>`
      )
      .join("");
  const items = [...box.querySelectorAll(".opt-item")];
  const priceEl = el("product-detail-price");
  const refresh = () => {
    items.forEach((c) => {
      const gi = +c.dataset.g;
      const oi = +c.dataset.o;
      const active = sel[gi].includes(oi);
      c.classList.toggle("active", active);
      c.setAttribute("aria-pressed", active ? "true" : "false");
    });
    const extras = product.groups.reduce(
      (acc, g, gi) => acc + sel[gi].reduce((a, oi) => a + g.options[oi].extra, 0),
      0
    );
    priceEl.textContent = currency.format(product.price + extras);
  };
  items.forEach((c) => {
    c.addEventListener("click", () => {
      const gi = +c.dataset.g;
      const oi = +c.dataset.o;
      const g = product.groups[gi];
      const arr = sel[gi];
      if (g.multi) {
        const i = arr.indexOf(oi);
        if (i === -1) arr.push(oi);
        else arr.splice(i, 1);
      } else {
        sel[gi] = arr.includes(oi) ? [] : [oi];
      }
      refresh();
      if (activeDetailSync) activeDetailSync();
    });
  });
  refresh();
}

function openProduct(product, presel) {
  detailReturn = null;
  productFromBusiness = !el("business-detail").classList.contains("hidden");
  detailScrollY = window.scrollY;
  const biz = getBusiness(product.businessId);
  el("home-tabs").classList.add("hidden");
  el("tab-businesses").classList.add("hidden");
  el("tab-products").classList.add("hidden");
  el("business-detail").classList.add("hidden");
  el("product-detail").classList.remove("hidden");
  el("view-home").classList.add("in-business");
  const homeHero = document.querySelector("#view-home .brand-hero");
  homeHero.classList.add("always-mini");
  homeHero.classList.remove("hero-collapsed");
  heroCollapsed = false;
  el("business-hero").classList.add("hidden");
  el("business-hero-back")?.classList.add("hidden");
  el("product-hero").classList.remove("hidden");
  el("product-hero-back")?.classList.remove("hidden");
  el("featured-section").classList.add("hidden");
  const heroImg = el("product-hero-img");
  heroImg.style.backgroundImage = product.image
    ? `url("${product.image}")`
    : productGradient(product.businessId);
  el("product-detail-name").textContent = product.name;
  el("product-detail-pill").innerHTML = statusPill(biz);
  el("product-detail-biz").textContent = bizName(product.businessId);
  el("product-detail-price").textContent = currency.format(product.price);
  el("product-detail-desc").textContent =
    "Aquí irá la descripción completa de este producto, sus especificaciones y cualquier detalle relevante para el cliente.";
  const addBtn = el("product-detail-add");
  const qtyBox = el("product-detail-qty");
  const qtyInput = el("detail-qty-input");
  const open = !!biz && businessStatus(biz).open;
  addBtn.classList.toggle("off", !open);
  const sel = product.groups
    ? (presel ? presel.map((a) => a.slice()) : product.groups.map(() => []))
    : null;
  renderProductOptions(product, sel);
  const configKey = () => {
    if (!product.groups || !product.groups.length) return String(product.id);
    const names = product.groups.map((g, gi) =>
      (sel[gi] || []).map((oi) => (g.options[oi] && g.options[oi].name)).filter(Boolean).sort()
    );
    return String(product.id) + "::" + JSON.stringify(names);
  };
  const refreshDetail = () => {
    const qty = cart.get(configKey()) || 0;
    if (qty > 0) {
      addBtn.classList.add("hidden");
      qtyBox.classList.remove("hidden");
      if (qtyInput !== document.activeElement) qtyInput.value = String(qty);
    } else {
      addBtn.classList.remove("hidden");
      qtyBox.classList.add("hidden");
    }
  };
  activeDetailSync = refreshDetail;
  qtyBox.querySelector('[data-a="minus"]').addEventListener("click", () => {
    const n = (cart.get(configKey()) || 0) - 1;
    if (n <= 0) cart.delete(configKey());
    else cart.set(configKey(), n);
    updateCartUI();
  });
  qtyBox.querySelector('[data-a="plus"]').addEventListener("click", () => {
    const k = configKey();
    cart.set(k, (cart.get(k) || 0) + 1);
    updateCartUI();
  });
  qtyBox.querySelector(".cq-del").addEventListener("click", () => {
    cart.delete(configKey());
    updateCartUI();
  });
  qtyInput.addEventListener("click", (e) => e.stopPropagation());
  qtyInput.addEventListener("input", (e) => {
    const v = parseInt(e.target.value, 10);
    if (Number.isFinite(v) && v >= 1) {
      cart.set(configKey(), v);
      updateCartUI();
      refreshDetail();
    }
  });
  qtyInput.addEventListener("change", (e) => {
    const k = configKey();
    const v = parseInt(e.target.value, 10);
    e.target.value = Number.isFinite(v) && v >= 1 ? String(v) : String(cart.get(k) || 1);
  });
  addBtn.onclick = () => {
    if (!open) return;
    if (sel) addToCartProduct(product, sel);
    else addToCart(product.id);
    bounceNav("cart");
    refreshDetail();
  };
  refreshDetail();
  renderSimilar(product);
  window.scrollTo(0, 0);
  armDetailBack();
}

function closeProduct() {
  el("product-detail").classList.add("hidden");
  if (detailReturn === "cart") {
    detailReturn = null;
    showView("cart");
    return;
  }
  if (productFromBusiness) {
    el("business-detail").classList.remove("hidden");
    el("home-tabs").classList.add("hidden");
    el("view-home").classList.add("in-business");
    const homeHero = document.querySelector("#view-home .brand-hero");
    homeHero.classList.add("always-mini");
    homeHero.classList.remove("hero-collapsed");
    heroCollapsed = false;
    el("business-hero").classList.remove("hidden");
    el("business-hero-back")?.classList.remove("hidden");
    el("product-hero").classList.add("hidden");
    el("product-hero-back")?.classList.add("hidden");
    el("featured-section").classList.add("hidden");
    el("similar-section")?.classList.add("hidden");
    window.scrollTo(0, detailScrollY);
    return;
  }
  el("home-tabs").classList.remove("hidden");
  resetHomeHero();
  const active = document.querySelector(".home-tab.active").dataset.tab;
  el("tab-businesses").classList.toggle("hidden", active !== "businesses");
  el("tab-products").classList.toggle("hidden", active !== "products");
  window.scrollTo(0, detailScrollY);
  setHeroCollapsed(detailScrollY >= heroRef() * 0.7);
}

function createProductCard(p) {
  const card = document.createElement("div");
  card.className = "product-card";
  card.dataset.id = String(p.id);
  const key = String(p.id);
  const media = p.image
    ? `<img src="${p.image}" alt="${p.name}" />`
    : `<div class="ph" style="background:${productGradient(p.businessId)}">${bizName(p.businessId).charAt(0)}</div>`;
  const addBtn = document.createElement("button");
  addBtn.className = "add-float";
  addBtn.dataset.id = key;
  addBtn.innerHTML = `<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
  const setAddState = (b) => {
    const canAdd = b && businessStatus(b).open;
    addBtn.classList.toggle("off", !canAdd);
    addBtn.setAttribute("aria-disabled", canAdd ? "false" : "true");
  };
  setAddState(getBusiness(p.businessId));
  card.innerHTML = `
    ${statusPill(getBusiness(p.businessId))}
    <div class="product-media">
      ${media}
    </div>
    <div class="product-body">
      <div class="product-name">${p.name}</div>
      <div class="product-biz">${bizName(p.businessId)}</div>
      <div class="product-price">${displayPrice(p)}</div>
      <div class="card-qty hidden">
        <button type="button" class="cq-btn" data-a="minus" aria-label="Quitar">−</button>
        <input type="text" class="cq-input" inputmode="numeric" autocomplete="off" aria-label="Cantidad" value="1" />
        <button type="button" class="cq-btn" data-a="plus" aria-label="Sumar">+</button>
        <button type="button" class="cq-del" aria-label="Eliminar"><svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 6 6 18"/><path d="M6 6l12 12"/></svg></button>
      </div>
    </div>`;
  card.querySelector(".product-media").appendChild(addBtn);
  const qtyBox = card.querySelector(".card-qty");
  const qtyInput = card.querySelector(".cq-input");
  const showStepper = () => {
    card.classList.add("has-qty");
    addBtn.classList.add("hidden");
    qtyBox.classList.remove("hidden");
  };
  const hideStepper = () => {
    card.classList.remove("has-qty");
    addBtn.classList.remove("hidden");
    qtyBox.classList.add("hidden");
  };
  const updateStepper = () => {
    const c = cart.get(key) || 0;
    if (c <= 0) { hideStepper(); return; }
    if (qtyInput !== document.activeElement) qtyInput.value = String(c);
  };
  const syncCartView = () => {
    if (!el("view-cart").classList.contains("hidden")) renderCart();
  };
  const configurable = !!(p.groups && p.groups.length);
  addBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (configurable) {
      openProduct(p);
      return;
    }
    const biz = getBusiness(p.businessId);
    if (!biz || !businessStatus(biz).open) return;
    addToCart(p.id);
    flashAdd(addBtn);
    showStepper();
    updateStepper();
  });
  qtyInput.addEventListener("click", (e) => e.stopPropagation());
  qtyInput.addEventListener("input", (e) => {
    e.stopPropagation();
    const v = parseInt(e.target.value, 10);
    if (Number.isFinite(v) && v >= 1) {
      cart.set(key, v);
      updateCartUI();
    }
  });
  qtyInput.addEventListener("change", (e) => {
    const v = parseInt(e.target.value, 10);
    e.target.value = Number.isFinite(v) && v >= 1 ? String(v) : String(cart.get(key) || 1);
  });
  qtyBox.querySelector('[data-a="minus"]').addEventListener("click", (e) => {
    e.stopPropagation();
    const next = (cart.get(key) || 0) - 1;
    if (next <= 0) { cart.delete(key); hideStepper(); }
    else cart.set(key, next);
    updateCartUI();
    syncCartView();
    updateStepper();
  });
  qtyBox.querySelector('[data-a="plus"]').addEventListener("click", (e) => {
    e.stopPropagation();
    addToCart(p.id);
    updateStepper();
  });
  qtyBox.querySelector(".cq-del").addEventListener("click", (e) => {
    e.stopPropagation();
    cart.delete(key);
    updateCartUI();
    syncCartView();
    hideStepper();
  });
  if (!configurable && cart.get(key)) { showStepper(); updateStepper(); }
  card.addEventListener("click", () => openProduct(p));
  return card;
}

function renderCategories() {
  const bar = el("category-bar");
  bar.innerHTML = "";
  data.categories.forEach((cat) => {
    const btn = document.createElement("button");
    btn.className = "cat-pill" + (cat === activeCategory ? " active" : "");
    btn.textContent = cat;
    btn.addEventListener("click", () => {
      activeCategory = cat;
      bar.querySelectorAll(".cat-pill").forEach((p) =>
        p.classList.toggle("active", p.textContent === cat)
      );
      renderProducts();
    });
    bar.appendChild(btn);
  });
}

function renderProducts() {
  const list = el("product-list");
  list.innerHTML = "";
  const filtered =
    activeCategory === "Todos"
      ? data.products
      : data.products.filter((p) => p.category === activeCategory);
  filtered.forEach((p) => list.appendChild(createProductCard(p)));
}

function flashAdd(btn) {
  const r = btn.getBoundingClientRect();
  const cartBtn =
    [...document.querySelectorAll('[data-view="cart"]')].find((b) => b.offsetParent !== null) ||
    document.querySelector('[data-view="cart"]');
  const cr = cartBtn.getBoundingClientRect();
  const startX = r.left + r.width / 2;
  const startY = r.top + r.height / 2;
  const endX = cr.left + cr.width / 2;
  const endY = cr.top + cr.height / 2;
  const buttonColors = ["#EE6A68", "#C9312E", "#E6524F", "#FF8A85", "#FFFFFF"];

  for (let i = 0; i < 16; i++) {
    const ghost = document.createElement("div");
    const size = 4 + Math.random() * 5;
    const sx = r.left + Math.random() * r.width;
    const sy = r.top + Math.random() * r.height;
    const c = buttonColors[i % buttonColors.length];
    const delay = Math.random() * 80;
    const dur = 1350 + Math.random() * 180;
    const cpX = (sx + endX) / 2 + (Math.random() - 0.5) * 40;
    const cpY = Math.min(sy, endY) - 70 - Math.random() * 90;
    ghost.style.cssText = `
      position:fixed; z-index:999; pointer-events:none;
      width:${size}px; height:${size}px; border-radius:50%;
      background:${c};
      box-shadow:0 0 ${6 + Math.random() * 6}px ${c}80;
      left:${sx - size / 2}px; top:${sy - size / 2}px;
      opacity:0; transform:scale(.4);
    `;
    document.body.appendChild(ghost);
    const start = performance.now() + delay;
    function tick(now) {
      let t = (now - start) / dur;
      if (t < 0) { requestAnimationFrame(tick); return; }
      if (t > 1) t = 1;
      const ease = t * t * t;
      const x = (1 - ease) * (1 - ease) * sx + 2 * (1 - ease) * ease * cpX + ease * ease * endX;
      const y = (1 - ease) * (1 - ease) * sy + 2 * (1 - ease) * ease * cpY + ease * ease * endY;
      const spread = Math.sin(t * Math.PI) * (i - 7) * 4;
      ghost.style.left = x + spread - size / 2 + "px";
      ghost.style.top = y - size / 2 + "px";
      ghost.style.opacity = t < 0.15 ? t / 0.15 : t > 0.97 ? (1 - t) / 0.03 : 1;
      ghost.style.transform = `scale(${0.25 + (1 - t) * 0.75})`;
      if (t < 1) requestAnimationFrame(tick);
      else ghost.remove();
    }
    requestAnimationFrame(tick);
  }

  btn.style.transform = "scale(.7)";
  btn.style.transition = "transform .15s ease";
  setTimeout(() => { btn.style.transform = ""; }, 150);
}

function bounceNav(v) {
  const btn = [...document.querySelectorAll(".nav-btn")].find(
    (b) => b.dataset.view === v && b.offsetParent !== null
  );
  if (!btn) return;
  const svg = btn.querySelector("svg");
  svg.classList.remove("bounce");
  void svg.offsetWidth;
  svg.classList.add("bounce");
}

let currentView = "home";
function showView(v) {
  const wasHome = currentView === "home";
  const scrollRef = heroRef();
  currentView = v;
  ["home", "cart", "profile"].forEach((x) =>
    el("view-" + x).classList.toggle("hidden", x !== v)
  );
  document.querySelectorAll(".nav-btn").forEach((b) =>
    b.classList.toggle("active", b.dataset.view === v)
  );
  el("home-tabs").classList.toggle("hidden", v !== "home");
  el("cart-hero-back")?.classList.toggle("hidden", v !== "cart");
  el("profile-hero-back")?.classList.toggle("hidden", v !== "profile");
  if (v === "home") {
    const active = document.querySelector(".home-tab.active").dataset.tab;
    el("tab-businesses").classList.toggle("hidden", active !== "businesses");
    el("tab-products").classList.toggle("hidden", active !== "products");
    hideBusiness();
  }
  bounceNav(v);
  if (v === "cart" || v === "profile") el("view-" + v).classList.add("no-entrance");
  if (v === "cart") renderCart();
  if (v === "profile") loadProfileView();
  if (v === "home" && !wasHome && window.scrollY < scrollRef * 0.35)
    revealHomeHero();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function addToCart(id) {
  const key = String(id);
  cart.set(key, (cart.get(key) || 0) + 1);
  updateCartUI();
}
function addToCartProduct(product, sel) {
  let key = String(product.id);
  sel = sel || (product.groups || []).map(() => []);
  if (product.groups && product.groups.length) {
    const names = product.groups.map((g, gi) =>
      (sel[gi] || []).map((oi) => (g.options[oi] && g.options[oi].name)).filter(Boolean).sort()
    );
    key = key + "::" + JSON.stringify(names);
  }
  cart.set(key, (cart.get(key) || 0) + 1);
  updateCartUI();
}
function parseCartKey(key) {
  const idx = key.indexOf("::");
  if (idx === -1) return { id: key, optsRaw: null };
  try {
    return { id: key.slice(0, idx), optsRaw: JSON.parse(key.slice(idx + 2)) };
  } catch {
    return { id: key, optsRaw: null };
  }
}
function cartItemInfo(key) {
  const { id, optsRaw } = parseCartKey(key);
  const p = getProduct(id);
  if (!p) return { key, product: null, unit: 0, name: "", opts: [] };
  const opts = [];
  let unit = p.price;
  if (optsRaw && p.groups) {
    p.groups.forEach((g, gi) => {
      const picked = optsRaw[gi] || [];
      picked.forEach((n) => {
        const opt = g.options.find((o) => o.name === n);
        if (opt) { opts.push(n); unit += opt.extra; }
      });
    });
  }
  return { key, product: p, unit, name: p.name, opts };
}
function changeQty(id, delta) {
  const key = String(id);
  const qty = (cart.get(key) || 0) + delta;
  if (qty <= 0) cart.delete(key);
  else cart.set(key, qty);
  updateCartUI();
  if (!el("view-cart").classList.contains("hidden")) renderCart();
}

const CART_KEY = "mm_cart";
let cartRestored = false;
function saveCart() {
  if (!cartRestored) return;
  try {
    localStorage.setItem(CART_KEY, JSON.stringify([...cart.entries()]));
  } catch {}
}
function loadCart() {
  cartRestored = true;
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return;
    cart.clear();
    arr.forEach((pair) => {
      const k = pair && pair[0];
      const q = pair && pair[1];
      if (typeof k === "string" && typeof q === "number" && q > 0) cart.set(k, Math.floor(q));
    });
  } catch {}
}

function updateCartUI() {
  let count = 0;
  cart.forEach((q) => (count += q));
  document.querySelectorAll(".cart-badge").forEach((badge) => {
    if (count > 0) {
      badge.textContent = count;
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
  });
  syncCardSteppers();
  syncDetailQty();
  saveCart();
}

function syncDetailQty() {
  if (activeDetailSync) activeDetailSync();
}

function syncCardSteppers() {
  document.querySelectorAll(".product-card").forEach((card) => {
    const key = card.dataset.id;
    const qtyBox = card.querySelector(".card-qty");
    const qtyInput = card.querySelector(".cq-input");
    const addBtn = card.querySelector(".add-float");
    if (!card.dataset.id || !qtyBox || !qtyInput || !addBtn) return;
    const p = getProduct(card.dataset.id);
    if (p && p.groups && p.groups.length) return;
    const qty = cart.get(key) || 0;
    if (qty > 0) {
      card.classList.add("has-qty");
      addBtn.classList.add("hidden");
      qtyBox.classList.remove("hidden");
      if (qtyInput !== document.activeElement) qtyInput.value = String(qty);
    } else {
      card.classList.remove("has-qty");
      addBtn.classList.remove("hidden");
      qtyBox.classList.add("hidden");
    }
  });
}

function openProductFromCart(key) {
  const { id, optsRaw } = parseCartKey(key);
  const p = getProduct(id);
  if (!p) return;
  let presel = null;
  if (p.groups && optsRaw) {
    presel = p.groups.map((g, gi) =>
      (optsRaw[gi] || []).map((n) => g.options.findIndex((o) => o.name === n)).filter((i) => i !== -1)
    );
  }
  el("view-cart").classList.add("hidden");
  el("view-home").classList.remove("hidden");
  document.querySelectorAll(".nav-btn").forEach((b) =>
    b.classList.toggle("active", b.dataset.view === "home")
  );
  openProduct(p, presel);
  detailReturn = "cart";
}

function renderCart() {
  const box = el("cart-items");
  const summary = el("cart-summary");
  box.innerHTML = "";
  if (cart.size === 0) {
    box.innerHTML = `<p class="empty">Tu carrito está vacío.</p>
      <button class="save-btn" id="cart-explore-btn">Explorar productos</button>`;
    summary.classList.add("hidden");
    summary.parentNode.querySelector(".cart-foot")?.remove();
    return;
  }
  let subtotal = 0;
  cart.forEach((qty, key) => {
    const info = cartItemInfo(key);
    const p = info.product;
    const bName = p ? bizName(p.businessId) : "";
    if (!p) return;
    subtotal += info.unit * qty;
    const row = document.createElement("div");
    row.className = "cart-row";
    row.innerHTML = `
      <div class="cr-img">${p.image ? `<img src="${p.image}" alt="${p.name}" />` : ''}</div>
      <div class="cr-info">
        <div class="cr-biz">${bName}</div>
        <div class="cr-name">${info.name}</div>
        ${info.opts.length ? `<div class="cr-opts">${info.opts.map((o) => `<span class="cr-opt">${o}</span>`).join("")}</div>` : ""}
        <div class="cr-price">${currency.format(info.unit * qty)}</div>
      </div>
      <div class="cr-qty">
        <button data-act="dec" data-id="${key}">−</button>
        <input class="cr-input" type="text" inputmode="numeric" autocomplete="off" aria-label="Cantidad" value="${qty}" />
        <button data-act="inc" data-id="${key}">+</button>
      </div>
      <button data-act="del" data-id="${key}" class="cr-del" aria-label="Eliminar"><svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 6 6 18"/><path d="M6 6l12 12"/></svg></button>`;
    row.querySelector('[data-act="dec"]').addEventListener("click", () => changeQty(key, -1));
    row.querySelector('[data-act="inc"]').addEventListener("click", () => changeQty(key, 1));
    row.querySelector('[data-act="del"]').addEventListener("click", () => { cart.delete(key); updateCartUI(); renderCart(); });
    row.addEventListener("click", (e) => {
      if (e.target.closest(".cr-qty") || e.target.closest("button") || e.target.closest("input")) return;
      openProductFromCart(key);
    });
    const crInput = row.querySelector(".cr-input");
    const rowPrice = row.querySelector(".cr-price");
    crInput.addEventListener("input", (e) => {
      const v = parseInt(e.target.value, 10);
      if (Number.isFinite(v) && v >= 1) {
        cart.set(key, v);
        updateCartUI();
        refreshCartTotals();
        if (rowPrice) rowPrice.textContent = currency.format(info.unit * v);
      }
    });
    crInput.addEventListener("change", (e) => {
      const v = parseInt(e.target.value, 10);
      e.target.value = Number.isFinite(v) && v >= 1 ? String(v) : String(cart.get(key) || 1);
    });
    box.appendChild(row);
  });
  const shipping = shippingCost();
  const total = subtotal + shipping;
  el("cart-subtotal").textContent = currency.format(subtotal);
  el("cart-shipping").textContent = currency.format(shipping);
  el("cart-total").textContent = currency.format(total);
  summary.classList.remove("hidden");
  const summaryBox = summary.parentNode;
  summaryBox.querySelector(".cart-foot")?.remove();
  summaryBox.querySelector(".shipping-note")?.remove();
  const note = document.createElement("p");
  note.className = "form-note shipping-note";
  note.innerHTML = `
    <svg viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M12 2 1 21h22L12 2zm1 14h-2v2h2v-2zm0-7h-2v5h2V9z"/></svg>
    <span>El precio de la mensajería varía según el pedido.</span>`;
  summaryBox.appendChild(note);
  const foot = document.createElement("div");
  foot.className = "cart-foot";
  foot.innerHTML = `
    <button id="checkout-button" class="primary-btn">Confirmar pedido</button>`;
  foot.querySelector("#checkout-button").addEventListener("click", openCheckout);
  summaryBox.appendChild(foot);
}

function shippingCost() {
  const bizes = new Set();
  cart.forEach((_, key) => {
    const info = cartItemInfo(key);
    if (info.product) bizes.add(info.product.businessId);
  });
  return 250 + 100 * Math.max(0, bizes.size - 1);
}

function refreshCartTotals() {
  let subtotal = 0;
  cart.forEach((qty, key) => {
    const info = cartItemInfo(key);
    if (info.product) subtotal += info.unit * qty;
  });
  const shipping = shippingCost();
  el("cart-subtotal").textContent = currency.format(subtotal);
  el("cart-shipping").textContent = currency.format(shipping);
  el("cart-total").textContent = currency.format(subtotal + shipping);
}

function openCheckout() {
  if (cart.size === 0) return;
  fillCheckoutFromProfile();
  buildTimeSelect();
  el("checkout-modal").classList.add("open");
  el("overlay").classList.add("open");
}
function closeCheckout() {
  el("checkout-modal").classList.remove("open");
  el("overlay").classList.remove("open");
  el("checkout-status").textContent = "";
}

function buildOrder(formData) {
  const items = [];
  let total = 0;
  cart.forEach((qty, key) => {
    const info = cartItemInfo(key);
    const p = info.product;
    if (!p) return;
    const bName = bizName(p.businessId);
    const unit = info.unit;
    const optsSuffix = info.opts.map((o) => "+ " + o).join(" ");
    items.push({
      business: bName,
      name: optsSuffix ? `${info.name} ${optsSuffix}` : info.name,
      qty,
      price: p.price,
      unit,
      subtotal: unit * qty,
    });
    total += unit * qty;
  });
  return {
    client: formData.get("clientName"),
    contact: formData.get("contact"),
    date: new Date().toISOString().slice(0, 10),
    time: formData.get("time") || "Entregar lo antes posible",
    place: formData.get("place"),
    items,
    total,
    createdAt: new Date().toISOString(),
  };
}

function buildTimeSelect() {
  const sel = el("checkout-time");
  if (!sel) return;
  const now = new Date();
  const curMin = now.getHours() * 60 + now.getMinutes();
  const fmt = (h, m) => {
    const ap = h >= 12 ? "PM" : "AM";
    const hh = h % 12 === 0 ? 12 : h % 12;
    return hh + ":" + String(m).padStart(2, "0") + " " + ap;
  };
  sel.innerHTML = `<option value="">Entregar lo antes posible</option>`;
  for (let h = 9; h <= 21; h++) {
    for (const m of [0, 30]) {
      if (h === 21 && m === 30) break;
      if (h * 60 + m < curMin) continue;
      const opt = document.createElement("option");
      const t = String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
      opt.value = t;
      opt.textContent = fmt(h, m);
      sel.appendChild(opt);
    }
  }
}

async function submitOrder(e) {
  e.preventDefault();
  const form = el("checkout-form");
  const status = el("checkout-status");
  const hours = new Date().getHours();
  if (hours >= 21) {
    status.className = "status-msg err";
    status.textContent = "Ya no se reciben pedidos después de las 9:00 PM.";
    return;
  }
  const order = buildOrder(new FormData(form));
  const btn = form.querySelector("button[type=submit]");
  btn.disabled = true;
  status.className = "status-msg";
  status.textContent = "Enviando pedido...";
  try {
    const res = await fetch(BACKEND_URL + "/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(order),
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    status.className = "status-msg ok";
    status.textContent = "✅ Pedido enviado. Te contactaremos pronto.";
    cart.clear();
    updateCartUI();
    if (!el("view-cart").classList.contains("hidden")) renderCart();
    setTimeout(closeCheckout, 2000);
  } catch (err) {
    status.className = "status-msg err";
    status.textContent = "❌ Error: " + err.message;
  } finally {
    btn.disabled = false;
  }
}

el("checkout-close").addEventListener("click", closeCheckout);
el("overlay").addEventListener("click", closeCheckout);
el("checkout-form").addEventListener("submit", submitOrder);
buildTimeSelect();
document.body.addEventListener("click", (e) => {
  if (e.target.closest("#cart-explore-btn")) {
    showView("home");
    setHomeTab("products");
    switchTabs("products");
  }
});
document.querySelectorAll(".nav-btn").forEach((b) =>
  b.addEventListener("click", () => showView(b.dataset.view))
);
document.querySelectorAll(".nav-btn svg").forEach((svg) =>
  svg.addEventListener("animationend", () => svg.classList.remove("bounce"))
);

function setHomeTab(tab) {
  document.querySelectorAll(".home-tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === tab));
  const ind = el("home-tab-indicator");
  ind.style.left = tab === "businesses" ? "calc(var(--u) / 4)" : "calc(var(--u) * 6.75)";
  ind.style.backgroundColor = tab === "businesses" ? "#5DB355" : "#CE4E4D";
  ind.style.backgroundImage = tab === "businesses"
    ? "linear-gradient(180deg,#67B85F,#52A348)"
    : "linear-gradient(180deg,#D9605F,#C74A49)";
}

document.querySelectorAll(".home-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    setHomeTab(tab.dataset.tab);
    switchTabs(tab.dataset.tab);
  });
});

function switchTabs(target) {
  const showId = target === "businesses" ? "tab-businesses" : "tab-products";
  const hideId = target === "businesses" ? "tab-products" : "tab-businesses";
  const hideBox = el(hideId);
  const showBox = el(showId);
  const toProducts = target === "products";
  hideBusiness();
  const animateIn = () => {
    showBox.classList.remove("hidden");
    showBox.classList.remove("tab-enter-left", "tab-enter-right");
    void showBox.offsetWidth;
    showBox.classList.add(toProducts ? "tab-enter-right" : "tab-enter-left");
  };
  if (hideBox.classList.contains("hidden")) {
    animateIn();
    return;
  }
  hideBox.classList.add(toProducts ? "tab-leave-left" : "tab-leave-right");
  setTimeout(() => {
    hideBox.classList.remove("tab-leave-left", "tab-leave-right");
    hideBox.classList.add("hidden");
    animateIn();
  }, 300);
}
function removeDiacritics(s) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "").toLowerCase();
}

function goToProduct(id) {
  const p = data.products.find((x) => String(x.id) === String(id));
  if (!p) return;
  const wasHidden = el("view-home").classList.contains("hidden");
  if (wasHidden) showView("home");
  openProduct(p);
}

function goToHomeGrid(id) {
  const key = String(id);
  const p = data.products.find((x) => String(x.id) === key);
  if (!p) return;
  releaseMarker();
  if (similarTimer) clearInterval(similarTimer);
  if (similarRecent) clearInterval(similarRecent);
  el("home-tabs").classList.remove("hidden");
  setHomeTab("products");
  switchTabs("products");
  activeCategory = "Todos";
  renderProducts();
  window.scrollTo(0, 0);
  setHeroCollapsed(false);
  const card = document.querySelector(`#product-list .product-card[data-id="${key}"]`);
  if (card) {
    card.scrollIntoView({ behavior: "smooth", block: "start" });
    card.classList.add("flash-card");
    setTimeout(() => card.classList.remove("flash-card"), 5200);
  }
}

function filterProducts(query) {
  const q = removeDiacritics(query);
  if (!q) { renderProducts(); return; }
  const list = el("product-list");
  list.innerHTML = "";
  const filtered = data.products.filter((p) =>
    removeDiacritics(p.name).includes(q) ||
    removeDiacritics(bizName(p.businessId)).includes(q)
  );
  if (!filtered.length) { list.innerHTML = '<p class="empty">No se encontraron productos.</p>'; return; }
  filtered.forEach((p) => list.appendChild(createProductCard(p)));
}

document.querySelectorAll(".search-input").forEach((inp) =>
  inp.addEventListener("input", (e) => {
    const q = e.target.value.trim();
    const currentView = document.querySelector(".view:not(.hidden)");
    if (currentView && currentView.id !== "view-home") showView("home");
    setHomeTab("products");
    el("tab-businesses").classList.add("hidden");
    el("tab-products").classList.remove("hidden");
    hideBusiness();
    el("home-tabs").classList.remove("hidden");
    document.querySelectorAll(".search-input").forEach((i) => { if (i !== inp) i.value = inp.value; });
    filterProducts(q);
  })
);

el("business-hero-back").addEventListener("click", () => { closeBusiness(); releaseMarker(); });
el("product-hero-back").addEventListener("click", () => { closeProduct(); releaseMarker(); });
el("cart-hero-back").addEventListener("click", () => showView("home"));
el("profile-hero-back").addEventListener("click", () => showView("home"));
el("back-to-top").addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
el("biz-back-to-top").addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));


loadData();
updateCartUI();

if ("scrollRestoration" in history) history.scrollRestoration = "manual";
window.scrollTo(0, 0);

/* Botón/gesto "atrás" del teléfono: actúa como el botón < en vez de salir de la página */
let detailMarkerActive = false;
function detailOpenState() {
  return (
    !el("business-detail").classList.contains("hidden") ||
    !el("product-detail").classList.contains("hidden")
  );
}
function armDetailBack() {
  if (detailMarkerActive) return;
  history.pushState({ mm: "detail" }, "");
  detailMarkerActive = true;
}
function releaseMarker() {
  if (!detailMarkerActive) return;
  detailMarkerActive = false;
  history.back();
}
window.addEventListener("popstate", (e) => {
  if (!detailMarkerActive) return;
  detailMarkerActive = false;
  if (!e.state || e.state.mm !== "detail") return;
  if (!el("product-detail").classList.contains("hidden")) closeProduct();
  else if (!el("business-detail").classList.contains("hidden")) closeBusiness();
  if (detailOpenState()) {
    history.pushState({ mm: "detail" }, "");
    detailMarkerActive = true;
  }
});

let heroCollapsed = false;
const heroes = () => document.querySelectorAll(".brand-hero:not(.always-mini)");
const activePage = () => document.querySelector(".view:not(.hidden) .page");
function heroRef() {
  const pg = activePage();
  if (!pg) return 0;
  return parseFloat(getComputedStyle(pg).marginTop) || 0;
}
function setHeroCollapsed(next) {
  heroes().forEach((h) => {
    const has = h.classList.contains("hero-collapsed");
    if (has === next) return;
    heroCollapsed = next;
    h.classList.remove("hero-construct", "hero-collapsing", "hero-collapsed");
    if (next) h.classList.add("hero-collapsed");
    else h.classList.add("hero-construct");
    if (!next)
      setTimeout(() => h.classList.remove("hero-construct"), 900);
  });
}

function revealHomeHero() {
  heroCollapsed = false;
  heroes().forEach((h) => {
    h.classList.remove("hero-collapsed", "hero-collapsing");
    void h.offsetWidth;
    h.classList.add("hero-construct");
    setTimeout(() => h.classList.remove("hero-construct"), 900);
  });
}
function updateLogoProgress() {
  const home = el("view-home");
  const isHome =
    home && !home.classList.contains("hidden") && !home.classList.contains("in-business");
  if (!isHome) { document.documentElement.style.setProperty("--logo-t", "0"); return; }
  const ref = heroRef();
  const t = ref > 0 ? Math.min(1, Math.max(0, window.scrollY / (ref * 0.6))) : 0;
  document.documentElement.style.setProperty("--logo-t", t.toFixed(4));
}
window.addEventListener(
  "scroll",
  () => {
    updateLogoProgress();
    const ref = heroRef();
    const y = window.scrollY;
    if (!heroCollapsed && y >= ref * 0.7) setHeroCollapsed(true);
    else if (heroCollapsed && y < ref * 0.35) setHeroCollapsed(false);
  },
  { passive: true }
);
window.addEventListener("resize", updateLogoProgress, { passive: true });
updateLogoProgress();

/* Barras de categorías: marcan "pinned" al quedar fijas debajo del nav chiquito */
[
  ["business-category-bar", () => !el("business-detail").classList.contains("hidden")],
  ["category-bar", () => !el("tab-products").classList.contains("hidden")],
].forEach(([id, isVisible]) => {
  const bar = el(id);
  if (!bar) return;
  const stickyTop = () => {
    const n = parseFloat(getComputedStyle(bar).top);
    return Number.isFinite(n) ? n : 0;
  };
  let pinned = false;
  const onScroll = () => {
    if (!isVisible()) {
      if (pinned) {
        pinned = false;
        bar.classList.remove("pinned");
      }
      return;
    }
    const r = bar.getBoundingClientRect();
    const next = r.top <= stickyTop() + 1;
    if (next !== pinned) {
      pinned = next;
      bar.classList.toggle("pinned", pinned);
    }
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  onScroll();
});

/* Toggle de vista lista/cuadrícula de productos */
document.querySelectorAll(".view-toggle").forEach((group) => {
  const grid = document.getElementById(group.dataset.grid);
  if (!grid) return;
  const btns = group.querySelectorAll(".view-toggle-btn");
  const apply = (view, save) => {
    grid.classList.toggle("list-view", view === "list");
    btns.forEach((b) => b.classList.toggle("active", b.dataset.view === view));
    if (save) {
      try { localStorage.setItem("mm_view_" + group.dataset.grid, view); } catch {}
    }
  };
  btns.forEach((b) =>
    b.addEventListener("click", () => apply(b.dataset.view, true))
  );
  let saved = null;
  try { saved = localStorage.getItem("mm_view_" + group.dataset.grid); } catch {}
  if (saved === "list" || saved === "grid") apply(saved, false);
  else apply(group.dataset.default || "grid", false);
});

function getProfile() {
  try { return JSON.parse(localStorage.getItem("mm_profile") || "{}"); } catch { return {}; }
}
function saveProfile(d) { localStorage.setItem("mm_profile", JSON.stringify(d)); }
function loadProfileView() {
  const p = getProfile();
  el("profile-form").profileName.value = p.name || "";
  el("profile-form").profileContact.value = p.contact || "";
  el("profile-form").profilePlace.value = p.place || "";
  el("profile-status").textContent = "";
  document.querySelectorAll(".profile-tab").forEach((t) => t.classList.remove("active"));
  document.querySelector('[data-tab="info"]').classList.add("active");
  el("profile-tab-indicator").style.left = "3px";
  el("tab-info").classList.remove("hidden");
  el("tab-history").classList.add("hidden");
}
function fillCheckoutFromProfile() {
  const p = getProfile();
  if (p.name) el("checkout-form").clientName.value = p.name;
  if (p.contact) el("checkout-form").contact.value = p.contact;
  if (p.place) el("checkout-form").place.value = p.place;
}
async function loadHistory() {
  const p = getProfile();
  const box = el("history-list");
  if (!p.contact) { box.innerHTML = '<p class="empty">Guarda tu teléfono en el perfil primero.</p>'; return; }
  box.innerHTML = '<p class="empty">Cargando...</p>';
  try {
    const res = await fetch(BACKEND_URL + "/pedidos?telefono=" + encodeURIComponent(p.contact));
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    if (!data.length) { box.innerHTML = '<p class="empty">No hay compras registradas.</p>'; return; }
    const orders = {};
    data.forEach((v) => {
      const key = v.created_at;
      if (!orders[key]) orders[key] = { fecha: v.fecha, hora: v.hora, items: [], total: v.total };
      orders[key].items.push(v);
    });
    box.innerHTML = Object.values(orders).map((o) => {
      const sub = o.items.reduce((s, i) => s + i.subtotal, 0);
      const ship = o.total - sub;
      return `
      <div class="history-card">
        <div class="history-date">${o.fecha} ${o.hora ? "a las " + o.hora : ""}</div>
        <div class="history-items">${o.items.map((i) => `${i.cantidad}× ${i.producto} — ${currency.format(i.subtotal)}`).join("<br>")}</div>
        <div class="history-breakdown">
          <div class="cart-summary-row"><span>Subtotal</span><span>${currency.format(sub)}</span></div>
          <div class="cart-summary-row"><span>Mensajería</span><span>${currency.format(ship)}</span></div>
          <div class="cart-summary-row total"><span>Total</span><span>${currency.format(o.total)}</span></div>
        </div>
      </div>
    `;
    }).join("");
  } catch (err) {
    box.innerHTML = '<p class="empty">Error: ' + err.message + "</p>";
  }
}


document.querySelectorAll(".profile-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".profile-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    el("profile-tab-indicator").style.left = tab.dataset.tab === "info" ? "3px" : "calc(50% + 1.5px)";
    const target = tab.dataset.tab;
    el("tab-info").classList.toggle("hidden", target !== "info");
    el("tab-history").classList.toggle("hidden", target !== "history");
    if (target === "history") loadHistory();
  });
});
el("profile-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = e.target;
  saveProfile({ name: f.profileName.value, contact: f.profileContact.value, place: f.profilePlace.value });
  const s = el("profile-status");
  s.className = "status-msg ok";
  s.textContent = "✓ Perfil guardado";
  setTimeout(() => showView("home"), 800);
});
