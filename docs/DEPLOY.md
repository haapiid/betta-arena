# Deploy & launching Betta Arena ($BETTA) — edisi memecoin

Ada dua bagian yang berjalan di satu server (VPS kecil sudah cukup, seperti palm):

1. **Engine** (`engine/`): mengikuti $BETTA, mengubah setiap buy jadi pertarungan, dan membunyikan bel
   (buyback & burn) saat tangki fee Pons penuh. API berjalan di `127.0.0.1:5050`.
2. **Situs** (root): file statis di `dist/`. nginx menyajikannya dan meneruskan `/api` ke engine.

Versi sebelumnya (NFT, toko, turnamen) disimpan di branch `game-onchain` dan tidak dipakai.

---

## 0. Sebelum launching

- **Wallet kreator:** luncurkan $BETTA di Pons **dari wallet yang private key-nya dipakai engine** (`ENGINE_KEY`).
  Pons membayar fee kreator ke wallet yang meluncurkan token, dan engine mengklaimnya dengan key itu.
  Pakai wallet baru yang hanya berisi sedikit ETH untuk gas (±0,005 ETH).
- **RPC khusus** untuk Robinhood Chain (Quicknode, Alchemy, dll.). RPC publik dibatasi.
- **Domain** untuk situs dan akun X (link-nya diisi di `VITE_LINK_X`).

## 1. Server (VPS Ubuntu) — satu perintah

Arahkan domain ke IP VPS, lalu:

```bash
git clone https://github.com/haapiid/betta-arena.git && cd betta-arena
sudo sh scripts/install-server.sh domainmu.com emailmu@contoh.com
```

Skrip ini memasang Node 22, nginx, pm2 dan HTTPS (certbot), membangun situs, menjalankan engine dengan pm2,
dan menulis konfigurasi nginx (situs, `/api`, live stream, link `/fight/…`, header keamanan).
Setelah itu tinggal mengisi `engine/.env` dan `.env` (langkah 2), lalu
`npm run build && pm2 restart betta-engine --update-env`.

Di `.env` situs, isi juga `SITE_URL=https://domainmu.com` (supaya gambar pratinjau link di X muncul) dan
`VITE_LINK_BUY`, `VITE_LINK_X`, `VITE_TOKEN_ADDRESS`.

## 2. Engine

Isi `engine/.env`:

| Setting | Isi |
|---|---|
| `RPC_URL` | RPC khusus Robinhood Chain milikmu |
| `TOKEN_ADDRESS` | kosongkan sampai launching (situs menampilkan pratinjau demo), lalu isi alamat $BETTA dari Pons |
| `ENGINE_KEY` | private key wallet yang meluncurkan $BETTA |
| `BUYBACK_STEP_ETH` | bel berbunyi saat tangki fee berisi sebanyak ini (default 0,02 ETH) |
| `FIGHT_MIN_TOKENS` | buy terkecil yang dihitung sebagai pertarungan (default 10.000 token), supaya buy debu tidak bisa memborong pertarungan |
| `ALLOWED_ORIGINS` | `https://domainmu` |
| `SITE_URL` | `https://domainmu` (untuk halaman `/fight/123` dan kartu pratinjau) |

```bash
cd engine
npm test                       # aturan: buy, sell, ikan, pertarungan, shelf (8 tes)
pm2 start "npm start" --name betta-engine
pm2 save && pm2 startup
curl -s localhost:5050/api/status | head -c 300
```

Kalau `.env` diubah: `pm2 restart betta-engine --update-env`. Data engine ada di `engine/data/state.json`
(cadangkan sesekali). `TOKEN_ADDRESS` baru memulai data dari nol, dan data lama otomatis dicadangkan.

## 2b. Dry-run di chain asli (WAJIB sebelum launching)

Engine belum pernah menyentuh Robinhood Chain sungguhan (RPC-nya tidak bisa dijangkau dari laptop dev).
Jalankan di server, terhadap **token Pons lain yang sudah trading**:

```bash
cd engine
npx tsx --env-file-if-exists=.env scripts/dryrun.ts 0xTOKEN_PONS_LAIN 20000
```

Hasilnya: berapa transfer yang akan jadi pertarungan, berapa yang dihitung jual, dan kenapa sisanya bukan
keduanya, plus contoh transaksi. Buka beberapa contoh di explorer dan pastikan BUY benar-benar beli dan SELL
benar-benar jual. Ulangi setelah buy pertama $BETTA (tambahkan alamat wallet kreator di akhir perintah untuk
melihat isi fee escrow).

