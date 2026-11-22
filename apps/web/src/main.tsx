import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Link, RouterProvider } from 'react-router';
import { EmptyState, ToastProvider } from './components/ui';
import { AdminLayout } from './layouts/AdminLayout';
import { PublicLayout } from './layouts/PublicLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminGame from './pages/admin/AdminGame';
import AdminMatches from './pages/admin/AdminMatches';
import AdminPlayers from './pages/admin/AdminPlayers';
import AdminSettings from './pages/admin/AdminSettings';
import Login from './pages/admin/Login';
import Dashboard from './pages/public/Dashboard';
import History from './pages/public/History';
import Leaderboard from './pages/public/Leaderboard';
import Online from './pages/public/Online';
import PlayerDetail from './pages/public/PlayerDetail';
import Players from './pages/public/Players';
import './styles.css';

const NotFound = () => (
  <EmptyState title="Không tìm thấy trang" hint={<Link to="/" className="text-accent underline">Về trang tổng quan</Link>} />
);

// 11 trang chính: 5 public + 6 admin (gồm login). /players/:id là route con, không tính trang mới.
const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <Dashboard /> },
      { path: '/leaderboard', element: <Leaderboard /> },
      { path: '/players', element: <Players /> },
      { path: '/players/:id', element: <PlayerDetail /> },
      { path: '/history', element: <History /> },
      { path: '/online', element: <Online /> },
      { path: '*', element: <NotFound /> },
    ],
  },
  { path: '/admin/login', element: <Login /> },
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { index: true, element: <AdminDashboard /> },
      { path: 'players', element: <AdminPlayers /> },
      { path: 'matches', element: <AdminMatches /> },
      { path: 'game', element: <AdminGame /> },
      { path: 'settings', element: <AdminSettings /> },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  </StrictMode>,
);
