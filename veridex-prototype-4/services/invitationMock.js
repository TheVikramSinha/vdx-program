// Mock invitation adapter: records intent only. Nothing leaves the browser.
export const invitations = {
  async send(member) { return { accepted: true, simulated: true, to: member.email, note: 'Invitation recorded in the demo. No email was sent.' }; },
};
