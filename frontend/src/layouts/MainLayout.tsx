import React, { useEffect, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button, Inline, PageContainer, Tabs, Text } from '../design-system';
import { UserPill } from '../features/users/UserPill';
import './MainLayout.css';

export const MainLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', isDark);
    root.setAttribute('data-theme', isDark ? 'dark' : 'light');
    document.body.classList.toggle('dark', isDark);
  }, [isDark]);

  const links = [
    { to: '/', label: 'Home', end: true },
    { to: '/events', label: 'Events' },
    { to: '/about', label: 'About' },
    {
      to: '/admin',
      label: 'Admin',
      show: !!user && (user.role === 'ADMIN' || user.role === 'SUPERADMIN'),
    },
  ];

  return (
    <div className="app-root">
      <header className="main-layout__header">
        <PageContainer>
          <div className="main-layout__nav">
            <Inline gap="sm" justify="space-between" align="center" wrap style={{ width: '100%' }}>
              <Tabs
                items={links
                  .filter((l) => l.show ?? true)
                  .map((link) => ({
                    key: link.to,
                    label: link.label,
                    active: link.end
                      ? location.pathname === link.to
                      : location.pathname.startsWith(link.to),
                    onSelect: () => navigate(link.to),
                  }))}
              />
              <Inline className="main-layout__actions" gap="sm" align="center" justify="end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsDark((v) => !v)}
                  aria-label="Toggle theme"
                >
                  <span className="material-symbols-outlined" aria-hidden="true">
                    {'\uEB37'}
                  </span>
                </Button>

                {user ? (
                  <>
                    <UserPill
                      as={Link}
                      to="/me"
                      name={user.display_name}
                      color={user.color_hex}
                      textColor={user.text_color}
                      size="md"
                      className="main-layout__user-pill"
                    />
                    <Button variant="secondary" size="md" onClick={() => logout()}>
                      Log out
                    </Button>
                  </>
                ) : (
                  <Button as={Link} to="/login" variant="primary" size="md">
                    Log in
                  </Button>
                )}
              </Inline>
            </Inline>
          </div>
        </PageContainer>
      </header>

      <main className="main-layout__main">
        <PageContainer>
          <Outlet />
        </PageContainer>
      </main>

      <footer className="main-layout__footer">
        <PageContainer>
          <Text variant="muted" className="main-layout__footnote">
            © {new Date().getFullYear()} Hanabi Events
          </Text>
        </PageContainer>
      </footer>
    </div>
  );
};
