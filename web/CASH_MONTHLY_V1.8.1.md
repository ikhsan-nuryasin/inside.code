# Kas Kelas Bulanan v1.8.1

## Prinsip
Kas tetap memakai satu ledger per kelas. Tampilan dan rekap dipisahkan berdasarkan bulan agar tidak terjadi duplikasi saldo antar-periode.

## Fitur
- Pemilih bulan.
- Saldo awal periode.
- Pemasukan periode.
- Pengeluaran periode.
- Saldo akhir periode.
- Mutasi hanya pada bulan terpilih.
- Iuran pada bulan terpilih.
- Ringkasan nilai tagihan/terbayar/menunggu/belum lunas.
- Pembayaran berstatus paid otomatis terhubung ke ledger melalui `cash_transaction_id`.
- Void dan correction tetap menjaga audit trail.

Tidak dibuat tabel saldo bulanan terpisah sehingga saldo historis tetap berasal dari ledger transaksi yang immutable/terlacak.
