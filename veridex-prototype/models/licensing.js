// Licensing model: memberships, per-module seat assignments, invitations. Enforces every non-negotiable seat rule.
//  - Seats are per module. Nothing is pooled, borrowed or transferred between modules.
//  - A person with two modules holds one seat in EACH. One assignment record = one seat, reserved or assigned, never both.
//  - The workspace administrator role is a flag on the membership and holds no seat.
import { nextId, clock } from './ids.js';
import { ROLES } from '../data/seedCatalog.js';
import { log } from './workspace.js';

export { ROLES };
export const MEMBER_TYPES = { employee: 'Employee', contractor: 'Contractor', external: 'External partner' };
export const STATUS = { draft: 'Not invited', invited: 'Invitation pending', active: 'Active', expired: 'Invitation expired', suspended: 'Suspended', revoked: 'Revoked' };
const RESERVING = ['draft', 'invited', 'expired'];
const HOLDING = ['active', 'suspended'];
export const INVITE_DAYS = 7;
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
const norm = (e) => (e || '').trim().toLowerCase();

export class CapacityError extends Error {}
export const member = (ws, id) => ws.members.find((m) => m.id === id);
export const liveMembers = (ws) => ws.members.filter((m) => m.status !== 'revoked');
export const seatsOf = (ws, memberId) => ws.assignments.filter((a) => a.memberId === memberId);

/** Per-module capacity. reserved + assigned + available === purchased, always. */
export function capacity(ws) {
  return Object.values(ws.entitlements).map((e) => {
    let reserved = 0, assigned = 0;
    for (const a of ws.assignments) if (a.productId === e.productId) {
      const st = member(ws, a.memberId)?.status;
      if (RESERVING.includes(st)) reserved++; else if (HOLDING.includes(st)) assigned++;
    }
    return { ...e, reserved, assigned, available: e.purchased - reserved - assigned };
  });
}
export const moduleCapacity = (ws, productId) => capacity(ws).find((c) => c.productId === productId);
export function totals(ws) {
  return { people: liveMembers(ws).length, seatsUsed: ws.assignments.length, seatsPurchased: Object.values(ws.entitlements).reduce((n, e) => n + e.purchased, 0), admins: liveMembers(ws).filter((m) => m.isAdmin).length };
}

