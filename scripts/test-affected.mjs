import { spawnSync } from "node:child_process";
import { selectTargets } from "./test-impact.mjs";

const args = process.argv.slice(2);
const baseIndex = args.indexOf("--base");
const baseRef = baseIndex >= 0 ? args[baseIndex + 1] : process.env.BASE_REF || "origin/main";
const planOnly = args.includes("--plan");

if (!baseRef || baseRef.startsWith("-")) {
  console.error("A valid --base git ref is required.");
  process.exit(2);
}

function run(command, commandArgs, options = {}) {
  return spawnSync(command, commandArgs, { encoding: "utf8", stdio: "pipe", ...options });
}

const resolvedBase = run("git", ["rev-parse", "--verify", `${baseRef}^{commit}`]);
if (resolvedBase.status !== 0) {
  console.error(`Cannot resolve base ref '${baseRef}'. Fetch it or pass BASE_REF=<ref>.`);
  process.exit(2);
}

const fileCommands = [
  ["diff", "--name-only", "--diff-filter=ACMRTUXB", `${baseRef}...HEAD`],
  ["diff", "--name-only", "--diff-filter=ACMRTUXB"],
  ["diff", "--cached", "--name-only", "--diff-filter=ACMRTUXB"],
  ["ls-files", "--others", "--exclude-standard"],
];
const files = new Set();
for (const commandArgs of fileCommands) {
  const result = run("git", commandArgs);
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
  result.stdout.split("\n").map((file) => file.trim()).filter(Boolean).forEach((file) => files.add(file));
}
const changedFiles = [...files].sort();
const plan = selectTargets(changedFiles);
console.log(changedFiles.length ? `Changed files vs ${baseRef}:\n- ${changedFiles.join("\n- ")}` : `No changed files vs ${baseRef}.`);
console.log(`Selected Make target${plan.length === 1 ? "" : "s"}: ${plan.join(", ")}`);

if (planOnly) process.exit(0);

for (const target of plan) {
  const result = spawnSync("make", [target], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
