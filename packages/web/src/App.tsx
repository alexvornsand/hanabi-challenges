import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MantineProvider, localStorageColorSchemeManager } from '@mantine/core';
import '@mantine/core/styles.css';

import { AuthProvider } from './lib/auth';
import { AppLayout } from './layouts/AppLayout';
import { RequireAuth } from './components/RequireAuth';
import { LoginPage } from './pages/LoginPage';
import { EventListPage } from './pages/EventListPage';
import { EventEditorPage } from './pages/EventEditorPage';
import { EventPage } from './pages/EventPage';
import { ScoreboardPage } from './pages/ScoreboardPage';
import { AuditPage } from './pages/AuditPage';
import { AwardsPage } from './pages/AwardsPage';

const colorSchemeManager = localStorageColorSchemeManager({ key: 'hanabi-color-scheme' });

export function App() {
  return (
    <MantineProvider colorSchemeManager={colorSchemeManager} defaultColorScheme="light">
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<RequireAuth />}>
              <Route element={<AppLayout />}>
                <Route path="/admin/events" element={<EventListPage />} />
                <Route path="/admin/events/new" element={<EventEditorPage />} />
                <Route path="/admin/events/:id/edit" element={<EventEditorPage />} />
                <Route path="/:slug" element={<EventPage />} />
                <Route path="/:slug/:division" element={<EventPage />} />
                <Route path="/:slug/standings" element={<ScoreboardPage />} />
                <Route path="/:slug/standings/:name" element={<ScoreboardPage />} />
                <Route path="/:slug/audit/:unitId" element={<AuditPage />} />
                <Route path="/profile/awards" element={<AwardsPage />} />
                <Route path="/" element={<Navigate to="/admin/events" replace />} />
              </Route>
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </MantineProvider>
  );
}
