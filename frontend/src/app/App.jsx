import { HashRouter, Route, Routes } from 'react-router';
import AppShell from '../components/AppShell';
import DashboardPage from '../features/dashboard/DashboardPage';
import HistoryPage from '../features/history/HistoryPage';
import { saveSession } from '../features/timer/sessionApi';
import { TimerProvider } from '../features/timer/TimerProvider';
import TimerPage from '../features/timer/TimerPage';

// HashRouter: survives direct navigation and refresh on GitHub Pages (D4).
// TimerProvider sits above the routes so navigation never unmounts the
// scheduler or the save flow.
export default function App() {
  return (
    <HashRouter>
      <TimerProvider onComplete={saveSession}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<TimerPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
          </Route>
        </Routes>
      </TimerProvider>
    </HashRouter>
  );
}
