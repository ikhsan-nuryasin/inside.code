# Inside Code v1.8.3

- Fixed `.env` handling in production guard.
- Fixed Turnstile SPA lifecycle and duplicate script loading.
- Added visible CAPTCHA states, error detail and retry.
- Separated CAPTCHA/rate/server failures from invalid credentials.
- Unified Service Worker update event name.
- Unified notification deep-link parsing.
- Fixed push `fail_count`.
- Added branding storage grants and path hardening.
- Improved logo cleanup and demo persistence.
- Added optional assignment reminder cron setup.
- Centralized important primary-color selectors.
- Updated push test branding to Inside Code.

- Note: package-lock.json is intentionally not fabricated; generate it locally with `npm install` and commit it for deterministic CI.

- Perbaikan tombol "Periksa pembaruan" agar menjalankan `registration.update()` dan hanya menampilkan bar update ketika ada Service Worker baru.
