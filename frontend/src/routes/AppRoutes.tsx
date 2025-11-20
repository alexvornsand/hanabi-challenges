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
        <Route element={<MainLayout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/challenges" element={<ChallengeArchivePage />} />
          <Route path="/challenges/:challengeId" element={<ChallengeDetailPage />} />

          {/* Catch-all for unknown paths */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