export function validateMember(ws, input, selfId) {
  const e = {};
  if (!(input.name || '').trim()) e.name = 'Enter a name.';
  if (!emailOk(norm(input.email))) e.email = 'Enter a valid work email, e.g. name@company.com.';
  else if (liveMembers(ws).some((m) => m.id !== selfId && norm(m.email) === norm(input.email))) e.email = 'This email already belongs to a workspace member. Edit that member instead.';
  if (input.type && !MEMBER_TYPES[input.type]) e.type = 'Choose a membership type.';
  return e;
}
/** Create a membership, or reuse the existing one with the same email (no duplicate identity entry). */
export function addMember(ws, input, now = clock.now()) {
  const existing = liveMembers(ws).find((m) => norm(m.email) === norm(input.email));
  if (existing) return { member: existing, reused: true };
  const e = validateMember(ws, input);
  if (Object.keys(e).length) throw new Error(Object.values(e)[0]);
  const m = { id: nextId(ws, 'mem'), name: input.name.trim(), email: input.email.trim(), type: input.type || 'employee', isAdmin: !!input.isAdmin, status: input.status || 'draft', invite: null, createdAt: now };
  ws.members.push(m);
  log(ws, 'Member added', m.name, now);
  return { member: m, reused: false };
}
/** Contact edits keep the stable membership id; assignments and roles are untouched. */
export function updateMember(ws, id, patch) {
  const m = member(ws, id);
  if (!m) throw new Error('Member not found.');
  const next = { name: patch.name ?? m.name, email: patch.email ?? m.email, type: patch.type ?? m.type };
  const e = validateMember(ws, next, id);
  if (Object.keys(e).length) throw new Error(Object.values(e)[0]);
  Object.assign(m, { name: next.name.trim(), email: next.email.trim(), type: next.type });
  log(ws, 'Member details updated', m.name);
  return m;
}
export function setAdmin(ws, id, isAdmin) {
  const m = member(ws, id);
  if (!m || m.status === 'revoked') throw new Error('Member not found.');
  if (!isAdmin && m.isAdmin && liveMembers(ws).filter((x) => x.isAdmin).length === 1) throw new Error('A workspace needs at least one administrator.');
  m.isAdmin = isAdmin;
  log(ws, isAdmin ? 'Administrator role granted (no seat used)' : 'Administrator role removed', m.name);
}
/** Assign one seat in one module. Blocks at that module's capacity even if other modules have spare seats. */
export function assign(ws, memberId, productId, role = 'Viewer') {
  const m = member(ws, memberId), e = ws.entitlements[productId];
  if (!m || m.status === 'revoked') throw new Error('Member not found.');
  if (!e) throw new Error('This workspace has not purchased that module.');
  if (!ROLES.includes(role)) throw new Error('Unknown role.');
  if (ws.assignments.some((a) => a.memberId === memberId && a.productId === productId)) throw new Error(`${m.name} already has a ${e.productName} seat.`);
  const c = moduleCapacity(ws, productId);
  if (c.available < 1) throw new CapacityError(`${e.productName} is full (${c.purchased} of ${c.purchased} seats in use). Free a ${e.productName} seat or buy more — seats in other modules cannot be used.`);
  const a = { id: nextId(ws, 'seat'), memberId, productId, role };
  ws.assignments.push(a);
  log(ws, 'Seat assigned', `${m.name} → ${e.productName} (${role})`);
  return a;
}
export function setRole(ws, memberId, productId, role) {
  const a = ws.assignments.find((x) => x.memberId === memberId && x.productId === productId);
  if (!a || !ROLES.includes(role)) throw new Error('Assignment not found.');
  a.role = role;
}
/** Removing access frees capacity in that module only. It never changes billing. */
export function unassign(ws, memberId, productId) {
  const i = ws.assignments.findIndex((a) => a.memberId === memberId && a.productId === productId);
  if (i < 0) return false;
  ws.assignments.splice(i, 1);
  log(ws, 'Seat freed (billing unchanged)', `${member(ws, memberId)?.name} ← ${ws.entitlements[productId]?.productName}`);
  return true;
}
const addDays = (iso, d) => new Date(new Date(iso).getTime() + d * 86400000).toISOString();
/** Invitation "sending" is recorded as a request to the invitation adapter; nothing is actually delivered in the demo. */
export function sendInvite(ws, id, now = clock.now()) {
  const m = member(ws, id);
  if (!m || !['draft', 'expired', 'invited'].includes(m.status)) throw new Error('This member cannot be invited in their current state.');
  m.invite = { sentAt: now, expiresAt: addDays(now, INVITE_DAYS), count: (m.invite?.count || 0) + 1 };
  m.status = 'invited';
  log(ws, m.invite.count > 1 ? 'Invitation resent (simulated)' : 'Invitation sent (simulated)', m.name, now);
}
/** Acceptance converts existing reservations to assigned seats — the same records, so nothing is counted twice. */
export function acceptInvite(ws, id, now = clock.now()) {
  const m = member(ws, id);
  if (!m || m.status !== 'invited') throw new Error('No pending invitation.');
  m.status = 'active'; m.invite.acceptedAt = now;
  log(ws, 'Invitation accepted (simulated)', m.name, now);
}
/** Expiry keeps the reservation until an administrator resends or revokes (demo policy). */
export function expireInvite(ws, id, now = clock.now()) {
  const m = member(ws, id);
  if (!m || m.status !== 'invited') throw new Error('No pending invitation.');
  m.status = 'expired';
  log(ws, 'Invitation expired (simulated)', `${m.name}: reservation held until resent or revoked`, now);
}
/** Revoking removes the person and releases every seat they reserved or held. Billing is unchanged. */
export function revoke(ws, id, now = clock.now()) {
  const m = member(ws, id);
  if (!m || m.status === 'revoked') throw new Error('Member not found.');
  if (m.isAdmin && liveMembers(ws).filter((x) => x.isAdmin).length === 1) throw new Error('Nominate another administrator before removing this one.');
  const freed = seatsOf(ws, id).length;
  ws.assignments = ws.assignments.filter((a) => a.memberId !== id);
  m.status = 'revoked'; m.isAdmin = false;
  log(ws, 'Access revoked', `${m.name}: ${freed} seat${freed === 1 ? '' : 's'} released, billing unchanged`, now);
  return freed;
}
/** Suspended users keep their seats (so reinstatement is guaranteed) but cannot sign in. */
export function suspend(ws, id) {
  const m = member(ws, id);
  if (!m || m.status !== 'active') throw new Error('Only active members can be suspended.');
  if (m.isAdmin && liveMembers(ws).filter((x) => x.isAdmin && x.status === 'active').length === 1) throw new Error('The only active administrator cannot be suspended.');
  m.status = 'suspended'; log(ws, 'Member suspended (seats kept)', m.name);
}
export function reinstate(ws, id) {
  const m = member(ws, id);
  if (!m || m.status !== 'suspended') throw new Error('Member is not suspended.');
  m.status = 'active'; log(ws, 'Member reinstated', m.name);
}
export function setModuleFlag(ws, productId, flag, value) {
  const e = ws.entitlements[productId];
  if (!e || !['enabled', 'visible'].includes(flag)) throw new Error('Unknown module setting.');
  e[flag] = !!value; // never touches e.purchased
  log(ws, `Module ${flag === 'enabled' ? (value ? 'enabled' : 'disabled') : (value ? 'shown' : 'hidden')}`, `${e.productName} (capacity unchanged)`);
}

