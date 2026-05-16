"use strict";

const SESSION_KEY = "booknest_current_user";
const state = {
  currentUser: JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null"),
  categories: [],
  books: [],
  users: [],
  cart: [],
  userOrders: [],
  orders: [],
  messages: []
};

const elements = {};

document.addEventListener("DOMContentLoaded", initApp);

/**
 * Menyiapkan referensi elemen, event listener, mengambil data API, dan membuka tampilan awal.
 */
async function initApp() {
  cacheElements();
  bindEvents();
  await refreshState();
  showView(location.hash.replace("#", "") || "home");
}

/**
 * Menyimpan elemen DOM yang sering dipakai agar query tidak berulang.
 */
function cacheElements() {
  elements.views = document.querySelectorAll(".view-section");
  elements.searchInput = document.querySelector("#searchInput");
  elements.categoryFilter = document.querySelector("#categoryFilter");
  elements.bookGrid = document.querySelector("#bookGrid");
  elements.cartList = document.querySelector("#cartList");
  elements.summaryItems = document.querySelector("#summaryItems");
  elements.summaryTotal = document.querySelector("#summaryTotal");
  elements.checkoutForm = document.querySelector("#checkoutForm");
  elements.deliveryAddress = document.querySelector("#deliveryAddress");
  elements.paymentMethod = document.querySelector("#paymentMethod");
  elements.loginForm = document.querySelector("#loginForm");
  elements.registerForm = document.querySelector("#registerForm");
  elements.logoutBtn = document.querySelector("#logoutBtn");
  elements.contactForm = document.querySelector("#contactForm");
  elements.bookDetailContent = document.querySelector("#bookDetailContent");
  elements.categoryForm = document.querySelector("#categoryForm");
  elements.bookForm = document.querySelector("#bookForm");
  elements.categoryTable = document.querySelector("#categoryTable");
  elements.bookTable = document.querySelector("#bookTable");
  elements.userTable = document.querySelector("#userTable");
  elements.orderList = document.querySelector("#orderList");
  elements.myOrderList = document.querySelector("#myOrderList");
  elements.messageList = document.querySelector("#messageList");
  elements.adminStats = document.querySelector("#adminStats");
}

/**
 * Menghubungkan aksi pengguna dengan fungsi aplikasi.
 */
function bindEvents() {
  document.body.addEventListener("click", handleGlobalClick);
  elements.searchInput.addEventListener("input", renderBooks);
  elements.categoryFilter.addEventListener("change", renderBooks);
  elements.loginForm.addEventListener("submit", handleLogin);
  elements.registerForm.addEventListener("submit", handleRegister);
  elements.logoutBtn.addEventListener("click", handleLogout);
  elements.contactForm.addEventListener("submit", handleContactSubmit);
  elements.checkoutForm.addEventListener("submit", handleCheckout);
  elements.categoryForm.addEventListener("submit", handleCategorySubmit);
  document.querySelector("#resetCategoryBtn").addEventListener("click", resetCategoryForm);
  elements.bookForm.addEventListener("submit", handleBookSubmit);
  document.querySelector("#resetBookBtn").addEventListener("click", resetBookForm);
  window.addEventListener("hashchange", () => showView(location.hash.replace("#", "") || "home"));
}

/**
 * Memanggil API backend dengan format JSON dan penanganan error konsisten.
 */
async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(data?.message || "Request gagal.");
  return data;
}

/**
 * Mengambil data terbaru dari database melalui backend.
 */
async function refreshState() {
  const data = await apiRequest("/api/state");
  state.categories = data.categories;
  state.books = data.books;
  state.users = data.users;
  state.orders = data.orders;
  state.messages = data.messages;
  if (state.currentUser?.id) {
    [state.cart, state.userOrders] = await Promise.all([
      apiRequest(`/api/cart/${state.currentUser.id}`),
      apiRequest(`/api/orders/user/${state.currentUser.id}`)
    ]);
  } else {
    state.cart = [];
    state.userOrders = [];
  }
  renderAll();
}

/**
 * Mengubah angka menjadi format mata uang rupiah.
 */
function formatCurrency(amount) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount);
}

