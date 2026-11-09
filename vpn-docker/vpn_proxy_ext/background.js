// Setelan proxy dari extension hanya berlaku untuk profil Chrome tempat extension ini dipasang.
const DEFAULTS = { on: true, port: 1080, domains: '', all: false };

function buildPac(cfg) {
  const proxy = 'SOCKS5 127.0.0.1:' + (parseInt(cfg.port, 10) || 1080);
  // "; DIRECT" = kalau container VPN mati, Chrome mencoba langsung (tidak macet).
  const target = proxy + '; DIRECT';
  if (cfg.all) return 'function FindProxyForURL(url, host) { return ' + JSON.stringify(target) + '; }';
  const doms = String(cfg.domains || '').split(/[\s,]+/).map(d => d.trim().replace(/^\.+/, '').toLowerCase()).filter(Boolean);
  return 'function FindProxyForURL(url, host) {\n' +
    '  var P = ' + JSON.stringify(target) + ';\n' +
    '  var d = ' + JSON.stringify(doms) + ';\n' +
    '  if (isPlainHostName(host)) return P;\n' +
    "  if (shExpMatch(host, '10.*') || shExpMatch(host, '192.168.*') || /^172\\.(1[6-9]|2[0-9]|3[01])\\./.test(host)) return P;\n" +
    "  for (var i = 0; i < d.length; i++) { if (host === d[i] || dnsDomainIs(host, '.' + d[i])) return P; }\n" +
    "  return 'DIRECT';\n}";
}

async function apply() {
  const cfg = Object.assign({}, DEFAULTS, await chrome.storage.local.get(DEFAULTS));
  if (cfg.on) {
    await chrome.proxy.settings.set({ value: { mode: 'pac_script', pacScript: { data: buildPac(cfg) } }, scope: 'regular' });
    await chrome.action.setBadgeText({ text: 'VPN' });
    await chrome.action.setBadgeBackgroundColor({ color: '#16a34a' });
  } else {
    await chrome.proxy.settings.clear({ scope: 'regular' });
    await chrome.action.setBadgeText({ text: '' });
  }
}

chrome.runtime.onInstalled.addListener(apply);
chrome.runtime.onStartup.addListener(apply);
chrome.storage.onChanged.addListener(apply);
chrome.proxy.onProxyError.addListener(e => { console.warn('proxy error', e && e.error); });
