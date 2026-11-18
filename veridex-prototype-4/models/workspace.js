// Workspace (tenant-side) aggregate factory. One isolated workspace per persona in this demo.
import { nextId, clock } from './ids.js';
export function createWorkspace(persona) {
  return { seq: 0, persona, orders: [], subscriptions: [], entitlements: {}, pools: {}, services: [], members: [], assignments: [], activity: [], addSeats: null,
    onboarding: { unlocked: false, step: 0, org: {}, confirmations: {}, inviteDecision: null, readiness: { signIn: '', defaultRole: 'Viewer', regions: [], rollout: '' }, completedAt: null } };
}
export function log(ws, action, detail = '', now = clock.now()) {
  ws.activity.unshift({ id: nextId(ws, 'act'), at: now, action, detail });
  if (ws.activity.length > 300) ws.activity.length = 300;
}
