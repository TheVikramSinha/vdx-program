// Mock identity adapter. The demo never verifies anyone; production needs an IdP (OIDC/SAML) and server-issued sessions.
export const identity = {
  currentUser: (ws) => ws.members.find((m) => m.id === ws.onboarding.org.adminMemberId) || null,
  describe: () => 'Simulated sign-in. No identity was verified.',
};
