"""Browser walk-through of both journeys incl. failure states. Needs: pip install playwright && playwright install chromium.
Run a server first:  python3 -m http.server 8765   then:  python3 tests/ui_e2e.py [screenshot_dir]"""
import asyncio, sys, os
from playwright.async_api import async_playwright, expect
B = os.environ.get('VDX_URL', 'http://localhost:8765/')
OUT = sys.argv[1] if len(sys.argv) > 1 else 'docs/screenshots'
os.makedirs(OUT, exist_ok=True)
results = []
def ok(name): results.append(name); print('✔', name)
CLEAN = '.sidebar{position:static!important;height:auto!important}.topbar,.with-aside>aside{position:static!important}.toasts,.chat-fab{display:none!important}main{animation:none!important}'
async def shot(pg, path, full_page=False):
    h = await pg.add_style_tag(content=CLEAN if full_page else '.toasts{display:none!important}')
    await pg.screenshot(path=path, full_page=full_page)
    await h.evaluate('e => e.remove()')

async def contact_step(pg, name='Jordan Avery', email='jordan.avery@northwind.example.test', company='Northwind Risk Partners', consent=True):
    await pg.fill('#start-name', name); await pg.fill('#start-email', email); await pg.fill('#start-company', company)
    for sel in ['#start-industry', '#start-size', '#start-region', '#start-usecase', '#start-timeline', '#start-budget']: await pg.select_option(sel, index=1)
    if consent: await pg.check('#start-consent')
    await pg.get_by_role('button', name='Continue to products').click(); await expect(pg.locator('#tab-modules')).to_be_visible()

