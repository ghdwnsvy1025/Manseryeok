/**
 * 신규 사용자 흐름을 자동으로 밟으며 화면을 찍는다.
 *
 * 왜 필요한가 — Claude 앱 안의 브라우저는 앱 창이 가려지면 화면을 그리지 않아
 * 스크린샷을 찍을 수 없다. 이 스크립트는 창 없이 도는 브라우저(headless)를 쓰므로
 * 창 상태와 무관하게 항상 찍힌다.
 *
 * 쓰는 법
 *   node scripts/shoot-flow.mjs                 (기본: localhost:3000)
 *   node scripts/shoot-flow.mjs --port 3001
 *   node scripts/shoot-flow.mjs --out ./shots
 *   node scripts/shoot-flow.mjs --desktop       (기본은 모바일 크기)
 */
import { chromium } from "@playwright/test";
import { seedInPage } from "./seed-browser.mjs";
import fs from "node:fs";
import path from "node:path";

// ── 옵션 ──────────────────────────────────────
const args = process.argv.slice(2);
function opt(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}
const PORT = opt("port", "3000");
const OUT = path.resolve(opt("out", "shots"));
const DESKTOP = args.includes("--desktop");
/** 가짜 기록 일수 (0 이면 주입 안 함) */
const SEED_DAYS = Number(opt("seed", "0")) || 0;
/** truth | inverted | unrelated */
const SEED_WORLD = opt("world", "truth");
/**
 * --today 를 주면 오늘 기록까지 넣는다 → "기록을 마친 뒤" 홈이 나온다.
 * 기본은 오늘을 빼서 "아직 기록 전" 홈을 찍는다.
 */
const SEED_TODAY = args.includes("--today");
/** 브라우저 시계를 이 시각으로 고정 — 시간대별 홈을 찍을 때 쓴다 (예: --now 08:00) */
const NOW_HHMM = opt("now", "");
/**
 * 날짜까지 고정 — 특정 일진(예: 용신일)의 화면을 찍을 때 쓴다.
 * 예: --date 2026-09-16
 */
const NOW_DATE = opt("date", "");
/** --skin off 로 감성 톤을 끈 화면을 찍는다 (before/after 대조용).
    플래그를 껐다 켜며 서버를 재시작하지 않아도 되도록 표시만 지운다. */
const SKIN_OFF = opt("skin", "") === "off";
const BASE = `http://localhost:${PORT}`;

// 테스트용 가상 생일 (실제 개인정보 아님)
const BIRTH = { year: "1990", month: "5", day: "15", hour: "14", minute: "30" };

fs.mkdirSync(OUT, { recursive: true });

let step = 0;
async function shoot(page, name) {
  step += 1;
  const file = path.join(OUT, `${String(step).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  찍음 → ${path.relative(process.cwd(), file)}`);
  return file;
}

/**
 * 값을 넣고 실제로 들어갔는지 확인한다.
 * 이 폼은 한 칸을 채우면 자동으로 다음 칸으로 포커스가 넘어가서,
 * 그냥 fill 만 하면 값이 밀리거나 비는 일이 있다.
 */
async function fillChecked(locator, value, label) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await locator.click();
    await locator.fill("");
    await locator.fill(value);
    await locator.blur().catch(() => {});
    const got = await locator.inputValue();
    if (got === value) return;
  }
  throw new Error(`${label} 칸에 "${value}" 를 넣지 못했습니다.`);
}

