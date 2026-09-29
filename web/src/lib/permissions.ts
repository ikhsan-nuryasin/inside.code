import type { ClassPosition } from '../types/models';

export type ClassCapability =
  | 'manage_class'
  | 'manage_tasks'
  | 'manage_secretary'
  | 'manage_cash'
  | 'manage_groups'
  | 'manage_documentation'
  | 'manage_poll'
  | 'manage_forum';

export const POSITION_LABEL: Record<ClassPosition, string> = {
  ketua: 'Ketua Kelas',
  wakil_ketua: 'Wakil Ketua',
  sekretaris: 'Sekretaris',
  bendahara: 'Bendahara',
};

export const POSITION_DESCRIPTION: Record<ClassPosition, string> = {
  ketua: 'Memimpin dan mengawasi seluruh operasional kelas.',
  wakil_ketua: 'Mendampingi ketua dan mengambil alih tugas kepemimpinan saat diperlukan.',
  sekretaris: 'Mengelola pengumuman, jadwal, materi, notulensi, dan dokumentasi administrasi.',
  bendahara: 'Mengelola kas, iuran, transaksi, bukti pembayaran, dan laporan keuangan kelas.',
};

export function hasCapability(position: ClassPosition | null, capability: ClassCapability): boolean {
  const leadership = position === 'ketua' || position === 'wakil_ketua';
  if (capability === 'manage_class' || capability === 'manage_tasks' || capability === 'manage_groups') return leadership;
  if (capability === 'manage_secretary' || capability === 'manage_documentation' || capability === 'manage_poll' || capability === 'manage_forum') {
    return leadership || position === 'sekretaris';
  }
  if (capability === 'manage_cash') return leadership || position === 'bendahara';
  return false;
}

export function isLeadership(position: ClassPosition | null) { return position === 'ketua' || position === 'wakil_ketua'; }
