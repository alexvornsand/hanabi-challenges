import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const MainLayout: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="app-root">
      <header>
        <nav className="main-nav">
          <div className="main-nav__links">
            <Link to="/">Home</Link> | <Link to="/events">Events</Link> |{' '}
            <Link to="/statistics">Statistics</Link>
            {user && (user.role === 'ADMIN' || user.role === 'SUPERADMIN') && (
              <>
                {' '}
                | <Link to="/admin">Admin</Link>
              </>
            )}
          </div>
          {user ? (
            <Link
              to="/me"
              className="main-nav__login-btn main-nav__login-btn--user"
              style={{
                backgroundColor: user.color_hex || '#777777',
                color: user.text_color || '#ffffff',
                borderColor: user.color_hex || '#777777',
              }}
            >
              {user.display_name}
            </Link>
          ) : (
            <Link to="/login" className="main-nav__login-btn">
              Log in
            </Link>
          )}
        </nav>
      </header>

      <main>
        <Outlet />
      </main>

      <footer>
        <small>© {new Date().getFullYear()} Hanabi Events</small>
      </footer>
    </div>
  );
};
