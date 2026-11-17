import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(localStorage.getItem('token')));

  useEffect(() => {
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    api('/api/auth/me', { token })
      .then((data) => setUser(data.user))
      .catch(() => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const accept = (data) => {
    localStorage.setItem('token', data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const login = async (email, password) =>
    accept(await api('/api/auth/login', { method: 'POST', body: { email, password } }));

  // Registering does not sign you in: the account must be verified first
  const register = (fields) => api('/api/auth/register', { method: 'POST', body: fields });

  // Opening the emailed link verifies the account and signs you in
  const verifyEmail = async (verifyToken) =>
    accept(await api('/api/auth/verify-email', { method: 'POST', body: { token: verifyToken } }));

  const updateProfile = async (fields) => {
    const data = await api('/api/auth/me', { method: 'PATCH', token, body: fields });
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, loading, login, register, verifyEmail, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
