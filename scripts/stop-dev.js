/**
 * 로컬 Next.js dev 서버 종료 (Windows/macOS/Linux)
 * 사용: npm run dev:stop
 */
const { execSync } = require("child_process");
const ports = [3000, 3001, 3002, 3003];

function killPort(port) {
  try {
    if (process.platform === "win32") {
      const out = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf8" });
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
      execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null`, { stdio: "ignore", shell: true });
      console.log(`포트 ${port} 정리 시도`);
    }
  } catch {
    /* no process on port */
  }
}

console.log("개발 서버 종료 중...");
for (const port of ports) killPort(port);
console.log("완료. 이제 터미널에 입력하거나 npm run dev:clean 을 실행하세요.");
