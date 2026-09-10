import { useState } from 'react';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthScreen } from './components/AuthScreen';
import './index.css';

type SessionRole = 'customer' | 'shopkeeper' | 'employee' | 'admin';

function readRoleFromToken(): SessionRole {
  const token = localStorage.getItem('freshcart_token');
  if (!token) return 'customer';
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { role?: string };
    const role = payload.role;
    if (role === 'shopkeeper' || role === 'employee' || role === 'admin') return role;
    return 'customer';
  } catch {
    return 'customer';
  }
}

function AppGate() {
  const [authenticated, setAuthenticated] = useState(() => Boolean(localStorage.getItem('freshcart_token')));

  if (!authenticated) {
    return <AuthScreen onAuthenticated={() => { localStorage.setItem('freshcart_role', readRoleFromToken()); setAuthenticated(true); }} />;
  }

  const role = readRoleFromToken();
  localStorage.setItem('freshcart_role', role);
  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode><AppGate /></React.StrictMode>
);
