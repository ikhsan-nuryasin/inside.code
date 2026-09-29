# Provisioning Kelas dan Mahasiswa

Mulai v1.0.6, aplikasi tidak memiliki create class dan join class. Ini sengaja dilakukan agar kelas tidak dapat dibuat/diikuti sembarang pengguna.

## Flow operator

1. Buat akun pengguna melalui Supabase Auth.
2. Pastikan trigger profile membuat `profiles`.
3. Buat row `classes` melalui SQL/operator terkontrol.
4. Masukkan pengguna ke `class_members` dengan status `active`.
5. Tetapkan posisi menggunakan `public.assign_class_position(...)`.
6. Terapkan jadwal menggunakan `public.apply_schedule_template(class_id)` bila jadwal bawaan diperlukan.

## Contoh operator SQL

```sql
-- Jalankan oleh operator/database admin, bukan dari browser mahasiswa.
-- Ganti UUID contoh dengan UUID nyata.

INSERT INTO public.classes(
  name, class_code, delivery_mode, study_program, semester, academic_year, description, created_by
) VALUES (
  '19.2B.14',
  'SI19B14',
  'offline',
  'Sistem Informasi',
  3,
  '2026/2027',
  'Kelas mahasiswa Sistem Informasi',
  '00000000-0000-0000-0000-000000000000'
);

-- Lalu masukkan user yang memang menjadi anggota kelas.
INSERT INTO public.class_members(class_id,user_id,role,status)
VALUES (
  'CLASS_UUID',
  'USER_UUID',
  'member',
  'active'
);

-- Tetapkan ketua/wakil/sekretaris/bendahara.
SELECT public.assign_class_position(
  'CLASS_UUID',
  'USER_UUID',
  'ketua'
);
```

## Catatan

Jangan memberikan hak SQL operator kepada mahasiswa. Provisioning adalah fungsi administrasi awal. Setelah class officer terbentuk, pengelolaan sehari-hari dilakukan melalui fitur jabatan di aplikasi.
