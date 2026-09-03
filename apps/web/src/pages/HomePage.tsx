import { useEffect, useState } from "react";
import { getHealth } from "../api";
import { SearchForm } from "../jobs/SearchForm";

type Status = "loading" | "ok" | "error";

/** The signed-in home: start a search from here. */
export function HomePage() {
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    getHealth()
      .then((res) => setStatus(res.status === "ok" ? "ok" : "error"))
      .catch(() => setStatus("error"));
  }, []);

  return (
    <>
      <SearchForm />
      <p>
        API: <strong data-testid="api-status">{status === "loading" ? "checking…" : status}</strong>
      </p>
    </>
  );
}
