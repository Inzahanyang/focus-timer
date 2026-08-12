import { api } from '../../lib/apiClient';

/**
 * Persist a completed session. The completionId minted at START doubles as
 * the Idempotency-Key: StrictMode remounts, reloads, and outbox retries can
 * repeat this call and the server still stores exactly one row (D9/D22).
 */
export function saveSession(session) {
  return api('/sessions', {
    method: 'POST',
    headers: { 'Idempotency-Key': session.completionId },
    body: {
      subject_id: session.subjectId,
      duration: session.minutes,
      completed_at: new Date(session.completedAt).toISOString(),
      ...(session.startedAt
        ? { started_at: new Date(session.startedAt).toISOString() }
        : {}),
      pause_count: session.pauseCount || 0,
      paused_seconds: session.pausedSeconds || 0,
      ...(session.intention ? { note: session.intention } : {}),
    },
  });
}

export function listSessions({ subjectId, range, signal } = {}) {
  const params = new URLSearchParams();
  if (subjectId != null && subjectId !== 'all') {
    params.set('subject_id', String(subjectId));
  }
  if (range) params.set('range', range);
  const qs = params.toString();
  return api(`/sessions${qs ? `?${qs}` : ''}`, { signal });
}

export function deleteSession(id) {
  return api(`/sessions/${id}`, { method: 'DELETE' });
}
