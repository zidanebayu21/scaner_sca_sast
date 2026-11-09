const DEFAULTS = { on: true, port: 1080, domains: '', all: false };
const $ = id => document.getElementById(id);

async function load() {
  const cfg = await chrome.storage.local.get(DEFAULTS);
  $('on').checked = !!cfg.on;
  $('port').value = cfg.port;
  $('all').checked = !!cfg.all;
  $('domains').value = cfg.domains;
  const cur = await chrome.proxy.settings.get({});
  $('st').textContent = cur.value && cur.value.mode === 'pac_script'
    ? 'Status: aktif (' + (cur.levelOfControl === 'controlled_by_this_extension' ? 'dikendalikan extension ini' : cur.levelOfControl) + ')'
    : 'Status: mati (koneksi langsung)';
}

$('save').addEventListener('click', async () => {
  await chrome.storage.local.set({
    on: $('on').checked,
    port: parseInt($('port').value, 10) || 1080,
    all: $('all').checked,
    domains: $('domains').value
  });
  setTimeout(load, 300);
});

load();
