import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { AuthProvider } from "./auth/AuthProvider";
import { redirectLegacyTokenFragment } from "./auth/legacy-token-fragment";
import { createQueryClient } from "./query-client";
import { AppRoutes } from "./routes";

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");

redirectLegacyTokenFragment();

const queryClient = createQueryClient();

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
