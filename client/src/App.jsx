import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import AuthPage from './pages/AuthPage.jsx';
import RoomsPage from './pages/RoomsPage.jsx';
import RoomPage from './pages/RoomPage.jsx';
import VerifyEmailPage from './pages/VerifyEmailPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import FriendsPage from './pages/FriendsPage.jsx';
import AppShell from './components/AppShell.jsx';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="center-note">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route element={<Protected><AppShell /></Protected>}>
        <Route path="/" element={<RoomsPage />} />
        <Route path="/friends" element={<FriendsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>
      <Route path="/room/:roomId" element={<Protected><RoomPage /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
