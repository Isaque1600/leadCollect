import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { AuthProvider } from "./auth/AuthProvider";
import { redirectLegacyTokenFragment } from "./auth/legacy-token-fragment";
import { AppRoutes } from "./routes";

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");

redirectLegacyTokenFragment();

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
