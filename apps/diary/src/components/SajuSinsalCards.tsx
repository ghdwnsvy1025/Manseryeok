import type { ReactNode } from "react";
import type { SinsalChip } from "@/lib/saju/chart";

/**
 * 만세력 낱장의 신살 칸 — 기호 카드 (명세 53, 톤 v3.57). 앱 주인: "만세력의 신살도 가시성이 좋게, 아니면 뜻이 설명되는 이미지를 넣던가 눈에 잘 들어오게".
 * 신살 하나 = 카드 한 장(두 칸 격자): 위에 기호 40px(붓선 인라인 SVG, 녹갈 한 색) → 이름(명조 굵게) → 한 줄 뜻 → 어디에 있는지(작게).
 * 같은 신살이 여러 자리에 있으면 카드 한 장에 묶고 자리를 쉼표로 나란히 적는다.
 * 기호 아홉은 한 벌: 40 × 40 판, 선 굵기 1.75, 둥근 끝, 면 없이 선만(점은 작은 먹점). 새 그림 파일이 아니다 — 여기 적힌 선이 전부.
 * 이름일 뿐 좋고 나쁨을 정하지 않는다 — 길흉 색(옥색 · 주홍 · 금색 면)을 쓰지 않는다. 목록에 없는 이름이 오면 기호 없이 글만.
 */

/** 복숭아꽃 꽃잎 하나(가운데 20,20에서 위로) — 다섯 번 돌려 쓴다 */
const PETAL = "M20 17.5 C15.2 14.5 15.4 7.6 20 5.2 C24.6 7.6 24.8 14.5 20 17.5 Z";

const SYMBOLS: Record<string, ReactNode> = {
  // 등불(초롱): 도와주는 사람이 붙는 자리
  천을귀인: (
    <>
      <path d="M20 3.5 V8" />
      <path d="M14.5 8 H25.5" />
      <path d="M14.5 8 C5.5 12.5 5.5 25.5 14.5 30 H25.5 C34.5 25.5 34.5 12.5 25.5 8" />
      <path d="M20 14.5 C17.2 17.8 17.2 20.6 20 22.6 C22.8 20.6 22.8 17.8 20 14.5 Z" />
      <path d="M20 30 V36.5" />
      <path d="M17.6 36.5 H22.4" />
    </>
  ),
  // 복숭아꽃 한 송이: 사람을 끄는 매력
  도화: (
    <>
      {[0, 72, 144, 216, 288].map((a) => (
        <path key={a} d={PETAL} transform={`rotate(${a} 20 20)`} />
      ))}
      <circle cx="20" cy="20" r="1.5" className="sinsal-sym__dot" />
    </>
  ),
  // 짚신 한 켤레(한 짝이 한 걸음 앞에): 움직이고 옮겨 다니는 기운
  역마: (
    <>
      <g transform="rotate(-7 12.5 23)">
        <path d="M12.5 11 C16.6 11 18 16.5 17.4 22.5 C16.9 28.5 15.8 35 12.5 35 C9.2 35 8.1 28.5 7.6 22.5 C7 16.5 8.4 11 12.5 11 Z" />
        <path d="M8 22.5 L12.5 12.5 L17 22.5" />
        <path d="M9.2 29.5 H15.8" />
      </g>
      <g transform="rotate(7 27.5 17)">
        <path d="M27.5 5 C31.6 5 33 10.5 32.4 16.5 C31.9 22.5 30.8 29 27.5 29 C24.2 29 23.1 22.5 22.6 16.5 C22 10.5 23.4 5 27.5 5 Z" />
        <path d="M23 16.5 L27.5 6.5 L32 16.5" />
        <path d="M24.2 23.5 H30.8" />
      </g>
    </>
  ),
  // 펼친 책: 혼자 깊이 파고드는 힘
  화개: (
    <>
      <path d="M20 11.5 C16 8.3 9.5 8 5 9.8 V30 C9.5 28.2 16 28.5 20 31.7 C24 28.5 30.5 28.2 35 30 V9.8 C30.5 8 24 8.3 20 11.5 Z" />
      <path d="M20 11.5 V31.7" />
      <path d="M9 15.2 C11.6 14.6 14.2 14.8 16.4 15.8" />
      <path d="M9 20.4 C11.6 19.8 14.2 20 16.4 21" />
      <path d="M23.6 15.8 C25.8 14.8 28.4 14.6 31 15.2" />
      <path d="M23.6 21 C25.8 20 28.4 19.8 31 20.4" />
    </>
  ),
  // 호랑이 발자국: 세고 거침없는 추진력
  백호: (
    <>
      <path d="M20 19 C24.4 19 26.6 22.6 29.4 25.6 C32.2 28.6 31.4 33.2 27.2 33.6 C24.6 33.8 22.6 32.4 20 32.4 C17.4 32.4 15.4 33.8 12.8 33.6 C8.6 33.2 7.8 28.6 10.6 25.6 C13.4 22.6 15.6 19 20 19 Z" />
      <ellipse cx="8.2" cy="17" rx="3" ry="4.2" transform="rotate(-24 8.2 17)" />
      <ellipse cx="15.6" cy="9.6" rx="3.1" ry="4.5" transform="rotate(-8 15.6 9.6)" />
      <ellipse cx="24.4" cy="9.6" rx="3.1" ry="4.5" transform="rotate(8 24.4 9.6)" />
      <ellipse cx="31.8" cy="17" rx="3" ry="4.2" transform="rotate(24 31.8 17)" />
    </>
  ),
  // 북두칠성 국자: 강한 결단과 고집
  괴강: (
    <>
      <path d="M4.5 8.5 L11.5 12.5 L17.5 13.5 L23.5 19 L22.5 30 L33.5 32 L35.5 21 L23.5 19" />
      {[
        [4.5, 8.5],
        [11.5, 12.5],
        [17.5, 13.5],
        [23.5, 19],
        [22.5, 30],
        [33.5, 32],
        [35.5, 21],
      ].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.2" className="sinsal-sym__dot" />
      ))}
    </>
  ),
  // 빈 그릇: 비어 있어 채워 가는 자리
  공망: (
    <>
      <ellipse cx="20" cy="14.5" rx="14.5" ry="4.2" />
      <path d="M5.5 14.5 C6.2 23.5 11.5 29.6 16 30.4 H24 C28.5 29.6 33.8 23.5 34.5 14.5" />
      <path d="M15.5 30.4 V33.8 H24.5 V30.4" />
    </>
  ),
  // 등 돌린 둘: 서로 껄끄러운 글자 한 쌍
  원진: (
    <>
      <path d="M13 7.5 C19.4 13.5 19.4 26.5 13 32.5" />
      <path d="M27 7.5 C20.6 13.5 20.6 26.5 27 32.5" />
      <circle cx="7.5" cy="20" r="2.2" className="sinsal-sym__dot" />
      <circle cx="32.5" cy="20" r="2.2" className="sinsal-sym__dot" />
    </>
  ),
  // 반쯤 열린 문: 예민하고 섬세한 감각
  귀문: (
    <>
      <path d="M8.5 32 V5.5 H31.5 V32" />
      <path d="M4 32 H8.5 M22 32 H36" />
      <path d="M8.5 5.5 L22 10 V36.5 L8.5 32" />
      <circle cx="18.4" cy="22.6" r="1.4" className="sinsal-sym__dot" />
    </>
  ),
};

