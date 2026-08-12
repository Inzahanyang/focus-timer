import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../../lib/apiClient';
import { subjectColorVar } from '../../lib/formatters';
import { isDemoLoaded, seedDemoAtlas } from '../demo/demoApi';
import { listSessions } from '../timer/sessionApi';
import FocusTerrain from './FocusTerrain';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const tooltipStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: 8,
  fontSize: 13,
  color: 'var(--text)',
};

/** Atlas Notes: the map's observation log. The onboarding note is skipped
    here — the terrain's "still forming" block already says it. */
function AtlasNotes({ insights }) {
  const notes = (insights || []).filter((note) => note.type !== 'onboarding');
  if (notes.length === 0) return null;
  const [first, ...rest] = notes;
  return (
    <section className="dash-section atlas-note">
      <h2 className="micro-label">Atlas Note</h2>
      <p className="note-message">{first.message}</p>
      <p className="note-evidence">{first.evidence}.</p>
      {first.action && <p className="note-action">{first.action}</p>}
      {rest.length > 0 && (
        <ul className="note-secondary">
          {rest.slice(0, 2).map((note) => (
            <li key={note.type}>
              <span>{note.message}</span>
              <span className="note-secondary-evidence"> {note.evidence}.</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ChartSection({ title, caption, children }) {
  return (
    <section className="dash-section">
      <h2 className="dash-question">{title}</h2>
      <p className="dash-caption">{caption}</p>
      {children}
    </section>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [weekSessions, setWeekSessions] = useState([]);
  const [error, setError] = useState(null);
  const [terrainError, setTerrainError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const onChange = () => setReloadKey((k) => k + 1);
    window.addEventListener('focus-atlas:sessions-changed', onChange);
    return () =>
      window.removeEventListener('focus-atlas:sessions-changed', onChange);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    // The terrain request is an extension — its failure must never take
    // down the required stats and charts (audit MAJOR-2).
    Promise.allSettled([
      api('/stats', { signal: controller.signal }),
      listSessions({ range: 'week', signal: controller.signal }),
    ]).then(([statsResult, sessionsResult]) => {
      if (controller.signal.aborted) return;
      if (statsResult.status === 'rejected') {
        setError(statsResult.reason?.message || 'Could not load statistics.');
        return;
      }
      setStats(statsResult.value);
      if (sessionsResult.status === 'fulfilled') {
        setWeekSessions(sessionsResult.value);
        setTerrainError(null);
      } else {
        setWeekSessions([]);
        setTerrainError('The hourly terrain is temporarily unavailable.');
      }
    });
    return () => controller.abort();
  }, [reloadKey]);

  if (error) {
    return (
      <div>
        <h1 className="page-title">Your focus landscape</h1>
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
      </div>
    );
  }

  if (!stats) {
    return (
      <div aria-busy="true">
        <h1 className="page-title">Your focus landscape</h1>
        <p className="sr-only" role="status">
          Loading dashboard statistics.
        </p>
        <div className="strata-ghost" aria-hidden="true">
          <span className="ghost-line" style={{ width: '70%' }} />
          <span className="ghost-line" style={{ width: '52%' }} />
          <span className="ghost-line" style={{ width: '81%' }} />
        </div>
      </div>
    );
  }

  // Assignment stats are always visible — zeros included (directive #8).
  const subjectData = stats.by_subject.map((entry) => ({
    name: entry.name,
    minutes: entry.minutes,
    subjectId: entry.subject_id,
  }));
  const weekdayData = WEEKDAYS.map((day) => ({
    day,
    minutes: stats.by_weekday[day] ?? 0,
  }));
  const stillForming = stats.sessions_this_week < 3;

  return (
    <div>
      <h1 className="page-title">Your focus landscape</h1>

      <p className="stat-line">
        <span
          className="stat-item"
          aria-label={`Current focus streak: ${stats.streak} consecutive days`}
        >
          <strong>{stats.streak}</strong> day continuity
        </span>
        <span className="stat-sep" aria-hidden="true">
          ·
        </span>
        <span className="stat-item">
          <strong>{stats.total_hours}</strong> focused hours
        </span>
        <span className="stat-sep" aria-hidden="true">
          ·
        </span>
        <span className="stat-item">
          <strong>{stats.sessions_this_week}</strong> sessions this week
        </span>
      </p>
      <p className="stat-note">
        Continuity counts consecutive days with at least one completed
        session.
      </p>

      <section className="dash-section">
        <h2 className="dash-question">This week's terrain</h2>
        <p className="dash-caption">Focused minutes by day and hour</p>
        {terrainError ? (
          <p className="field-note">{terrainError}</p>
        ) : (
          <FocusTerrain weekSessions={weekSessions} />
        )}
        {stillForming && (
          <div className="terrain-forming">
            <strong>Your map is still forming.</strong>
            <p>Complete three sessions to reveal your first pattern.</p>
            <div className="terrain-forming-actions">
              <Link className="btn btn-primary" to="/">
                Start a session
              </Link>
              {!isDemoLoaded() && (
                <button
                  type="button"
                  className="btn btn-quiet"
                  onClick={() => seedDemoAtlas()}
                >
                  Explore a sample atlas
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      <ChartSection
        title="Where did your attention go?"
        caption="Focus time by subject"
      >
        <div className="chart-frame">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={subjectData}
              margin={{ top: 8, right: 8, bottom: 0, left: -18 }}
            >
              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'var(--muted)', fontSize: 12 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                tick={{ fill: 'var(--muted)', fontSize: 12 }}
              />
              <Tooltip
                cursor={{ fill: 'var(--contour-faint)' }}
                contentStyle={tooltipStyle}
                formatter={(value) => [`${value} min`, 'Focus']}
              />
              <Bar dataKey="minutes" radius={[3, 3, 0, 0]} maxBarSize={44}>
                {subjectData.map((entry) => (
                  <Cell
                    key={entry.subjectId ?? entry.name}
                    fill={
                      entry.subjectId != null
                        ? subjectColorVar(entry.subjectId)
                        : 'var(--contour)'
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {subjectData.length === 0 && (
            <p className="chart-empty">No focus time recorded yet.</p>
          )}
        </div>
      </ChartSection>

      <ChartSection
        title="When did focus take shape?"
        caption="Focus time from Monday to Sunday"
      >
        <div className="chart-frame">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={weekdayData}
              margin={{ top: 8, right: 8, bottom: 0, left: -18 }}
            >
              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'var(--muted)', fontSize: 12 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                tick={{ fill: 'var(--muted)', fontSize: 12 }}
              />
              <Tooltip
                cursor={{ fill: 'var(--contour-faint)' }}
                contentStyle={tooltipStyle}
                formatter={(value) => [`${value} min`, 'Focus']}
              />
              <Bar
                dataKey="minutes"
                fill="var(--contour)"
                radius={[3, 3, 0, 0]}
                maxBarSize={44}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartSection>

      <AtlasNotes insights={stats.insights} />
    </div>
  );
}
