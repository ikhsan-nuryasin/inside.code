# Setup Student Hub v1.0.6 — Windows RAM 4 GB

## Perangkat development

Untuk Acer Aspire A314-32 Celeron N4000 + RAM 4 GB:

- VS Code
- Node.js 20.19+
- Chrome

Tidak perlu Android Studio, emulator, Flutter, XAMPP, Laragon, Docker, WSL, atau database lokal.

## 1. Project

Ekstrak project dan buka `web` di VS Code.

## 2. Dependency

```powershell
cd C:\xampp\htdocs\student_hub_pwa_v1_0_6\web
npm install
```

## 3. Environment

```powershell
copy .env.example .env.local
```

Demo:

```env
VITE_DEMO_MODE=true
```

Supabase:

```env
VITE_DEMO_MODE=false
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Jangan taruh secret/service-role key di client.

## 4. Supabase

Jalankan migration berikut secara berurutan di SQL Editor:

001 → 002 → 003 → 004 → 005 → 006 → 007 → 008 → 009 → 010 → 011 → 012

Migration 010 historically introduced class positions/group leader plus a legacy attendance module; migration 013 removes the legacy attendance module. Migration 011 locks workflow by position and disables self-service class creation/joining. The final product has no attendance feature. Historical attendance migration files exist only for cleanup of older databases and must not be treated as active product requirements.

## 5. Provisioning

Karena aplikasi tidak menyediakan membuat/bergabung kelas, akun dan kelas harus diprovision oleh operator/database administrator. Lihat `docs/14_DATA_PROVISIONING.md`.

## 6. Jalankan

```powershell
npm run typecheck
npm run build
npm run dev
```

Buka `http://localhost:5173`.

## 7. Test minimum

1. Login/register.
2. Pastikan akun sudah ditempatkan ke kelas melalui provisioning.
3. Pastikan role/jabatan tampil.
4. Coba jadwal template.
5. Coba tugas sesuai role.
7. Coba kas sebagai bendahara/ketua/wakil.
8. Coba dokumentasi sebagai sekretaris/ketua/wakil.
9. Coba roda ketua kelompok.
10. Matikan internet dan uji cache/queue.
11. Nyalakan internet dan cek sync.
