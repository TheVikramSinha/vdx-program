// Application shell: sidebar with the supplied logo and navigation, top bar with demo status, Reset demo and Demo tools.
import { html } from './html.js';
import { icon } from './components.js';

const GROUPS = [
  ['Buy', [['index.html', 'Shop', 'shop', 'cart'], ['carrier.html', 'Carriers', 'carrier', 'building'], ['assistance.html', 'Expert guidance', 'assistance', 'compass']]],
  ['After purchase', [['onboarding.html', 'Onboarding', 'onboarding', 'flag'], ['tenant-admin.html', 'Tenant Admin', 'tenant-admin', 'users']]],
  ['VeriDex staff', [['veridex-admin.html', 'VeriDex Admin', 'veridex-admin', 'sliders'], ['demo-leads.html', 'Leads & carts', 'leads', 'mail']]],
];
const LABEL = { shop: 'Shop', carrier: 'Carrier solutions', assistance: 'Expert guidance', onboarding: 'Workspace setup', 'tenant-admin': 'Tenant Admin', 'veridex-admin': 'VeriDex Admin', leads: 'Leads and abandoned carts' };
export function shell({ page, persona, body }) {
  const q = persona === 'carrier' ? '?p=carrier' : '';
  const href = (h, key) => ['assistance', 'onboarding', 'tenant-admin'].includes(key) ? h + q : h;
  const link = ([h, label, key, ic]) => html`<a href="${href(h, key)}" ${key === page ? html`aria-current="page"` : ''}>${icon(ic)}${label}</a>`;
  return html`<a class="skip" href="#main">Skip to content</a>
  <div class="shell">
    <aside class="sidebar">
      <a class="brand" href="${persona === 'carrier' ? 'carrier.html' : 'index.html'}" aria-label="VeriDex home">
        <img class="full" src="assets/brand/veridex-logo-primary.png" alt="VeriDex Solution.AI" width="212" height="46">
        <img class="mark" src="assets/brand/veridex-mark.png" alt="VeriDex" width="51" height="32"></a>
      <button class="btn btn-ghost btn-sm nav-toggle" data-action="nav-toggle" aria-expanded="false" aria-controls="site-nav">${icon('menu')} Menu</button>
      <nav class="nav" id="site-nav" aria-label="Main">${GROUPS.map(([g, links]) => html`<span class="staff">${g}</span>${links.map(link)}`)}</nav>
      <div class="side-note"><b>Seats per module. Administrator free.</b><span>One person, one sign-in. A seat in each module they use — per module, or from a bundle’s shared seats.</span></div>
      <div class="side-foot"><button class="btn btn-ghost btn-sm btn-block" data-action="reset-demo" data-id="side">${icon('reset')} Reset demo</button></div>
    </aside>
    <div class="main-col">
      <div class="topbar"><div class="top-label">${icon('lock')}<b>${LABEL[page] || 'VeriDex'}</b><span class="pill">Illustrative demo</span><span class="top-note">Payment, identity, invitations and chat are simulated. Nothing is sent or charged.</span></div>
        <div class="top-right"><button class="btn btn-secondary btn-sm" data-action="reset-demo" id="reset-demo-btn">${icon('reset')} <span class="lbl">Reset demo</span></button>
          <button class="btn btn-ghost btn-sm" data-action="demo-tools" id="demo-tools-btn">${icon('sliders')} <span class="lbl">Demo tools</span></button></div></div>
      <main id="main" tabindex="-1">${body}</main>
      <footer class="site-footer"><div><img src="assets/brand/veridex-logo-tagline.png" alt="VeriDex — Trusted intelligence, insurance transformed" width="155" height="34">
        <span>Illustrative prototype · prices and offers are examples · data stays in this browser · not a secure backend</span></div></footer>
    </div>
  </div>`;
}
