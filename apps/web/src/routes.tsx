import { Route, Routes } from "react-router";
import { App } from "./App";
import { RequireAuth } from "./auth/RequireAuth";
import { AuthCallbackPage } from "./pages/AuthCallbackPage";
import { HomePage } from "./pages/HomePage";
import { JobProgressPage } from "./pages/JobProgressPage";
import { LoginPage } from "./pages/LoginPage";
import { NotFoundPage } from "./pages/NotFoundPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<App />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/jobs/:jobId" element={<JobProgressPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
