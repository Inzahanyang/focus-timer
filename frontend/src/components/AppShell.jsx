import { NavLink, Outlet, Link } from 'react-router';

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
    </div>
  );
}
