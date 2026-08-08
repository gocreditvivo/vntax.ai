import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, useLocation, useNavigate } from 'react-router-dom';
import App from './app/App';
import './index.css';

/**
 * Bridges react-router-dom to the app's router abstraction, so screens stay
 * router-agnostic and unit-testable without a router in scope.
 *
 * No `key` here. Keying on the pathname remounted the entire tree on every
 * navigation, which would destroy and rebuild the auth provider on each page
 * change — re-reading the session, flashing a loading state, and discarding
 * any in-flight work. `NavProvider` syncs the path prop instead.
 */
function Bridge() {
  const loc = useLocation();
  const navigate = useNavigate();
  return <App initialPath={loc.pathname} onNavigate={navigate} />;
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <Bridge />
    </HashRouter>
  </React.StrictMode>
);
