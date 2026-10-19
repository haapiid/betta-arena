# Panduan deploy & launching Betta Arena (Robinhood Chain)

Ada tiga bagian yang dideploy, urut seperti ini:

1. **Kontrak** (`contracts/`): BettaFish (NFT ikan), BettaShop (toko), BettaArena (turnamen).
2. **Game server** (`server/`): menyimpan perawatan ikan, menandatangani izin, dan menjalankan ronde.
3. **Web** (root): situs yang dibuka pemain.

Lakukan semuanya **di testnet dulu** (chain 46630), coba bersama beberapa teman, baru ulangi di mainnet (4663).

---

## 0. Siapkan wallet (sekali saja)

| Wallet | Untuk apa | Catatan |
|---|---|---|
| **Deployer** | Men-deploy kontrak | Isi sedikit ETH di Robinhood Chain untuk gas |
| **Owner** | Admin semua kontrak (harga, pause, kunci) | **Pakai multisig** (misalnya Safe) atau hardware wallet, jangan hot wallet |
| **Treasury** | Menerima bagian non-burn dari penjualan toko | Sebaiknya multisig |
| **Signer** | Key milik server untuk menandatangani izin & snapshot stat | Buat key baru khusus ini; **tidak pernah memegang dana** |
| **Operator** | Server memakainya untuk commit/reveal/settle ronde | Key baru; isi ±0,01 ETH untuk gas, tidak memegang $BETTA |

Simpan private key Signer dan Operator di password manager. Siapa pun yang memegang key Signer bisa memalsukan stat ikan, jadi jaga baik-baik.

## 1. Token $BETTA

- Deploy token ERC-20 kamu di Robinhood Chain.
- **Jangan pakai pajak/fee transfer.** Kontrak game sengaja menolak token yang memotong saat transfer, supaya escrow tidak pernah kurang.
- Catat alamat token dan jumlah decimals-nya (umumnya 18).

## 2. Deploy kontrak

```bash
cd contracts
npm install
npx hardhat test                      # semua tes harus lulus
npx hardhat keystore set DEPLOYER_KEY  # atau set variabel lingkungan DEPLOYER_KEY
npx hardhat keystore set RH_MAINNET_RPC
```

Testnet (token tes dibuat otomatis kalau `TOKEN_ADDRESS` dikosongkan):

```bash
SIGNER_ADDRESS=0x... OPERATOR_ADDRESS=0x... \
SEASON_START=2026-11-01T13:00:00Z TOURNAMENT_DAYS=3 \
METADATA_URL=https://api.domainmu.com/api/fish/ \
npx hardhat run scripts/deploy.ts --network robinhoodTestnet
```

Mainnet:

```bash
TOKEN_ADDRESS=0x...token... OWNER=0x...multisig... TREASURY=0x...multisig... \
SIGNER_ADDRESS=0x... OPERATOR_ADDRESS=0x... BURN_BPS=5000 \
SEASON_START=2026-11-01T13:00:00Z TOURNAMENT_DAYS=3 \
METADATA_URL=https://api.domainmu.com/api/fish/ \
npx hardhat run scripts/deploy.ts --network robinhood
```

- Script ini mencetak baris env untuk server dan web, lalu menyimpan `deployments/<chainId>.json`.
- Kalau `OWNER` bukan deployer: dari wallet owner, panggil `acceptOwnership()` di BettaFish dan BettaShop. BettaArena langsung dimiliki owner.
- `SEASON_START` adalah waktu ronde 1 dibuka, dalam UTC (13:00 UTC = 20:00 WIB). **Server harus sudah jalan sebelum waktu ini**, karena operator harus meng-commit ronde 1 sebelum dibuka.

## 3. Jalankan game server

Pilihan termudah: **Railway** atau **Render**, ditambah **Neon** atau **Supabase** untuk database Postgres.

