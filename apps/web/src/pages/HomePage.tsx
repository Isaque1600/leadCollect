import { useEffect, useState } from "react";
import { getHealth } from "../api";

type Status = "loading" | "ok" | "error";

/** The signed-in home. Ticket 04 puts the search form here. */
export function HomePage() {
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    getHealth()
      .then((res) => setStatus(res.status === "ok" ? "ok" : "error"))
      .catch(() => setStatus("error"));
  }, []);

  return (
    <p>
      API: <strong data-testid="api-status">{status === "loading" ? "checking…" : status}</strong>
    </p>
  );
}
