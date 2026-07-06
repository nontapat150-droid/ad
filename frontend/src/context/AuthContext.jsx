import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session from localStorage or sessionStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('bou_user') || sessionStorage.getItem('bou_user');
    const token  = localStorage.getItem('bou_token') || sessionStorage.getItem('bou_token');
    
    if (stored && stored !== 'undefined' && token) {
      try {
        setUser(JSON.parse(stored));
      } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('bou_user');
        localStorage.removeItem('bou_token');
        sessionStorage.removeItem('bou_user');
        sessionStorage.removeItem('bou_token');
      }
    }
    setLoading(false);
  }, []);

  const login = async (username, password, rememberMe = false) => {
    const { data } = await api.post('/auth/login', { username, password });
    
    const storage = rememberMe ? localStorage : sessionStorage;
    
    // Clear other storage to prevent conflicts
    if (rememberMe) {
      sessionStorage.removeItem('bou_token');
      sessionStorage.removeItem('bou_user');
    } else {
      localStorage.removeItem('bou_token');
      localStorage.removeItem('bou_user');
    }

    storage.setItem('bou_token', data.token);
    storage.setItem('bou_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('bou_token');
    localStorage.removeItem('bou_user');
    sessionStorage.removeItem('bou_token');
    sessionStorage.removeItem('bou_user');
    setUser(null);
  };

  const updateUser = (newProps) => {
    const updatedUser = { ...user, ...newProps };
    setUser(updatedUser);
    
    if (localStorage.getItem('bou_token')) {
      localStorage.setItem('bou_user', JSON.stringify(updatedUser));
    } else if (sessionStorage.getItem('bou_token')) {
      sessionStorage.setItem('bou_user', JSON.stringify(updatedUser));
    }
  };

  const hasRole = (roles) => {
    if (!user) return false;
    const userRoles = user.roles || [user.role];
    return (Array.isArray(roles) ? roles : [roles]).some((r) => userRoles.includes(r));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasRole, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
