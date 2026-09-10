const BACKEND_URL = "https://melollevo-backend.dev-yovany.workers.dev";

const currency = {
  format: (v) =>
    new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(v) + " $",
};

let data = { categories: [], businesses: [], products: [] };
let activeCategory = "Todos";
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
  return `<span class="open-dot ${st.open ? "on" : "off"}" data-bid="${p.businessId}"></span><span class="status-label">${st.label}</span><span class="biz-name">${b ? b.name : ""}</span>`;
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
}

function updateStatuses() {
  document.querySelectorAll(".biz-status, .open-dot").forEach((n) => {
    const b = getBusiness(n.dataset.bid);
    const st = businessStatus(b);
    n.classList.toggle("on", st.open);
    n.classList.toggle("off", !st.open);
    const lab = n.querySelector(".status-label");
    if (lab) lab.textContent = st.label;
  });
}
setInterval(updateStatuses, 60000);

function featuredCard(p) {
  const card = document.createElement("div");
  card.className = "featured-card";
  card.innerHTML = `
    <div class="fc-media"><img src="${p.image}" alt="${p.name}" loading="lazy" /></div>
    <div class="fc-body">
      <div class="featured-name">${p.name}</div>
      <div class="featured-biz">${bizName(p.businessId)}</div>
      <div class="featured-price">${currency.format(p.price)}</div>
    </div>`;
  card.addEventListener("click", () => goToProduct(p.id));
  return card;
}

function renderFeatured() {
  const featured = data.products.filter((p) => p.price >= 12000).slice(0, 6);
  const track = el("featured-track");
  const dotsBox = el("featured-dots");
  track.innerHTML = "";
  dotsBox.innerHTML = featured.map((_, i) => `<span class="dot${i === 0 ? " active" : ""}"></span>`).join("");
  const dots = [...dotsBox.children];
  [...featured, ...featured.slice(0, 2)].forEach((p) => track.appendChild(featuredCard(p)));
  let idx = 0;
  const step = () => {
    const c = track.querySelector(".featured-card");
    return c ? c.getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap) : 0;
  };
  const move = () => {
    track.style.transform = `translateX(${-idx * step()}px)`;
    dots.forEach((d, i) => d.classList.toggle("active", i === idx % featured.length));
  };
  setInterval(() => {
    idx++;
    if (idx > featured.length) {
      idx = 1;
      track.style.transition = "none";
      void track.offsetWidth;
    }
    track.style.transition = "transform .55s cubic-bezier(.4, 0, .2, 1)";
    move();
  }, 4000);
  move();
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
      ${businessAvatar(b)}
      <div class="business-card-name">${b.name}</div>
      <div class="business-card-status">${statusInline(b)}</div>
      <div class="business-card-cat">${b.category || ""}</div>
      <div class="business-card-desc">${b.description || ""}</div>`;
    card.addEventListener("click", () => openBusiness(b));
    list.appendChild(card);
  });
}

function openBusiness(business) {
  el("home-tabs").classList.add("hidden");
  el("tab-businesses").classList.add("hidden");
  el("tab-products").classList.add("hidden");
  el("business-detail").classList.remove("hidden");
  el("business-detail-name").textContent = business.name;
  el("business-detail-cat").textContent = business.category || "";
  el("business-detail-status").innerHTML = statusPill(business) + ' <span class="biz-hours">' + todayHoursLine(business) + "</span>";
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
      ${businessAvatar(b)}
      <div class="business-card-name">${b.name}</div>
      <div class="business-card-status">${statusInline(b)}</div>
      <div class="business-card-cat">${b.category || ""}</div>
      <div class="business-card-desc">${b.description || ""}</div>`;
    card.addEventListener("click", () => openBusiness(b));
    rec.appendChild(card);
  });
  window.scrollTo(0, 0);
}

function closeBusiness() {
  el("home-tabs").classList.remove("hidden");
  const active = document.querySelector(".home-tab.active").dataset.tab;
  el("tab-businesses").classList.toggle("hidden", active !== "businesses");
  el("tab-products").classList.toggle("hidden", active !== "products");
  el("business-detail").classList.add("hidden");
  window.scrollTo(0, 0);
}

