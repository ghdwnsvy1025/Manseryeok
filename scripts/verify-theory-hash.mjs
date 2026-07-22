/**
 * Regenerates theory file hash into manifests/versions.json fields (stdout).
 * Does not modify docs/sajubase_final.md.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const p = path.resolve("docs/sajubase_final.md");
if (!fs.existsSync(p)) {
  console.error("missing docs/sajubase_final.md");
  process.exit(1);
}
const buf = fs.readFileSync(p);
const sha256 = crypto.createHash("sha256").update(buf).digest("hex");
const manifestPath = path.resolve("knowledge/saju/manifests/versions.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const expected = manifest.canonicalSource?.sha256;
const ok = expected === sha256;
console.log(
  JSON.stringify(
    {
      ok,
      path: "docs/sajubase_final.md",
      byteLength: buf.length,
      sha256,
      manifestSha256: expected,
      match: ok,
      nextAction: ok
        ? null
        : "원문이 변경됨. manifest sha256을 갱신하고 theoryVersion 재검토.",
    },
    null,
    2
  )
);
if (!ok) process.exitCode = 1;
