(() => {
  if (window.__insideCodeMyBestSyncInstalled) return;
  window.__insideCodeMyBestSyncInstalled = true;

  const clean = (value, max = 500) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

  function detectCategory() {
    const haystack = `${location.pathname} ${document.title} ${document.body?.innerText || ''}`.toLowerCase();
    if (/jadwal|schedule|kuliah/.test(haystack)) return 'schedule';
    if (/tugas|assignment/.test(haystack)) return 'assignment';
    if (/materi|modul|rps|silabus|slide|referensi/.test(haystack)) return 'material';
    if (/pengumuman|announcement/.test(haystack)) return 'announcement';
    return 'other';
  }

  function tableItems(category) {
    const tables = Array.from(document.querySelectorAll('table'));
    const rows = [];
    for (const table of tables.slice(0, 10)) {
      const headerCells = Array.from(table.querySelectorAll('thead th'));
      const headers = headerCells.length
        ? headerCells.map((cell) => clean(cell.textContent, 100))
        : Array.from(table.rows[0]?.cells || []).map((cell) => clean(cell.textContent, 100));

      const bodyRows = Array.from(table.querySelectorAll('tbody tr')).length
        ? Array.from(table.querySelectorAll('tbody tr'))
        : Array.from(table.rows).slice(headers.length ? 1 : 0);

      for (const tr of bodyRows.slice(0, 50)) {
        const cells = Array.from(tr.cells).map((cell) => clean(cell.textContent, 400));
        if (!cells.some(Boolean)) continue;
        const data = {};
        cells.forEach((value, index) => { if (value) data[headers[index] || `kolom_${index + 1}`] = value; });
        const link = tr.querySelector('a[href]');
        const title = clean(link?.textContent || cells[0] || document.title, 500);
        rows.push({
          kind: category,
          sourceKey: `${location.pathname}:table:${rows.length}`,
          title,
          sourceUrl: link ? new URL(link.getAttribute('href'), location.href).toString() : location.href,
          data,
        });
      }
    }
    return rows;
  }

  function linkItems(category) {
    if (category === 'other') return [];
    return Array.from(document.querySelectorAll('a[href]'))
      .filter((a) => {
        const href = a.href;
        const text = clean(a.textContent, 160);
        return href.startsWith('https://elearning.bsi.ac.id/') && text;
      })
      .slice(0, 80)
      .map((a, index) => ({
        kind: category,
        sourceKey: `${location.pathname}:link:${index}:${a.href}`,
        title: clean(a.textContent, 500),
        sourceUrl: a.href,
        data: { text: clean(a.textContent, 500), href: a.href },
      }));
  }

  function capture() {
    const category = detectCategory();
    let items = tableItems(category);
    if (!items.length) items = linkItems(category);
    const text = clean(document.body?.innerText || '', 20000);
    if (!items.length) {
      items = [{
        kind: category,
        sourceKey: `${location.pathname}:page`,
        title: clean(document.title || 'MyBest', 500),
        sourceUrl: location.href,
        data: { text },
      }];
    }
    return {
      sourceUrl: location.href,
      pageTitle: clean(document.title, 300),
      category,
      items: items.slice(0, 100),
      payload: {
        pathname: location.pathname,
        title: clean(document.title, 300),
        capturedText: text,
      },
    };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'INSIDE_CODE_CAPTURE_MYBEST') return;
    sendResponse(capture());
  });
})();
