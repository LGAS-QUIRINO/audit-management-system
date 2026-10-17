// Temporary screen after sign-in. Replaced by the dashboard once its design is approved.
import { esc, bottomBand } from '../ui.js';

export function homeHtml(session) {
  return `<main class="home-wrap"><div class="home-card">
    <h2>Signed in</h2>
    <p>${esc(session.name || '')}<br>${esc(session.email)}</p>
    <p>The dashboard is the next screen to design and approve.</p>
    <button class="btn" type="button" id="signout">Sign out</button>
  </div></main>${bottomBand()}`;
}
