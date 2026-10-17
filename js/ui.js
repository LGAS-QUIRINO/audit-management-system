// Small helpers shared by every screen and module.
export const $ = (sel, root = document) => root.querySelector(sel);

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Blue/red/gold wave and footer at the bottom of the page.
export function bottomBand() {
  return `<div class="bottom">
    <svg class="wave" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0,70 C360,20 760,120 1440,40 L1440,120 L0,120 Z" fill="#0b2a6b"/>
      <path d="M0,62 C380,14 780,112 1440,32 L1440,40 C760,120 360,20 0,70 Z" fill="#d62839"/>
      <path d="M0,54 C400,6 800,102 1440,22 L1440,32 C780,112 380,14 0,62 Z" fill="#f2b705"/>
    </svg>
    <footer>
      <span>Audit Management System &nbsp;|&nbsp; COA Quirino</span>
      <span class="motto">GOOD GOVERNANCE FOR A BETTER PHILIPPINES</span>
    </footer>
  </div>`;
}
