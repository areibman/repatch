import { FullConfig } from "@playwright/test";
import { spawn } from "child_process";

function runCommand(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      env,
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
      }
    });
  });
}

export default async function globalSetup(_config: FullConfig) {
  if (process.env.SKIP_DB_SEED === "1") {
    return;
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.warn("Skipping database seeding because Supabase environment variables are missing.");
    return;
  }

  await runCommand("bun", ["run", "db:seed"], {
    ...process.env,
    NODE_ENV: "test",
  });
}
