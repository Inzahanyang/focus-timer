// Anonymous per-device identity — not an account system, an isolation layer.
// Every API request carries this ID so public reviewers never share data.

const CLIENT_ID_KEY = 'focus-atlas.client-id.v1';

export function getClientId() {
  let id = null;
  try {
    id = localStorage.getItem(CLIENT_ID_KEY);
  } catch {
    // Storage unavailable (private mode edge cases) — fall through.
  }
  if (!id) {
    id = crypto.randomUUID();
    try {
      localStorage.setItem(CLIENT_ID_KEY, id);
    } catch {
      // Keep the in-memory ID for this page life.
    }
  }
  return id;
}

export function getTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}