## 3. nginx (situs + API dalam satu domain)

`scripts/install-server.sh` sudah menulis konfigurasi ini. Untuk referensi:

```nginx
server {
  server_name domainmu;
  root /home/USER/betta-arena/dist;
  index index.html;

  location /api/stream {            # update live: tanpa buffering
    proxy_pass http://127.0.0.1:5050;
    proxy_http_version 1.1;
    proxy_set_header Connection '';
    proxy_buffering off;
    proxy_read_timeout 1h;
  }
  location /api/ { proxy_pass http://127.0.0.1:5050; proxy_set_header X-Forwarded-For $remote_addr; }
  location /fight/ { proxy_pass http://127.0.0.1:5050; }   # link share: pratinjau = kartu fight
  location /community { try_files /index.html =404; }
  location / { try_files $uri /index.html; }
}
```

Lalu HTTPS: `sudo apt install certbot python3-certbot-nginx && sudo certbot --nginx -d domainmu`.
Salin header keamanan dari `public/_headers` ke blok server (`add_header ...`). Alternatifnya, host situs di
Vercel/Netlify/Cloudflare Pages (header ikut otomatis) dengan `VITE_API_URL=https://api.domainmu`.

## Mode demo / live

Sebelum launching situs bisa tetap online dengan pertarungan demo berlabel:
`sh scripts/site-mode.sh demo` (tanpa build ulang). Saat launching: `sh scripts/site-mode.sh live`.
Kapan pun, `?demo` di alamat menampilkan demo dan `?live` memaksa data live.

## 4. Hari launching

1. Luncurkan $BETTA di Pons dari wallet engine.
2. Isi alamat token di `engine/.env` (`TOKEN_ADDRESS`) dan di `.env` (`VITE_TOKEN_ADDRESS`, `VITE_LINK_BUY`),
   lalu `pm2 restart betta-engine --update-env` dan `npm run build`.
3. Log harus menampilkan `Pons curve: 0x…`. Setelah buy pertama, `/api/status` menampilkan pertarungan dan shelf.
4. Pantau bel pertama: `pm2 logs betta-engine` → `Bell #1 … sent to the deep (0x…)`. Buka transaksinya di
   explorer dan pastikan tokennya masuk ke `0x…dEaD`.
5. Jalankan `sh scripts/postlaunch-check.sh https://domainmu.com`: engine, curve, harga USD, kartu pratinjau,
   `/api` lewat nginx, og:image. Lalu tes share: buka satu fight, tekan Share → Post on X, cek pratinjaunya.

## 5. Yang perlu diketahui

- **Sebelum graduation**, bel membeli di curve Pons dengan alamat dead sebagai penerima: dibeli dan dibakar
  dalam satu transaksi, dengan batas slippage 3%.
- **Setelah graduation**, bel membeli lewat router Uniswap v4 (template dari engine palm), lalu mengirim
  tepat jumlah yang dibeli ke alamat dead. ⚠ Jalur ini **tidak punya batas minimum-out** dan belum pernah
  berjalan di pool $BETTA sungguhan. Saat $BETTA graduate, pantau bel pertama dengan ketat, atau kecilkan
  `BUYBACK_STEP_ETH` supaya tiap bel kecil sampai jalurnya terbukti aman.
- Engine menyimpan setiap hash transaksi sebelum menunggunya. Jadi kalau di-restart, engine melanjutkan
  ronde tanpa mengklaim, membeli, atau membakar dua kali.
- Sudah diuji di chain lokal dengan tiruan Pons (`contracts/`, lihat `scripts/local.ts`): buy menjadi
  pertarungan, penjual "jumped the jar", dan bel mengklaim 0,086 ETH lalu membakar hasil belinya dalam satu
  transaksi. **Kontrak Pons sungguhan dan Robinhood Chain belum dipakai.** Lakukan uji coba dulu dengan
  token kecil.
- Tanpa janji: halaman menyatakan $BETTA tidak menjanjikan nilai atau imbal hasil. Pastikan postingan juga begitu.
- Cek aturan hukum di negaramu dan negara pembelimu.

## 6. GitHub

Setelah semua di atas berjalan di chain sungguhan:

```bash
git remote add origin https://github.com/haapiid/betta-arena.git
git push -u origin main game-onchain
```

`.env`, `engine/.env`, dan `engine/data` diabaikan git dan tidak pernah ikut ter-push.
