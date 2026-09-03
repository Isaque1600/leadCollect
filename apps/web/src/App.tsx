import { Link, Outlet } from "react-router";
import { useAuth } from "./auth/AuthProvider";

/**
 * The app shell around every protected route: who is signed in and how to sign
 * out live here, so no feature screen has to carry them.
 */
export function App() {
  const { user, signOut } = useAuth();

  return (
    <div>
      <header>
        <Link to="/">
          <h1>Lead Collector</h1>
        </Link>
        {user ? (
          <p>
            Signed in as <strong data-testid="user-email">{user.email}</strong>{" "}
            <button type="button" onClick={signOut}>
              Log out
            </button>
          </p>
        ) : null}
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
