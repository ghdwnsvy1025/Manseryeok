/**
 * 불러오기 멈춤 / 포트 충돌 / .next 캐시 꼬임 복구용 원샷 재시작.
 * 사용: npm.cmd run dev:restart
 *
 * 1) 3000~3003 포트의 기존 Next 프로세스 종료
 * 2) E2E가 남긴 .env.development.local 제거 (플래그가 조용히 꺼지는 원인)
 * 3) .next 캐시 삭제
 * 4) next dev 시작
 */
const { execSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const ports = [3000, 3001, 3002, 3003];

function killPort(port) {
  try {
    if (process.platform === "win32") {
      const out = execSync(`netstat -ano | findstr :${port}`, {
        encoding: "utf8",
      });
      const pids = new Set();
      for (const line of out.split("\n")) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && /^\d+$/.test(pid) && pid !== "0") pids.add(pid);
      }
      for (const pid of pids) {
        try {
          execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
          console.log(`포트 ${port}: PID ${pid} 종료`);
        } catch {
          /* already dead */
        }
      }
    } else {
      execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null`, {
        stdio: "ignore",
        shell: true,
      });
      console.log(`포트 ${port} 정리 시도`);
    }
  } catch {
    /* no process on port */
  }
}

/**
 * .env.development.local은 next dev에서 .env.local보다 우선한다.
 * Playwright(e2e/write-flags.mjs)가 남긴 파일이 그대로 있으면 운세 v2 같은
 * 기능 플래그가 조용히 꺼진 채로 개발하게 되므로 여기서 제거한다.
 */
function removeE2eEnvOverride() {
  const p = path.join(root, ".env.development.local");
  try {
    if (!fs.existsSync(p)) return;
    const text = fs.readFileSync(p, "utf8");
    if (!text.includes("NEXT_PUBLIC_E2E_CONSERVATIVE_FLAGS")) {
      console.log(".env.development.local 유지 (E2E 파일 아님)");
      return;
    }
    fs.rmSync(p, { force: true });
    console.log("E2E 잔여 .env.development.local 제거 (기능 플래그 복구)");
  } catch (e) {
    console.log("env 정리 스킵:", e && e.message ? e.message : e);
  }
}

console.log("1/4 개발 서버 종료 중...");
for (const port of ports) killPort(port);

console.log("2/4 E2E 잔여 env 확인 중...");
removeE2eEnvOverride();

const nextDir = path.join(root, ".next");
console.log("3/4 .next 캐시 삭제 중...");
try {
  fs.rmSync(nextDir, { recursive: true, force: true });
  console.log(".next 삭제 완료");
} catch (e) {
  console.log(".next 삭제 스킵:", e && e.message ? e.message : e);
}

console.log("4/4 next dev 시작...");
const child = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["next", "dev"],
  {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: process.env,
  }
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
