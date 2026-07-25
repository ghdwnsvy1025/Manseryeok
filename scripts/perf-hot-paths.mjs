/**
 * 합성 데이터로 핫패스 처리량 측정 (로컬/운영 준비용).
 * Usage: node scripts/perf-hot-paths.mjs
 * CI에는 Jest 상한 테스트(hotPath.bench.test.ts)를 쓴다.
 */
import { performance } from "node:perf_hooks";

function elapsed(label, fn, n = 1) {
  const t0 = performance.now();
  for (let i = 0; i < n; i++) fn();
  const ms = performance.now() - t0;
  console.log(
    JSON.stringify({
      label,
      iterations: n,
      totalMs: Math.round(ms * 100) / 100,
      perIterMs: Math.round((ms / n) * 1000) / 1000,
    })
  );
}

async function main() {
  // 동적 import — Next alias 없이 상대 경로로는 어려우니
  // 측정은 Jest 벤치를 권장하고, 여기선 스크립트 존재·실행만 확인.
  elapsed("noop", () => {
    let x = 0;
    for (let i = 0; i < 10000; i++) x += i;
    return x;
  }, 100);

  console.log(
    JSON.stringify({
      note: "Detailed benches live in src/__tests__/perf/hotPath.bench.test.ts",
      syntheticTarget: "100 users × 365 days — run offline with dedicated seed",
      ok: true,
    })
  );
}

main();