/** 텍스트가 보이면 누른다. 없으면 조용히 넘어간다. */
async function clickIfVisible(page, text, timeout = 3000) {
  const target = page.getByRole("button", { name: text }).first();
  try {
    await target.waitFor({ state: "visible", timeout });
    await target.click();
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log(`\n대상: ${BASE}`);
  console.log(`저장: ${OUT}\n`);

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: DESKTOP ? { width: 1280, height: 900 } : { width: 390, height: 844 },
    deviceScaleFactor: 2,
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
  });
  const page = await context.newPage();

  // 브라우저 안의 "지금"을 고정한다. 홈이 시간대에 따라 갈리므로
  // 아침/밤 화면을 각각 찍으려면 시계를 바꿔줘야 한다.
  if (NOW_HHMM || NOW_DATE) {
    const [hh, mm] = (NOW_HHMM || "12:00").split(":").map((n) => Number(n) || 0);
    const [yy, mo, dd] = NOW_DATE
      ? NOW_DATE.split("-").map((n) => Number(n) || 0)
      : [0, 0, 0];
    await context.addInitScript(
      ({ hh, mm, yy, mo, dd }) => {
        const Real = Date;
        const shift = () => {
          const d = new Real();
          if (yy) d.setFullYear(yy, mo - 1, dd);
          d.setHours(hh, mm, 0, 0);
          return d.getTime() - Real.now();
        };
        const offset = shift();
        // @ts-expect-error 개발 촬영 전용
        window.Date = class extends Real {
          constructor(...args) {
            if (args.length === 0) super(Real.now() + offset);
            else super(...args);
          }
          static now() {
            return Real.now() + offset;
          }
        };
      },
      { hh, mm, yy, mo, dd }
    );
    console.log(`  시계 고정: ${NOW_DATE || "오늘"} ${NOW_HHMM || "12:00"}`);
  }

  if (SKIN_OFF) {
    // SoftThemeGate 가 붙이는 표시를 계속 지운다. CSS 는 이 표시 하나만 보므로
    // 이것만 없으면 플래그를 끈 것과 화면이 같다.
    await context.addInitScript(() => {
      // 이 스크립트는 문서가 만들어지기 전에도 돌아서 documentElement 가 없을 수 있다
      const arm = () => {
        const root = document.documentElement;
        if (!root) {
          requestAnimationFrame(arm);
          return;
        }
        const strip = () => {
          if (root.dataset.skin) delete root.dataset.skin;
        };
        strip();
        new MutationObserver(strip).observe(root, {
          attributes: true,
          attributeFilter: ["data-skin"],
        });
      };
      arm();
    });
    console.log("  감성 톤 OFF 로 촬영");
  }

  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));

  try {
    // 1. 첫 화면
    // 개발 서버는 첫 요청에서 컴파일하느라 오래 걸린다.
    // 고정 대기 대신 "화면이 실제로 준비될 때까지" 기다린다.
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page
      .getByRole("button", { name: /비로그인으로 둘러보기|저장하기/ })
      .first()
      .waitFor({ state: "visible", timeout: 90000 });
    await page.waitForTimeout(1200);
    await shoot(page, "welcome");

    // 2. 안내 팝업 닫고 게스트로 진입
    await clickIfVisible(page, "확인");
    await page.waitForTimeout(500);
    await clickIfVisible(page, "비로그인으로 둘러보기");
    await page.waitForTimeout(2500);
    await clickIfVisible(page, "확인", 1500);
    await page.waitForTimeout(800);
    await shoot(page, "saju-form");

    // 3. 생년월일 입력
    // 성별·달력은 radio 로 뜬다 (button 아님)
    await page.getByRole("radio", { name: "남성" }).click();

    // 이름·년·월·일·시·분 순서대로 놓인 텍스트 입력 6개
    const fields = page.locator('input[type="text"]');
    await fields.first().waitFor({ state: "visible", timeout: 10000 });

    await fillChecked(fields.nth(0), "테스트", "이름");
    await fillChecked(fields.nth(1), BIRTH.year, "년");
    await fillChecked(fields.nth(2), BIRTH.month, "월");
    await fillChecked(fields.nth(3), BIRTH.day, "일");
    await fillChecked(fields.nth(4), BIRTH.hour, "시");
    await fillChecked(fields.nth(5), BIRTH.minute, "분");
    await page.waitForTimeout(400);
    await shoot(page, "saju-form-filled");

    // 4. 저장 → 가설 카드
    await page.getByRole("button", { name: "저장하기" }).click();
    await page.waitForTimeout(4000);
    await shoot(page, "card-01");

    // 5. 카드를 끝까지 넘기며 두 장 더 찍는다
    // 답을 섞는다 — 전부 "맞아요"면 나중에 "짐작과 달라요"가 나오는 화면을 못 본다
    const ANSWER_PATTERN = ["맞아요", "글쎄요", "맞아요", "모르겠어요", "글쎄요"];
    let answered = 0;
    for (let i = 0; i < 15; i += 1) {
      const ok = await clickIfVisible(page, ANSWER_PATTERN[i % ANSWER_PATTERN.length], 2500);
      if (!ok) break;
      answered += 1;
      await page.waitForTimeout(450);
      if (answered === 3) await shoot(page, "card-04");
    }
    await page.waitForTimeout(1200);
    await shoot(page, "card-summary");

    // 6. 홈 — 운세 맞춤도
    await clickIfVisible(page, "오늘 첫 기록 하러 가기", 4000);
    await page.waitForTimeout(3000);
    // 첫 방문 환영 스플래시가 홈을 덮는다 — 걷어내야 홈이 보인다
    await clickIfVisible(page, "오늘의 홈으로", 6000);
    await page.waitForTimeout(2500);
    await clickIfVisible(page, "확인", 2000);
    await page.waitForTimeout(4000);
    await shoot(page, "home");

    // 6-2. 가짜 기록 주입 후 다시 보기 (--seed 30)
    if (SEED_DAYS > 0) {
      const profileId = await page.evaluate(() => {
        try {
          const raw = localStorage.getItem("manseryeok_guest_saju_profiles_v2")
            ?? localStorage.getItem("manseryeok_saju_profiles_v2");
          const list = raw ? JSON.parse(raw) : [];
          return list[0]?.id ?? "local";
        } catch {
          return "local";
        }
      });
      // 사주 조건에 맞춰 미리 만들어둔 값을 쓴다.
      // 만드는 법: WRITE_DEMO_SEED=1 npx jest src/__tests__/hypothesis/demoSeed
      const seedFile = path.join(process.cwd(), "scripts", "demo-seed.json");
      if (!fs.existsSync(seedFile)) {
        throw new Error(
          "scripts/demo-seed.json 이 없습니다. 먼저 만들어 주세요:\n" +
            "  WRITE_DEMO_SEED=1 npx jest src/__tests__/hypothesis/demoSeed"
        );
      }
      const seedData = JSON.parse(fs.readFileSync(seedFile, "utf-8"));
      const all = seedData.worlds?.[SEED_WORLD] ?? [];

      // 시드는 오늘까지 들어 있다. 오늘을 빼면 "기록 전", 두면 "기록 완료 후" 홈이 된다.
      //
      // toISOString() 은 UTC 라 한국 시간과 하루가 어긋난다(자정~오전 9시).
      // 앱의 todayDateString() 과 똑같이 **현지 날짜**로 맞춘다.
      const now = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      const usable = SEED_TODAY ? all : all.filter((r) => r.date !== todayStr);
      const rows = usable.slice(-SEED_DAYS);

      if (SEED_TODAY && !rows.some((r) => r.date === todayStr)) {
        console.log(
          `  ⚠ 시드에 오늘(${todayStr})이 없습니다. "기록 완료 후" 홈이 안 나옵니다.
` +
            "     다시 만들어 주세요: WRITE_DEMO_SEED=1 npx jest src/__tests__/hypothesis/demoSeed"
        );
      }

      console.log(
        `  기록 ${rows.length}일 주입 · 프로필 ${profileId} · 세계 ${SEED_WORLD}` +
          (SEED_TODAY ? " · 오늘 포함" : " · 오늘 제외")
      );

      const result = await page.evaluate(seedInPage, { profileId, rows });
      console.log(`  → ${result.inserted}건 (${result.first} ~ ${result.last})`);

      await page.reload({ waitUntil: "networkidle" });
      await page.waitForTimeout(7000);
      await clickIfVisible(page, "확인", 1500);
      await page.waitForTimeout(1500);
      await shoot(page, `home-seeded-${SEED_WORLD}${SEED_TODAY ? "-done" : ""}`);

      // "내 기록으로 본 오늘" 블록만 따로
      const patternLine = page
        .locator("button")
        .filter({ hasText: "내 기록으로 본 오늘" })
        .first();
      if (await patternLine.isVisible().catch(() => false)) {
        await patternLine.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        step += 1;
        const pf = path.join(OUT, `${String(step).padStart(2, "0")}-today-pattern.png`);
        await patternLine.screenshot({ path: pf });
        console.log(`  찍음 → ${path.relative(process.cwd(), pf)}`);
      } else {
        console.log("  (내 기록으로 본 오늘 블록 없음 — 오늘 해당하는 확인된 날이 없을 수 있음)");
      }

      // 맞춤도 블록만 따로 크게 (홈은 안쪽이 스크롤돼서 전체샷에 안 잡힌다)
      const fitBlock = page.locator("section").filter({ hasText: "운세 맞춤도" }).first();
      if (await fitBlock.isVisible().catch(() => false)) {
        await fitBlock.scrollIntoViewIfNeeded();
        await page.waitForTimeout(600);
        step += 1;
        const f = path.join(OUT, `${String(step).padStart(2, "0")}-fit-block.png`);
        await fitBlock.screenshot({ path: f });
        console.log(`  찍음 → ${path.relative(process.cwd(), f)}`);
      }
    }

    // 7. 맞춤도를 눌러 카드 목록 열기
    const fit = page.getByRole("button", { name: /운세 맞춤도/ }).first();
    if (await fit.isVisible().catch(() => false)) {
      await fit.click();
      await page.waitForTimeout(1200);
      await shoot(page, "card-deck");

      // 짐작과 다르게 나온 카드가 있으면 그걸, 없으면 첫 카드를 펼쳐 대조 문장을 본다
      const differ = page.locator('[role="dialog"] article button', { hasText: "내 짐작과 달라요" }).first();
      const firstCard = (await differ.count()) > 0
        ? differ
        : page.locator('[role="dialog"] article button').first();
      if (await firstCard.isVisible().catch(() => false)) {
        await firstCard.scrollIntoViewIfNeeded().catch(() => {});
        await firstCard.click();
        await page.waitForTimeout(500);
        await shoot(page, "card-open");
        await firstCard.click();
        await page.waitForTimeout(300);
      }

      // 카드가 10장이라 한 화면에 안 들어간다. 아래쪽(확인 중인 카드들)도 찍는다.
      const scroller = page.locator('[role="dialog"] .overflow-y-auto').first();
      if (await scroller.isVisible().catch(() => false)) {
        await scroller.evaluate((el) => el.scrollTo(0, el.scrollHeight));
        await page.waitForTimeout(600);
        await shoot(page, "card-deck-bottom");
      }

      await clickIfVisible(page, "닫기", 2000);
      await page.waitForTimeout(600);
    } else {
      console.log("  (맞춤도 블록을 못 찾음 — 플래그가 꺼져 있는지 확인)");
    }

    // 7-2. 운세를 펼친 화면 — 용신 한 줄이 붙는지 본다
    const openFortune = page
      .getByRole("button", { name: /오늘의 운세 열기/ })
      .first();
    if (await openFortune.isVisible().catch(() => false)) {
      await openFortune.click();
      await page.waitForTimeout(2500);
      await shoot(page, "fortune-open");
      await page.waitForTimeout(300);
    }

    // 8. "나" 탭 — 하단 탭에서 눌러서 들어간다 (링크가 실제로 붙어 있는지도 같이 확인)
    const meTab = page.getByRole("link", { name: /^나$/ }).first();
    if (await meTab.isVisible().catch(() => false)) {
      await meTab.click();
      await page.waitForTimeout(1500);
      await shoot(page, "me-tab");

      // 맞춤도 4축을 펼친 모습
      const axes = page
        .getByRole("button", { name: /무엇이 이 숫자를 만드는지 보기/ })
        .first();
      if (await axes.isVisible().catch(() => false)) {
        await axes.click();
        await page.waitForTimeout(500);
        await shoot(page, "me-tab-axes");
      }
    } else {
      console.log("  (나 탭을 못 찾음 — CALM_HOME 플래그가 꺼져 있는지 확인)");
    }

    // 9. "기록" 탭 — 홈에서 옮겨 온 "최근 나의 상태"가 여기 있는지 본다
    const statsTab = page.getByRole("link", { name: /^기록$/ }).first();
    if (await statsTab.isVisible().catch(() => false)) {
      await statsTab.click();

      // 먼저 기록 탭이 실제로 그려졌는지 확인한다.
      // 이걸 안 하면 다음 줄의 "숨겨졌나?" 검사가 **아직 없는 요소**를 보고
      // 곧바로 참이 되어 버린다 (없는 것 = 숨겨진 것). 한 번 그 함정에 빠졌다.
      await page
        .getByText("기록 캘린더")
        .first()
        .waitFor({ state: "visible", timeout: 20000 })
        .catch(() => console.log("  (기록 탭이 안 뜸)"));

      // "최근 나의 상태"는 LLM 을 부르므로 느리다. 문구가 채워질 때까지 기다린다.
      await page
        .getByText("요즘 흐름을 읽는 중")
        .first()
        .waitFor({ state: "hidden", timeout: 30000 })
        .catch(() => console.log("  (최근 나의 상태가 30초 안에 안 채워짐)"));
      await page.waitForTimeout(800);
      await shoot(page, "stats-tab");
    } else {
      console.log("  (기록 탭을 못 찾음)");
    }

    console.log(`\n완료. 화면 ${step}장.`);
    if (errors.length) {
      console.log(`\n브라우저 콘솔 오류 ${errors.length}건:`);
      for (const e of errors.slice(0, 8)) console.log(`  - ${e.slice(0, 200)}`);
    } else {
      console.log("브라우저 콘솔 오류 없음.");
    }
  } catch (err) {
    console.error("\n실패:", err instanceof Error ? err.message : err);
    await shoot(page, "error").catch(() => {});
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

void main();
