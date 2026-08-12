import { NavLink, Outlet, Link } from 'react-router';
import { useTimer } from '../features/timer/useTimer';

// The completion notice lives in the shell, not in TimerPage: a session
// that completes while the user reads History must still announce itself
// (Codex audit round 2).
function CompletionNotice() {
  const { state } = useTimer();
  if (!state.overlay) return null;
  return (
    <div className="completion" role="status">
      <div className="completion-title">A new contour has been added.</div>
      <div className="completion-meta">
        {state.overlay.subjectName} · {state.overlay.minutes} minutes
      </div>
    </div>
  );
}

export default function AppShell() {
  return (
    <div className="shell">
      <header className="shell-header">
        <Link to="/" className="wordmark">
          Focus Atlas
        </Link>
        <nav className="nav" aria-label="Main">
          <NavLink to="/" end>
            Timer
          </NavLink>
          <NavLink to="/history">History</NavLink>
          <NavLink to="/dashboard">Dashboard</NavLink>
        </nav>
      </header>
      <main className="shell-main">
        <Outlet />
      </main>
      <CompletionNotice />
    </div>
  );
}
