// Shared controller plumbing: state loading, delegated events, demo tools, persona resolution.
import { html, render } from '../views/templates/html.js';
import { shell } from '../views/templates/shell.js';
import { toast, openDialog, confirmDialog, alert } from '../views/templates/components.js';
import { load, save, resetAll, exportAll, importAll, incompatible } from '../services/storage.js';
import { SCENARIOS, loadScenario } from '../services/scenarios.js';
import { promoteScheduled } from '../models/platform.js';
import { download } from '../services/crmMock.js';

export function personaFromPage() {
  const fixed = document.body.dataset.persona;
  if (fixed) return fixed;
  const p = new URLSearchParams(location.search).get('p') === 'carrier' ? 'carrier' : 'tenant';
  document.body.dataset.persona = p;
  return p;
}
/** Load the aggregates a page needs. Each persona has its own workspace and draft keys. */
export function loadState(persona) {
  const S = { persona, platform: load('platform'), ws: load(`ws.${persona}`), draft: load(`draft.${persona}`) };
  if (promoteScheduled(S.platform)) save('platform', S.platform);
  S.save = () => { save('platform', S.platform); save(`ws.${persona}`, S.ws); save(`draft.${persona}`, S.draft); };
  S.reload = () => { S.platform = load('platform'); S.ws = load(`ws.${persona}`); S.draft = load(`draft.${persona}`); };
  return S;
}
/** Mount a page: shell + body view, delegated handlers, demo tools. Returns {refresh}. */
export function mount({ page, persona, view, handlers = {}, onRender }) {
  const root = document.getElementById('app');
  const refresh = () => { render(root, shell({ page, persona, body: view() })); onRender?.(root); };
  const run = async (fn, el, e) => { if (!fn) return; try { await fn(el, e); } catch (err) { console.error(err); toast(err.message || 'Something went wrong.', 'error'); } };
  const all = { ...handlers,
    'nav-toggle': (el) => { const nav = document.getElementById('site-nav'); const open = nav.classList.toggle('open'); el.setAttribute('aria-expanded', String(open)); },
    'demo-tools': () => demoTools(refresh),
  };
  root.addEventListener('click', (e) => { const el = e.target.closest('[data-action]'); if (el && root.contains(el)) { if (el.tagName !== 'A' || el.getAttribute('href') === '#') e.preventDefault(); run(all[el.dataset.action], el, e); } });
  root.addEventListener('change', (e) => { const el = e.target.closest('[data-change]'); if (el) run(all[el.dataset.change], el, e); });
  root.addEventListener('submit', (e) => { const f = e.target.closest('form[data-submit]'); if (f) { e.preventDefault(); run(all[f.dataset.submit], f, e); } });
  refresh();
  if (incompatible.length) toast(`Saved demo data from an older version could not be opened (${incompatible.join(', ')}). It was set aside and a clean state was started.`, 'error');
  return { refresh, root };
}
async function demoTools(refresh) {
  const choice = await openDialog({ title: 'Demo tools', body: html`
    ${alert('info', 'Everything here is synthetic and stored only in this browser.')}
    <fieldset><legend>Load a demo scenario (replaces current demo data)</legend><div class="stack-sm">
      ${Object.entries(SCENARIOS).map(([k, s]) => html`<button type="button" class="btn btn-ghost" data-scn="${k}" style="justify-content:flex-start;text-align:left"><span><b>${s.label}</b><br><span class="small muted">${s.detail}</span></span></button>`)}</div></fieldset>
    <fieldset><legend>Data</legend><div class="row"><button type="button" class="btn btn-ghost" data-tool="export">Export JSON</button>
      <label class="btn btn-ghost" for="import-file">Import JSON</label><input class="sr-only" type="file" id="import-file" accept="application/json,.json">
      <button type="button" class="btn btn-secondary" data-tool="reset">Reset all demo data</button></div></fieldset>`,
    onMount(d, done) {
      d.addEventListener('click', async (e) => {
        const scn = e.target.closest('[data-scn]')?.dataset.scn; const tool = e.target.closest('[data-tool]')?.dataset.tool;
        if (scn) done({ scn });
        if (tool === 'export') download('veridex-demo-export.json', JSON.stringify(exportAll(), null, 2), 'application/json');
        if (tool === 'reset') done({ reset: true });
      });
      d.querySelector('#import-file').addEventListener('change', async (e) => {
        const f = e.target.files[0]; if (!f) return;
        let obj; try { obj = JSON.parse(await f.text()); } catch { obj = null; }
        const r = obj ? importAll(obj) : { ok: false, error: 'The file is not valid JSON.' };
        if (r.ok) done({ imported: true }); else { toast(r.error + ' Nothing was changed.', 'error'); e.target.value = ''; }
      });
    } });
  if (!choice) return;
  if (choice.reset) { if (!(await confirmDialog({ title: 'Reset all demo data?', body: html`<p>Carts, purchases, workspaces, leads and catalog edits in this browser will be cleared.</p>`, confirmLabel: 'Reset', kind: 'primary' }))) return; resetAll(); }
  if (choice.scn) loadScenario(choice.scn);
  location.hash = ''; location.reload();
}
export { html, toast, openDialog, confirmDialog };
