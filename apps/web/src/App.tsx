import { useEffect, useState } from "react";
import { getHealth } from "./api";

type Status = "loading" | "ok" | "error";

export function App() {
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    getHealth()
      .then((res) => setStatus(res.status === "ok" ? "ok" : "error"))
      .catch(() => setStatus("error"));
  }, []);

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
      <h1>Lead Collector</h1>
      <p>
        API:{" "}
        <strong data-testid="api-status">
          {status === "loading" ? "checking…" : status}
        </strong>
      </p>
    </main>
  );
}
