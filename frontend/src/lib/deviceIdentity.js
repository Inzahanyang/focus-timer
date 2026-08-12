// Anonymous per-device identity — not an account system, an isolation layer.
// Every API request carries this ID so public reviewers never share data.

const CLIENT_ID_KEY = 'focus-atlas.client-id.v1';
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Module-scope fallback: if storage fails, every request in this page life
// still uses ONE identity instead of minting a new UUID per call.
let memoryClientId = null;

export function getClientId() {
  if (memoryClientId) return memoryClientId;

  let stored = null;
  try {
    stored = localStorage.getItem(CLIENT_ID_KEY);
  } catch {
    // Storage unavailable — fall through to a fresh in-memory ID.
  }
  // A corrupted stored value self-heals into a fresh identity.
  memoryClientId =
    stored && UUID_PATTERN.test(stored) ? stored : crypto.randomUUID();
  try {
    localStorage.setItem(CLIENT_ID_KEY, memoryClientId);
  } catch {
    // Keep the in-memory ID for this page life.
  }
  return memoryClientId;
}

export function getTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}
