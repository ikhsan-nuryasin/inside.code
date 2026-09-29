# Student Hub v1.1.0 — Release Checklist

## Validasi yang berhasil di environment audit
- [x] ZIP dasar diinspeksi dan source tree dipertahankan.
- [x] 28 file TS/TSX lolos parse TypeScript AST.
- [x] `verify-product-rules.mjs` PASS.
- [x] `static-audit.mjs` PASS.
- [x] Tidak ada client flow membuat atau bergabung ke kelas.
- [x] Tidak ada modul absensi/presensi di `web/src`.
- [x] Service worker cache cocok dengan `1.1.0`.
- [x] Service worker icon path tervalidasi.
- [x] Group leader dibatasi oleh class leadership/current group leader dan wajib menjadi anggota grup.
- [x] Kas memiliki status verification, bukti, void, dan correction audit trail.
- [x] Sync event feed menggunakan cursor monotonik dan trigger-safe untuk tabel junction.
- [x] `cash-proofs` bucket private + policy class-scoped.

## Validasi lokal yang dilakukan tanpa registry
- [x] TypeScript semantic check menggunakan dependency stubs: 0 error source-level.
- [x] JavaScript syntax: service worker + validation scripts PASS.
- [x] `package.json` JSON syntax PASS.

## Validasi yang belum dapat dinyatakan PASS
- [ ] `npm install` / download dependency dari registry. Environment audit mengalami `EAI_AGAIN` ke registry, sehingga dependency asli tidak tersedia.
- [ ] `npm run typecheck` dengan paket React/Supabase asli.
- [ ] `npm run build` Vite production dengan dependency asli.
- [ ] RLS/storage integration test pada project Supabase nyata.
- [ ] Browser offline/PWA install/update test pada perangkat nyata.

## Cara final verification di mesin developer
```powershell
cd web
npm install
npm run verify:product
npm run audit:static
npm run typecheck
npm run build
```

Jangan gunakan `--force` atau `--legacy-peer-deps` untuk menutupi masalah dependency.