/**
 * Mengambil nama kategori berdasarkan ID kategori.
 */
function getCategoryName(categoryId) {
  return state.categories.find((category) => category.id === categoryId)?.name || "Tanpa Kategori";
}

/**
 * Mengatur perpindahan halaman virtual pada single page application.
 */
function showView(viewName) {
  const allowedView = viewName === "admin" && state.currentUser?.role !== "admin" ? "home" : viewName;
  elements.views.forEach((section) => section.classList.add("d-none"));
  document.querySelector(`#${allowedView}View`)?.classList.remove("d-none");
  if (location.hash.replace("#", "") !== allowedView) {
    location.hash = allowedView;
  }
  renderAll();
}

/**
 * Menangani klik global untuk tombol navigasi dan aksi data.
 */
function handleGlobalClick(event) {
  const viewButton = event.target.closest("[data-view]");
  const actionButton = event.target.closest("[data-action]");
  if (viewButton) {
    event.preventDefault();
    showView(viewButton.dataset.view);
  }
  if (actionButton) {
    runAction(actionButton.dataset.action, actionButton.dataset.id);
  }
}

/**
 * Mendistribusikan aksi tombol ke fungsi yang sesuai.
 */
function runAction(action, id) {
  const actions = {
    detail: () => showBookDetail(id),
    addCart: () => addToCart(id),
    decreaseCart: () => updateCartQuantity(id, -1),
    increaseCart: () => updateCartQuantity(id, 1),
    removeCart: () => removeFromCart(id),
    refreshMyOrders: () => refreshMyOrders(),
    updateOrderStatus: () => updateOrderStatus(id),
    editCategory: () => fillCategoryForm(id),
    deleteCategory: () => deleteCategory(id),
    editBook: () => fillBookForm(id),
    deleteBook: () => deleteBook(id)
  };
  actions[action]?.();
}

/**
 * Merender seluruh bagian yang bergantung pada perubahan state.
 */
function renderAll() {
  renderAuthState();
  renderCategoryOptions();
  renderBooks();
  renderCart();
  renderMyOrders();
  renderAdmin();
}

/**
 * Menampilkan elemen navigasi sesuai status login dan role.
 */
function renderAuthState() {
  const user = state.currentUser;
  document.querySelectorAll(".guest-only").forEach((item) => item.classList.toggle("d-none", Boolean(user)));
  document.querySelectorAll(".auth-only").forEach((item) => item.classList.toggle("d-none", !user));
  document.querySelectorAll(".user-only").forEach((item) => item.classList.toggle("d-none", user?.role !== "user"));
  document.querySelectorAll(".admin-only").forEach((item) => item.classList.toggle("d-none", user?.role !== "admin"));
}

/**
 * Merender pilihan kategori pada katalog dan form admin.
 */
function renderCategoryOptions() {
  const selectedFilter = elements.categoryFilter.value || "all";
  elements.categoryFilter.innerHTML = ['<option value="all">Semua Kategori</option>']
    .concat(state.categories.map((category) => `<option value="${category.id}">${category.name}</option>`))
    .join("");
  elements.categoryFilter.value = selectedFilter;
  document.querySelector("#bookCategory").innerHTML = state.categories
    .map((category) => `<option value="${category.id}">${category.name}</option>`)
    .join("");
}

/**
 * Mengambil daftar buku yang cocok dengan kata kunci dan filter kategori.
 */
function getFilteredBooks() {
  const keyword = elements.searchInput.value.trim().toLowerCase();
  const categoryId = elements.categoryFilter.value || "all";
  return state.books.filter((book) => {
    const categoryMatch = categoryId === "all" || book.categoryId === categoryId;
    const searchableText = `${book.title} ${book.author} ${getCategoryName(book.categoryId)} ${book.description}`.toLowerCase();
    return categoryMatch && searchableText.includes(keyword);
  });
}

/**
 * Merender kartu buku pada halaman katalog.
 */
function renderBooks() {
  const books = getFilteredBooks();
  elements.bookGrid.innerHTML = books.length
    ? books.map(createBookCard).join("")
    : '<div class="alert alert-warning">Buku tidak ditemukan.</div>';
}