function createProductCard(p) {
  const card = document.createElement("div");
  card.className = "product-card";
  card.dataset.id = String(p.id);
  const media = p.image
    ? `<img src="${p.image}" alt="${p.name}" />`
    : `<div class="ph" style="background:${productGradient(p.businessId)}">${bizName(p.businessId).charAt(0)}</div>`;
  card.innerHTML = `
    <div class="product-media">
      ${media}
      <button class="add-float" data-id="${p.id}"><svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
    </div>
    <div class="product-body">
      <div class="product-name">${p.name}</div>
      <div class="product-biz">${productBizLine(p)}</div>
      <div class="product-price">${currency.format(p.price)}</div>
    </div>`;
  card.querySelector(".add-float").addEventListener("click", (e) => {
    e.stopPropagation();
    addToCart(p.id);
    flashAdd(card.querySelector(".add-float"));
  });
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
  const cartBtn = document.querySelector('[data-view="cart"]');
  const cr = cartBtn.getBoundingClientRect();
  const colors = ["#CE4E4D", "#d87676", "#e8928f", "#a83a39", "#5DB355"];
  const startX = r.left + r.width / 2;
  const startY = r.top + r.height / 2;
  const endX = cr.left + cr.width / 2;
  const endY = cr.top + cr.height / 2;
  const cpX = (startX + endX) / 2 - 30;
  const cpY = Math.min(startY, endY) - 80;

  for (let i = 0; i < 7; i++) {
    const ghost = document.createElement("div");
    const size = 6 + Math.random() * 5;
    const delay = i * 35;
    const dur = 620 + i * 30;
    ghost.style.cssText = `
      position:fixed; z-index:999; pointer-events:none;
      width:${size}px; height:${size}px; border-radius:50%;
      background:${colors[i % colors.length]};
      box-shadow:0 0 8px ${colors[i % colors.length]}90;
      left:${startX - size / 2}px; top:${startY - size / 2}px;
      opacity:0; transform:scale(1);
    `;
    document.body.appendChild(ghost);
    const start = performance.now() + delay;
    function tick(now) {
      let t = (now - start) / dur;
      if (t < 0) { requestAnimationFrame(tick); return; }
      if (t > 1) t = 1;
      const ease = 1 - Math.pow(1 - t, 3);
      const x = (1 - ease) * (1 - ease) * startX + 2 * (1 - ease) * ease * cpX + ease * ease * endX;
      const y = (1 - ease) * (1 - ease) * startY + 2 * (1 - ease) * ease * cpY + ease * ease * endY;
      const spread = Math.sin(t * Math.PI) * (i - 3) * 10;
      ghost.style.left = x + spread - size / 2 + "px";
      ghost.style.top = y - size / 2 + "px";
      ghost.style.opacity = t < 0.1 ? t * 10 : t > 0.7 ? (1 - t) / 0.3 : 1;
      ghost.style.transform = `scale(${1 - t * 0.6})`;
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
  if (v === "home") {
    const active = document.querySelector(".home-tab.active").dataset.tab;
    el("tab-businesses").classList.toggle("hidden", active !== "businesses");
    el("tab-products").classList.toggle("hidden", active !== "products");
    el("business-detail").classList.add("hidden");
  }
  bounceNav(v);
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
function changeQty(id, delta) {
  const key = String(id);
  const qty = (cart.get(key) || 0) + delta;
  if (qty <= 0) cart.delete(key);
  else cart.set(key, qty);
  updateCartUI();
  if (!el("view-cart").classList.contains("hidden")) renderCart();
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
}

function renderCart() {
  const box = el("cart-items");
  box.innerHTML = "";
  if (cart.size === 0) {
    box.innerHTML = `<p class="empty">Tu carrito está vacío.</p>`;
    return;
  }
  let total = 0;
  cart.forEach((qty, key) => {
    const p = data.products.find((x) => String(x.id) === key);
    const bName = p ? bizName(p.businessId) : "";
    if (!p) return;
    total += p.price * qty;
    const row = document.createElement("div");
    row.className = "cart-row";
    row.innerHTML = `
      <div class="cr-info">
        <div class="cr-biz">${bName}</div>
        <div class="cr-name">${p.name}</div>
        <div class="cr-price">${currency.format(p.price * qty)}</div>
      </div>
      <div class="cr-qty">
        <button data-act="dec" data-id="${key}">−</button>
        <span>${qty}</span>
        <button data-act="inc" data-id="${key}">+</button>
      </div>
      <button data-act="del" data-id="${key}" class="cr-del" aria-label="Eliminar"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>`;
    row.querySelector('[data-act="dec"]').addEventListener("click", () => changeQty(key, -1));
    row.querySelector('[data-act="inc"]').addEventListener("click", () => changeQty(key, 1));
    row.querySelector('[data-act="del"]').addEventListener("click", () => { cart.delete(key); updateCartUI(); renderCart(); });
    box.appendChild(row);
  });
  const foot = document.createElement("div");
  foot.className = "cart-foot";
  foot.innerHTML = `
    <div class="cart-total"><span>Total</span><strong>${currency.format(total)}</strong></div>
    <button id="checkout-button" class="primary-btn">Confirmar pedido</button>`;
  foot.querySelector("#checkout-button").addEventListener("click", openCheckout);
  box.appendChild(foot);
}

function openCheckout() {
  if (cart.size === 0) return;
  fillCheckoutFromProfile();
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
    const p = data.products.find((x) => String(x.id) === key);
    if (!p) return;
    const bName = bizName(p.businessId);
    items.push({
      business: bName,
      name: p.name,
      qty,
      price: p.price,
      subtotal: p.price * qty,
    });
    total += p.price * qty;
  });
  return {
    client: formData.get("clientName"),
    contact: formData.get("contact"),
    date: formData.get("date"),
    time: formData.get("time"),
    place: formData.get("place"),
    items,
    total,
    createdAt: new Date().toISOString(),
  };
}

async function submitOrder(e) {
  e.preventDefault();
  const form = el("checkout-form");
  const status = el("checkout-status");
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
  el("business-detail").classList.add("hidden");
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
  setHomeTab("products");
  el("tab-businesses").classList.add("hidden");
  el("tab-products").classList.remove("hidden");
  el("business-detail").classList.add("hidden");
  el("home-tabs").classList.remove("hidden");
  el("search-input").value = "";
  activeCategory = p.category;
  document.querySelectorAll("#category-bar .cat-pill").forEach((pill) =>
    pill.classList.toggle("active", pill.textContent === p.category)
  );
  renderProducts();
  const wait = wasHidden ? 620 : 90;
  setTimeout(() => {
    const target = [...document.querySelectorAll("#product-list .product-card")].find(
      (c) => c.dataset.id === String(p.id)
    );
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.classList.add("target-flash");
    setTimeout(() => target.classList.remove("target-flash"), 1900);
  }, wait);
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
    el("business-detail").classList.add("hidden");
    el("home-tabs").classList.remove("hidden");
    document.querySelectorAll(".search-input").forEach((i) => { if (i !== inp) i.value = inp.value; });
    filterProducts(q);
  })
);

