// 2026-11-17 "빠지면 코드가 넣기" 미리보기 — 이미 쓴 시안(모델 호출 없음)에 placeRecordLine을 대어 둘째 문단이 어떻게 읽히는지 본다.
// 실행 (apps/diary): V5_OUT=<시안 폴더> npx vitest run --config vitest.scripts.config.ts scripts/fortune-record-place-preview.migrate.ts
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { test } from "vitest";
import { placeRecordLine } from "@/lib/fortune/recall";

test("기록 넣기 미리보기", () => {
  const dir = process.env.V5_OUT!;
  const md = ["# 기록 한 줄 — 빠지면 코드가 넣은 모습 (모델 호출 없음)", "", "둘째 문단만. **굵은 문장**이 코드가 넣은 기록 한 줄이다. 모델이 이미 녹인 날은 \"녹임\"으로 적었다.", ""];
  for (const f of readdirSync(path.join(dir, "시안")).filter((x) => x.endsWith(".json")).sort()) {
    const s = JSON.parse(readFileSync(path.join(dir, "시안", f), "utf8")) as { date: string; band: string; text: { headline: string; body: string }; bodySentences?: string[]; split?: number; record?: { text: string } };
    if (!s.record) continue;
    const before = s.bodySentences ?? s.text.body.split(/(?<=[.!?])\s+/);
    const split = s.split ?? s.text.body.split("\n\n")[0]!.split(/(?<=[.!?])\s+/).length;
    const after = placeRecordLine(before, split, s.record.text);
    const added = after.length > before.length;
    md.push(`## ${s.date.slice(5)} · ${s.band} · ${s.text.headline}${added ? "" : " — 녹임"}`, "", "> " + after.slice(split).map((x) => (added && x === s.record!.text ? `**${x}**` : x)).join(" "), "");
  }
  writeFileSync(path.join(dir, "기록넣기_미리보기.md"), md.join("\n"), "utf8");
  console.log(md.join("\n"));
});
