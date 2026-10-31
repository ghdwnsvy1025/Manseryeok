// 링크 미리보기 이미지(카톡·스레드·인스타 og:image) — 앱 아이콘 D안 "붓 한 획 초승달"과 같은 그림 (2026-10-23)
//   node scripts/build-og.mjs
//   public/og.jpg     1200×630  layout.tsx metadata.openGraph.images
//   public/kakao.jpg   800×800  카카오 피드 템플릿 규격(최대 800×800) — 지금은 og.jpg만 쓰고 보관
// 재료: public/ui/paper-bg.webp(한지), 에셋/사주 일기/icons/brush-moon-cutout.png(초승달 컷아웃, 투명).
// 글꼴: 제목은 송명 대신 시스템 명조(함초롬바탕), 본문은 맑은 고딕 — 빌드 머신(Windows)에 있는 것. 다른 머신이면 fontconfig가 대체한다.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// 2026-10-23: 별 점 자리(초승달 품 안)에 작은 네모 인장(ui-kit seal-collected) — 달이 품은 도장. 귀퉁이 낙관·달 끝 걸침은 비교 뒤 탈락
const CUTOUT = path.resolve(ROOT, "../../../../에셋/사주 일기/icons/brush-moon-seal-in-arc-cutout.png");
const PAPER_TILE = path.join(ROOT, "public", "ui", "paper-bg.webp");
const SERIF = "'HCR Batang','함초롬바탕','Song Myung',serif";
const SANS = "'Malgun Gothic','맑은 고딕',sans-serif";
const PAPER = "#f3e7c9", INK = "#2a2118", SOFT = "#6b5d4d", LINE = "#7f8c4b";
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);

async function paper(W, H) {
  if (existsSync(PAPER_TILE)) return sharp(await sharp(PAPER_TILE).resize(W, H, { fit: "cover" }).toBuffer());
  return sharp({ create: { width: W, height: H, channels: 3, background: PAPER } });
}

const TITLE = "사주카우 일기";
const SUB = ["밤에 한 줄 쓰면,", "내 기록으로 운세가 점점 내 것이 돼요"];

/** 1200×630: 왼쪽 초승달(높이 76%), 오른쪽 글 — 왼맞춤, 제목 아래 녹갈 괘선 한 줄 */
async function wide(out) {
  const W = 1200, H = 630;
  const moonH = Math.round(H * 0.76);
  const moon = await sharp(CUTOUT).resize({ height: moonH, fit: "inside" }).toBuffer();
  const moonW = (await sharp(moon).metadata()).width;
  const x = 560;
  const svg = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <text x="${x}" y="268" font-family="${SERIF}" font-size="78" font-weight="400" fill="${INK}">${esc(TITLE)}</text>
    <line x1="${x}" y1="304" x2="${x + 540}" y2="304" stroke="${LINE}" stroke-width="2" opacity=".75"/>
    <text x="${x}" y="368" font-family="${SANS}" font-size="33" fill="${SOFT}">${esc(SUB[0])}</text>
    <text x="${x}" y="418" font-family="${SANS}" font-size="33" fill="${SOFT}">${esc(SUB[1])}</text>
  </svg>`);
  const img = await (await paper(W, H))
    .composite([{ input: moon, left: Math.round(300 - moonW / 2), top: Math.round((H - moonH) / 2) }, { input: svg, left: 0, top: 0 }])
    .jpeg({ quality: 90 })
    .toBuffer();
  writeFileSync(out, img);
  console.log(`${path.relative(ROOT, out)} ${W}×${H}`);
}

/** 800×800: 위 초승달(높이 52%), 아래 글 가운데 */
async function square(out) {
  const W = 800, H = 800;
  const moonH = Math.round(H * 0.52);
  const moon = await sharp(CUTOUT).resize({ height: moonH, fit: "inside" }).toBuffer();
  const moonW = (await sharp(moon).metadata()).width;
  const svg = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <text x="${W / 2}" y="596" text-anchor="middle" font-family="${SERIF}" font-size="66" fill="${INK}">${esc(TITLE)}</text>
    <line x1="250" y1="626" x2="550" y2="626" stroke="${LINE}" stroke-width="2" opacity=".75"/>
    <text x="${W / 2}" y="680" text-anchor="middle" font-family="${SANS}" font-size="28" fill="${SOFT}">${esc(SUB[0])}</text>
    <text x="${W / 2}" y="722" text-anchor="middle" font-family="${SANS}" font-size="28" fill="${SOFT}">${esc(SUB[1])}</text>
  </svg>`);
  const img = await (await paper(W, H))
    .composite([{ input: moon, left: Math.round((W - moonW) / 2), top: 72 }, { input: svg, left: 0, top: 0 }])
    .jpeg({ quality: 90 })
    .toBuffer();
  writeFileSync(out, img);
  console.log(`${path.relative(ROOT, out)} ${W}×${H}`);
}

if (!existsSync(CUTOUT)) throw new Error(`초승달 컷아웃이 없다: ${CUTOUT}`);
mkdirSync(path.join(ROOT, "public"), { recursive: true });
await wide(path.join(ROOT, "public", "og.jpg"));
await square(path.join(ROOT, "public", "kakao.jpg"));
