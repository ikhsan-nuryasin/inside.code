# Schedule Update — v1.0.5

## User requirement
Classes must have only two modes:
- `offline` — physical/tatap muka
- `online` — remote/daring

No third mode is introduced.

## Supplied timetable
The uploaded image is preserved at `docs/assets/jadwal-matakuliah-sumber.png`. The eight rows below are transcribed from the image.

| No | Day | Time | Lecturer code 1 | Lecturer code 2 | Course code | Course | SKS | Practical group | Room |
|---:|---|---|---|---|---|---|---:|---|---|
| 1 | Senin | 17:30–19:30 | TRT | — | 240 | SISTEM INFORMASI MANAJEMEN | 3 | — | 301-E5 |
| 2 | Senin | 19:30–21:30 | ECR | — | 0405 | KEAMANAN BASIS DATA | 3 | — | 301-E5 |
| 3 | Selasa | 17:30–19:30 | WYR | — | 0367 | METODOLOGI PENELITIAN | 3 | — | 301-E5 |
| 4 | Selasa | 19:30–21:30 | FZR | — | 0407 | WEB PROGRAMMING II | 3 | WPP.19.3B.14A | 301-E5 |
| 5 | Rabu | 18:10–19:30 | RBP | — | 253 | BAHASA INDONESIA | 2 | — | E1.3-E5 |
| 6 | Rabu | 19:30–21:30 | CYG | — | 154 | CHARACTER BUILDING | 3 | — | E1.3-E5 |
| 7 | Kamis | 17:30–19:30 | IMK | — | 0406 | FUNDAMENTAL DATA ANALYST | 3 | — | 301-E5 |
| 8 | Kamis | 19:30–21:30 | ERH | — | 0624 | STATISTIKA DAN PROBABILITAS | 3 | — | 301-E5 |

## Product behavior
When creating a class, the member selects exactly one class mode. The mode is persisted in PostgreSQL and displayed on class cards, class headers, and the calendar.

In an offline class, schedule rows display the room. In an online class, schedule rows display the meeting URL when configured; otherwise the UI states that the online link has not been configured.

## Template action
A class admin can press **Muat jadwal dari gambar**. The server RPC upserts these eight rows using stable course codes, so pressing the button again does not duplicate them. Existing unrelated schedules are not deleted.

## Important implementation note
The timetable image does not provide two lecturer codes. The application therefore stores lecturer code 1 from the image and stores lecturer code 2 as `NULL`, which is rendered as `—`. Blank source fields remain `NULL`.
