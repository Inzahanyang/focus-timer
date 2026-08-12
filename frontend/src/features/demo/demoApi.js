import { api } from '../../lib/apiClient';

// The demo flag mirrors server state for UI affordances (banner, the
// 10-second demo session). Losing the flag only hides those affordances;
// "Remove demo data" on the server is always scoped by is_demo.
const DEMO_FLAG_KEY = 'focus-atlas.demo.v1';

function setFlag(on) {
  try {
    if (on) localStorage.setItem(DEMO_FLAG_KEY, '1');
    else localStorage.removeItem(DEMO_FLAG_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event('focus-atlas:demo-changed'));
}

export function isDemoLoaded() {
  try {
    return localStorage.getItem(DEMO_FLAG_KEY) === '1';
  } catch {
    return false;
  }
}

export async function seedDemoAtlas() {
  const result = await api('/demo/seed', { method: 'POST' });
  setFlag(true);
  window.dispatchEvent(new Event('focus-atlas:sessions-changed'));
  return result;
}

export async function removeDemoAtlas() {
  const result = await api('/demo', { method: 'DELETE' });
  setFlag(false);
  window.dispatchEvent(new Event('focus-atlas:sessions-changed'));
  return result;
}
