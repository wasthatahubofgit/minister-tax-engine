/* "Install app": registers the offline helper and offers a one-click install where the browser supports it. */
(function(){
'use strict';
const A = window.App, $ = A.$;
if (window.MTW_OFFLINE) return;
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
const box = $('installBox'); if (!box) return;
const btn = $('btnInstall'), note = $('installNote');
if (standalone) { box.hidden = false; btn.hidden = true; note.textContent = "You're using the installed app. Your numbers are saved on this device."; return; }
const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let evt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); evt = e; btn.hidden = false; note.textContent = 'Opens in its own window with its own icon, and also works with no internet after the first visit.'; });
window.addEventListener('appinstalled', () => { btn.hidden = true; note.textContent = 'Installed. Look for "Minister Planner" in your apps.'; });
btn.addEventListener('click', async () => { if (!evt) return; evt.prompt(); await evt.userChoice.catch(() => {}); evt = null; btn.hidden = true; });
note.textContent = ios ? 'On iPhone or iPad: tap the Share button in Safari, then "Add to Home Screen".'
  : 'In Chrome or Edge, use the install icon in the address bar, or the browser menu and "Install". Safari on Mac: File, then "Add to Dock".';
})();
