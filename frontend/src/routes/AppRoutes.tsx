// src/routes/AppRoutes.tsx
import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MainLayout } from "../layouts/MainLayout";
import { LandingPage } from "../pages/LandingPage";
import { ChallengeArchivePage } from "../pages/ChallengeArchivePage";
import { ChallengeDetailPage } from "../pages/ChallengeDetailPage";
import { NotFoundPage } from "../pages/NotFoundPage";

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          {/* Home */}
          <Route index element={<LandingPage />} />

          {/* Challenges */}
          <Route path="challenges">
            <Route index element={<ChallengeArchivePage />} />
            <Route path=":slug" element={<ChallengeDetailPage />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