/**
 * Membuat HTML kartu buku katalog.
 */
function createBookCard(book) {
  return `
    <article class="book-card">
      <img src="${book.image}" alt="${book.title}">
      <div class="card-body p-3">
        <span class="badge text-bg-success align-self-start mb-2">${getCategoryName(book.categoryId)}</span>
        <h3 class="h5 fw-bold">${book.title}</h3>
        <p class="small text-secondary mb-1">${book.author} · <i class="bi bi-star-fill text-warning"></i> ${book.rating}</p>
        <p class="book-description">${book.description}</p>
        <div class="mt-auto">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <strong>${formatCurrency(book.price)}</strong>
            <span class="small text-secondary">Stok ${book.stock}</span>
          </div>
          <div class="d-grid gap-2">
            <button class="btn btn-outline-dark btn-sm" type="button" data-action="detail" data-id="${book.id}"><i class="bi bi-eye"></i> Detail</button>
            <button class="btn btn-success btn-sm" type="button" data-action="addCart" data-id="${book.id}" ${book.stock < 1 ? "disabled" : ""}><i class="bi bi-cart-plus"></i> Add to Cart</button>
          </div>
        </div>
      </div>
    </article>
  `;
}

/**
 * Menampilkan detail buku dalam modal.
 */
function showBookDetail(bookId) {
  const book = state.books.find((item) => item.id === bookId);
  if (!book) return;
  elements.bookDetailContent.innerHTML = `
    <div class="modal-header">
      <h2 class="modal-title h5">${book.title}</h2>
      <button class="btn-close" type="button" data-bs-dismiss="modal" aria-label="Tutup"></button>
    </div>
    <div class="modal-body">
      <div class="row g-4">
        <div class="col-md-5"><img class="w-100 rounded-2" src="${book.image}" alt="${book.title}"></div>
        <div class="col-md-7">
          <p class="badge text-bg-success">${getCategoryName(book.categoryId)}</p>
          <p class="text-secondary">Penulis: ${book.author}</p>
          <p>${book.description}</p>
          <p><i class="bi bi-star-fill text-warning"></i> ${book.rating} · Stok ${book.stock}</p>
          <h3 class="h4 fw-bold">${formatCurrency(book.price)}</h3>
          <button class="btn btn-success" type="button" data-action="addCart" data-id="${book.id}" ${book.stock < 1 ? "disabled" : ""}>Add to Cart</button>
        </div>
      </div>
    </div>
  `;
  bootstrap.Modal.getOrCreateInstance(document.querySelector("#bookDetailModal")).show();
}

/**
 * Menambahkan buku ke keranjang user melalui API backend.
 */
async function addToCart(bookId) {
  try {
    if (!state.currentUser || state.currentUser.role !== "user") {
      showToast("Silakan login sebagai user untuk menambahkan buku.");
      bootstrap.Modal.getOrCreateInstance(document.querySelector("#authModal")).show();
      return;
    }
    await apiRequest("/api/cart", {
      method: "POST",
      body: JSON.stringify({ userId: state.currentUser.id, bookId })
    });
    await refreshState();
    showToast("Buku berhasil masuk ke keranjang database.");
  } catch (error) {
    showToast(error.message);
  }
}

/**
 * Mengubah jumlah buku dalam keranjang melalui API backend.
 */
async function updateCartQuantity(bookId, delta) {
  try {
    const item = state.cart.find((entry) => entry.bookId === bookId);
    const book = state.books.find((entry) => entry.id === bookId);
    if (!item || !book) return;
    const quantity = Math.max(1, Math.min(book.stock, item.quantity + delta));
    await apiRequest("/api/cart", {
      method: "PATCH",
      body: JSON.stringify({ userId: state.currentUser.id, bookId, quantity })
    });
    await refreshState();
  } catch (error) {
    showToast(error.message);
  }
}

/**
 * Menghapus buku dari keranjang melalui API backend.
 */
async function removeFromCart(bookId) {
  try {
    await apiRequest(`/api/cart/${state.currentUser.id}/${bookId}`, { method: "DELETE" });
    await refreshState();
  } catch (error) {
    showToast(error.message);
  }
}

