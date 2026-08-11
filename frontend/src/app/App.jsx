import { HashRouter, Route, Routes } from 'react-router';
import AppShell from '../components/AppShell';
import DashboardPage from '../features/dashboard/DashboardPage';
import HistoryPage from '../features/history/HistoryPage';
import TimerPage from '../features/timer/TimerPage';

// HashRouter: survives direct navigation and refresh on GitHub Pages (D4).
export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<TimerPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
