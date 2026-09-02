import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { DB, type Database } from "../../../shared/db/db.module";
import type { Job, JobParams } from "../domain/job";
import type { JobProgressPatch, Jobs } from "../domain/jobs.port";
import { jobs, type JobRow } from "./jobs.schema";

/** The stored row and the domain type share a shape; the mapping stays explicit. */
function toJob(row: JobRow): Job {
  return {
    id: row.id,
    userId: row.userId,
    status: row.status,
    params: row.params,
    queriesTotal: row.queriesTotal,
    queriesDone: row.queriesDone,
    leadsFound: row.leadsFound,
    apiCallsUsed: row.apiCallsUsed,
    currentStep: row.currentStep,
    error: row.error,
    createdAt: row.createdAt,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
  };
}

/** The Drizzle-backed implementation of the {@link Jobs} port (ADR-0006/0008). */
@Injectable()
export class DrizzleJobsRepository implements Jobs {
  constructor(@Inject(DB) private readonly db: Database) {}

  async create(userId: string, params: JobParams): Promise<Job> {
    const [row] = await this.db.insert(jobs).values({ userId, params }).returning();
    return toJob(row!);
  }

  async findByIdForUser(id: string, userId: string): Promise<Job | undefined> {
    const [row] = await this.db
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, id), eq(jobs.userId, userId)))
      .limit(1);
    return row && toJob(row);
  }

  async update(id: string, patch: JobProgressPatch): Promise<Job> {
    const [row] = await this.db.update(jobs).set(patch).where(eq(jobs.id, id)).returning();
    return toJob(row!);
  }
}