/**
 * Menghitung total item dan total harga keranjang aktif.
 */
function getCartSummary() {
  return state.cart.reduce((summary, item) => {
    const book = state.books.find((entry) => entry.id === item.bookId);
    if (!book) return summary;
    summary.items += item.quantity;
    summary.total += book.price * item.quantity;
    return summary;
  }, { items: 0, total: 0 });
}

/**
 * Merender daftar item keranjang dan ringkasan pembelian.
 */
function renderCart() {
  const summary = getCartSummary();
  document.querySelectorAll(".cart-count").forEach((item) => { item.textContent = summary.items; });
  elements.summaryItems.textContent = summary.items;
  elements.summaryTotal.textContent = formatCurrency(summary.total);
  elements.cartList.innerHTML = state.cart.length
    ? state.cart.map(createCartItem).join("")
    : '<div class="list-group-item">Keranjang masih kosong.</div>';
}

/**
 * Membuat HTML item keranjang.
 */
function createCartItem(item) {
  const book = state.books.find((entry) => entry.id === item.bookId);
  if (!book) return "";
  return `
    <div class="list-group-item">
      <div class="d-flex gap-3 align-items-center">
        <img src="${book.image}" alt="${book.title}" width="72" height="72" class="rounded-2 object-fit-cover">
        <div class="flex-grow-1">
          <h3 class="h6 fw-bold mb-1">${book.title}</h3>
          <p class="small text-secondary mb-0">${formatCurrency(book.price)} · ${getCategoryName(book.categoryId)}</p>
        </div>
        <div class="btn-group" role="group" aria-label="Jumlah buku">
          <button class="btn btn-outline-secondary btn-sm" type="button" data-action="decreaseCart" data-id="${book.id}">-</button>
          <span class="btn btn-light btn-sm disabled">${item.quantity}</span>
          <button class="btn btn-outline-secondary btn-sm" type="button" data-action="increaseCart" data-id="${book.id}">+</button>
        </div>
        <button class="btn btn-outline-danger btn-sm" type="button" data-action="removeCart" data-id="${book.id}"><i class="bi bi-trash"></i></button>
      </div>
    </div>
  `;
}

/**
 * Membuat pesanan dari keranjang aktif dengan metode Payment at Delivery.
 */
async function handleCheckout(event) {
  event.preventDefault();
  try {
    if (!state.currentUser || state.cart.length === 0) {
      showToast("Keranjang masih kosong.");
      return;
    }
    await apiRequest("/api/orders", {
      method: "POST",
      body: JSON.stringify({
        userId: state.currentUser.id,
        address: elements.deliveryAddress.value.trim(),
        paymentMethod: elements.paymentMethod.value
      })
    });
    elements.checkoutForm.reset();
    await refreshState();
    showToast("Pesanan berhasil disimpan ke database.");
    showView("myOrders");
  } catch (error) {
    showToast(error.message);
  }
}

/**
 * Memproses login user atau admin melalui backend.
 */
