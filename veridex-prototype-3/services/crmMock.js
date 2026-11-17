// Mock CRM adapter: leads live in the demo platform store. Production would POST to a CRM with server-side consent logging.
export const crm = { async submit(lead) { return { stored: true, simulated: true, id: lead.id }; } };
export function download(filename, text, type = 'text/plain') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = filename; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
