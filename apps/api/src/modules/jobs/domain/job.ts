import type { JobStatus } from "@olc/types";

export type { JobStatus };

/**
 * The structured search a user starts a Job with. Ticket 06 adds a `sources`
 * list here; today every Job runs the Maps Source.
 */
export interface JobParams {
  businessType: string;
  city: string;
  state: string;
  maxResults: number;
}

/**
 * One execution of a search (CONTEXT.md: Job). Status and progress live on the
 * row and the SPA polls them — there is no queue and no worker (ADR-0003).
 *
 * Plain types, no decorators, no imports from `infra/` (ADR-0008). The database
 * owns `id`, `createdAt` and the progress defaults.
 */
export interface Job {
  id: string;
  userId: string;
  status: JobStatus;
  params: JobParams;
  queriesTotal: number;
  queriesDone: number;
  leadsFound: number;
  /** Billable Calls spent so far — Places *details* requests (CONTEXT.md). */
  apiCallsUsed: number;
  currentStep: string | null;
  error: string | null;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
}

/** A Job stops being polled once it reaches one of these. */
const TERMINAL_STATUSES: readonly JobStatus[] = ["done", "failed", "cancelled"];

export function isTerminal(status: JobStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/** One composed search, plus the business type its Leads should be tagged with. */
export interface ComposedQuery {
  text: string;
  businessType: string;
}

/**
 * Turns the structured params into the text queries the Sources are asked.
 * The Python collector kept these hand-written in `config.py` as
 * `MAPS_BUSCAS`; the app composes them from what the user typed instead.
 *
 * The shape is `"{businessType} em {city} {state}"`, in Portuguese because that
 * is the language the Places search is issued in. A list is returned even
 * though today it holds exactly one query — `queriesTotal` and the progress bar
 * are already counted per query, and tickets 06/07 add more.
 */
export function composeQueries(params: JobParams): ComposedQuery[] {
  const businessType = params.businessType.trim();
  const city = params.city.trim();
  const state = params.state.trim();
  const location = [city, state].filter(Boolean).join(" ");

  return [
    {
      text: location ? `${businessType} em ${location}` : businessType,
      businessType,
    },
  ];
}
