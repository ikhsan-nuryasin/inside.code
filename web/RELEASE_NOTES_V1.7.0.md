# Student Hub v1.7.0

- Randomizer now uses the active remaining pool for wheel alignment.
- Presentation order is sequential and can create one calendar event per group with duration/gap.
- Group leader supports wheel and manual selection.
- Randomizer result history and calendar integration preserved.
- Cash is now presented by monthly accounting period with opening balance, monthly income/expense, closing balance, monthly transactions and monthly dues.
- Added `025_cash_monthly_summary.sql`.

## Kas bulanan
- Kas dipilih per bulan, dengan saldo awal, pemasukan, pengeluaran, saldo akhir, mutasi, dan iuran periode.
- Pembayaran iuran yang diverifikasi `paid` otomatis dibuat sebagai pemasukan `Iuran Kelas` dan ditautkan ke pembayaran untuk mencegah double counting.
