import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL 
});

API.interceptors.request.use(config => {
  const token = localStorage.getItem('xp_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('xp_token');
    if (token) {
      API.get('/auth/me')
        .then(r => setUser(r.data))
        .catch(() => localStorage.removeItem('xp_token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const r = await API.post('/auth/login', { email, password });
    localStorage.setItem('xp_token', r.data.token);
    setUser(r.data.user);
    return r.data;
  };

  const register = async (username, email, password) => {
    const r = await API.post('/auth/register', { username, email, password });
    localStorage.setItem('xp_token', r.data.token);
    setUser(r.data.user);
    return r.data;
  };

  const logout = () => {
    localStorage.removeItem('xp_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, API }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
export { API };