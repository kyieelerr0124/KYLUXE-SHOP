// ========================================
// KYLUXE — SCRIPT
// ========================================

// Supabase connection
const supabaseClient = window.supabase.createClient(
  window.KYLUXE_CONFIG.SUPABASE_URL,
  window.KYLUXE_CONFIG.SUPABASE_PUBLISHABLE_KEY
);

// App state
let products = [];
let favorites = JSON.parse(localStorage.getItem("kyluxe_favorites")) || [];
let cart = JSON.parse(localStorage.getItem("kyluxe_cart")) || [];

// ========================================
// INITIALIZE
// ========================================

document.addEventListener("DOMContentLoaded", () => {
  loadProducts();
  setupNavigation();
  setupButtons();
  checkUser();
  updateCartCount();
});

// ========================================
// LOAD PRODUCTS FROM SUPABASE
// ========================================

async function loadProducts() {
  const { data, error } = await supabaseClient
    .from("products")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Products error:", error);
    showToast("Unable to load products.");
    return;
  }

  products = data || [];

  displayProducts(products);
  displayCategories(products);
  displayFavorites();
}

// ========================================
// DISPLAY PRODUCTS
// ========================================

function displayProducts(list) {
  const grid = document.getElementById("productGrid");

  if (!grid) return;

  if (list.length === 0) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:50px;">
        <h3>No products yet</h3>
        <p style="color:#888;margin-top:8px;">
          Products added from the admin dashboard will appear here.
        </p>
      </div>
    `;
    return;
  }

  grid.innerHTML = list.map(product => createProductCard(product)).join("");
}

// ========================================
// PRODUCT CARD
// ========================================

function createProductCard(product) {
  const isFavorite = favorites.includes(product.id);

  const image = product.image_url ||
    "https://via.placeholder.com/600x750?text=KYLUXE";

  const soldOut = product.stock <= 0;

  const originalPrice = product.original_price
    ? `
      <span class="product-original-price">
        ₱${Number(product.original_price).toFixed(2)}
      </span>
    `
    : "";

  return `
    <article class="product-card">

      <div style="position:relative;">

        <img
          class="product-image"
          src="${image}"
          alt="${escapeHTML(product.name)}"
        >

        <button
          onclick="toggleFavorite('${product.id}')"
          style="
            position:absolute;
            top:12px;
            right:12px;
            width:38px;
            height:38px;
            border-radius:50%;
            border:none;
            background:white;
            cursor:pointer;
            font-size:20px;
          "
          aria-label="Favorite"
        >
          ${isFavorite ? "♥" : "♡"}
        </button>

      </div>

      <div class="product-info">

        <div class="product-name">
          ${escapeHTML(product.name)}
        </div>

        <div class="product-price">
          ₱${Number(product.price).toFixed(2)}
          ${originalPrice}
        </div>

        <div class="product-stock">
          ${
            soldOut
              ? "Sold Out"
              : product.stock <= 5
                ? `Only ${product.stock} left`
                : `${product.stock} available`
          }
        </div>

        <button
          onclick="addToCart('${product.id}')"
          class="primary-btn"
          style="width:100%;margin-top:14px;"
          ${soldOut ? "disabled" : ""}
        >
          ${soldOut ? "SOLD OUT" : "ADD TO CART"}
        </button>

      </div>

    </article>
  `;
}

// ========================================
// CATEGORIES
// ========================================

function displayCategories(list) {
  const grid = document.getElementById("categoryGrid");

  if (!grid) return;

  const categories = [
    ...new Set(
      list
        .map(product => product.category)
        .filter(Boolean)
    )
  ];

  if (categories.length === 0) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;">
        Categories will appear when products are added.
      </div>
    `;
    return;
  }

  grid.innerHTML = categories.map(category => `
    <div
      class="category-card"
      onclick="filterCategory('${escapeAttribute(category)}')"
    >
      <h3>${escapeHTML(category)}</h3>
    </div>
  `).join("");
}

// ========================================
// CATEGORY FILTER
// ========================================

function filterCategory(category) {
  const filtered = products.filter(
    product => product.category === category
  );

  displayProducts(filtered);

  document.getElementById("home")?.scrollIntoView({
    behavior: "smooth"
  });
}

// ========================================
// FAVORITES
// ========================================

function toggleFavorite(productId) {
  if (favorites.includes(productId)) {
    favorites = favorites.filter(id => id !== productId);
    showToast("Removed from favorites.");
  } else {
    favorites.push(productId);
    showToast("Added to favorites.");
  }

  localStorage.setItem(
    "kyluxe_favorites",
    JSON.stringify(favorites)
  );

  displayProducts(products);
  displayFavorites();
}