async def buy(pg, shot_prefix, demo_failures=True):
    await pg.fill('#name', 'Jordan Avery'); await pg.fill('#email', 'not-an-email')
    await pg.click('#pay-btn'); await expect(pg.locator('#error-summary')).to_be_visible(); ok(f'{shot_prefix}: invalid receipt email blocked with error summary')
    await pg.fill('#email', 'jordan.avery@northwind.example.test'); await pg.fill('#company', 'Northwind Risk Partners')
    if demo_failures:
        await pg.check('input[name=method][value=decline]'); await pg.click('#pay-btn')
        await expect(pg.get_by_text('Payment declined (simulated)')).to_be_visible(); await shot(pg, f'{OUT}/{shot_prefix}-payment-declined.png')
        await pg.check('input[name=method][value=cancel]'); await pg.click('#pay-btn')
        await expect(pg.get_by_text('Payment cancelled (simulated)')).to_be_visible(); ok(f'{shot_prefix}: declined and cancelled states, order kept')
    await pg.check('input[name=method][value=approve]'); await pg.click('#pay-btn')
    await expect(pg.get_by_role('heading', name='Purchase complete')).to_be_visible()

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch(); ctx = await br.new_context(viewport={'width': 1360, 'height': 900}, accept_downloads=True); pg = await ctx.new_page()
        errs = []
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None); pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(B + 'index.html'); await pg.evaluate("localStorage.clear()"); await pg.reload()

        # --- guard: onboarding locked before payment (direct link) ---
        await pg.goto(B + 'onboarding.html'); await expect(pg.get_by_role('heading', name='Onboarding unlocks after purchase')).to_be_visible(); ok('Direct onboarding link is locked before payment')
        await pg.goto(B + 'tenant-admin.html'); await expect(pg.get_by_text('No subscription in this tenant workspace yet')).to_be_visible(); ok('Tenant Admin empty state')

        # --- tenant purchase: 10 + 4 worked example via bundle ---
        await pg.goto(B + 'index.html'); await expect(pg.get_by_role('heading', name='Before you choose products')).to_be_visible()
        await pg.goto(B + 'index.html#review'); await expect(pg.get_by_role('heading', name='Before you choose products')).to_be_visible(); ok('Contact step is required before products, review or checkout')
        await pg.get_by_role('button', name='Continue to products').click(); await expect(pg.locator('#error-summary')).to_be_visible()
        for t in ['company name', 'industry', 'company size', 'main use case', 'plan to start']: await expect(pg.locator('#error-summary')).to_contain_text(t)
        ok('Lead form requires contact, business and requirement details')
        await shot(pg, f'{OUT}/00-contact-first.png', True)
        await contact_step(pg); ok('Contact captured; cart session opened')
        n = await pg.evaluate("JSON.parse(localStorage['vdx.demo.platform']).data.cartSessions.filter(c=>c.contact.email==='jordan.avery@northwind.example.test' && c.contact.industry && c.contact.companySize && c.contact.useCase && c.contact.budget).length"); assert n == 1
        # metric picker: Claims can be licensed per seat, per module or per usage
        await expect(pg.locator('fieldset.metric-pick', has_text='Per module').first).to_be_visible()
        await pg.locator('input[name="metric-VDX-CLM-STD"][value=per_module]').check(); await expect(pg.locator('article', has_text='Claims').first).to_contain_text('Any number of people')
        await pg.locator('input[name="metric-VDX-CLM-STD"][value=per_seat]').check(); ok('Buyer can pick any enabled licence metric per product')
        await shot(pg, f'{OUT}/01-shop-modules.png', True)
        await pg.click('#tab-bundles'); await pg.get_by_role('button', name='Try the 10 Claims + 4 Legal example').click()
        row = pg.locator('tr', has_text='Team Pack 5+5').first; await expect(row).to_contain_text('6 paid, not needed'); await expect(row).to_contain_text('$840.00')
        await expect(pg.locator('tr', has_text='Individual modules').first).to_contain_text('$652.00')
        cl = pg.locator('tbody tr', has_text='Claims & Legal').first; await expect(cl).to_contain_text('$586.80'); ok('10 + 4 comparison: $652.00 standalone, $586.80 bundle, fixed pack discloses 6 unneeded seats')
        await shot(pg, f'{OUT}/02-shop-bundles-unequal-demand.png', True)
        await cl.get_by_role('button', name='Use this').click()
        await expect(pg.locator('.cart-line', has_text='VeriDex Core user licence')).to_contain_text('10 VeriDex Core user licences'); ok('Choosing a bundle adds required user licences (10) transparently')
        # tier conflict
        await pg.click('#tab-modules'); await pg.check('input[name="tier-mod_claims"][value=advanced]'); await pg.locator('[data-action=add][data-id="VDX-CLM-ADV"]').click()
        await expect(pg.get_by_text('Claims is in your order at two tiers').first).to_be_visible(); ok('Tier overlap is blocked with an explicit choice')
        await shot(pg, f'{OUT}/03-shop-tier-conflict.png', True)
        await pg.get_by_role('button', name='Remove Claims Advanced').first.click()
        # add-ons and setup services
        await pg.click('#tab-addons'); await pg.locator('[data-action=add][data-id="VDX-ADD-PAY"]').click(); await pg.locator('[data-action=add][data-id="VDX-SVC-CFG"]').click()
        await expect(pg.locator('.sum-line', has_text='Hosted access & support')).to_be_visible(); await expect(pg.locator('.sum-line', has_text='One-time setup')).to_contain_text('$1,500.00')
        await shot(pg, f'{OUT}/02b-addons-services.png', True); ok('Add-ons (usage) and one-time setup show with SMA and one-time totals')
        # invalid qty
        await pg.click('#tab-modules'); q = pg.locator('#q-VDX-LGL-STD-mod_legal'); await q.fill('2.5'); await q.dispatch_event('change'); await expect(pg.locator('.toast.error').first).to_be_visible(); ok('Invalid quantity rejected')
        await pg.locator('a[href="#review"]').click(); await expect(pg.get_by_role('heading', name='Review your order')).to_be_visible()
        await pg.get_by_role('button', name='Continue to checkout').click(); await expect(pg.locator('#error-summary')).to_be_visible(); ok('Required checklist gates checkout')
        await pg.check('#cl-order-reviewed'); await pg.check('#cl-per-module')
        await shot(pg, f'{OUT}/04-review-order.png', True)
        # editing the order invalidates the confirmation
        await pg.check('input[name=cadence][value=annual]') if await pg.locator('input[name=cadence]').count() else None
        await pg.goto(B + 'index.html'); await pg.check('input[name=cadence][value=annual]'); await pg.goto(B + 'index.html#review')
        await expect(pg.locator('#cl-order-reviewed')).not_to_be_checked(); await expect(pg.get_by_text('Cleared because related details changed').first).to_be_visible(); ok('Editing the order clears the confirmation')
        await pg.goto(B + 'index.html'); await pg.check('input[name=cadence][value=monthly]'); await pg.goto(B + 'index.html#review'); await pg.check('#cl-order-reviewed')
        await pg.get_by_role('button', name='Continue to checkout').click(); await expect(pg.get_by_role('heading', name='Checkout')).to_be_visible()
        assert await pg.locator('input[autocomplete^="cc-"], input[name*=card]').count() == 0; ok('No card fields or roster fields at checkout')
        await shot(pg, f'{OUT}/05-checkout.png', True)
        await buy(pg, 'tenant'); await shot(pg, f'{OUT}/06-confirmation.png', True)
        n = await pg.evaluate("JSON.parse(localStorage['vdx.demo.platform']).data.orders.length"); assert n == 1; ok('Decline → cancel → approve produced exactly one order')

        # --- onboarding ---
        await pg.get_by_role('link', name='Start onboarding').first.click(); await expect(pg.get_by_role('heading', name='Set up your workspace')).to_be_visible()
        await pg.get_by_role('button', name='Save and continue').click(); await expect(pg.locator('#error-summary')).to_be_visible(); ok('Onboarding step 1 validation with summary')
        await pg.select_option('#businessType', index=2); await pg.fill('#workspaceName', 'Northwind Claims'); await pg.fill('#workspaceSlug', 'northwind'); await pg.locator('#workspaceSlug').dispatch_event('change')
        await pg.select_option('#region', index=1); await pg.check('#cl-admin-free'); await shot(pg, f'{OUT}/07-onboarding-workspace.png', True)
        await pg.get_by_role('button', name='Save and continue').click()
        if await pg.locator('#error-summary').count(): print('DEBUG', await pg.locator('#error-summary').inner_text())
        await expect(pg.get_by_role('heading', name='Add a person')).to_be_visible()
        cap = await pg.evaluate("import('./models/licensing.js').then(async L=>{const s=await import('./services/storage.js');const ws=s.load('ws.tenant');return [L.totals(ws).seatsUsed, L.totals(ws).admins, ws.entitlements.mod_claims.purchased, ws.entitlements.mod_legal.purchased]})")
        assert cap == [0, 1, 10, 4], cap; ok('Admin-only setup uses 0 seats; capacity is 10 Claims / 4 Legal')
        for i, (nm, em) in enumerate([('Alex Chen', 'alex@northwind.example.test'), ('Bea Diaz', 'bea@northwind.example.test'), ('Cy Eze', 'cy@northwind.example.test'), ('Di Fox', 'di@northwind.example.test'), ('Ed Gale', 'ed@northwind.example.test')]):
            await pg.fill('#p-name', nm); await pg.fill('#p-email', em); await pg.get_by_role('button', name='Add person').click()
        for nm in ['Alex Chen', 'Bea Diaz', 'Cy Eze', 'Di Fox']:
            await pg.get_by_label(f'Legal seat for {nm}', exact=True).check()
        await pg.get_by_label('Claims seat for Alex Chen', exact=True).check()
        await expect(pg.get_by_label('Legal seat for Ed Gale — module full')).to_be_disabled(); ok('Fifth Legal assignment blocked at 4/4 while Claims has spare seats')
        await shot(pg, f'{OUT}/08-onboarding-people-capacity.png', True)
        await pg.check('#cl-alloc-reviewed'); await pg.get_by_label('Claims seat for Ed Gale', exact=True).check()
        await expect(pg.locator('#cl-alloc-reviewed')).not_to_be_checked(); ok('Changing seats clears the allocation confirmation')
        await pg.get_by_role('button', name='Import sample CSV').click(); await expect(pg.get_by_role('heading', name='Review CSV import')).to_be_visible(); await pg.get_by_role('button', name='Cancel').click()
        await pg.check('#cl-alloc-reviewed'); await pg.get_by_role('button', name='Save and continue').click()
        await pg.get_by_role('button', name='Save and continue').click(); await expect(pg.locator('#error-summary')).to_be_visible(); ok('Invitation decision is required')
        await pg.locator('[data-action=send-all]').click()
        await pg.locator('tr', has_text='Alex Chen').get_by_role('button', name='Simulate accept').click(); await pg.locator('tr', has_text='Bea Diaz').get_by_role('button', name='Simulate expiry').click()
        await shot(pg, f'{OUT}/09-onboarding-invitations.png', True)
        c = await pg.evaluate("import('./models/licensing.js').then(async L=>{const s=await import('./services/storage.js');const c=L.moduleCapacity(s.load('ws.tenant'),'mod_legal');return [c.assigned,c.reserved,c.available]})")
        assert c == [1, 3, 0], c; ok('Accept converts a reservation to assigned; expiry keeps reservation; no double count')
        await pg.get_by_role('button', name='Save and continue').click(); await pg.check('input[name=signIn][value=password]')
        await pg.locator('input[data-change=flag][data-pid=mod_legal][data-arg=visible]').uncheck(); await pg.check('#cl-modules-reviewed'); await shot(pg, f'{OUT}/10-onboarding-readiness.png', True)
        await pg.get_by_role('button', name='Review and finish').click(); await pg.get_by_role('button', name='Finish setup').click(); await expect(pg.get_by_role('heading', name='Setup recorded')).to_be_visible()
        await shot(pg, f'{OUT}/11-onboarding-success.png', True); ok('Tenant onboarding completed')

        # --- tenant admin ---
        await pg.goto(B + 'tenant-admin.html'); await expect(pg.get_by_text('Legal is full (4 of 4).')).to_be_visible(); await shot(pg, f'{OUT}/12-tenant-admin-overview.png', True)
        await pg.goto(B + 'tenant-admin.html#billing'); await expect(pg.locator('tfoot', has_text='Hosted access & support')).to_be_visible()
        await pg.locator('[data-action=usage][data-id=mod_pay]').click(); await pg.locator('[data-action=usage][data-id=mod_pay]').click()
        await expect(pg.locator('tr', has_text='Digital Payments').last).to_contain_text('50'); ok('Usage meter, SMA and setup services shown in Tenant Admin billing')
        await pg.locator('[data-action=buy][data-id=mod_legal]').click(); await pg.fill('#add-n', '2'); await pg.locator('#add-n').dispatch_event('input')
        await shot(pg, f'{OUT}/13-tenant-admin-buy-seats.png')
        await pg.check('dialog input[name=method][value=decline]'); await pg.get_by_role('button', name='Pay and add seats (simulated)').click(); await expect(pg.locator('dialog .error-summary')).to_be_visible()
        v = await pg.evaluate("JSON.parse(localStorage['vdx.demo.ws.tenant']).data.entitlements.mod_legal.purchased"); assert v == 4; ok('Declined seat purchase leaves capacity unchanged')
        await pg.check('dialog input[name=method][value=approve]'); await pg.get_by_role('button', name='Pay and add seats (simulated)').click(); await pg.wait_for_selector('dialog', state='detached')
        v = await pg.evaluate("JSON.parse(localStorage['vdx.demo.ws.tenant']).data.entitlements"); assert v['mod_legal']['purchased'] == 6 and v['mod_claims']['purchased'] == 10; ok('Paid seat purchase adds Legal capacity only')
        await shot(pg, f'{OUT}/14-tenant-admin-billing.png', True)
        await pg.goto(B + 'tenant-admin.html#people'); await pg.locator('tr', has_text='Alex Chen').get_by_role('button', name='Manage').click(); await pg.fill('#m-email', 'alex.chen@northwind.example.test'); await shot(pg, f'{OUT}/15-tenant-admin-member.png')
        await pg.get_by_role('button', name='Save changes').click(); await pg.wait_for_selector('dialog', state='detached'); await expect(pg.locator('tr', has_text='alex.chen@northwind.example.test')).to_contain_text('Legal'); ok('Email edit keeps member id, seats and roles')
        await pg.goto(B + 'tenant-admin.html#invitations'); await pg.locator('tr', has_text='Bea Diaz').get_by_role('button', name='Revoke').click(); await pg.get_by_role('button', name='Revoke', exact=True).last.click()
        v = await pg.evaluate("JSON.parse(localStorage['vdx.demo.ws.tenant']).data.entitlements.mod_legal.purchased"); assert v == 6; ok('Revoking releases seats without changing purchased capacity')

        # --- VeriDex Admin: product → price → bundle → publish → storefront ---
        await pg.goto(B + 'veridex-admin.html#products'); await pg.get_by_role('button', name='New product').click()
        await pg.fill('#pf-name', 'Subrogation'); await pg.fill('#pf-summary', 'Recover paid losses.'); await pg.fill('#pf-tier-feat-0', 'Recovery queue\nDemand letters')
        await pg.locator('dialog summary', has_text='Add a new / custom metric').click(); await pg.fill('dialog input[name=cm-name-0]', 'Per recovery file'); await pg.fill('dialog input[name=cm-unit-0]', 'file'); await pg.select_option('dialog select[name=cm-basis-0]', 'usage'); await pg.check('dialog input[name=cm-on-0]')
        await pg.get_by_role('button', name='Save to draft').click(); await expect(pg.locator('dialog .error-summary, dialog [role=alert]').first).to_contain_text('New / custom metric'); ok('Custom metric must be explicitly marked New / custom')
        await pg.check('dialog input[name=cm-new-0]'); await shot(pg, f'{OUT}/16-veridex-admin-new-product.png')
        await pg.get_by_role('button', name='Save to draft').click(); await pg.wait_for_selector('dialog', state='detached')
        await expect(pg.locator('tr', has_text='Subrogation').first).to_contain_text('New / custom'); ok('Product shows enabled metrics incl. the new/custom one')
        await pg.goto(B + 'veridex-admin.html#publish'); await expect(pg.get_by_text('Missing or invalid price').first).to_be_visible(); await expect(pg.get_by_role('button', name='Publish catalog…')).to_be_disabled(); ok('Publish blocked by validation error (missing price)')
        await shot(pg, f'{OUT}/17-veridex-admin-validation.png', True)
        await pg.goto(B + 'veridex-admin.html#pricing'); pi = pg.get_by_label('Subrogation Standard Per seat draft price in dollars'); await pi.fill('31.00'); await pi.dispatch_event('change')
        ci = pg.get_by_label('Claims Standard Per seat draft price in dollars'); await ci.fill('45.00'); await ci.dispatch_event('change')
        ri = pg.get_by_label('Subrogation Standard Per recovery file draft price in dollars'); await ri.fill('2.50'); await ri.dispatch_event('change'); await shot(pg, f'{OUT}/18-veridex-admin-pricing.png', True)
        await pg.goto(B + 'veridex-admin.html#skus'); await pg.get_by_role('button', name='New bundle SKU').click()
        await pg.fill('#sf-id', 'VDX-BND-CSUB'); await pg.fill('#sf-name', 'Claims & Subrogation'); await pg.fill('#sf-description', 'Claims with recoveries. Separate seat count per module.')
        await pg.locator('dialog label', has_text='Claims').locator('input[name=sf-inc]').first.check(); await pg.locator('dialog .choice', has_text='Subrogation').locator('input[name=sf-inc]').check(); await pg.fill('#sf-discount', '15')
        await shot(pg, f'{OUT}/19-veridex-admin-new-bundle.png'); await pg.get_by_role('button', name='Save to draft').click(); await pg.wait_for_selector('dialog', state='detached')
        await pg.goto(B + 'index.html'); await pg.click('#tab-bundles'); assert await pg.get_by_role('heading', name='Claims & Subrogation').count() == 0; ok('Draft SKU is not visible to buyers before publish')
        await pg.goto(B + 'veridex-admin.html#publish'); await pg.select_option('#role', 'catalog_manager'); await expect(pg.get_by_role('button', name='Publish catalog…')).to_be_disabled(); ok('Catalog manager cannot publish (role separation)')
        await pg.select_option('#role', 'pricing_approver'); await pg.get_by_role('button', name='Publish catalog…').click(); await shot(pg, f'{OUT}/20-veridex-admin-publish-confirm.png')
        await pg.get_by_role('button', name='Publish', exact=True).click(); await expect(pg.locator('dialog .error-summary')).to_be_visible(); await pg.check('dialog input[name=ack]'); await pg.get_by_role('button', name='Publish', exact=True).click(); await pg.wait_for_selector('dialog', state='detached')
        await pg.select_option('#role', 'platform_admin'); await shot(pg, f'{OUT}/21-veridex-admin-published.png', True)
        await pg.goto(B + 'veridex-admin.html#quote'); await shot(pg, f'{OUT}/22-veridex-admin-quote-preview.png', True)
        await pg.goto(B + 'tenant-admin.html#billing'); await expect(pg.locator('tr', has_text='VDX-BND-CL').first).to_contain_text('@ $37.80'); ok('Published price change did not rewrite the existing subscription')
        await pg.goto(B + 'index.html'); await pg.click('#tab-bundles'); await expect(pg.get_by_role('heading', name='Claims & Subrogation')).to_be_visible(); ok('Published bundle appears in the purchaser journey')
        await shot(pg, f'{OUT}/23-shop-shows-new-bundle.png', True)

        # --- carrier journey (isolated) ---
        await pg.goto(B + 'carrier.html'); await expect(pg.get_by_role('heading', name='Before you choose products')).to_be_visible()
        await contact_step(pg, 'Morgan Ellis', 'morgan.ellis@keystone.example.test', 'Keystone Mutual', consent=False)
        await expect(pg.get_by_text('Nothing added yet')).to_be_visible(); ok('Carrier cart and contact are isolated from the tenant journey')
        await pg.goto(B + 'onboarding.html?p=carrier'); await expect(pg.get_by_role('heading', name='Onboarding unlocks after purchase')).to_be_visible(); ok('Carrier onboarding locked although the tenant has purchased')
        await pg.goto(B + 'carrier.html'); await pg.click('#tab-bundles'); await expect(pg.get_by_role('heading', name='Carrier Operations', exact=True)).to_be_visible(); assert await pg.get_by_role('heading', name='Team Pack 5+5').count() == 0
        a = pg.locator('#q-VDX-BND-CO-mod_policy'); await a.fill('25'); await a.dispatch_event('change'); a = pg.locator('#q-VDX-BND-CO-mod_claims'); await a.fill('40'); await a.dispatch_event('change')
        await pg.locator('[data-action=add][data-id="VDX-BND-CO"]').click(); await pg.check('input[name=cadence][value=annual]')
        await expect(pg.get_by_text('Module access needs VeriDex Core user licences').first).to_be_visible(); ok('Module access without user licences is blocked')
        await pg.click('#tab-modules'); u = pg.locator('#q-VDX-CORE-USR-mod_core'); await u.fill('30'); await u.dispatch_event('change'); await pg.locator('[data-action=add][data-id="VDX-CORE-USR"]').click()
        await expect(pg.get_by_text('Some module seats cannot be filled').first).to_be_visible(); ok('Fewer user licences than module seats shows a warning')
        await u.fill('50'); await u.dispatch_event('change'); await pg.locator('[data-action=add][data-id="VDX-CORE-USR"]').click()
        await shot(pg, f'{OUT}/24-carrier-shop.png', True)
        await pg.locator('a[href="#review"]').click(); await pg.check('#cl-order-reviewed'); await pg.check('#cl-per-module'); await pg.get_by_role('button', name='Continue to checkout').click(); await buy(pg, 'carrier', demo_failures=False)
        await pg.get_by_role('link', name='Start onboarding').first.click(); await expect(pg.get_by_text('Lines of business in scope')).to_be_visible()
        await pg.select_option('#businessType', index=1); await pg.fill('#workspaceName', 'Keystone Ops'); await pg.fill('#workspaceSlug', 'keystone-ops'); await pg.locator('#workspaceSlug').dispatch_event('change'); await pg.select_option('#region', index=1)
        await pg.check('input[data-change=org-line][value="Commercial auto"]'); await pg.check('#cl-admin-free'); await shot(pg, f'{OUT}/25-carrier-onboarding.png', True); await pg.get_by_role('button', name='Save and continue').click()
        await pg.check('#cl-alloc-reviewed'); await pg.get_by_role('button', name='Save and continue').click(); await pg.get_by_role('button', name='Save and continue').click()
        await pg.check('input[name=signIn][value=sso]'); await pg.check('#cl-modules-reviewed'); await pg.get_by_role('button', name='Review and finish').click(); await expect(pg.locator('#error-summary')).to_contain_text('operating region'); ok('Carrier readiness requires an operating region')
        await pg.check('input[data-change=ready-region][value=Midwest]'); await pg.check('#cl-modules-reviewed'); await shot(pg, f'{OUT}/26-carrier-readiness.png', True)
        await pg.get_by_role('button', name='Review and finish').click(); await pg.get_by_role('button', name='Finish setup').click()
        await pg.goto(B + 'tenant-admin.html?p=carrier'); await expect(pg.locator('.cap-card', has_text='Policy')).to_contain_text('25'); await expect(pg.locator('.cap-card', has_text='user licences')).to_contain_text('50'); await shot(pg, f'{OUT}/27-carrier-tenant-admin.png', True); ok('Carrier journey verified from purchase through administration')

        # --- assistance, chat, leads ---
        await pg.goto(B + 'assistance.html?p=carrier'); await pg.get_by_role('button', name='Review request').click(); await expect(pg.locator('#error-summary')).to_be_visible(); ok('Intake requires email and contact permission')
        await pg.fill('#email', 'ops@keystone.example.test'); await pg.locator('#email').dispatch_event('change'); await pg.check('#consent'); await shot(pg, f'{OUT}/28-assistance-intake.png', True)
        await pg.get_by_role('button', name='Review request').click(); await pg.get_by_role('button', name='Record request').click(); await expect(pg.get_by_text('no meeting is booked')).to_be_visible(); ok('Intake confirmation states request only, nothing sent or booked')
        await pg.goto(B + 'index.html'); await pg.click('#chat-fab'); await pg.fill('#chat-input', 'how do seats work?'); await pg.keyboard.press('Enter'); await expect(pg.locator('#chat-log')).to_contain_text('one seat in each')
        await pg.select_option('#chat-avail', 'offline'); await pg.get_by_role('button', name='Talk to a specialist').click(); await expect(pg.locator('#chat-log')).to_contain_text('offline'); await pg.get_by_role('button', name='Record request').click()
        await expect(pg.locator('#chat-log')).to_contain_text('Tick the box'); await shot(pg, f'{OUT}/29-chat-offline-followup.png'); ok('Chat: scripted answer, offline state, follow-up needs permission')
        await pg.reload(); await pg.click('#chat-fab'); await expect(pg.locator('#chat-log')).to_contain_text('how do seats work?'); ok('Chat draft survives reload')
        await pg.goto(B + 'demo-leads.html#leads'); await expect(pg.locator('tbody tr')).to_have_count(1); await shot(pg, f'{OUT}/30-lead-inbox.png', True)
        # abandoned cart: start a cart, leave it, see it in the inbox
        await pg.evaluate("localStorage.removeItem('vdx.demo.draft.tenant')"); await pg.goto(B + 'index.html')
        await contact_step(pg, 'Casey Quinn', 'casey@brightpath.example.test', 'Brightpath Agency')
        await pg.locator('[data-action=add][data-id="VDX-CLM-STD"]').click(); await pg.locator('[data-action=add][data-id="VDX-CORE-USR"]').click()
        await pg.goto(B + 'demo-leads.html'); await pg.select_option('#abandon-after', '0')
        row = pg.locator('tbody tr', has_text='Casey Quinn'); await expect(row).to_contain_text('Abandoned'); await expect(row).to_contain_text('Claims Standard')
        await row.get_by_role('button', name='Open').click(); await pg.select_option('#cd-status', 'contacted'); await pg.fill('#cd-note', 'Called, sending quote')
        await shot(pg, f'{OUT}/30b-abandoned-cart.png'); await pg.get_by_role('button', name='Save').click(); await pg.wait_for_selector('dialog', state='detached')
        await expect(pg.locator('tbody tr', has_text='Casey Quinn')).to_contain_text('Contacted'); ok('Abandoned cart appears with contact and cart; follow-up recorded')
        await pg.select_option('#cf', 'all'); morgan = pg.locator('tbody tr', has_text='carrier journey'); await expect(morgan).to_contain_text('No permission'); await expect(morgan).to_contain_text('Purchased')
        ok('Carts without follow-up permission are flagged; purchased carts marked converted')
        await shot(pg, f'{OUT}/30c-abandoned-carts.png', True)
        await pg.goto(B + 'veridex-admin.html#customers'); await shot(pg, f'{OUT}/31-veridex-admin-customers.png', True); await pg.goto(B + 'veridex-admin.html#orders'); await shot(pg, f'{OUT}/32-veridex-admin-orders.png', True)

        # --- bundle seat pool: each person–module assignment uses one seat ---
        await pg.goto(B + 'index.html'); await pg.evaluate("import('./services/scenarios.js').then(m=>m.loadScenario('running'))"); await pg.wait_for_timeout(300)
        await pg.goto(B + 'carrier.html'); await pg.click('#tab-bundles'); await pg.locator('input[name="metric-VDX-BND-CO"][value=bundle_seat]').check()
        await expect(pg.locator('article', has_text='One pool of seats').first).to_contain_text('uses 2 seats'); ok('Bundle offers shared bundle seats as a licence option')
        pool = pg.locator('.cap-card', has_text='Carrier Operations bundle seats')
        await pg.goto(B + 'tenant-admin.html?p=carrier'); await expect(pool).to_contain_text('61 available')
        await pg.goto(B + 'tenant-admin.html?p=carrier#people'); await pg.locator('tr', has_text='Morgan Ellis').get_by_role('button', name='Manage').click()
        await expect(pg.locator('dialog')).to_contain_text('61 of 65 bundle seats left')
        await pg.check('dialog input[name=seat-mod_policy]'); await pg.check('dialog input[name=seat-mod_claims]'); await shot(pg, f'{OUT}/15b-tenant-admin-bundle-seats.png')
        await pg.get_by_role('button', name='Save changes').click(); await pg.wait_for_selector('dialog', state='detached')
        await pg.goto(B + 'tenant-admin.html?p=carrier'); await expect(pool).to_contain_text('59 available'); ok('One person in 2 bundle modules uses 2 bundle seats')
        await pool.get_by_role('button', name='Buy bundle seats').click(); await expect(pg.locator('dialog')).to_contain_text('Shared by the bundle')
        await pg.get_by_role('button', name='Pay and add seats (simulated)').click(); await pg.wait_for_selector('dialog', state='detached')
        await expect(pool).to_contain_text('60 available'); await shot(pg, f'{OUT}/14b-tenant-admin-bundle-pool.png', True); ok('Buying bundle seats adds to the shared pool after simulated payment')
        await pg.goto(B + 'veridex-admin.html#skus'); await pg.locator('tr', has_text='VDX-BND-CO').get_by_role('button', name='Edit').click()
        await expect(pg.locator('dialog')).to_contain_text('Shared bundle seats'); await shot(pg, f'{OUT}/19b-veridex-admin-bundle-metrics.png'); await pg.keyboard.press('Escape'); await pg.wait_for_selector('dialog', state='detached')
        await pg.goto(B + 'veridex-admin.html#products'); await pg.locator('tr', has_text='Claims').first.get_by_role('button', name='Edit').click()
        for t in ['Per seat', 'Per module', 'Per usage', 'Add a new / custom metric']: await expect(pg.locator('dialog')).to_contain_text(t)
        await shot(pg, f'{OUT}/16b-veridex-admin-product-metrics.png'); await pg.keyboard.press('Escape'); await pg.wait_for_selector('dialog', state='detached'); ok('Admin can enable/disable metrics per product and per SKU')

        # --- keyboard + mobile ---
        await pg.goto(B + 'index.html'); await pg.keyboard.press('Tab'); assert await pg.evaluate("document.activeElement.className") == 'skip'
        await pg.click('#demo-tools-btn'); await expect(pg.locator('dialog')).to_be_visible(); await pg.keyboard.press('Escape'); await pg.wait_for_selector('dialog', state='detached')
        assert await pg.evaluate("document.activeElement.id") == 'demo-tools-btn'; ok('Keyboard: skip link first, dialog closes on Esc and restores focus')
        m = await ctx.new_page(); await m.set_viewport_size({'width': 390, 'height': 844}); m.on('pageerror', lambda e: errs.append(str(e)))
        for u, n in [('index.html', '33-mobile-shop'), ('tenant-admin.html', '34-mobile-tenant-admin'), ('onboarding.html', '35-mobile-onboarding')]:
            await m.goto(B + u); await m.wait_for_timeout(200); w = await m.evaluate("document.documentElement.scrollWidth"); assert w <= 392, (u, w); await shot(m, f'{OUT}/{n}.png', True)
        await m.goto(B + 'index.html'); await m.get_by_role('button', name='Menu').click(); await expect(m.get_by_role('link', name='Tenant Admin')).to_be_visible(); ok('Mobile: no horizontal overflow, menu works')

        # --- reset / scenario ---
        await pg.goto(B + 'index.html'); await pg.evaluate("import('./services/scenarios.js').then(m=>m.loadScenario('running'))"); await pg.goto(B + 'tenant-admin.html'); await expect(pg.get_by_role('heading', name='Northwind Claims & Legal')).to_be_visible(); ok('Demo scenario loads')
        # --- Reset demo: clean state for a new tester ---
        await pg.goto(B + 'tenant-admin.html'); await pg.click('#reset-demo-btn'); await expect(pg.get_by_role('heading', name='Reset the demo?')).to_be_visible(); await shot(pg, f'{OUT}/36-reset-demo-confirm.png')
        await pg.get_by_role('button', name='Reset demo', exact=True).last.click(); await pg.wait_for_url('**/index.html'); await expect(pg.get_by_role('heading', name='Before you choose products')).to_be_visible()
        st = await pg.evaluate("(()=>{const g=k=>JSON.parse(localStorage['vdx.demo.'+k]).data;return [g('platform').orders.length, g('platform').catalog.version, g('ws.tenant').members.length, g('ws.carrier').subscriptions.length, g('draft.tenant').cart.lines.length, g('draft.tenant').chat.messages.length, g('platform').leads.length]})()")
        assert st == [0, 1, 0, 0, 0, 0, 3], st
        assert await pg.evaluate("JSON.parse(localStorage['vdx.demo.platform']).data.cartSessions.length") == 2
        await pg.goto(B + 'onboarding.html'); await expect(pg.get_by_role('heading', name='Onboarding unlocks after purchase')).to_be_visible(); ok('Reset demo returns every area to a clean first-run state')
        assert not errs, errs; ok('No console or page errors')
        print(f'\n{len(results)} UI checks passed'); await br.close()
asyncio.run(main())
