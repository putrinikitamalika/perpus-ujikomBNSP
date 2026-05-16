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
 * Mengisi data awal saat database masih kosong.
 */
async function seedDatabase() {
  const categoryCount = await get("SELECT COUNT(*)::int AS total FROM categories");
  if (categoryCount.total > 0) return;

  const categories = [
    ["cat-fiksi", "Fiksi"],
    ["cat-bisnis", "Bisnis"],
    ["cat-teknologi", "Teknologi"],
    ["cat-anak", "Anak"]
  ];
  const books = [
    ["book-atomic", "Atomic Reading", "Nadia Pratama", "cat-bisnis", 85000, 12, 4.8, "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=900&q=80", "Panduan membangun kebiasaan membaca yang konsisten untuk karier dan pengembangan diri."],
    ["book-code", "Clean Code Web", "Raka Wijaya", "cat-teknologi", 125000, 8, 4.9, "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=900&q=80", "Prinsip penulisan kode web yang rapi, mudah dirawat, dan ramah kolaborasi tim."],
    ["book-novel", "Senja di Perpustakaan", "Maya Laras", "cat-fiksi", 78000, 15, 4.6, "https://images.unsplash.com/photo-1519682337058-a94d519337bc?auto=format&fit=crop&w=900&q=80", "Novel hangat tentang persahabatan, keberanian, dan rahasia kecil di sudut perpustakaan kota."],
    ["book-anak", "Petualangan Aksara", "Dian Sari", "cat-anak", 52000, 20, 4.7, "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=900&q=80", "Buku cerita bergambar untuk membantu anak mengenal huruf, kata, dan nilai keberanian."]
  ];
  const users = [
    ["user-admin", "Admin BookNest", "admin@booknest.test", "admin123", "admin", "2026-05-16"],
    ["user-demo", "User Demo", "user@booknest.test", "user123", "user", "2026-05-16"]
  ];

  for (const category of categories) {
    await run("INSERT INTO categories (id, name) VALUES ($1, $2)", category);
  }
  for (const book of books) {
    await run("INSERT INTO books (id, title, author, category_id, price, stock, rating, image, description) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)", book);
  }
  for (const user of users) {
    await run("INSERT INTO users (id, name, email, password, role, created_at) VALUES ($1, $2, $3, $4, $5, $6)", user);
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