function displayFavorites() {
  const grid = document.getElementById("favoritesGrid");

  if (!grid) return;

  const favoriteProducts = products.filter(product =>
    favorites.includes(product.id)
  );

  if (favoriteProducts.length === 0) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:40px;">
        <h3>No favorites yet ♡</h3>
        <p style="color:#888;margin-top:8px;">
          Tap the heart on a product to save it here.
        </p>
      </div>
    `;

    return;
  }

  grid.innerHTML = favoriteProducts
    .map(product => createProductCard(product))
    .join("");
}

// ========================================
// CART
// ========================================

function addToCart(productId) {
  const product = products.find(
    item => item.id === productId
  );

  if (!product) return;

  if (product.stock <= 0) {
    showToast("This product is sold out.");
    return;
  }

  const existing = cart.find(
    item => item.product_id === productId
  );

  if (existing) {
    if (existing.quantity >= product.stock) {
      showToast("You reached the available stock.");
      return;
    }

    existing.quantity += 1;

  } else {

    cart.push({
      product_id: product.id,
      quantity: 1,
      size: null,
      color: null
    });

  }

  saveCart();

  showToast("Added to cart.");

  renderCart();
}

function removeFromCart(productId) {
  cart = cart.filter(
    item => item.product_id !== productId
  );

  saveCart();
  renderCart();

  showToast("Removed from cart.");
}

function changeQuantity(productId, change) {
  const item = cart.find(
    cartItem => cartItem.product_id === productId
  );

  const product = products.find(
    productItem => productItem.id === productId
  );

  if (!item || !product) return;

  item.quantity += change;

  if (item.quantity <= 0) {
    removeFromCart(productId);
    return;
  }

  if (item.quantity > product.stock) {
    item.quantity = product.stock;
    showToast("Maximum available stock reached.");
  }

  saveCart();
  renderCart();
}

function saveCart() {
  localStorage.setItem(
    "kyluxe_cart",
    JSON.stringify(cart)
  );

  updateCartCount();
}

function updateCartCount() {
  const count = cart.reduce(
    (total, item) => total + item.quantity,
    0
  );

  document.querySelectorAll(".cart-count").forEach(element => {
    element.textContent = count;
  });
}

// ========================================
// RENDER CART
// ========================================

function renderCart() {
  const container = document.getElementById("cartContainer");

  if (!container) return;

  if (cart.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:30px;">
        <h3>Your cart is empty.</h3>
        <p style="color:#888;margin-top:8px;">
          Add something you love.
        </p>
      </div>
    `;

    return;
  }

  let subtotal = 0;

  const itemsHTML = cart.map(item => {

    const product = products.find(
      productItem => productItem.id === item.product_id
    );

    if (!product) return "";

    const itemTotal =
      Number(product.price) * item.quantity;

    subtotal += itemTotal;

    return `
      <div
        style="
          display:flex;
          gap:15px;
          padding:15px 0;
          border-bottom:1px solid #eee;
          align-items:center;
        "
      >

        <img
          src="${product.image_url || "https://via.placeholder.com/100"}"
          style="
            width:80px;
            height:100px;
            object-fit:cover;
            border-radius:10px;
          "
        >

        <div style="flex:1;">

          <strong>
            ${escapeHTML(product.name)}
          </strong>

          <p style="margin-top:5px;">
            ₱${Number(product.price).toFixed(2)}
          </p>

          <div style="margin-top:10px;">

            <button
              onclick="changeQuantity('${product.id}', -1)"
              style="padding:5px 10px;"
            >
              −
            </button>

            <span style="margin:0 12px;">
              ${item.quantity}
            </span>

            <button
              onclick="changeQuantity('${product.id}', 1)"
              style="padding:5px 10px;"
            >
              +
            </button>

          </div>

        </div>

        <button
          onclick="removeFromCart('${product.id}')"
          style="
            border:none;
            background:none;
            cursor:pointer;
          "
        >
          Remove
        </button>

      </div>
    `;
  }).join("");

  container.innerHTML = `
    ${itemsHTML}

    <div
      style="
        display:flex;
        justify-content:space-between;
        margin-top:25px;
        font-size:18px;
        font-weight:bold;
      "
    >
      <span>Subtotal</span>
      <span>₱${subtotal.toFixed(2)}</span>
    </div>

    <button
      class="primary-btn"
      style="width:100%;margin-top:20px;"
      onclick="checkout()"
    >
      CHECKOUT
    </button>
  `;
}

// ========================================
// CHECKOUT
// ========================================

