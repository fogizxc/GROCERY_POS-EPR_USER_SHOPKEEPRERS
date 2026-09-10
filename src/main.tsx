import { useState } from 'react';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthScreen } from './components/AuthScreen';
import './index.css';

function AppGate() {
  const [authenticated, setAuthenticated] = useState(() => Boolean(localStorage.getItem('freshcart_token')));

  if (!authenticated) {
    return <AuthScreen onAuthenticated={() => setAuthenticated(true)} />;
  }

  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode><AppGate /></React.StrictMode>
);
