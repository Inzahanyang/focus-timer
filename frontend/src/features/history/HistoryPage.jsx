import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import ConfirmDialog from '../../components/ConfirmDialog';
import { api } from '../../lib/apiClient';
import { subjectColorVar } from '../../lib/formatters';
import { deleteSession, listSessions } from '../timer/sessionApi';

const RANGES = [
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'all', label: 'All time' },
];

const MONTHS = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
];

/** Group sessions by local calendar date, newest date first. */
function groupByLocalDate(sessions) {
  const groups = new Map();
  for (const session of sessions) {
    const date = new Date(session.created_at);
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: `${MONTHS[date.getMonth()]} ${date.getDate()}`,
        year: date.getFullYear(),
        sessions: [],
      });
    }
    groups.get(key).sessions.push(session);
  }
  return [...groups.values()];
}

function localTime(iso) {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes()
  ).padStart(2, '0')}`;
}

/** Strata bar: length encodes duration (60 min spans the full track). */
function StrataBar({ duration, subjectId }) {
  const width = Math.max(8, Math.min(100, (duration / 60) * 100));
  return (
    <span className="strata-track" aria-hidden="true">
      <span
        className="strata-bar"
        style={{
          width: `${width}%`,
          background: subjectColorVar(subjectId),
        }}
      />
    </span>
  );
}

export default function HistoryPage() {
  const [subjects, setSubjects] = useState([]);
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [range, setRange] = useState('all');
  const [sessions, setSessions] = useState(null); // null = loading
  const [error, setError] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    api('/subjects').then(setSubjects).catch(() => {});
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setSessions(null);
    setError(null);
    listSessions({
      subjectId: subjectFilter,
      range,
      signal: controller.signal,
    })
      .then(setSessions)
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err.message);
      });
    return () => controller.abort(); // stale filter responses never land
  }, [subjectFilter, range, reloadKey]);

  // Archived subjects still appear in history — the filter must offer them
  // even though /subjects only returns active ones.
  const filterOptions = useMemo(() => {
    const seen = new Map(subjects.map((s) => [s.id, s.name]));
    for (const session of sessions || []) {
      if (!seen.has(session.subject_id)) {
        seen.set(session.subject_id, session.subject_name);
      }
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [subjects, sessions]);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteSession(pendingDelete.id);
      setPendingDelete(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(err.message);
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const groups = useMemo(
    () => (sessions ? groupByLocalDate(sessions) : []),
    [sessions]
  );

  return (
    <div>
      <h1 className="page-title">Focus history</h1>
      <p className="page-sub">A record of where your attention has been.</p>

      <div className="filters" role="group" aria-label="Filters">
        <div className="segmented" role="group" aria-label="Date range">
          {RANGES.map((option) => (
            <button
              key={option.value}
              type="button"
              className="segmented-option"
              aria-pressed={range === option.value}
              onClick={() => setRange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <select
          className="subject-select"
          aria-label="Filter by subject"
          value={subjectFilter}
          onChange={(event) => setSubjectFilter(event.target.value)}
        >
          <option value="all">All subjects</option>
          {filterOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="empty-strata">
          <p className="field-error">{error}</p>
          <button
            type="button"
            className="btn btn-quiet"
            onClick={() => setReloadKey((k) => k + 1)}
          >
            Retry
          </button>
        </div>
      )}

      {!error && sessions === null && (
        <div className="strata-ghost" aria-hidden="true">
          <span className="ghost-line" style={{ width: '62%' }} />
          <span className="ghost-line" style={{ width: '78%' }} />
          <span className="ghost-line" style={{ width: '45%' }} />
        </div>
      )}

      {!error && sessions && sessions.length === 0 && (
        <div className="empty-strata">
          <div className="strata-ghost" aria-hidden="true">
            <span className="ghost-line" style={{ width: '58%' }} />
            <span className="ghost-line" style={{ width: '74%' }} />
            <span className="ghost-line" style={{ width: '41%' }} />
          </div>
          <strong>No sessions match these filters</strong>
          <p>
            {range === 'all' && subjectFilter === 'all'
              ? 'Complete your first focus session to begin the record.'
              : 'Try widening the range or choosing another subject.'}
          </p>
          {range === 'all' && subjectFilter === 'all' && (
            <Link className="btn btn-primary" to="/">
              Start a session
            </Link>
          )}
        </div>
      )}

      {!error &&
        groups.map((group) => (
          <section key={group.key} className="day-group">
            <h2 className="day-label">
              {group.label}
              <span className="day-year">{group.year}</span>
            </h2>
            <ul className="session-list">
              {group.sessions.map((session) => (
                <li key={session.id} className="session-row">
                  <span className="session-time">
                    {localTime(session.created_at)}
                  </span>
                  <span className="session-main">
                    <span className="session-head">
                      <span
                        className="session-subject"
                        style={{ color: subjectColorVar(session.subject_id) }}
                      >
                        {session.subject_name}
                      </span>
                      <span className="session-duration">
                        {session.duration} min
                      </span>
                    </span>
                    <StrataBar
                      duration={session.duration}
                      subjectId={session.subject_id}
                    />
                    {session.note && (
                      <span className="session-note">{session.note}</span>
                    )}
                  </span>
                  <button
                    type="button"
                    className="btn btn-quiet session-delete"
                    onClick={() => setPendingDelete(session)}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete this session?"
          body="This action cannot be undone."
          busy={deleting}
          onCancel={() => setPendingDelete(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}
