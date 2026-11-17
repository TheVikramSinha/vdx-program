// Application shell: demo strip, header with the supplied logo, navigation, footer.
import { html } from './html.js';
import { icon } from './components.js';

const LINKS = [
  ['index.html', 'Shop', 'shop'], ['carrier.html', 'Carriers', 'carrier'], ['assistance.html', 'Expert guidance', 'assistance'],
  ['onboarding.html', 'Onboarding', 'onboarding'], ['tenant-admin.html', 'Tenant Admin', 'tenant-admin'],
];
const STAFF = [['veridex-admin.html', 'VeriDex Admin', 'veridex-admin'], ['demo-leads.html', 'Lead inbox', 'leads']];
export function shell({ page, persona, body }) {
  const q = persona === 'carrier' ? '?p=carrier' : '';
  const href = (h, key) => ['assistance', 'onboarding', 'tenant-admin'].includes(key) ? h + q : h;
  const link = ([h, label, key]) => html`<a href="${href(h, key)}" ${key === page ? html`aria-current="page"` : ''}>${label}</a>`;
  return html`<a class="skip" href="#main">Skip to content</a>
  <div class="demo-strip"><div><span>${icon('info')} Illustrative prototype. Prices, offers, payment, identity, invitations and chat are simulated. Nothing is sent or charged.</span>
    <button class="btn-link" style="min-height:0;padding:0;font-size:inherit" data-action="demo-tools" id="demo-tools-btn">Demo tools</button></div></div>
  <header class="site-header"><div>
    <a class="brand" href="${persona === 'carrier' ? 'carrier.html' : 'index.html'}" aria-label="VeriDex home">
      <img class="full" src="assets/brand/veridex-logo-primary.png" alt="VeriDex Solution.AI" width="203" height="44">
      <img class="mark" src="assets/brand/veridex-mark.png" alt="VeriDex" width="54" height="34"></a>
    <button class="btn btn-ghost btn-sm nav-toggle" data-action="nav-toggle" aria-expanded="false" aria-controls="site-nav">${icon('menu')} Menu</button>
    <nav class="nav" id="site-nav" aria-label="Main">${LINKS.map(link)}<span class="sep" aria-hidden="true"></span><span class="staff">Staff</span>${STAFF.map(link)}</nav>
  </div></header>
  <main id="main" tabindex="-1">${body}</main>
  <footer class="site-footer"><div><img src="assets/brand/veridex-logo-tagline.png" alt="VeriDex — Trusted intelligence, insurance transformed" width="182" height="40">
    <span>Demo build · data stays in this browser · not a secure backend</span></div></footer>`;
}
