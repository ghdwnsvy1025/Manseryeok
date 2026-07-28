/**
 * Patch JournalEntry test fixtures to include sajuProfileId.
 * Usage: node scripts/patch-test-saju-profile-id.mjs
 */
import fs from "node:fs";
import path from "node:path";

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

const files = walk(path.resolve("src/__tests__"));
let changed = 0;
for (const f of files) {
  let t = fs.readFileSync(f, "utf8");
  const before = t;
  t = t.replace(
    /userId: ([^,]+),\r?\n(?!\s*sajuProfileId:)(\s*)entryDate:/g,
    "userId: $1,\n$2sajuProfileId: \"p1\",\n$2entryDate:"
  );
  if (t !== before) {
    fs.writeFileSync(f, t);
    changed += 1;
    console.log("patched", f);
  }
}
console.log(JSON.stringify({ changed }));
