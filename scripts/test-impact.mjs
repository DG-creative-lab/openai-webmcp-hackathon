const isFullGateChange = (file) => [
  "package.json",
  "pnpm-lock.yaml",
  "vite.config.ts",
  "playwright.config.ts",
  "Makefile",
].includes(file)
  || file.startsWith(".github/workflows/")
  || file.startsWith("scripts/")
  || file.startsWith("tsconfig");

const isDocumentation = (file) => file === "README.md"
  || file.startsWith("docs/")
  || file.startsWith(".agents/skills/");

export function selectTargets(files) {
  const targets = new Set(["verify-diff"]);

  for (const file of files) {
    if (isFullGateChange(file)) return ["test-all"];

    if (file.startsWith("src/commerce/") || file.startsWith("src/domain/") || file.startsWith("src/store/") || file.startsWith("src/webmcp/")) {
      targets.add("test-coverage");
      targets.add("build");
      targets.add("test-smoke");
    } else if (file === "src/App.tsx" || file === "src/main.tsx" || file === "src/styles.css" || file === "index.html" || file.startsWith("public/")) {
      targets.add("check");
      targets.add("build");
      targets.add("test-smoke");
    } else if (file.startsWith("tests/adversarial/")) {
      targets.add("test-adversarial");
    } else if (file.startsWith("tests/smoke/")) {
      targets.add("test-smoke");
    } else if (file.startsWith("tests/infrastructure/")) {
      targets.add("test-infrastructure");
    } else if (!isDocumentation(file)) {
      return ["test-all"];
    }
  }

  return [...targets];
}
