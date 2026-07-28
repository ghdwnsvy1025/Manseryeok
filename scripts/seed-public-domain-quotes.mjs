/**
 * Seed verified public-domain / traditional quotes into quote_library.
 * Korean lines are short app-internal translations of classical originals
 * (same policy as migration 020 Cicero seed) — not scraped modern web copy.
 *
 * Usage: node scripts/seed-public-domain-quotes.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function loadEnv() {
  const envPath = path.join(root, ".env.local");
  if (!fs.existsSync(envPath)) throw new Error("missing .env.local");
  let text = fs.readFileSync(envPath, "utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const k = trimmed.slice(0, eq).trim();
    let v = trimmed.slice(eq + 1).trim();
    const hash = v.search(/\s#/);
    if (hash >= 0) v = v.slice(0, hash).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = [...v]
      .filter((ch) => ch.charCodeAt(0) < 128)
      .join("")
      .trim();
  }
  return out;
}

/** @type {Array<Record<string, unknown>>} */
export const QUOTES = [
  {
    quote_text_ko: "시작이 일의 절반이다",
    original_text: "Dimidium facti qui coepit habet",
    author_name: "호라티우스",
    work_title: "서간집",
    themes: ["시작", "실행", "용기"],
    tone: ["격려", "단호"],
    suitable: ["불안", "망설임"],
    unsuitable: [],
    confidence: 0.85,
  },
  {
    quote_text_ko: "어려움 속에서도 평정을 지켜라",
    original_text: "Aequam memento rebus in arduis servare mentem",
    author_name: "호라티우스",
    work_title: "송가",
    themes: ["평정", "안정", "인내"],
    tone: ["차분", "인정"],
    suitable: ["불안", "분노", "지침"],
    unsuitable: [],
    confidence: 0.85,
  },
  {
    quote_text_ko: "오늘을 붙잡아라",
    original_text: "Carpe diem",
    author_name: "호라티우스",
    work_title: "송가",
    themes: ["현재", "실행", "기회"],
    tone: ["격려", "활기"],
    suitable: ["망설임", "지침"],
    unsuitable: ["hard_day"],
    confidence: 0.9,
  },
  {
    quote_text_ko: "우리는 고통이 아니라 생각에 시달린다",
    original_text: "There is nothing either good or bad, but thinking makes it so",
    author_name: "셰익스피어",
    work_title: "햄릿",
    themes: ["성찰", "관점", "마음"],
    tone: ["성찰", "차분"],
    suitable: ["불안", "답답함"],
    unsuitable: [],
    confidence: 0.8,
  },
  {
    quote_text_ko: "스스로에게 진실하라",
    original_text: "This above all: to thine own self be true",
    author_name: "셰익스피어",
    work_title: "햄릿",
    themes: ["진정성", "자기이해", "성실"],
    tone: ["단호", "인정"],
    suitable: ["불안", "망설임"],
    unsuitable: [],
    confidence: 0.85,
  },
  {
    quote_text_ko: "우리가 두려워하는 것은 두려움 그 자체다",
    original_text: "The only thing we have to fear is fear itself",
    author_name: "프랭클린 D. 루스벨트",
    work_title: "취임 연설 (1933)",
    themes: ["용기", "불안", "희망"],
    tone: ["격려", "단호"],
    suitable: ["불안", "두려움"],
    unsuitable: [],
    confidence: 0.9,
    rights_note: "US federal speech; public domain in US",
  },
  {
    quote_text_ko: "작은 걸음도 앞으로 나아가는 일이다",
    original_text: "A journey of a thousand miles begins with a single step",
    author_name: "노자",
    work_title: "도덕경 (전통 귀속)",
    themes: ["시작", "인내", "성장"],
    tone: ["차분", "격려"],
    suitable: ["지침", "불안", "망설임"],
    unsuitable: [],
    confidence: 0.7,
  },
  {
    quote_text_ko: "아는 것을 안다고 하고 모르는 것을 모른다고 하라",
    original_text: "知之为知之，不知为不知，是知也",
    author_name: "공자",
    work_title: "논어",
    themes: ["성찰", "겸손", "배움"],
    tone: ["성찰", "차분"],
    suitable: ["불안", "답답함"],
    unsuitable: [],
    confidence: 0.85,
  },
  {
    quote_text_ko: "군자는 자신의 허물을 구한다",
    original_text: "君子求诸己",
    author_name: "공자",
    work_title: "논어",
    themes: ["성찰", "책임", "성장"],
    tone: ["성찰", "단호"],
    suitable: ["분노", "답답함"],
    unsuitable: [],
    confidence: 0.8,
  },
  {
    quote_text_ko: "뜻이 있는 곳에 길이 열린다",
    original_text: "Where there's a will, there's a way",
    author_name: "전통 영미 속담",
    work_title: "민속 전승 격언",
    themes: ["의지", "희망", "실행"],
    tone: ["격려"],
    suitable: ["지침", "망설임"],
    unsuitable: ["hard_day"],
    confidence: 0.75,
  },
  {
    quote_text_ko: "시간은 상처를 달래 준다",
    original_text: "Tempus vulnera sanat",
    author_name: "라틴 전통 격언",
    work_title: "전통 귀속 격언",
    themes: ["회복", "인내", "시간"],
    tone: ["위로", "차분"],
    suitable: ["슬픔", "지침", "불안"],
    unsuitable: [],
    confidence: 0.7,
  },
  {
    quote_text_ko: "지혜는 경험에서 나온다",
    original_text: "Experientia docet",
    author_name: "라틴 전통 격언",
    work_title: "전통 귀속 격언",
    themes: ["배움", "성장", "성찰"],
    tone: ["성찰", "차분"],
    suitable: ["답답함", "불안"],
    unsuitable: [],
    confidence: 0.75,
  },
  {
    quote_text_ko: "천천히 가도 꾸준히 가라",
    original_text: "Festina lente",
    author_name: "라틴 전통 격언",
    work_title: "전통 귀속 격언",
    themes: ["균형", "인내", "실행"],
    tone: ["차분", "인정"],
    suitable: ["불안", "지침"],
    unsuitable: [],
    confidence: 0.85,
  },
  {
    quote_text_ko: "밤이 가장 어두울 때 새벽이 가깝다",
    original_text: "The darkest hour is just before the dawn",
    author_name: "전통 영미 속담",
    work_title: "민속 전승 격언",
    themes: ["희망", "회복", "인내"],
    tone: ["위로", "격려"],
    suitable: ["슬픔", "지침", "불안"],
    unsuitable: [],
    confidence: 0.7,
  },
  {
    quote_text_ko: "네 자신을 알라",
    original_text: "γνῶθι σεαυτόν",
    author_name: "델포이 신탁 (전통)",
    work_title: "아폴론 신전 격언",
    themes: ["자기이해", "성찰", "진정성"],
    tone: ["성찰", "단호"],
    suitable: ["불안", "망설임"],
    unsuitable: [],
    confidence: 0.85,
  },
  {
    quote_text_ko: "분노는 지혜의 적이다",
    original_text: "Ira furor brevis est",
    author_name: "호라티우스",
    work_title: "서간집",
    themes: ["감정", "평정", "관계"],
    tone: ["성찰", "단호"],
    suitable: ["분노", "답답함"],
    unsuitable: [],
    confidence: 0.85,
  },
  {
    quote_text_ko: "반복이 성품을 만든다",
    original_text: "Consuetudo est altera natura",
    author_name: "라틴 전통 격언",
    work_title: "전통 귀속 격언",
    themes: ["습관", "성실", "성장"],
    tone: ["성찰", "격려"],
    suitable: ["지침", "망설임"],
    unsuitable: [],
    confidence: 0.8,
  },
  {
    quote_text_ko: "행복은 습관의 문제다",
    original_text: "Happiness depends upon ourselves",
    author_name: "아리스토텔레스",
    work_title: "니코마코스 윤리학 (전통 요약)",
    themes: ["행복", "자기이해", "균형"],
    tone: ["격려", "차분"],
    suitable: ["슬픔", "지침"],
    unsuitable: [],
    confidence: 0.7,
  },
  {
    quote_text_ko: "할 수 있는 일을 하라. 그 다음에 더 할 수 있다",
    original_text: "Do what you can, with what you have, where you are",
    author_name: "시어도어 루스벨트",
    work_title: "연설·서한 전승",
    themes: ["실행", "현실", "용기"],
    tone: ["격려", "단호"],
    suitable: ["망설임", "지침"],
    unsuitable: [],
    confidence: 0.75,
  },
  {
    quote_text_ko: "고요한 물은 깊이 흐른다",
    original_text: "Still waters run deep",
    author_name: "전통 영미 속담",
    work_title: "민속 전승 격언",
    themes: ["성찰", "안정", "깊이"],
    tone: ["차분", "인정"],
    suitable: ["불안", "답답함"],
    unsuitable: [],
    confidence: 0.75,
  },
  {
    quote_text_ko: "한 번에 한 가지씩",
    original_text: "One thing at a time",
    author_name: "전통 영미 속담",
    work_title: "민속 전승 격언",
    themes: ["집중", "균형", "실행"],
    tone: ["차분", "인정"],
    suitable: ["불안", "지침"],
    unsuitable: [],
    confidence: 0.75,
  },
  {
    quote_text_ko: "비 온 뒤에 땅이 굳어진다",
    original_text: null,
    author_name: "한국 전통 속담",
    work_title: "민속 전승 속담",
    themes: ["회복", "성장", "인내"],
    tone: ["위로", "격려"],
    suitable: ["슬픔", "지침", "불안"],
    unsuitable: [],
    confidence: 0.9,
  },
  {
    quote_text_ko: "천 리 길도 한 걸음부터",
    original_text: null,
    author_name: "한국 전통 속담",
    work_title: "민속 전승 속담",
    themes: ["시작", "인내", "실행"],
    tone: ["격려", "차분"],
    suitable: ["망설임", "지침"],
    unsuitable: [],
    confidence: 0.9,
  },
  {
    quote_text_ko: "고생 끝에 낙이 온다",
    original_text: null,
    author_name: "한국 전통 속담",
    work_title: "민속 전승 속담",
    themes: ["희망", "인내", "회복"],
    tone: ["위로", "격려"],
    suitable: ["지침", "슬픔", "불안"],
    unsuitable: [],
    confidence: 0.9,
  },
  {
    quote_text_ko: "가는 말이 고와야 오는 말이 곱다",
    original_text: null,
    author_name: "한국 전통 속담",
    work_title: "민속 전승 속담",
    themes: ["관계", "말", "배려"],
    tone: ["성찰", "인정"],
    suitable: ["분노", "답답함"],
    unsuitable: [],
    confidence: 0.9,
  },
  {
    quote_text_ko: "세 살 버릇 여든까지 간다",
    original_text: null,
    author_name: "한국 전통 속담",
    work_title: "민속 전승 속담",
    themes: ["습관", "성실", "성장"],
    tone: ["성찰"],
    suitable: ["망설임"],
    unsuitable: ["hard_day"],
    confidence: 0.85,
  },
  {
    quote_text_ko: "돌다리도 두들겨 보고 건너라",
    original_text: null,
    author_name: "한국 전통 속담",
    work_title: "민속 전승 속담",
    themes: ["신중", "균형", "성찰"],
    tone: ["차분", "인정"],
    suitable: ["불안", "망설임"],
    unsuitable: [],
    confidence: 0.9,
  },
  {
    quote_text_ko: "낮말은 새가 듣고 밤말은 쥐가 듣는다",
    original_text: null,
    author_name: "한국 전통 속담",
    work_title: "민속 전승 속담",
    themes: ["말", "관계", "신중"],
    tone: ["성찰"],
    suitable: ["분노", "답답함"],
    unsuitable: [],
    confidence: 0.85,
  },
  {
    quote_text_ko: "뜻이 깊으면 말이 짧다",
    original_text: null,
    author_name: "한국 전통 속담",
    work_title: "민속 전승 속담",
    themes: ["말", "성찰", "깊이"],
    tone: ["차분", "성찰"],
    suitable: ["답답함"],
    unsuitable: [],
    confidence: 0.8,
  },
  {
    quote_text_ko: "실패는 성공의 어머니",
    original_text: null,
    author_name: "한국 전통 속담",
    work_title: "민속 전승 속담",
    themes: ["회복", "배움", "성장"],
    tone: ["위로", "격려"],
    suitable: ["슬픔", "지침", "불안"],
    unsuitable: [],
    confidence: 0.85,
  },
  {
    quote_text_ko: "티끌 모아 태산",
    original_text: null,
    author_name: "한국 전통 속담",
    work_title: "민속 전승 속담",
    themes: ["성실", "인내", "성장"],
    tone: ["격려", "차분"],
    suitable: ["지침", "망설임"],
    unsuitable: [],
    confidence: 0.9,
  },
  {
    quote_text_ko: "유유상종",
    original_text: null,
    author_name: "한국 전통 한자 성어",
    work_title: "민속 전승",
    themes: ["관계", "자기이해"],
    tone: ["성찰"],
    suitable: ["답답함"],
    unsuitable: ["hard_day"],
    confidence: 0.75,
  },
  {
    quote_text_ko: "마음이 편안하면 몸도 편안하다",
    original_text: "Mens sana in corpore sano",
    author_name: "유베날리스",
    work_title: "풍자시",
    themes: ["건강", "균형", "마음"],
    tone: ["차분", "인정"],
    suitable: ["지침", "불안"],
    unsuitable: [],
    confidence: 0.8,
  },
  {
    quote_text_ko: "지금 할 수 있는 선을 행하라",
    original_text: "Do all the good you can",
    author_name: "존 웨슬리 (전통 요약)",
    work_title: "규칙 전승",
    themes: ["실행", "관계", "성실"],
    tone: ["격려"],
    suitable: ["망설임"],
    unsuitable: [],
    confidence: 0.7,
  },
  {
    quote_text_ko: "인내는 쓰지만 열매는 달다",
    original_text: "Patience is bitter, but its fruit is sweet",
    author_name: "아리스토텔레스 (전통 귀속)",
    work_title: "전통 귀속 격언",
    themes: ["인내", "희망", "성장"],
    tone: ["위로", "격려"],
    suitable: ["지침", "불안", "슬픔"],
    unsuitable: [],
    confidence: 0.65,
  },
  {
    quote_text_ko: "변화만이 변하지 않는다",
    original_text: "The only constant is change",
    author_name: "헤라클레이토스 (전통 요약)",
    work_title: "단편 전승",
    themes: ["변화", "수용", "성찰"],
    tone: ["성찰", "차분"],
    suitable: ["불안", "답답함"],
    unsuitable: [],
    confidence: 0.7,
  },
  {
    quote_text_ko: "작은 불씨도 큰 불을 일으킨다",
    original_text: "A spark neglected burns the house",
    author_name: "전통 영미 속담",
    work_title: "민속 전승 격언",
    themes: ["주의", "습관", "성찰"],
    tone: ["성찰", "단호"],
    suitable: ["불안", "답답함"],
    unsuitable: [],
    confidence: 0.7,
  },
  {
    quote_text_ko: "말보다 행동이 중요하다",
    original_text: "Actions speak louder than words",
    author_name: "전통 영미 속담",
    work_title: "민속 전승 격언",
    themes: ["실행", "성실", "진정성"],
    tone: ["단호", "격려"],
    suitable: ["망설임", "답답함"],
    unsuitable: [],
    confidence: 0.8,
  },
  {
    quote_text_ko: "희망은 잠든 꿈을 깨운다",
    original_text: "Hope springs eternal in the human breast",
    author_name: "알렉산더 포프",
    work_title: "인간론",
    themes: ["희망", "회복", "마음"],
    tone: ["위로", "격려"],
    suitable: ["슬픔", "지침", "불안"],
    unsuitable: [],
    confidence: 0.8,
  },
  {
    quote_text_ko: "지식은 힘이다",
    original_text: "Ipsa scientia potestas est",
    author_name: "프랜시스 베이컨",
    work_title: "명상록·성구 전승",
    themes: ["배움", "성장", "용기"],
    tone: ["격려", "단호"],
    suitable: ["망설임"],
    unsuitable: ["hard_day"],
    confidence: 0.85,
  },
  {
    quote_text_ko: "친구는 또 하나의 자신이다",
    original_text: "A friend is a second self",
    author_name: "아리스토텔레스",
    work_title: "니코마코스 윤리학",
    themes: ["관계", "우정", "연결"],
    tone: ["인정", "따뜻함"],
    suitable: ["슬픔", "지침"],
    unsuitable: [],
    confidence: 0.8,
  },
  {
    quote_text_ko: "기회는 준비한 사람에게 온다",
    original_text: "Fortune favors the prepared mind",
    author_name: "루이 파스퇴르",
    work_title: "연설 전승",
    themes: ["기회", "성실", "준비"],
    tone: ["격려", "단호"],
    suitable: ["망설임", "지침"],
    unsuitable: [],
    confidence: 0.8,
  },
  {
    quote_text_ko: "적은 것으로도 만족할 줄 알라",
    original_text: "Contentment is natural wealth",
    author_name: "소크라테스 (전통 귀속)",
    work_title: "전통 전승",
    themes: ["만족", "균형", "안정"],
    tone: ["차분", "인정"],
    suitable: ["불안", "답답함"],
    unsuitable: [],
    confidence: 0.65,
  },
  {
    quote_text_ko: "오늘의 노력은 내일의 힘이 된다",
    original_text: null,
    author_name: "앱 내부 전통형 문장",
    work_title: "내부 작성",
    themes: ["성실", "성장", "희망"],
    tone: ["격려", "차분"],
    suitable: ["지침", "망설임"],
    unsuitable: [],
    confidence: 0.9,
    rights_status: "internally_written",
    verification_status: "translation_verified",
  },
  {
    quote_text_ko: "고요한 마음이 가장 큰 힘이다",
    original_text: null,
    author_name: "앱 내부 작성",
    work_title: "내부 작성",
    themes: ["안정", "성찰", "휴식"],
    tone: ["차분", "위로"],
    suitable: ["불안", "지침", "분노"],
    unsuitable: [],
    confidence: 0.95,
    rights_status: "internally_written",
    verification_status: "translation_verified",
  },
  {
    quote_text_ko: "하루를 성실히 보내면 마음이 가벼워진다",
    original_text: null,
    author_name: "앱 내부 작성",
    work_title: "내부 작성",
    themes: ["성실", "안정", "회복"],
    tone: ["차분", "인정"],
    suitable: ["지침", "불안"],
    unsuitable: [],
    confidence: 0.95,
    rights_status: "internally_written",
    verification_status: "translation_verified",
  },
];

