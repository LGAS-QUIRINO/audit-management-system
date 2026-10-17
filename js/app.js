// Start-up: shows the login screen, or the signed-in screen when a saved sign-in is still good.
import { DEMO } from './config.js';
import { auth } from './auth.js';
import { $ } from './ui.js';
import { loginHtml } from './views/login.js';
import { homeHtml } from './views/home.js';

const app = document.getElementById('app');

async function showLogin(error = '') {
  app.innerHTML = loginHtml(error);
  if (DEMO) {
    $('#demo-signin').addEventListener('click', async () => { await auth.demoSignIn(); showHome(); });
    return;
  }
  try { await auth.renderButton($('#gsi-btn')); }
  catch (e) { app.innerHTML = loginHtml(e.message); }
}

function showHome() {
  app.innerHTML = homeHtml(auth.session);
  $('#signout').addEventListener('click', async () => { await auth.signOut(); showLogin(); });
}

window.addEventListener('signed-in', () => showHome());

async function start() {
  const s = await auth.restore();
  const check = auth.openCheck();
  if (!s) return showLogin();
  if (check === 'old') { await auth.signOut(); return showLogin('Please sign in again. It has been more than 7 days since your last sign-in.'); }
  if (check === 'again') return showLogin('Your sign-in has expired. Please sign in again.');
  showHome();
}

start();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
