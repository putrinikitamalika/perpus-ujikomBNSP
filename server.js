"use strict";

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const express = require("express");
const multer = require("multer");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 4173;
const uploadDirectory = path.join(__dirname, "uploads", "books");

const pool = new Pool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 5433),
  database: process.env.DB_DATABASE || "perpus",
  user: process.env.DB_USERNAME || "postgres",
  password: process.env.DB_PASSWORD || "123456"
});

app.use(express.json());
app.use(express.static(__dirname));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

fs.mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: (request, file, callback) => {
    callback(null, uploadDirectory);
  },
  filename: (request, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, `${Date.now()}-${Math.random().toString(16).slice(2)}${extension}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (request, file, callback) => {
    if (!file.mimetype.startsWith("image/")) {
      callback(new Error("File harus berupa gambar."));
      return;
    }
    callback(null, true);
  },
  limits: { fileSize: 2 * 1024 * 1024 }
});

/**
 * Menjalankan query PostgreSQL dan mengembalikan hasil mentah dari driver.
 */
function query(sql, params = []) {
  return pool.query(sql, params);
}

/**
 * Menjalankan query database yang tidak membutuhkan banyak baris hasil.
 */
async function run(sql, params = []) {
  const result = await query(sql, params);
  return { rows: result.rows, rowCount: result.rowCount };
}

/**
 * Mengambil satu baris data dari database.
 */
async function get(sql, params = []) {
  const result = await query(sql, params);
  return result.rows[0] || null;
}

/**
 * Mengambil banyak baris data dari database.
 */
async function all(sql, params = []) {
  const result = await query(sql, params);
  return result.rows;
}

/**
 * Membuat ID teks agar data mudah dibaca pada frontend.
 */
function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Mengirim respons error API dengan format konsisten.
 */
function sendError(response, error, status = 500) {
  response.status(status).json({ message: error.message || "Terjadi kesalahan server." });
}

/**
 * Mengambil path publik file upload untuk disimpan ke database.
 */
function getUploadedImagePath(file) {
  return file ? `/uploads/books/${file.filename}` : null;
}

/**
 * Membuat tabel PostgreSQL bila belum ada.
 */
async function createTables() {
  await run(`CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
  )`);
  await run(`CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    category_id TEXT NOT NULL REFERENCES categories(id),
    price INTEGER NOT NULL,
    stock INTEGER NOT NULL,
    rating NUMERIC(2, 1) NOT NULL,
    image TEXT NOT NULL,
    description TEXT NOT NULL
  )`);
  await run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);
  await run(`CREATE TABLE IF NOT EXISTS carts (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    PRIMARY KEY (user_id, book_id)
  )`);
  await run(`CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    user_name TEXT NOT NULL,
    address TEXT NOT NULL,
    payment_method TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);
  await run(`CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    book_id TEXT NOT NULL,
    title TEXT NOT NULL,
    price INTEGER NOT NULL,
    quantity INTEGER NOT NULL
  )`);
  await run(`CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);
}

/**
 * Mengisi data dummy minimal 6 item per modul tanpa menghapus data yang sudah ada.
 */
async function seedDatabase() {
  const categories = [
    ["cat-fiksi", "Fiksi"],
    ["cat-bisnis", "Bisnis"],
    ["cat-teknologi", "Teknologi"],
    ["cat-anak", "Anak"],
    ["cat-pendidikan", "Pendidikan"],
    ["cat-sejarah", "Sejarah"]
  ];
  const books = [
    ["book-atomic", "Atomic Reading", "Nadia Pratama", "cat-bisnis", 85000, 12, 4.8, "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=900&q=80", "Panduan membangun kebiasaan membaca yang konsisten untuk karier dan pengembangan diri."],
    ["book-code", "Clean Code Web", "Raka Wijaya", "cat-teknologi", 125000, 8, 4.9, "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=900&q=80", "Prinsip penulisan kode web yang rapi, mudah dirawat, dan ramah kolaborasi tim."],
    ["book-novel", "Senja di Perpustakaan", "Maya Laras", "cat-fiksi", 78000, 15, 4.6, "https://images.unsplash.com/photo-1519682337058-a94d519337bc?auto=format&fit=crop&w=900&q=80", "Novel hangat tentang persahabatan, keberanian, dan rahasia kecil di sudut perpustakaan kota."],
    ["book-anak", "Petualangan Aksara", "Dian Sari", "cat-anak", 52000, 20, 4.7, "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=900&q=80", "Buku cerita bergambar untuk membantu anak mengenal huruf, kata, dan nilai keberanian."],
    ["book-belajar", "Belajar Efektif", "Hendra Kusuma", "cat-pendidikan", 68000, 18, 4.5, "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=900&q=80", "Strategi belajar terstruktur untuk siswa, mahasiswa, dan pembelajar mandiri."],
    ["book-sejarah", "Jejak Nusantara", "Sinta Mahardika", "cat-sejarah", 99000, 10, 4.4, "https://images.unsplash.com/photo-1461360370896-922624d12aa1?auto=format&fit=crop&w=900&q=80", "Ringkasan perjalanan sejarah Nusantara dengan bahasa yang ringan dan mudah dipahami."]
  ];
  const users = [
    ["user-admin", "Admin BookNest", "admin@booknest.test", "admin123", "admin", "2026-05-16"],
    ["user-demo", "User Demo", "user@booknest.test", "user123", "user", "2026-05-16"],
    ["user-andi", "Andi Prasetyo", "andi@booknest.test", "andi123", "user", "2026-05-16"],
    ["user-sarah", "Sarah Amelia", "sarah@booknest.test", "sarah123", "user", "2026-05-16"],
    ["user-bima", "Bima Saputra", "bima@booknest.test", "bima123", "user", "2026-05-16"],
    ["user-laras", "Laras Wulandari", "laras@booknest.test", "laras123", "user", "2026-05-16"]
  ];
  const messages = [
    ["message-001", "User Demo", "user@booknest.test", "Apakah Atomic Reading tersedia untuk pengiriman hari ini?", "2026-05-16T08:00:00.000Z"],
    ["message-002", "Andi Prasetyo", "andi@booknest.test", "Saya ingin bertanya stok buku teknologi terbaru.", "2026-05-16T08:15:00.000Z"],
    ["message-003", "Sarah Amelia", "sarah@booknest.test", "Apakah bisa bayar di tempat untuk wilayah Bogor?", "2026-05-16T08:30:00.000Z"],
    ["message-004", "Bima Saputra", "bima@booknest.test", "Mohon rekomendasi buku sejarah untuk pemula.", "2026-05-16T08:45:00.000Z"],
    ["message-005", "Laras Wulandari", "laras@booknest.test", "Kapan restock buku anak terbaru?", "2026-05-16T09:00:00.000Z"],
    ["message-006", "Nadia Putri", "nadia@booknest.test", "Apakah ada diskon untuk pembelian lebih dari tiga buku?", "2026-05-16T09:15:00.000Z"]
  ];
  const orders = [
    ["order-demo-001", "user-demo", "User Demo", "Jl. Raya Puncak Cipayung Datar", "Payment at Delivery", "Menunggu Pengiriman", "2026-05-16T09:20:00.000Z", [["book-atomic", "Atomic Reading", 85000, 1]]],
    ["order-demo-002", "user-andi", "Andi Prasetyo", "Jl. Merdeka No. 12, Jakarta", "Payment at Delivery", "Diproses", "2026-05-16T09:35:00.000Z", [["book-code", "Clean Code Web", 125000, 1]]],
    ["order-demo-003", "user-sarah", "Sarah Amelia", "Jl. Melati No. 8, Bogor", "Payment at Delivery", "Dikirim", "2026-05-16T09:50:00.000Z", [["book-novel", "Senja di Perpustakaan", 78000, 2]]],
    ["order-demo-004", "user-bima", "Bima Saputra", "Jl. Diponegoro No. 21, Bandung", "Payment at Delivery", "Selesai", "2026-05-16T10:05:00.000Z", [["book-sejarah", "Jejak Nusantara", 99000, 1]]],
    ["order-demo-005", "user-laras", "Laras Wulandari", "Jl. Kenanga No. 5, Depok", "Payment at Delivery", "Diproses", "2026-05-16T10:20:00.000Z", [["book-anak", "Petualangan Aksara", 52000, 3]]],
    ["order-demo-006", "user-demo", "User Demo", "Jl. Raya Puncak Cipayung Datar", "Payment at Delivery", "Dikirim", "2026-05-16T10:35:00.000Z", [["book-belajar", "Belajar Efektif", 68000, 1], ["book-code", "Clean Code Web", 125000, 1]]]
  ];

  for (const category of categories) {
    await run("INSERT INTO categories (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING", category);
  }
  for (const book of books) {
    await run("INSERT INTO books (id, title, author, category_id, price, stock, rating, image, description) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO NOTHING", book);
  }
  for (const user of users) {
    await run("INSERT INTO users (id, name, email, password, role, created_at) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING", user);
  }
  for (const message of messages) {
    await run("INSERT INTO messages (id, name, email, message, created_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING", message);
  }
  for (const order of orders) {
    const [id, userId, userName, address, paymentMethod, status, createdAt, items] = order;
    await run(`INSERT INTO orders (id, user_id, user_name, address, payment_method, status, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING`, [id, userId, userName, address, paymentMethod, status, createdAt]);
    for (const item of items) {
      const existingItem = await get("SELECT id FROM order_items WHERE order_id = $1 AND book_id = $2 LIMIT 1", [id, item[0]]);
      if (!existingItem) {
        await run("INSERT INTO order_items (order_id, book_id, title, price, quantity) VALUES ($1, $2, $3, $4, $5)", [id, item[0], item[1], item[2], item[3]]);
      }
    }
  }
}

/**
 * Query buku dengan alias field agar cocok dengan kebutuhan frontend.
 */
function bookSelectSql() {
  return `SELECT id, title, author, category_id AS "categoryId", price, stock, rating::float AS rating, image, description FROM books`;
}

/**
 * Mengambil pesanan beserta item buku di dalamnya.
 */
async function getOrdersWithItems(userId = null) {
  const orders = userId
    ? await all(`SELECT id, user_id AS "userId", user_name AS "userName", address, payment_method AS "paymentMethod", status, created_at AS "createdAt"
      FROM orders WHERE user_id = $1 ORDER BY created_at DESC`, [userId])
    : await all(`SELECT id, user_id AS "userId", user_name AS "userName", address, payment_method AS "paymentMethod", status, created_at AS "createdAt"
      FROM orders ORDER BY created_at DESC`);
  const items = await all(`SELECT id, order_id AS "orderId", book_id AS "bookId", title, price, quantity FROM order_items ORDER BY id ASC`);
  return orders.map((order) => ({
    ...order,
    items: items.filter((item) => item.orderId === order.id)
  }));
}

app.get("/api/state", async (request, response) => {
  try {
    const [categories, books, users, messages, orders] = await Promise.all([
      all("SELECT * FROM categories ORDER BY name"),
      all(`${bookSelectSql()} ORDER BY title`),
      all(`SELECT id, name, email, role, created_at AS "createdAt" FROM users ORDER BY created_at DESC`),
      all(`SELECT id, name, email, message, created_at AS "createdAt" FROM messages ORDER BY created_at DESC`),
      getOrdersWithItems()
    ]);
    response.json({ categories, books, users, messages, orders });
  } catch (error) {
    sendError(response, error);
  }
});

app.post("/api/login", async (request, response) => {
  try {
    const { email, password } = request.body;
    const user = await get(`SELECT id, name, email, role, created_at AS "createdAt" FROM users WHERE email = $1 AND password = $2`, [email, password]);
    if (!user) return response.status(401).json({ message: "Email atau password tidak valid." });
    response.json(user);
  } catch (error) {
    sendError(response, error);
  }
});

app.post("/api/register", async (request, response) => {
  try {
    const { name, email, password } = request.body;
    const existingUser = await get("SELECT id FROM users WHERE email = $1", [email]);
    if (existingUser) return response.status(409).json({ message: "Email sudah terdaftar." });
    const user = { id: createId("user"), name, email, role: "user", createdAt: new Date().toISOString().slice(0, 10) };
    await run("INSERT INTO users (id, name, email, password, role, created_at) VALUES ($1, $2, $3, $4, $5, $6)", [user.id, name, email, password, user.role, user.createdAt]);
    response.status(201).json(user);
  } catch (error) {
    sendError(response, error);
  }
});

app.post("/api/users", async (request, response) => {
  try {
    const { name, email, password, role } = request.body;
    const existingUser = await get("SELECT id FROM users WHERE email = $1", [email]);
    if (existingUser) return response.status(409).json({ message: "Email sudah terdaftar." });
    const user = { id: createId("user"), name, email, role, createdAt: new Date().toISOString().slice(0, 10) };
    await run("INSERT INTO users (id, name, email, password, role, created_at) VALUES ($1, $2, $3, $4, $5, $6)", [user.id, name, email, password, role, user.createdAt]);
    response.status(201).json(user);
  } catch (error) {
    sendError(response, error);
  }
});

app.put("/api/users/:id", async (request, response) => {
  try {
    const { name, email, password, role } = request.body;
    const existingUser = await get("SELECT id FROM users WHERE email = $1 AND id <> $2", [email, request.params.id]);
    if (existingUser) return response.status(409).json({ message: "Email sudah digunakan user lain." });
    if (password) {
      await run("UPDATE users SET name = $1, email = $2, password = $3, role = $4 WHERE id = $5", [name, email, password, role, request.params.id]);
    } else {
      await run("UPDATE users SET name = $1, email = $2, role = $3 WHERE id = $4", [name, email, role, request.params.id]);
    }
    response.json({ id: request.params.id, name, email, role });
  } catch (error) {
    sendError(response, error);
  }
});

app.delete("/api/users/:id", async (request, response) => {
  const client = await pool.connect();
  try {
    if (request.params.id === "user-admin") {
      return response.status(409).json({ message: "Akun admin demo tidak boleh dihapus." });
    }
    await client.query("BEGIN");
    const orderIds = await client.query("SELECT id FROM orders WHERE user_id = $1", [request.params.id]);
    for (const order of orderIds.rows) {
      await client.query("DELETE FROM order_items WHERE order_id = $1", [order.id]);
    }
    await client.query("DELETE FROM orders WHERE user_id = $1", [request.params.id]);
    await client.query("DELETE FROM carts WHERE user_id = $1", [request.params.id]);
    await client.query("DELETE FROM users WHERE id = $1", [request.params.id]);
    await client.query("COMMIT");
    response.json({ message: "User dihapus." });
  } catch (error) {
    await client.query("ROLLBACK");
    sendError(response, error);
  } finally {
    client.release();
  }
});

app.get("/api/cart/:userId", async (request, response) => {
  try {
    const cart = await all(`SELECT user_id AS "userId", book_id AS "bookId", quantity FROM carts WHERE user_id = $1`, [request.params.userId]);
    response.json(cart);
  } catch (error) {
    sendError(response, error);
  }
});

app.get("/api/orders/user/:userId", async (request, response) => {
  try {
    const orders = await getOrdersWithItems(request.params.userId);
    response.json(orders);
  } catch (error) {
    sendError(response, error);
  }
});

app.post("/api/cart", async (request, response) => {
  try {
    const { userId, bookId } = request.body;
    const book = await get("SELECT stock FROM books WHERE id = $1", [bookId]);
    if (!book) return response.status(404).json({ message: "Buku tidak ditemukan." });
    const item = await get("SELECT quantity FROM carts WHERE user_id = $1 AND book_id = $2", [userId, bookId]);
    const quantity = Math.min((item?.quantity || 0) + 1, book.stock);
    await run(`INSERT INTO carts (user_id, book_id, quantity) VALUES ($1, $2, $3)
      ON CONFLICT(user_id, book_id) DO UPDATE SET quantity = EXCLUDED.quantity`, [userId, bookId, quantity]);
    response.json({ userId, bookId, quantity });
  } catch (error) {
    sendError(response, error);
  }
});

app.patch("/api/cart", async (request, response) => {
  try {
    const { userId, bookId, quantity } = request.body;
    await run("UPDATE carts SET quantity = $1 WHERE user_id = $2 AND book_id = $3", [quantity, userId, bookId]);
    response.json({ userId, bookId, quantity });
  } catch (error) {
    sendError(response, error);
  }
});

app.delete("/api/cart/:userId/:bookId", async (request, response) => {
  try {
    await run("DELETE FROM carts WHERE user_id = $1 AND book_id = $2", [request.params.userId, request.params.bookId]);
    response.json({ message: "Item keranjang dihapus." });
  } catch (error) {
    sendError(response, error);
  }
});

app.post("/api/orders", async (request, response) => {
  const client = await pool.connect();
  try {
    const { userId, address, paymentMethod } = request.body;
    await client.query("BEGIN");
    const userResult = await client.query("SELECT name FROM users WHERE id = $1", [userId]);
    const user = userResult.rows[0];
    const cartResult = await client.query(`SELECT carts.book_id AS "bookId", carts.quantity, books.title, books.price, books.stock
      FROM carts JOIN books ON books.id = carts.book_id WHERE carts.user_id = $1`, [userId]);
    const cart = cartResult.rows;
    if (!cart.length) {
      await client.query("ROLLBACK");
      return response.status(400).json({ message: "Keranjang masih kosong." });
    }
    const orderId = createId("order");
    await client.query(`INSERT INTO orders (id, user_id, user_name, address, payment_method, status, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)`, [orderId, userId, user.name, address, paymentMethod, "Menunggu Pengiriman", new Date().toISOString()]);
    for (const item of cart) {
      if (item.quantity > item.stock) throw new Error(`Stok ${item.title} tidak mencukupi.`);
      await client.query(`INSERT INTO order_items (order_id, book_id, title, price, quantity) VALUES ($1, $2, $3, $4, $5)`, [orderId, item.bookId, item.title, item.price, item.quantity]);
      await client.query("UPDATE books SET stock = stock - $1 WHERE id = $2", [item.quantity, item.bookId]);
    }
    await client.query("DELETE FROM carts WHERE user_id = $1", [userId]);
    await client.query("COMMIT");
    response.status(201).json({ id: orderId });
  } catch (error) {
    await client.query("ROLLBACK");
    sendError(response, error);
  } finally {
    client.release();
  }
});

app.patch("/api/orders/:id/status", async (request, response) => {
  try {
    const allowedStatuses = ["Menunggu Pengiriman", "Diproses", "Dikirim", "Selesai"];
    if (!allowedStatuses.includes(request.body.status)) {
      return response.status(400).json({ message: "Status pengiriman tidak valid." });
    }
    await run("UPDATE orders SET status = $1 WHERE id = $2", [request.body.status, request.params.id]);
    response.json({ id: request.params.id, status: request.body.status });
  } catch (error) {
    sendError(response, error);
  }
});

app.delete("/api/orders/:id", async (request, response) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM order_items WHERE order_id = $1", [request.params.id]);
    await client.query("DELETE FROM orders WHERE id = $1", [request.params.id]);
    await client.query("COMMIT");
    response.json({ message: "Pesanan dihapus." });
  } catch (error) {
    await client.query("ROLLBACK");
    sendError(response, error);
  } finally {
    client.release();
  }
});

app.post("/api/messages", async (request, response) => {
  try {
    const { name, email, message } = request.body;
    const payload = { id: createId("message"), name, email, message, createdAt: new Date().toISOString() };
    await run("INSERT INTO messages (id, name, email, message, created_at) VALUES ($1, $2, $3, $4, $5)", [payload.id, name, email, message, payload.createdAt]);
    response.status(201).json(payload);
  } catch (error) {
    sendError(response, error);
  }
});

app.put("/api/messages/:id", async (request, response) => {
  try {
    const { name, email, message } = request.body;
    await run("UPDATE messages SET name = $1, email = $2, message = $3 WHERE id = $4", [name, email, message, request.params.id]);
    response.json({ id: request.params.id, name, email, message });
  } catch (error) {
    sendError(response, error);
  }
});

app.delete("/api/messages/:id", async (request, response) => {
  try {
    await run("DELETE FROM messages WHERE id = $1", [request.params.id]);
    response.json({ message: "Pesan dihapus." });
  } catch (error) {
    sendError(response, error);
  }
});

app.post("/api/categories", async (request, response) => {
  try {
    const category = { id: createId("cat"), name: request.body.name };
    await run("INSERT INTO categories (id, name) VALUES ($1, $2)", [category.id, category.name]);
    response.status(201).json(category);
  } catch (error) {
    sendError(response, error);
  }
});

app.put("/api/categories/:id", async (request, response) => {
  try {
    await run("UPDATE categories SET name = $1 WHERE id = $2", [request.body.name, request.params.id]);
    response.json({ id: request.params.id, name: request.body.name });
  } catch (error) {
    sendError(response, error);
  }
});

app.delete("/api/categories/:id", async (request, response) => {
  try {
    const used = await get("SELECT id FROM books WHERE category_id = $1 LIMIT 1", [request.params.id]);
    if (used) return response.status(409).json({ message: "Kategori tidak bisa dihapus karena masih dipakai buku." });
    await run("DELETE FROM categories WHERE id = $1", [request.params.id]);
    response.json({ message: "Kategori dihapus." });
  } catch (error) {
    sendError(response, error);
  }
});

app.post("/api/books", upload.single("imageFile"), async (request, response) => {
  try {
    const book = { ...request.body, id: createId("book") };
    book.image = getUploadedImagePath(request.file);
    if (!book.image) return response.status(400).json({ message: "Gambar buku wajib diupload." });
    await run("INSERT INTO books (id, title, author, category_id, price, stock, rating, image, description) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)", [
      book.id, book.title, book.author, book.categoryId, book.price, book.stock, book.rating, book.image, book.description
    ]);
    response.status(201).json(book);
  } catch (error) {
    sendError(response, error);
  }
});

app.put("/api/books/:id", upload.single("imageFile"), async (request, response) => {
  try {
    const book = request.body;
    const uploadedImage = getUploadedImagePath(request.file);
    const existingBook = await get("SELECT image FROM books WHERE id = $1", [request.params.id]);
    const image = uploadedImage || existingBook?.image;
    await run("UPDATE books SET title = $1, author = $2, category_id = $3, price = $4, stock = $5, rating = $6, image = $7, description = $8 WHERE id = $9", [
      book.title, book.author, book.categoryId, book.price, book.stock, book.rating, image, book.description, request.params.id
    ]);
    response.json({ ...book, image, id: request.params.id });
  } catch (error) {
    sendError(response, error);
  }
});

app.delete("/api/books/:id", async (request, response) => {
  try {
    await run("DELETE FROM carts WHERE book_id = $1", [request.params.id]);
    await run("DELETE FROM books WHERE id = $1", [request.params.id]);
    response.json({ message: "Buku dihapus." });
  } catch (error) {
    sendError(response, error);
  }
});

/**
 * Menyiapkan database PostgreSQL lalu menjalankan web server.
 */
async function startServer() {
  await createTables();
  await seedDatabase();
  app.listen(PORT, () => {
    console.log(`BookNest berjalan di http://localhost:${PORT}`);
    console.log(`PostgreSQL: ${process.env.DB_HOST || "127.0.0.1"}:${process.env.DB_PORT || 5433}/${process.env.DB_DATABASE || "perpus"}`);
  });
}

startServer().catch((error) => {
  console.error(error);
  process.exit(1);
});