1. Buat database Postgres, lalu salin connection string-nya ke `DATABASE_URL`.
2. Buat service dari repo ini dengan Dockerfile `server.Dockerfile` (build dari root repo).
3. Isi environment variables sesuai `server/.env.example`: alamat kontrak dan `START_BLOCK` dari langkah 2, `SIGNER_KEY`, `OPERATOR_KEY`, `OPERATOR_SECRET` (acak, panjang), `SESSION_SECRET` (acak, panjang), `ALLOWED_ORIGINS` = alamat situs, dan `PUBLIC_URL` = alamat server.
4. Jalankan **satu instance saja**. Pasang domain, misalnya `api.domainmu.com`.
5. Cek `https://api.domainmu.com/api/health` → `{"ok":true}`. Di log harus muncul `[operator] commit #1: success`.

Buat string acak dengan: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

## 4. Deploy web

Vercel/Netlify/Cloudflare Pages, build command `npm run build`, output `dist`. Isi environment variables sesuai `.env.example`:

- `VITE_CHAIN_ID`, `VITE_RPC_URL`, `VITE_EXPLORER_URL`
- `VITE_API_URL` = alamat server
- empat alamat kontrak, `VITE_SEASON_START`, `VITE_TOURNAMENT_DAYS` (dari output deploy)
- link komunitas

Header keamanan (`vercel.json`, `public/_headers`) ikut terpasang otomatis. Selama alamat kontrak belum diisi, situs menampilkan "Launching soon" dan tidak ada yang bisa dibeli.

## 5. Cek setelah live

- [ ] Connect wallet → wallet pindah ke Robinhood Chain → tanda tangan sign-in (tanpa gas).
- [ ] Saldo $BETTA di header benar.
- [ ] Beli 1 ikan → muncul di jar dalam beberapa detik, dengan starter pack 10 pelet + 2 ganti air.
- [ ] Feed, Water, Train berjalan dan ada animasinya.
- [ ] Daftarkan ikan ke arena → muncul di bracket. Withdraw sebelum dikunci → $BETTA kembali.
- [ ] Setelah lonceng ronde: hadiah masuk wallet pemenang, hasil muncul di Arena & Leaderboard.
- [ ] Alamat kontrak di `/community` benar.

## 6. Push ke GitHub

Setelah semua cek lulus:

```bash
git remote add origin https://github.com/haapiid/betta-arena.git
git push -u origin main
```

File `.env`, `server/.env`, `.env.local`, dan database lokal tidak ikut ter-push (sudah di `.gitignore`).

## Keamanan: wajib dibaca sebelum mainnet

- **Audit kontrak.** BettaArena memegang biaya masuk pemain. Tesnya lengkap (12 tes, termasuk pencocokan pertarungan Solidity vs TypeScript), tapi tetap minta auditor independen memeriksa `contracts/contracts/*.sol` sebelum uang sungguhan masuk.
- **Yang tidak bisa dilakukan owner:** mengambil dana escrow arena. Fungsi seperti itu memang tidak ada. Owner hanya bisa mengubah harga/biaya, mengganti key signer/operator, dan pause.
- **Yang dipercayakan ke server:**
  - Stat ikan (perawatan) dan izin beli ikan. Kalau key Signer bocor, ganti lewat `setConfig` di Shop dan Arena.
  - Operator meng-commit rahasia ronde **sebelum** pendaftaran dibuka, jadi dia tidak bisa memilih hasil. Paling buruk, kalau operator tidak me-reveal, siapa pun bisa memicu refund penuh 1 hari setelah lonceng.
- **Darurat:** owner bisa `pause()` Shop dan Arena. Pause di Arena hanya menghentikan pendaftaran baru; withdraw, settle, dan refund tetap jalan.
- **Hukum:** turnamen berbayar dengan hadiah token bisa dianggap judi di Indonesia dan negara lain. Konsultasikan ke ahli hukum sebelum launching, dan pertimbangkan memblokir wilayah tertentu.
