/**
 * Ensure conservative release flags exist for next dev before Playwright webServer.
 * Clears .next so NEXT_PUBLIC_* are re-inlined.
 */
import fs from "node:fs";
import path from "node:path";

const FLAGS = `# Phase 6.1 E2E conservative flags — auto-generated, gitignored via .env*.local
NEXT_PUBLIC_E2E_CONSERVATIVE_FLAGS=true
NEXT_PUBLIC_FF_LEGACY_MENU=false
NEXT_PUBLIC_FF_NEW_DIARY=true
NEXT_PUBLIC_FF_SAJU_SNAPSHOT=true
NEXT_PUBLIC_FF_PERSONALIZATION_TRAIN=false
NEXT_PUBLIC_FF_PERSONALIZATION_DISPLAY=false
NEXT_PUBLIC_FF_PERSONALIZATION=false
NEXT_PUBLIC_FF_NEW_ANALYSIS=true
NEXT_PUBLIC_FF_ANALYSIS_NARRATIVE_LLM=false
FF_ANALYSIS_NARRATIVE_LLM=false
NEXT_PUBLIC_FF_ANALYSIS_CACHE=false
`;

const root = process.cwd();
fs.writeFileSync(path.join(root, ".env.development.local"), FLAGS, "utf8");
try {
  fs.rmSync(path.join(root, ".next"), { recursive: true, force: true });
} catch {
  /* ignore */
}
console.log("e2e flags written; .next cleared");
