/**
 * 브라우저 안에서 실행할 "가짜 기록 주입" 코드.
 *
 * 왜 필요한가 — 맞춤도와 성향 카드는 기록이 쌓여야 뭔가 보인다.
 * 갓 가입한 상태에서는 0%라 화면을 봐도 판단할 수가 없다.
 * 그래서 실제 IndexedDB에 기록을 직접 넣고 화면을 다시 그린다.
 *
 * 중요 — 이건 **개발 시연 전용**이다. 앱 코드에는 들어가지 않는다.
 * 그리고 앱이 실제로 쓰는 저장소에 그대로 넣기 때문에,
 * 어댑터(fromJournal.ts)가 실제 저장 형식과 어긋나 있으면 여기서 드러난다.
 */

/**
 * 페이지 안에서 돌 함수. Playwright 의 page.evaluate 로 넘긴다.
 *
 * `rows` 는 `scripts/demo-seed.json` 에서 온다. 그 파일은 앱과 같은 사주 엔진으로
 * **그날의 사주 조건에 맞춰** 만들어진 값이다. 요일 기준으로 만들면 카드 조건과
 * 무관해서 전부 "영향 없었습니다"가 나온다 (실제로 그렇게 나왔었다).
 *
 * @param {{ profileId: string, rows: Array<{date: string, metrics: Record<string, number>}> }} opts
 */
export function seedInPage(opts) {
  const { profileId, rows: source } = opts;

  const DB_NAME = "manseryeok-journal";
  const DB_VERSION = 2;
  const STORE = "journal_entries";

  const CORE = ["energy", "focus_execution", "physical_condition", "emotional_balance"];
  const DOMAINS = ["recovery_sleep", "work_study", "relationship", "finance_resource", "change_opportunity"];
  const MOODS = ["기쁨", "뿌듯함", "설렘", "평온", "무덤덤", "지침", "답답함", "짜증남", "불안", "분노", "슬픔", "우울함", "후회스러움"];

  // 재현 가능한 난수 — 기분 태그 고르는 데만 쓴다 (지표 값은 rows 가 정한다)
  let state = 20260909;
  const rng = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0x100000000;
  };

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const pick = (arr) => arr[Math.floor(rng() * arr.length) % arr.length];

  /** 1~5 서열 → 1~10 점수 (앱의 ordinalToJournalScore 와 같은 표) */
  const ORD_TO_SCORE = { 1: 1, 2: 3, 3: 5, 4: 8, 5: 10 };

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const s = db.createObjectStore(STORE, { keyPath: "id" });
          s.createIndex("entryDate", "entryDate", { unique: false });
          s.createIndex("updatedAt", "updatedAt", { unique: false });
          s.createIndex("profileDate", "profileDateKey", { unique: true });
        }
      };
    });
  }

  function dateStr(offsetFromToday) {
    const d = new Date();
    d.setDate(d.getDate() + offsetFromToday);
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  const rows = [];
  for (const src of source) {
    const entryDate = src.date;
    const m = src.metrics ?? {};

    // 핵심 4 — 값이 없으면 그날 안 물어본 것으로 보고 보통(3)을 쓴다
    const coreStates = {};
    const scores = [];
    for (const code of CORE) {
      const ordinal = clamp(Math.round(m[code] ?? 3), 1, 5);
      coreStates[code] = { ordinal, isNotApplicable: false };
      scores.push({
        categoryCode: code,
        userScore: ORD_TO_SCORE[ordinal],
        aiScore: null,
        finalScore: ORD_TO_SCORE[ordinal],
        rawScore: ORD_TO_SCORE[ordinal],
        isNotApplicable: false,
      });
    }

    // 조건부 영역 — 값이 실제로 있는 것만 넣는다 (앱도 하루 최대 2개)
    const domainScores = [];
    for (const code of DOMAINS) {
      if (m[code] == null) continue;
      const ordinal = clamp(Math.round(m[code]), 1, 5);
      domainScores.push({ code, ordinal, isNotApplicable: false });
      scores.push({
        categoryCode: code,
        userScore: ORD_TO_SCORE[ordinal],
        aiScore: null,
        finalScore: ORD_TO_SCORE[ordinal],
        rawScore: ORD_TO_SCORE[ordinal],
        isNotApplicable: false,
      });
    }

    const happiness = clamp(Math.round(m.happiness ?? 5), 0, 10);
    const moodCount = 1 + Math.floor(rng() * 3);
    const moodLabels = [];
    for (let m = 0; m < moodCount; m += 1) {
      const mood = pick(MOODS);
      if (!moodLabels.includes(mood)) moodLabels.push(mood);
    }

    const now = new Date().toISOString();
    rows.push({
      id: `seed-${entryDate}`,
      userId: null,
      sajuProfileId: profileId,
      profileDateKey: `${profileId}::${entryDate}`,
      entryDate,
      userTimezone: "Asia/Seoul",
      content: "",
      overallSatisfaction: happiness === 0 ? null : happiness,
      happinessScore: happiness,
      moodLabel: moodLabels[0] ?? null,
      moodLabels,
      mainEventText: null,
      source: "new_diary",
      scores,
      tags: [],
      coreStates,
      domainScores,
      checkinVersion: 2,
      xpGranted: true,
      xpAwarded: 0,
      schemaVersion: 1,
      firstRecordedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }

  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        const store = tx.objectStore(STORE);
        for (const row of rows) store.put(row);
        tx.oncomplete = () =>
          resolve({
            inserted: rows.length,
            first: rows[0]?.entryDate ?? null,
            last: rows[rows.length - 1]?.entryDate ?? null,
          });
        tx.onerror = () => reject(tx.error);
      })
  );
}
