const tokenEl = document.getElementById('token');
const urlEl = document.getElementById('supabaseUrl');
const statusEl = document.getElementById('status');

chrome.storage.local.get(['mybestToken'], (data) => {
  if (data.mybestToken) tokenEl.value = data.mybestToken;
});

document.getElementById('clear').addEventListener('click', () => {
  chrome.storage.local.remove('mybestToken', () => {
    tokenEl.value = '';
    statusEl.textContent = 'Kode tersimpan dihapus.';
  });
});

document.getElementById('sync').addEventListener('click', async () => {
  const token = tokenEl.value.trim();
  const supabaseUrl = urlEl.value.trim().replace(/\/$/, '');
  if (!/^[a-fA-F0-9]{64}$/.test(token)) {
    statusEl.textContent = 'Kode sinkron harus 64 karakter hex.';
    return;
  }
  statusEl.textContent = 'Membaca halaman MyBest…';

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab?.id || !tab.url?.startsWith('https://elearning.bsi.ac.id/')) {
      throw new Error('Buka halaman MyBest terlebih dahulu.');
    }

    const payload = await chrome.tabs.sendMessage(tab.id, { type: 'INSIDE_CODE_CAPTURE_MYBEST' });
    if (!payload?.sourceUrl) throw new Error('Data halaman tidak dapat dibaca.');

    statusEl.textContent = 'Mengirim data ke Inside Code…';
    const response = await fetch(`${supabaseUrl}/functions/v1/mybest-import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, ...payload }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || result.error || `HTTP ${response.status}`);

    chrome.storage.local.remove('mybestToken');
    tokenEl.value = '';
    statusEl.textContent = `Berhasil. ${result.importedItems ?? 0} item disimpan. Kode sudah dipakai dan tidak dapat digunakan lagi.`;
  } catch (error) {
    statusEl.textContent = error instanceof Error ? error.message : 'Sinkronisasi gagal.';
  }
});
