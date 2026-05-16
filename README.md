# BookNest BookStore

Aplikasi BookStore full-stack untuk praktik demonstrasi Junior Web Developer. Aplikasi ini memakai backend Express dan database PostgreSQL, serta memiliki dua aktor:

- **Admin**: mengelola kategori buku, data buku, melihat user terdaftar, pesanan, mengubah status pengiriman, dan pesan kontak.
- **User**: registrasi, login, melihat About Us, mengirim pesan ke admin, mencari buku, add to cart, checkout dengan metode Payment at Delivery, dan melihat status pengiriman buku.

## Cara Menjalankan

Install dependency terlebih dahulu:

```bash
npm install
```

Jalankan server backend:

```bash
npm start
```

Buka aplikasi di browser:

```text
http://localhost:4173
```

Login demo:

- Admin: `admin@booknest.test` / `admin123`
- User: `user@booknest.test` / `user123`

Data demo dan perubahan CRUD tersimpan di database PostgreSQL sesuai konfigurasi `.env`.

Konfigurasi database:

```env
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5433
DB_DATABASE=perpus
DB_USERNAME=postgres
DB_PASSWORD=123456
CACHE_DRIVER=database
```

## Teknologi

- HTML5
- CSS3
- JavaScript terstruktur
- Node.js
- Express.js
- PostgreSQL
- Bootstrap 5 dari CDN sebagai library komponen pre-existing
- Bootstrap Icons dari CDN

## Struktur File

- `index.html`: struktur halaman, modal, form, dashboard, dan layout utama.
- `styles.css`: styling responsif dan komponen visual.
- `app.js`: logika frontend untuk memanggil API backend.
- `server.js`: backend Express, endpoint API, pembuatan tabel, seed database, dan API status pesanan user.
- `package.json`: daftar dependency dan script menjalankan aplikasi.
- `.env`: konfigurasi koneksi PostgreSQL lokal.
- `.env.example`: contoh konfigurasi environment.
- `mockup.html`: mockup/wireframe sederhana untuk rancangan aplikasi.
- `laporan-bookstore.md`: template laporan untuk disalin ke Ms. Word.
- `laporan-bookstore.doc`: laporan yang dapat dibuka di Ms. Word.

## Sumber Gambar

Gambar menggunakan URL Unsplash. Berdasarkan halaman lisensi Unsplash, foto dapat digunakan gratis untuk sebagian besar proyek personal dan komersial. Referensi lisensi: https://unsplash.com/license

## Link Pengumpulan

Setelah aplikasi diupload ke GitHub, isi link repository dan link rancangan/mockup pada `laporan-bookstore.md`, tambahkan screenshot tampilan aplikasi, lalu upload laporan ke https://lspmi.co.id.
