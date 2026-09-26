# 💰 Budget Tracker

Mini Project RevoU — Expense & Budget Visualizer

Aplikasi pelacak pengeluaran berbasis web yang dibuat dengan HTML, CSS, dan Vanilla JavaScript murni tanpa framework.

---

## Fitur

- **Tambah transaksi** — catat nama item, jumlah, dan kategori
- **Batas pengeluaran** — set spending limit; muncul peringatan jika terlampaui
- **Kategori kustom** — tambah/hapus kategori sendiri dengan warna pilihan
- **Grafik pie** — visualisasi pengeluaran per kategori menggunakan Chart.js
- **Ringkasan bulanan** — navigasi per bulan dengan total dan breakdown per kategori
- **Sortir transaksi** — urutkan berdasarkan tanggal, nominal, atau kategori
- **Dark / Light mode** — toggle tema dengan preferensi tersimpan
- **Persistensi data** — semua data disimpan di `localStorage`, tetap ada setelah refresh

---

## Struktur Proyek

```
├── index.html        # Markup utama aplikasi
├── css/
│   └── style.css     # Styling lengkap dengan tema merah metalik
└── js/
    └── app.js        # Seluruh logika aplikasi (state, render, event)
```

---

## Cara Menjalankan

Tidak perlu build tool atau server. Cukup buka `index.html` langsung di browser.

---

## Teknologi

| Teknologi | Keterangan |
|-----------|-----------|
| HTML5 | Struktur halaman |
| CSS3 | Styling dengan CSS custom properties & gradients |
| Vanilla JS (ES6+) | Logika aplikasi, DOM manipulation, localStorage |
| [Chart.js 4.4](https://www.chartjs.org/) | Pie chart pengeluaran per kategori |
