import { Outlet } from 'react-router-dom';
import TopBar from './TopBar.jsx';

// Keeps the header mounted while you move between Rooms, Friends and Profile,
// so the underline can slide from one tab to the next.
export default function AppShell() {
  return (
    <div className="page">
      <TopBar />
      <Outlet />
    </div>
  );
}