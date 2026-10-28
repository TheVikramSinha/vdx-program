/** Browser-tab persistence. Separate namespaces prevent carrier/tenant state crossover. */
export class SessionStore {
  constructor(key, storage = globalThis.sessionStorage) { this.key = key; this.storage = storage; this.available = true; }
  load() { try { return JSON.parse(this.storage.getItem(this.key) || 'null'); } catch { this.available = false; return null; } }
  save(value) { try { this.storage.setItem(this.key, JSON.stringify(value)); } catch { this.available = false; } }
  clear() { try { this.storage.removeItem(this.key); } catch { this.available = false; } }
}
