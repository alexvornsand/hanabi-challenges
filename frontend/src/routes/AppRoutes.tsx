// src/routes/AppRoutes.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MainLayout } from '../layouts/MainLayout';
import { LandingPage } from '../pages/LandingPage';
import { AboutPage } from '../pages/AboutPage';
import { AboutFAQPage } from '../pages/AboutFAQPage';
import { EventArchivePage } from '../pages/EventArchivePage';
import { EventDetailPage } from '../pages/EventDetailPage';
import { TeamPage } from '../pages/TeamPage';
import { LoginPage } from '../pages/LoginPage';
import { UserPage } from '../pages/UserPage';
import { UserProfilePage } from '../pages/UserProfilePage';
import { NewUserPage } from '../pages/NewUserPage';
import { UserEventsPage } from '../pages/UserEventsPage';
import { UserBadgesPage } from '../pages/UserBadgesPage';
import { AdminHomePage } from '../pages/admin/AdminHomePage';
import { AdminCreateEventPage } from '../pages/admin/AdminCreateEventPage';
import { AdminManageUsersPage } from '../pages/admin/AdminManageUsersPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { EventStatsPage } from '../pages/EventStatsPage';

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
        {/* Home */}
        <Route index element={<LandingPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="about/FAQ" element={<AboutFAQPage />} />

          {/* Events */}
          <Route path="events">
            <Route index element={<EventArchivePage />} />
            <Route path=":slug" element={<EventDetailPage />} />
            <Route path=":slug/:teamSize" element={<EventDetailPage />} />
            <Route path=":slug/teams/:teamId" element={<TeamPage />} />
            <Route path=":slug/stats" element={<EventStatsPage />} />
          </Route>

          {/* Auth */}
          <Route path="login" element={<LoginPage />} />
          <Route path="new-user" element={<NewUserPage />} />
          <Route path="me" element={<UserPage />} />
          <Route path="users/:username" element={<UserProfilePage />} />
          <Route path="users/:username/events" element={<UserEventsPage />} />
          <Route path="users/:username/badges" element={<UserBadgesPage />} />

          {/* Admin */}
          <Route path="admin">
            <Route index element={<AdminHomePage />} />
            <Route path="create-event" element={<AdminCreateEventPage />} />
            <Route path="events/:slug/edit" element={<AdminCreateEventPage />} />
            <Route path="manage-users" element={<AdminManageUsersPage />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