async function handleLogin(event) {
  event.preventDefault();
  try {
    const email = document.querySelector("#loginEmail").value.trim().toLowerCase();
    const password = document.querySelector("#loginPassword").value;
    const user = await apiRequest("/api/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    state.currentUser = user;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
    elements.loginForm.reset();
    bootstrap.Modal.getInstance(document.querySelector("#authModal"))?.hide();
    await refreshState();
    showToast(`Selamat datang, ${user.name}.`);
    showView(user.role === "admin" ? "admin" : "catalog");
  } catch (error) {
    showToast(error.message);
  }
}

/**
 * Mendaftarkan akun user baru melalui backend.
 */
async function handleRegister(event) {
  event.preventDefault();
  try {
    const user = await apiRequest("/api/register", {
      method: "POST",
      body: JSON.stringify({
        name: document.querySelector("#registerName").value.trim(),
        email: document.querySelector("#registerEmail").value.trim().toLowerCase(),
        password: document.querySelector("#registerPassword").value
      })
    });
    state.currentUser = user;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
    elements.registerForm.reset();
    bootstrap.Modal.getInstance(document.querySelector("#authModal"))?.hide();
    await refreshState();
    showToast("Registrasi berhasil dan data tersimpan di database.");
    showView("catalog");
  } catch (error) {
    showToast(error.message);
  }
}

/**
 * Menghapus sesi login aktif dari browser.
 */
function handleLogout() {
  state.currentUser = null;
  state.cart = [];
  state.userOrders = [];
  sessionStorage.removeItem(SESSION_KEY);
  renderAll();
  showToast("Anda sudah logout.");
  showView("home");
}

/**
 * Menyimpan pesan kontak ke database agar dapat dipantau admin.
 */
async function handleContactSubmit(event) {
  event.preventDefault();
  try {
    await apiRequest("/api/messages", {
      method: "POST",
      body: JSON.stringify({
        name: document.querySelector("#contactName").value.trim(),
        email: document.querySelector("#contactEmail").value.trim(),
        message: document.querySelector("#contactMessage").value.trim()
      })
    });
    elements.contactForm.reset();
    await refreshState();
    showToast("Pesan berhasil disimpan ke database admin.");
  } catch (error) {
    showToast(error.message);
  }
}

/**
 * Mengubah status pengiriman pesanan dari dashboard admin.
 */
async function updateOrderStatus(orderId) {
  try {
    const select = document.querySelector(`[data-order-status="${orderId}"]`);
    await apiRequest(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: select.value })
    });
    await refreshState();
    showToast("Status pengiriman berhasil diperbarui.");
  } catch (error) {
    showToast(error.message);
  }
}

/**
 * Mengambil ulang status pesanan user dari database.
 */
async function refreshMyOrders() {
  try {
    await refreshState();
    showToast("Status pengiriman berhasil diperbarui.");
  } catch (error) {
    showToast(error.message);
  }
}

/**
 * Menentukan urutan status pengiriman untuk indikator progres user.
 */
function getDeliverySteps(status) {
  const steps = ["Menunggu Pengiriman", "Diproses", "Dikirim", "Selesai"];
  const currentIndex = Math.max(0, steps.indexOf(status));
  return steps.map((step, index) => ({ label: step, active: index <= currentIndex }));
}

/**
 * Merender daftar pesanan milik user beserta status pengiriman.
 */
function renderMyOrders() {
  if (!elements.myOrderList) return;
  elements.myOrderList.innerHTML = state.userOrders.length
    ? state.userOrders.map(createUserOrderCard).join("")
    : '<div class="admin-panel"><p class="mb-0 text-secondary">Belum ada pesanan. Buku yang sudah checkout akan tampil di sini.</p></div>';
}

/**
 * Membuat kartu status pengiriman untuk satu pesanan user.
 */
function createUserOrderCard(order) {
  const total = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const items = order.items.map((item) => `<li>${item.title} x${item.quantity}</li>`).join("");
  const steps = getDeliverySteps(order.status).map((step) => `
    <div class="delivery-step ${step.active ? "active" : ""}">
      <span></span>
      <small>${step.label}</small>
    </div>
  `).join("");
  return `
    <article class="admin-panel mb-3">
      <div class="d-flex flex-column flex-lg-row justify-content-between gap-3 mb-3">
        <div>
          <h3 class="h5 fw-bold mb-1">Order ${order.id}</h3>
          <p class="text-secondary mb-0">${new Date(order.createdAt).toLocaleString("id-ID")} · ${order.paymentMethod}</p>
        </div>
        <div class="text-lg-end">
          <span class="badge text-bg-success">${order.status}</span>
          <p class="fw-bold mb-0 mt-2">${formatCurrency(total)}</p>
        </div>
      </div>
      <div class="delivery-progress mb-3">${steps}</div>
      <div class="row g-3">
        <div class="col-lg-7">
          <p class="fw-semibold mb-1">Buku</p>
          <ul class="mb-0">${items}</ul>
        </div>
        <div class="col-lg-5">
          <p class="fw-semibold mb-1">Alamat Pengiriman</p>
          <p class="mb-0 text-secondary">${order.address}</p>
        </div>
      </div>
    </article>
  `;
}