/** 기호 하나 — 40 × 40 판, 붓선. 꾸밈이라 읽어 주지 않는다(이름이 바로 아래 있다) */
export function SinsalSymbol({ name }: { name: string }) {
  const body = SYMBOLS[name];
  if (!body) return null;
  return (
    <svg className="sinsal-sym" viewBox="0 0 40 40" width={40} height={40} aria-hidden focusable="false">
      {body}
    </svg>
  );
}

/** 같은 이름끼리 한 장으로 — 자리는 나온 차례대로 쉼표로 잇는다 */
function grouped(specials: SinsalChip[]): { name: string; note: string; where: string[] }[] {
  const out: { name: string; note: string; where: string[] }[] = [];
  for (const s of specials) {
    const hit = out.find((o) => o.name === s.name);
    if (!hit) out.push({ name: s.name, note: s.note, where: [s.where] });
    else if (!hit.where.includes(s.where)) hit.where.push(s.where);
  }
  return out;
}

export function SajuSinsalCards({ specials }: { specials: SinsalChip[] }) {
  if (specials.length === 0) return null;
  const cards = grouped(specials);
  return (
    <section className="sinsal" aria-label="신살">
      <div className="sinsal__head">
        <h3 className="saju-h">신살</h3>
        <p className="sinsal__only">내 사주에 든 것만 보여요</p>
      </div>
      <ul className="sinsal__grid">
        {cards.map((c) => (
          <li key={c.name} className="sinsal__card">
            <SinsalSymbol name={c.name} />
            <p className="sinsal__name font-serif">{c.name}</p>
            <p className="sinsal__note">{c.note}</p>
            <p className="sinsal__where">{c.where.join(", ")}</p>
          </li>
        ))}
      </ul>
      <p className="saju-fine sinsal__foot">이름일 뿐 좋고 나쁨을 정하지 않아요</p>
    </section>
  );
}
