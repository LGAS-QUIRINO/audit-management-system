// Start-up and screen router: login → dashboard → Admin screens.
import { DEMO } from './config.js';
import { auth } from './auth.js';
import { store, loadRefs, onChange } from './store.js';
import { $, toast, bottomBand } from './ui.js';
import { loginHtml } from './views/login.js';
import { dashboardHtml } from './views/dashboard.js';
import { MODULES } from './modules.js';
import { adminBar, notAdmin, roleLine, usersHtml, wireUsers, teamsHtml, wireTeams, lgusHtml, wireLgus } from './views/admin.js';

const app = document.getElementById('app');
let signedIn = false;
let popPending = false;   // the Urgent Reports pop-out appears once each time the app is opened or someone signs in

async function showLogin(error = '') {
  signedIn = false;
  app.innerHTML = loginHtml(error);
  if (DEMO) {
    $('#demo-signin').addEventListener('click', async () => { await auth.demoSignIn(); enter(); });
    return;
  }
  try { await auth.renderButton($('#gsi-btn')); }
  catch (e) { app.innerHTML = loginHtml(e.message); }
}

async function enter() {
  const refs = await loadRefs(auth.session.email);
  if (!DEMO && (!refs.me || refs.me.data.status === 'disabled')) {
    await auth.signOut();
    return showLogin('This Gmail is not registered in AMS. Ask the Admin to add it.');
  }
  signedIn = true;
  popPending = true;
  if (!location.hash || location.hash === '#') history.replaceState(null, '', '#/');
  render();
}

async function render() {
  if (!signedIn) return;
  const refs = await loadRefs(auth.session.email);
  const [path, qs] = (location.hash.replace(/^#/, '') || '/').split('?');
  const q = new URLSearchParams(qs || '');
  const part = path.split('/').filter(Boolean);

  if (part[0] === 'admin') {
    const key = part[1] || 'users';
    const body = !refs.isAdmin ? notAdmin()
      : key === 'teams' ? teamsHtml(refs)
      : key === 'lgus' ? lgusHtml(refs, q)
      : usersHtml(refs);
    const y = window.scrollY;
    app.innerHTML = adminBar(key, refs, auth.session) + `<main class="admin">${body}</main>` + bottomBand();
    if (refs.isAdmin) {
      if (key === 'teams') wireTeams(refs);
      else if (key === 'lgus') wireLgus(refs, q);
      else wireUsers(refs, render);
    }
    if (render.sameRoute === location.hash) window.scrollTo(0, y);
    render.sameRoute = location.hash;
    return;
  }
  render.sameRoute = '';
  showDashboard(refs);
}

function showDashboard(refs) {
  const name = refs.me ? (refs.me.data.nickname || refs.me.data.name) : '';
  app.innerHTML = dashboardHtml(auth.session, refs.me ? roleLine(refs) : (DEMO ? 'Admin · Demo Mode' : 'Signed in'), refs.isAdmin, name);

  const pop = $('#urgent');
  const hide = () => { pop.hidden = true; };
  $('#bell').addEventListener('click', () => { pop.hidden = !pop.hidden; });
  $('#u-close').addEventListener('click', hide);
  $('#u-ok').addEventListener('click', hide);
  $('#u-all').addEventListener('click', (e) => { e.preventDefault(); toast('The full Urgent Items list comes with the first module.'); });

  if (popPending) { popPending = false; pop.hidden = false; }

  app.querySelectorAll('.card').forEach((card) => card.addEventListener('click', (e) => {
    const m = MODULES.find((x) => x.id === card.dataset.mod);
    if (!m.ready) { e.preventDefault(); toast(`${m.title} is not built yet. It will open here once the module is ready.`); }
  }));

  $('#signout').addEventListener('click', async () => { await auth.signOut(); history.replaceState(null, '', '#/'); showLogin(); });
}

window.addEventListener('hashchange', () => render());
onChange(() => render());
window.addEventListener('signed-in', () => enter());

async function start() {
  await store.ready();
  const s = await auth.restore();
  const check = auth.openCheck();
  if (!s) return showLogin();
  if (check === 'old') { await auth.signOut(); return showLogin('Please sign in again. It has been more than 7 days since your last sign-in.'); }
  if (check === 'again') return showLogin('Your sign-in has expired. Please sign in again.');
  enter();
}

start();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
