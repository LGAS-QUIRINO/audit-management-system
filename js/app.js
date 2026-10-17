// Start-up: shows the login screen, or the dashboard when a saved sign-in is still good.
import { DEMO } from './config.js';
import { auth } from './auth.js';
import { $ } from './ui.js';
import { loginHtml } from './views/login.js';
import { dashboardHtml } from './views/dashboard.js';
import { MODULES } from './modules.js';

const app = document.getElementById('app');
const SHOWN_KEY = 'ams-urgent-shown';   // the Urgent Reports pop-out appears once each time the app is opened

async function showLogin(error = '') {
  app.innerHTML = loginHtml(error);
  if (DEMO) {
    $('#demo-signin').addEventListener('click', async () => {
      await auth.demoSignIn();
      try { sessionStorage.removeItem(SHOWN_KEY); } catch (e) { /* ignore */ }
      showDashboard();
    });
    return;
  }
  try { await auth.renderButton($('#gsi-btn')); }
  catch (e) { app.innerHTML = loginHtml(e.message); }
}

let toastTimer = null;
function toast(msg) {
  const t = $('#toast'); if (!t) return;
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 3000);
}

function showDashboard() {
  const s = auth.session;
  // Roles and teams come with the user setup (next Core step). Until then: Demo Admin, or just "Signed in".
  const roleLine = DEMO ? 'Admin · Demo Mode' : 'Signed in';
  app.innerHTML = dashboardHtml(s, roleLine);

  const pop = $('#urgent');
  const hide = () => { pop.hidden = true; };
  $('#bell').addEventListener('click', () => { pop.hidden = !pop.hidden; });
  $('#u-close').addEventListener('click', hide);
  $('#u-ok').addEventListener('click', hide);
  $('#u-all').addEventListener('click', (e) => { e.preventDefault(); toast('The full Urgent Items list comes with the first module.'); });

  let shown = false;
  try { shown = sessionStorage.getItem(SHOWN_KEY) === '1'; sessionStorage.setItem(SHOWN_KEY, '1'); } catch (e) { /* ignore */ }
  if (!shown) pop.hidden = false;

  app.querySelectorAll('.card').forEach((card) => card.addEventListener('click', (e) => {
    const m = MODULES.find((x) => x.id === card.dataset.mod);
    if (!m.ready) { e.preventDefault(); toast(`${m.title} is not built yet. It will open here once the module is ready.`); }
  }));

  $('#signout').addEventListener('click', async () => {
    await auth.signOut();
    try { sessionStorage.removeItem(SHOWN_KEY); } catch (e) { /* ignore */ }
    showLogin();
  });
}

window.addEventListener('signed-in', () => {
  try { sessionStorage.removeItem(SHOWN_KEY); } catch (e) { /* ignore */ }
  showDashboard();
});

async function start() {
  const s = await auth.restore();
  const check = auth.openCheck();
  if (!s) return showLogin();
  if (check === 'old') { await auth.signOut(); return showLogin('Please sign in again. It has been more than 7 days since your last sign-in.'); }
  if (check === 'again') return showLogin('Your sign-in has expired. Please sign in again.');
  showDashboard();
}

start();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