async function checkout() {

  const {
    data: {
      user
    }
  } = await supabaseClient.auth.getUser();

  if (!user) {
    showToast("Please sign in before checkout.");
    return;
  }

  if (cart.length === 0) {
    showToast("Your cart is empty.");
    return;
  }

  const subtotal = cart.reduce((total, item) => {

    const product = products.find(
      productItem => productItem.id === item.product_id
    );

    if (!product) return total;

    return total +
      Number(product.price) * item.quantity;

  }, 0);

  const deliveryFee = 50;
  const total = subtotal + deliveryFee;

  const customerName =
    user.user_metadata?.full_name ||
    user.email ||
    "KYLUXE Customer";

  const orderNumber =
    "KYL-" +
    Date.now().toString().slice(-8);

  const {
    data: order,
    error
  } = await supabaseClient
    .from("orders")
    .insert({
      order_number: orderNumber,
      user_id: user.id,
      customer_name: customerName,
      phone: "Not provided",
      address: "Not provided",
      city: "Not provided",
      postal_code: "",
      instructions: "",
      payment_method: "Cash on Delivery",
      subtotal: subtotal,
      delivery_fee: deliveryFee,
      total: total,
      status: "Order Confirmed"
    })
    .select()
    .single();

  if (error) {
    console.error(error);
    showToast("Checkout failed.");
    return;
  }

  const orderItems = cart.map(item => {

    const product = products.find(
      productItem => productItem.id === item.product_id
    );

    return {
      order_id: order.id,
      product_id: product.id,
      product_name: product.name,
      price: product.price,
      quantity: item.quantity,
      size: item.size,
      color: item.color,
      image_url: product.image_url
    };

  });

  const {
    error: itemError
  } = await supabaseClient
    .from("order_items")
    .insert(orderItems);

  if (itemError) {
    console.error(itemError);
    showToast("Order items could not be saved.");
    return;
  }

  cart = [];

  saveCart();
  renderCart();

  showToast(
    `Order ${orderNumber} confirmed!`
  );
}

// ========================================
// AUTH
// ========================================

async function checkUser() {

  const {
    data: {
      user
    }
  } = await supabaseClient.auth.getUser();

  const account = document.getElementById(
    "accountContainer"
  );

  if (!account) return;

  if (user) {

    const name =
      user.user_metadata?.full_name ||
      user.email;

    account.innerHTML = `
      <h3>Welcome, ${escapeHTML(name)}</h3>

      <p style="color:#777;margin-top:8px;">
        ${escapeHTML(user.email || "")}
      </p>

      <button
        class="primary-btn"
        onclick="signOut()"
        style="margin-top:20px;"
      >
        SIGN OUT
      </button>
    `;

  } else {

    account.innerHTML = `
      <h3>Welcome to KYLUXE</h3>

      <p style="color:#777;margin-top:8px;">
        Sign in to manage your account and orders.
      </p>

      <button
        class="primary-btn"
        onclick="showToast('Login page coming next.')"
        style="margin-top:20px;"
      >
        SIGN IN
      </button>
    `;
  }
}

// ========================================
// SIGN OUT
// ========================================

async function signOut() {

  const {
    error
  } = await supabaseClient.auth.signOut();

  if (error) {
    showToast("Unable to sign out.");
    return;
  }

  showToast("Signed out.");

  checkUser();
}

// ========================================
// NAVIGATION
// ========================================

function setupNavigation() {

  document.querySelectorAll(
    'a[href^="#"]'
  ).forEach(link => {

    link.addEventListener("click", event => {

      const targetId =
        link.getAttribute("href");

      const target =
        document.querySelector(targetId);

      if (!target) return;

      event.preventDefault();

      target.scrollIntoView({
        behavior: "smooth"
      });

    });

  });
}

// ========================================
// BUTTONS
// ========================================

function setupButtons() {

  const shopNow =
    document.getElementById("shopNowBtn");

  if (shopNow) {
    shopNow.addEventListener("click", () => {

      document
        .getElementById("home")
        ?.scrollIntoView({
          behavior: "smooth"
        });

    });
  }

  const viewAll =
    document.getElementById("viewAllBtn");

  if (viewAll) {
    viewAll.addEventListener("click", () => {
      displayProducts(products);
    });
  }
}

// ========================================
// TOAST
// ========================================

function showToast(message) {

  const toast =
    document.getElementById("toast");

  if (!toast) return;

  toast.textContent = message;

  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}

// ========================================
// SECURITY / TEXT HELPERS
// ========================================

function escapeHTML(value) {

  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll("'", "\\'");
}

// ========================================
// AUTH STATE LISTENER
// ========================================

supabaseClient.auth.onAuthStateChange(
  (event, session) => {

    console.log(
      "Auth state:",
      event
    );

    checkUser();
  }
);
