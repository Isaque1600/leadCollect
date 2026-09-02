import { Navigate } from "react-router";
import { googleLoginUrl } from "../api";
import { useAuth } from "../auth/AuthProvider";

/** The only thing a signed-out visitor sees: the sign-in call to action. */
export function LoginPage() {
  const { status } = useAuth();

  if (status === "loading") return <p>Loading…</p>;
  if (status === "authenticated") return <Navigate to="/" replace />;

  return (
    <main>
      <h1>Lead Collector</h1>
      <a href={googleLoginUrl} data-testid="google-login">
        Sign in with Google
      </a>
    </main>
  );
}
