const BACKEND_URL = "https://melollevo-backend.dev-yovany.workers.dev";

const currency = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

let products = [];
const cart = new Map();

const el = (id) => document.getElementById(id);

async function loadProducts() {
  try {
    const res = await fetch("products.json");
    products = await res.json();
  } catch (e) {
    products = [];
  }
  renderProducts();
}

function renderProducts() {
  const list = el("product-list");
  list.innerHTML = "";
  products.forEach((p) => {
    const card = document.createElement("div");
    card.className = "product-card";
    card.innerHTML = `
      <div class="product-emoji">${p.emoji || "📦"}</div>
      <h3>${p.name}</h3>
      <p>${p.description || ""}</p>
      <div class="product-price">${currency.format(p.price)}</div>
      <button class="add-btn" data-id="${p.id}">Agregar al carrito</button>
    `;
    card.querySelector(".add-btn").addEventListener("click", () => addToCart(p.id));
    list.appendChild(card);
  });
}

function addToCart(id) {
  const item = products.find((p) => p.id === id);
  if (!item) return;
  cart.set(id, (cart.get(id) || 0) + 1);
  updateCartUI();
}

function changeQty(id, delta) {
  const qty = (cart.get(id) || 0) + delta;
  if (qty <= 0) cart.delete(id);
  else cart.set(id, qty);
  updateCartUI();
}

function updateCartUI() {
  let count = 0;
  let total = 0;
  cart.forEach((qty, id) => {
    const item = products.find((p) => p.id === id);
    count += qty;
    total += item.price * qty;
  });
  el("cart-count").textContent = count;
  el("cart-total").textContent = currency.format(total);
  renderCartItems();
}

function renderCartItems() {
  const box = el("cart-items");
  box.innerHTML = "";
  if (cart.size === 0) {
    box.innerHTML = `<p class="empty-msg">Tu carrito está vacío.</p>`;
    return;
  }
  cart.forEach((qty, id) => {
    const item = products.find((p) => p.id === id);
    const row = document.createElement("div");
    row.className = "cart-item";
    row.innerHTML = `
      <span class="ci-name">${item.emoji || ""} ${item.name}</span>
      <span>${currency.format(item.price * qty)}</span>
      <span class="ci-qty">
        <button data-act="dec" data-id="${id}">−</button>
        <span>${qty}</span>
        <button data-act="inc" data-id="${id}">+</button>
      </span>
    `;
    row.querySelector('[data-act="dec"]').addEventListener("click", () => changeQty(id, -1));
    row.querySelector('[data-act="inc"]').addEventListener("click", () => changeQty(id, 1));
    box.appendChild(row);
  });
}

function openCart() {
  el("cart-panel").classList.remove("hidden");
  el("overlay").classList.remove("hidden");
}
function closeCart() {
  el("cart-panel").classList.add("hidden");
  el("overlay").classList.add("hidden");
}
function openCheckout() {
  if (cart.size === 0) return;
  el("checkout-modal").classList.remove("hidden");
  el("cart-panel").classList.add("hidden");
}
function closeCheckout() {
  el("checkout-modal").classList.add("hidden");
  el("overlay").classList.add("hidden");
  el("checkout-status").textContent = "";
}

function buildOrder(formData) {
  const items = [];
  let total = 0;
  cart.forEach((qty, id) => {
    const item = products.find((p) => p.id === id);
    items.push({ name: item.name, qty, price: item.price, subtotal: item.price * qty });
    total += item.price * qty;
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

el("cart-button").addEventListener("click", openCart);
el("cart-close").addEventListener("click", closeCart);
el("overlay").addEventListener("click", closeCart);
el("checkout-button").addEventListener("click", openCheckout);
el("checkout-close").addEventListener("click", closeCheckout);
el("checkout-form").addEventListener("submit", submitOrder);

loadProducts();
updateCartUI();