el("business-back").addEventListener("click", closeBusiness);
el("back-to-top").addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
el("biz-back-to-top").addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));


loadData();
updateCartUI();

let heroCollapsed = false;
const heroes = () => document.querySelectorAll(".brand-hero:not(.always-mini)");
const activePage = () => document.querySelector(".view:not(.hidden) .page");
function heroRef() {
  const pg = activePage();
  if (!pg) return 0;
  return parseFloat(getComputedStyle(pg).marginTop) || 0;
}
function setHeroCollapsed(next) {
  if (heroCollapsed === next) return;
  heroCollapsed = next;
  if (next) {
    heroes().forEach((h) => {
      h.classList.remove("hero-construct");
      h.classList.add("hero-collapsing");
    });
    setTimeout(() => heroes().forEach((h) => {
      h.classList.remove("hero-collapsing");
      h.classList.add("hero-collapsed");
    }), 360);
  } else {
    heroes().forEach((h) => h.classList.add("hero-collapsing"));
    setTimeout(() =>
      heroes().forEach((h) => {
        h.classList.remove("hero-collapsed", "hero-collapsing");
        h.classList.add("hero-construct");
        setTimeout(() => h.classList.remove("hero-construct"), 900);
      }), 250);
  }
}

function revealHomeHero() {
  heroCollapsed = false;
  heroes().forEach((h) => {
    if (h.classList.contains("hero-collapsed")) {
      h.classList.add("hero-collapsing");
      setTimeout(() => {
        h.classList.remove("hero-collapsed", "hero-collapsing");
        h.classList.add("hero-construct");
        setTimeout(() => h.classList.remove("hero-construct"), 900);
      }, 250);
    } else {
      h.classList.remove("hero-collapsing", "hero-collapsed");
      h.classList.add("hero-construct");
      setTimeout(() => h.classList.remove("hero-construct"), 900);
    }
  });
}
window.addEventListener(
  "scroll",
  () => {
    const ref = heroRef();
    const y = window.scrollY;
    if (!heroCollapsed && y >= ref * 0.85) setHeroCollapsed(true);
    else if (heroCollapsed && y < ref * 0.35) setHeroCollapsed(false);
  },
  { passive: true }
);

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
    box.innerHTML = Object.values(orders).map((o) => `
      <div class="history-card">
        <div class="history-date">${o.fecha} ${o.hora ? "a las " + o.hora : ""}</div>
        <div class="history-items">${o.items.map((i) => `${i.cantidad}× ${i.producto} — ${formatPrice(i.subtotal)}`).join("<br>")}</div>
        <div class="history-total">Total: ${formatPrice(o.total)}</div>
      </div>
    `).join("");
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
