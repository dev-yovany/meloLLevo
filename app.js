const BACKEND_URL = "https://melollevo-backend.dev-yovany.workers.dev";

const currency = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

let data = { categories: [], businesses: [], products: [] };
let activeCategory = "Todos";
const cart = new Map();
const el = (id) => document.getElementById(id);

function hue(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h) % 360;
}
function bizGradient(id) {
  const h = hue(id);
  return `linear-gradient(135deg, hsl(${h},75%,58%), hsl(${h},75%,42%))`;
}
function bizName(businessId) {
  const b = data.businesses.find((x) => x.id === businessId);
  return b ? b.name : "";
}

async function loadData() {
  try {
    const res = await fetch("data.json");
    data = await res.json();
  } catch (e) {
    data = { categories: [], businesses: [], products: [] };
  }
  renderCategories();
  renderProducts();
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

  filtered.forEach((p) => {
    const card = document.createElement("div");
    card.className = "product-card";
    const media = p.image
      ? `<img src="${p.image}" alt="${p.name}" />`
      : `<div class="ph" style="background:${bizGradient(p.businessId)}">${bizName(p.businessId).charAt(0)}</div>`;
    card.innerHTML = `
      <div class="product-media">
        ${media}
        <button class="add-float" data-id="${p.id}"><svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
      </div>
      <div class="product-body">
        <div class="product-name">${p.name}</div>
        <div class="product-biz">${bizName(p.businessId)}</div>
        <div class="product-price">${currency.format(p.price)}</div>
      </div>`;
    card.querySelector(".add-float").addEventListener("click", (e) => {
      e.stopPropagation();
      addToCart(p.id);
      flashAdd(card.querySelector(".add-float"));
    });
    list.appendChild(card);
  });
}

function flashAdd(btn) {
  const r = btn.getBoundingClientRect();
  const cartBtn = document.querySelector('[data-view="cart"]');
  const cr = cartBtn.getBoundingClientRect();
  const colors = ["#d44040", "#c53030", "#e55555", "#a52828", "#f06060", "#cc3333"];
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

function showView(v) {
  ["home", "cart"].forEach((x) =>
    el("view-" + x).classList.toggle("hidden", x !== v)
  );
  document.querySelectorAll(".nav-btn").forEach((b) =>
    b.classList.toggle("active", b.dataset.view === v)
  );
  if (v === "cart") renderCart();
  window.scrollTo(0, 0);
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
  const badge = el("cart-badge");
  if (count > 0) {
    badge.textContent = count;
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }
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
    const res = await fetch(BACKEND_URL, {
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
    status.textContent = "❌ No se pudo enviar. Revisa tu conexión o el backend.";
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

loadData();
updateCartUI();
