export const emailKey = email => String(email || '').trim().toLowerCase();
export const validEmail = email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailKey(email));
