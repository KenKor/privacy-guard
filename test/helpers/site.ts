// Starts the local broker A stand-in (scripts/site.ts) on a free port, as `npm run site` runs it.
import { spawn } from "node:child_process";

export interface RunningSite {
  /** e.g. http://localhost:41234/ */
  url: string;
  /** Everything the site printed so far, stdout and stderr. */
  output: () => string;
  stop: () => void;
}

export function startSite(): Promise<RunningSite> {
  const site = spawn(process.execPath, ["scripts/site.ts"], { env: { ...process.env, PORT: "0" } });
  let output = "";
  site.stderr.on("data", (chunk) => (output += chunk));
  return new Promise((resolve, reject) => {
    site.on("exit", (code) => reject(new Error(`site exited with ${code}: ${output}`)));
    site.stdout.on("data", (chunk) => {
      output += chunk;
      const match = /http:\/\/localhost:\d+\//.exec(output);
      if (match) resolve({ url: match[0], output: () => output, stop: () => site.kill() });
    });
  });
}