/**
 * Menyimpan data kategori baru atau memperbarui kategori lama melalui backend.
 */
async function handleCategorySubmit(event) {
  event.preventDefault();
  try {
    const id = document.querySelector("#categoryId").value;
    const name = document.querySelector("#categoryName").value.trim();
    await apiRequest(id ? `/api/categories/${id}` : "/api/categories", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify({ name })
    });
    resetCategoryForm();
    await refreshState();
    showToast("Kategori berhasil disimpan ke database.");
  } catch (error) {
    showToast(error.message);
  }
}

/**
 * Mengisi form kategori untuk proses update.
 */
function fillCategoryForm(categoryId) {
  const category = state.categories.find((item) => item.id === categoryId);
  if (!category) return;
  document.querySelector("#categoryId").value = category.id;
  document.querySelector("#categoryName").value = category.name;
}

/**
 * Menghapus kategori dari database jika tidak sedang dipakai buku.
 */
async function deleteCategory(categoryId) {
  try {
    await apiRequest(`/api/categories/${categoryId}`, { method: "DELETE" });
    await refreshState();
    showToast("Kategori berhasil dihapus.");
  } catch (error) {
    showToast(error.message);
  }
}

/**
 * Mengosongkan form kategori.
 */
function resetCategoryForm() {
  elements.categoryForm.reset();
  document.querySelector("#categoryId").value = "";
}

/**
 * Membaca nilai form buku dan membentuk payload API.
 */
function getBookPayload() {
  return {
    title: document.querySelector("#bookTitle").value.trim(),
    author: document.querySelector("#bookAuthor").value.trim(),
    categoryId: document.querySelector("#bookCategory").value,
    price: Number(document.querySelector("#bookPrice").value),
    stock: Number(document.querySelector("#bookStock").value),
    rating: Number(document.querySelector("#bookRating").value),
    image: document.querySelector("#bookImage").value.trim(),
    description: document.querySelector("#bookDescription").value.trim()
  };
}

/**
 * Menyimpan data buku baru atau memperbarui data buku lama melalui backend.
 */
async function handleBookSubmit(event) {
  event.preventDefault();
  try {
    const id = document.querySelector("#bookId").value;
    await apiRequest(id ? `/api/books/${id}` : "/api/books", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(getBookPayload())
    });
    resetBookForm();
    await refreshState();
    showToast("Data buku berhasil disimpan ke database.");
  } catch (error) {
    showToast(error.message);
  }
}

/**
 * Mengisi form buku untuk proses update.
 */
function fillBookForm(bookId) {
  const book = state.books.find((item) => item.id === bookId);
  if (!book) return;
  document.querySelector("#bookId").value = book.id;
  document.querySelector("#bookTitle").value = book.title;
  document.querySelector("#bookAuthor").value = book.author;
  document.querySelector("#bookCategory").value = book.categoryId;
  document.querySelector("#bookPrice").value = book.price;
  document.querySelector("#bookStock").value = book.stock;
  document.querySelector("#bookRating").value = book.rating;
  document.querySelector("#bookImage").value = book.image;
  document.querySelector("#bookDescription").value = book.description;
}

/**
 * Menghapus data buku dari database dan item keranjang terkait.
 */
async function deleteBook(bookId) {
  try {
    await apiRequest(`/api/books/${bookId}`, { method: "DELETE" });
    await refreshState();
    showToast("Buku berhasil dihapus.");
  } catch (error) {
    showToast(error.message);
  }
}

/**
 * Mengosongkan form buku.
 */
function resetBookForm() {
  elements.bookForm.reset();
  document.querySelector("#bookId").value = "";
}

/**
 * Merender seluruh tabel dan daftar pada dashboard admin.
 */
function renderAdmin() {
  renderAdminStats();
  renderCategoryTable();
  renderBookTable();
  renderUserTable();
  renderOrderList();
  renderMessageList();
}

/**
 * Merender statistik ringkas dashboard admin.
 */
