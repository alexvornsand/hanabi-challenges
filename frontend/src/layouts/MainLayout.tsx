import React from 'react';
import { Outlet, Link } from 'react-router-dom';

export const MainLayout: React.FC = () => {
  return (
    <div className="app-root">
      <header>
        <nav>
          <Link to="/">Hanabi Challenges</Link> | <Link to="/challenges">Challenges</Link> |{' '}
          <Link to="/statistics">Statistics</Link> | <Link to="/login">Log in</Link>
        </nav>
      </header>

      <main>
        <Outlet />
      </main>

      <footer>
        <small>© {new Date().getFullYear()} Hanabi Challenges</small>
      </footer>
    </div>
  );
};