/** Parse and validate a CSV roster. Returns rows with errors; apply only imports rows that fully fit. */
export function parseCsv(ws, text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n').filter((l) => l.trim());
  if (lines.length < 2) return { rows: [], error: 'The file needs a header row and at least one person.' };
  if (lines.length > 201) return { rows: [], error: 'Import up to 200 people at a time.' };
  const head = lines[0].split(',').map((h) => h.trim().toLowerCase());
  for (const h of ['name', 'email']) if (!head.includes(h)) return { rows: [], error: `Missing required column: ${h}.` };
  const ents = Object.values(ws.entitlements);
  const cols = head.map((h) => ents.find((e) => e.productName.toLowerCase() === h));
  const left = Object.fromEntries(capacity(ws).map((c) => [c.productId, c.available]));
  const seen = new Set();
  const rows = lines.slice(1).map((line, i) => {
    const cells = line.split(',').map((c) => c.trim());
    const get = (k) => cells[head.indexOf(k)] || '';
    const row = { line: i + 2, name: get('name'), email: get('email'), type: (get('type') || 'employee').toLowerCase(), seats: [], errors: [] };
    const ve = validateMember(ws, row);
    row.errors.push(...Object.values(ve));
    if (seen.has(norm(row.email))) row.errors.push('Duplicate email in file.');
    seen.add(norm(row.email));
    cols.forEach((e, ci) => {
      const v = cells[ci];
      if (!e || !v) return;
      const role = ROLES.find((r) => r.toLowerCase() === v.toLowerCase());
      if (!role) row.errors.push(`${e.productName}: unknown role "${v}". Use ${ROLES.join(', ')}.`);
      else row.seats.push({ productId: e.productId, role });
    });
    if (!row.errors.length) {
      const over = row.seats.find((s) => left[s.productId] < 1);
      if (over) row.errors.push(`${ws.entitlements[over.productId].productName} has no seats left; row skipped.`);
      else row.seats.forEach((s) => left[s.productId]--);
    }
    return row;
  });
  return { rows };
}
export function applyCsv(ws, parsed) {
  let added = 0;
  for (const r of parsed.rows.filter((x) => !x.errors.length)) {
    const { member: m } = addMember(ws, r);
    r.seats.forEach((s) => assign(ws, m.id, s.productId, s.role));
    added++;
  }
  return added;
}
