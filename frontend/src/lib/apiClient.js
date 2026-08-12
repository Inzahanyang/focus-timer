import { getClientId, getTimezone } from './deviceIdentity';

const configured = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

// A production build without an API URL would make every visitor's browser
// call http://localhost — fail the misconfiguration loudly.
if (import.meta.env.PROD && !configured) {
  throw new Error('VITE_API_BASE_URL is required in production builds.');
}

// The ternary is statically folded per build: the localhost fallback is
// dev-only and never survives into the production bundle (CI greps for it).
const BASE_URL = import.meta.env.PROD
  ? configured
  : configured || 'http://localhost:5001';

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Single shared API client. Attaches identity headers to every request
 * and normalizes errors into ApiError.
 */
export async function api(path, { method = 'GET', body, headers = {}, signal } = {}) {
  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      signal,
      headers: {
        'X-Client-ID': getClientId(),
        'X-Timezone': getTimezone(),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(0, 'network_error', 'Could not reach the server.');
  }

  let data = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const code = data?.error?.code || 'unknown_error';
    const message =
      data?.error?.message || `Request failed (${response.status}).`;
    throw new ApiError(response.status, code, message);
  }
  return data;
}
