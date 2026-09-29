# Student Hub v1.1.0 — Release Test Matrix

## Authorization
| Scenario | Expected |
|---|---|
| Anggota mengubah tugas kelas | Denied by RLS |
| Leadership mengelola tugas | Allowed |
| Anggota memilih leader grup sendiri | Denied |
| Leadership/current leader memilih leader | Allowed only for current group member |
| Anggota menulis administrasi sekretaris | Denied |
| Bendahara memverifikasi pembayaran | Allowed |

## Integrity
| Scenario | Expected |
|---|---|
| Dua mahasiswa memakai jabatan yang sama | Database rejects second assignment |
| Menghapus satu-satunya leadership | Database rejects action |
| Menjadikan non-member sebagai leader grup | Database rejects action |
| Pembayaran ditolak lalu diajukan ulang | Existing rejected row reused; no permanent duplicate lock |
| Koreksi kas | Original row voided + replacement row recorded with reason |

## Offline
| Scenario | Expected |
|---|---|
| Membuka kelas dengan cache | Cached view remains readable |
| Mutation gagal karena network | Entry persists in IndexedDB outbox |
| Reconnect | Retry with backoff |
| Duplicate/conflict | Item remains visible for manual attention |
| Server events advanced | Sync cursor advances monotonically |

## Storage/PWA
| Scenario | Expected |
|---|---|
| Cash proof bucket | Private; class-member scoped |
| Cached file | Can be opened offline |
| New Storage upload while offline | Explicitly remains online-required |
| Service worker update | Cache namespace `student-hub-v1.1.0` |
