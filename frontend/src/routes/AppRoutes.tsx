// src/routes/AppRoutes.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MainLayout } from '../layouts/MainLayout';
import { LandingPage } from '../pages/LandingPage';
import { EventArchivePage } from '../pages/EventArchivePage';
import { EventDetailPage } from '../pages/EventDetailPage';
import { TeamPage } from '../pages/TeamPage';
import { LoginPage } from '../pages/LoginPage';
import { UserPage } from '../pages/UserPage';
import { UserProfilePage } from '../pages/UserProfilePage';
import { NewUserPage } from '../pages/NewUserPage';
import { NotFoundPage } from '../pages/NotFoundPage';

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          {/* Home */}
          <Route index element={<LandingPage />} />

          {/* Events */}
          <Route path="events">
            <Route index element={<EventArchivePage />} />
            <Route path=":slug" element={<EventDetailPage />} />
            <Route path=":slug/:teamSize" element={<EventDetailPage />} />
            <Route path=":slug/teams/:teamId" element={<TeamPage />} />
          </Route>

          {/* Auth */}
          <Route path="login" element={<LoginPage />} />
          <Route path="new-user" element={<NewUserPage />} />
          <Route path="me" element={<UserPage />} />
          <Route path="users/:username" element={<UserProfilePage />} />

          {/* Catch-all */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