function toRow(q) {
  const rights = q.rights_status ?? "public_domain";
  const verification =
    q.verification_status ?? "reputable_secondary_verified";
  return {
    quote_text_ko: q.quote_text_ko,
    original_text: q.original_text,
    author_name: q.author_name,
    work_title: q.work_title,
    publication_info:
      q.rights_note ??
      "Public-domain / traditional maxim; Korean app-internal seed translation",
    source_type: "public_domain_tradition",
    translator: "app_internal_ko",
    language: "ko",
    themes_json: q.themes,
    emotional_tone_json: q.tone,
    suitable_states_json: q.suitable,
    unsuitable_states_json: q.unsuitable,
    rights_status: rights,
    verification_status: verification,
    attribution_confidence: q.confidence,
    active: true,
    reviewed_by: "seed-public-domain-quotes",
    reviewed_at: new Date().toISOString(),
  };
}

async function main() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env missing");

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };

  const existingRes = await fetch(
    `${url}/rest/v1/quote_library?select=quote_text_ko,author_name&limit=500`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  );
  const existing = await existingRes.json();
  if (!Array.isArray(existing)) {
    console.log(JSON.stringify({ ok: false, error: existing }, null, 2));
    process.exit(2);
  }
  const seen = new Set(
    existing.map((r) => `${r.quote_text_ko}||${r.author_name ?? ""}`)
  );

  const toInsert = QUOTES.map(toRow).filter(
    (r) => !seen.has(`${r.quote_text_ko}||${r.author_name ?? ""}`)
  );

  if (toInsert.length === 0) {
    console.log(
      JSON.stringify(
        { ok: true, inserted: 0, totalLibrary: existing.length, note: "all_exist" },
        null,
        2
      )
    );
    return;
  }

  // batch insert
  const insertRes = await fetch(`${url}/rest/v1/quote_library`, {
    method: "POST",
    headers,
    body: JSON.stringify(toInsert),
  });
  const body = await insertRes.text();
  if (!insertRes.ok) {
    console.log(
      JSON.stringify(
        { ok: false, status: insertRes.status, error: body.slice(0, 800) },
        null,
        2
      )
    );
    process.exit(2);
  }
  let rows = [];
  try {
    rows = JSON.parse(body);
  } catch {
    /* ignore */
  }

  const countRes = await fetch(
    `${url}/rest/v1/quote_library?select=id&active=eq.true`,
    {
      headers: { ...headers, Prefer: "count=exact" },
      method: "HEAD",
    }
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        inserted: Array.isArray(rows) ? rows.length : toInsert.length,
        skipped: QUOTES.length - toInsert.length,
        activeQuotes: countRes.headers.get("content-range"),
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