function renderAdminStats() {
  elements.adminStats.innerHTML = [
    ["Kategori", state.categories.length],
    ["Buku", state.books.length],
    ["User", state.users.filter((user) => user.role === "user").length],
    ["Pesanan", state.orders.length]
  ].map(([label, value]) => `<div class="stat-pill"><span>${label}</span><strong>${value}</strong></div>`).join("");
}

/**
 * Merender tabel kategori buku.
 */
function renderCategoryTable() {
  elements.categoryTable.innerHTML = state.categories.map((category) => `
    <tr>
      <td>${category.name}</td>
      <td class="text-end">
        <button class="btn btn-outline-secondary btn-sm" type="button" data-action="editCategory" data-id="${category.id}"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-outline-danger btn-sm" type="button" data-action="deleteCategory" data-id="${category.id}"><i class="bi bi-trash"></i></button>
      </td>
    </tr>
  `).join("");
}

/**
 * Merender tabel data buku.
 */
function renderBookTable() {
  elements.bookTable.innerHTML = state.books.map((book) => `
    <tr>
      <td><div class="d-flex gap-2 align-items-center"><img src="${book.image}" alt="${book.title}"><div><strong>${book.title}</strong><br><span class="small text-secondary">${book.author}</span></div></div></td>
      <td>${getCategoryName(book.categoryId)}</td>
      <td>${formatCurrency(book.price)}</td>
      <td>${book.stock}</td>
      <td class="text-end">
        <button class="btn btn-outline-secondary btn-sm" type="button" data-action="editBook" data-id="${book.id}"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-outline-danger btn-sm" type="button" data-action="deleteBook" data-id="${book.id}"><i class="bi bi-trash"></i></button>
      </td>
    </tr>
  `).join("");
}

/**
 * Merender daftar user yang sudah terdaftar.
 */
function renderUserTable() {
  elements.userTable.innerHTML = state.users.map((user) => `
    <tr><td>${user.name}</td><td>${user.email}</td><td>${user.role}</td><td>${user.createdAt}</td></tr>
  `).join("");
}

/**
 * Merender daftar pesanan dari user berbeda-beda.
 */
function renderOrderList() {
  elements.orderList.innerHTML = state.orders.length
    ? state.orders.map((order) => {
      const total = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const items = order.items.map((item) => `${item.title} x${item.quantity}`).join(", ");
      const statuses = ["Menunggu Pengiriman", "Diproses", "Dikirim", "Selesai"];
      const options = statuses.map((status) => `<option value="${status}" ${status === order.status ? "selected" : ""}>${status}</option>`).join("");
      return `
        <div class="border-bottom py-3">
          <div class="d-flex flex-column flex-lg-row justify-content-between gap-3">
            <div>
              <strong>${order.userName}</strong>
              <p class="mb-1 text-secondary">${items}</p>
              <p class="mb-1">${order.address}</p>
              <span class="badge text-bg-success">${order.paymentMethod}</span>
              <strong class="ms-2">${formatCurrency(total)}</strong>
            </div>
            <div class="order-status-control">
              <label class="form-label small" for="status-${order.id}">Status Pengiriman</label>
              <div class="input-group">
                <select id="status-${order.id}" class="form-select form-select-sm" data-order-status="${order.id}">${options}</select>
                <button class="btn btn-outline-success btn-sm" type="button" data-action="updateOrderStatus" data-id="${order.id}">Update</button>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join("")
    : '<p class="mb-0 text-secondary">Belum ada pesanan.</p>';
}

/**
 * Merender pesan kontak yang dikirim user ke admin.
 */
function renderMessageList() {
  elements.messageList.innerHTML = state.messages.length
    ? state.messages.map((message) => `<div class="border-bottom py-3"><strong>${message.name}</strong> <span class="text-secondary">${message.email}</span><p class="mb-0">${message.message}</p></div>`).join("")
    : '<p class="mb-0 text-secondary">Belum ada pesan.</p>';
}

/**
 * Menampilkan notifikasi singkat kepada pengguna.
 */
function showToast(message) {
  const toastElement = document.querySelector("#appToast");
  toastElement.querySelector(".toast-body").textContent = message;
  bootstrap.Toast.getOrCreateInstance(toastElement).show();
}
