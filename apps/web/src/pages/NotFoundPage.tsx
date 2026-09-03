import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <main>
      <h1 data-testid="not-found">Page not found</h1>
      <Link to="/">Back to Lead Collector</Link>
    </main>
  );
}
