import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const MainLayout: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <div
      className="app-root"
      style={{ background: 'linear-gradient(180deg, #f8fbff 0%, #ffffff 45%, #f6f8fb 100%)' }}
    >
      <header style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
        <nav
          className="main-nav"
          style={{
            maxWidth: '1100px',
            margin: '0 auto',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            className="main-nav__links"
            style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}
          >
            <Link to="/">Home</Link>
            <Link to="/events">Events</Link>
            <Link to="/about">About</Link>
            {user && (user.role === 'ADMIN' || user.role === 'SUPERADMIN') && <Link to="/admin">Admin</Link>}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {user ? (
              <>
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
                <button
                  className="btn btn--secondary"
                  onClick={() => logout()}
                  style={{ padding: '6px 10px' }}
                >
                  Log out
                </button>
              </>
            ) : (
              <Link to="/login" className="main-nav__login-btn">
                Log in
              </Link>
            )}
          </div>
        </nav>
      </header>

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px 16px' }}>
        <Outlet />
      </main>

      <footer
        style={{
          background: 'var(--color-surface)',
          borderTop: '1px solid var(--color-border)',
          marginTop: 'var(--space-md)',
        }}
      >
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '12px 16px' }}>
          <small className="text-gray-700">© {new Date().getFullYear()} Hanabi Events</small>
        </div>
      </footer>
    </div>
  );
};
