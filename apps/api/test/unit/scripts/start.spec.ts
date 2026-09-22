import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * `scripts/start.sh` is Render's start command: it migrates, then becomes the
 * server. Its two steps are swapped for stand-ins through `MIGRATE_CMD` and
 * `START_CMD`, so these tests need neither a database nor a built app.
 */
const wrapper = resolve(__dirname, "../../../scripts/start.sh");

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "olc-start-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** Writes a stand-in Node script and returns the command line that runs it. */
function standIn(name: string, source: string): string {
  const file = join(dir, name);
  writeFileSync(file, source);
  return `node ${file}`;
}

describe("start.sh", () => {
  it("exits with the migration's failure code and never starts the server", () => {
    const startedMarker = join(dir, "server-started");
    const result = spawnSync("sh", [wrapper], {
      encoding: "utf8",
      env: {
        ...process.env,
        MIGRATE_CMD: standIn("migrate.js", "process.exit(3);"),
        START_CMD: standIn(
          "server.js",
          `require("node:fs").writeFileSync(${JSON.stringify(startedMarker)}, "");`,
        ),
      },
    });

    expect(result.status).toBe(3);
    expect(existsSync(startedMarker)).toBe(false);
  });

  it("starts the server after a successful migration, as the process Render signals", async () => {
    const child = spawn("sh", [wrapper], {
      env: {
        ...process.env,
        MIGRATE_CMD: standIn("migrate.js", `console.log("migrated");`),
        START_CMD: standIn(
          "server.js",
          `process.on("SIGTERM", () => { console.log("server got SIGTERM"); process.exit(0); });
           console.log("server listening");
           setInterval(() => {}, 1000);`,
        ),
      },
    });

    let stdout = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      // Render stops an instance by signalling the start command's process.
      if (stdout.includes("server listening")) child.kill("SIGTERM");
    });
    const [code] = (await once(child, "exit")) as [number | null];

    expect(stdout).toBe("migrated\nserver listening\nserver got SIGTERM\n");
    expect(code).toBe(0);
  });
});
