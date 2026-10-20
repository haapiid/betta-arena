> **Arsip.** Rencana ini untuk versi game on-chain (NFT, toko, turnamen) yang sekarang ada di branch `game-onchain`. Versi yang dipakai sekarang adalah memecoin: lihat `CONCEPT.md` dan `docs/DEPLOY.md`.

# Rencana Betta Arena on-chain (Robinhood Chain)

Keputusan (20 Okt 2026): jalur B, **hybrid** di **Robinhood Chain** (Arbitrum Orbit, gas ETH, chain ID 4663; testnet 46630).
Status (20 Okt 2026): kontrak, server, dan web sudah dibangun dan lulus uji end-to-end di chain lokal. Langkah deploy ada di docs/DEPLOY.md. Belum di-push ke GitHub.

## Pembagian: apa yang on-chain, apa yang di server

| Bagian | Di mana | Alasan |
|---|---|---|
| Token $BETTA (ERC-20) | On-chain | Uang pemain |
| Kepemilikan ikan | On-chain, NFT ERC-721, **transfer dikunci dulu** (bisa dibuka nanti) | Ikan jelas milik wallet; jual-beli ditunda sampai sistem stabil |
| Beli ikan, beli item, biaya breeding | On-chain, dibayar $BETTA (sebagian burn, sebagian treasury) | Uang tidak pernah dipegang server |
| Pendaftaran turnamen + biaya masuk | On-chain, ditahan di kontrak Arena | Escrow transparan |
| Undian & pertarungan | On-chain: seed commit-reveal, bracket + fight dihitung di kontrak | Hasil bisa diverifikasi siapa pun |
| Hadiah 60/25/7,5/7,5 + burn 5% | On-chain, dibayar otomatis saat settle | Tidak perlu percaya server |
| Perawatan harian (makan, air, latihan, XP, sakit) | Server + database | Kalau on-chain, tiap klik = transaksi + gas |
| Stat ikan saat masuk turnamen | Server menandatangani snapshot (EIP-712), kontrak memverifikasi | Menghubungkan perawatan off-chain ke turnamen on-chain |
| Login | Sign-In With Ethereum (tanda tangan pesan, tanpa gas) | Aksi perawatan hanya bisa dilakukan pemilik wallet |

## Keacakan (tanpa VRF)
Chainlink VRF belum ada di Robinhood Chain, dan `prevrandao` di chain Arbitrum selalu 1. Skemanya:
1. Saat ronde dibuka, operator meng-commit `hash(secret)` ke kontrak (sebelum ada pendaftar).
2. Setelah pendaftaran dikunci, operator me-reveal `secret`. Seed = `keccak(secret, daftar peserta)`.
3. Kalau tidak di-reveal sebelum batas waktu, siapa pun bisa memicu refund penuh, dan jaminan operator dipotong.
4. Begitu Chainlink VRF tersedia di Robinhood Chain, kontrak bisa diganti ke VRF.

## Komponen yang dibangun
1. `contracts/` (Hardhat, Solidity 0.8.x, OpenZeppelin): `BettaFish` (ERC-721), `BettaShop`, `BettaArena`. Tes unit + fuzz.
2. `server/` (Node + TypeScript + Postgres): indexer event, API perawatan, penanda tangan snapshot, job operator (commit/reveal/settle).
3. Frontend: viem; jaringan Robinhood Chain; transaksi beli/daftar/klaim; perawatan lewat API; hapus koin localStorage, faucet, dan NPC.

## Tahapan
1. Kontrak + tes lokal.
2. Server + frontend terhubung ke testnet 46630, uji coba tertutup.
3. Audit eksternal kontrak, cek hukum (turnamen berbayar dengan hadiah token).
4. Deploy mainnet, push ke GitHub, launching.

## Yang dibutuhkan dari pemilik proyek
- Alamat token $BETTA di Robinhood Chain (atau kapan di-deploy), decimals, dan apakah ada pajak/fee transfer.
- Pembagian uang pembelian: berapa % burn vs treasury, dan alamat treasury (sebaiknya multisig, mis. Safe).
- Tempat hosting server + database (mis. Railway/Render + Supabase/Neon).
- Wallet operator terpisah (hanya untuk commit/reveal/settle; bukan pemegang dana).
