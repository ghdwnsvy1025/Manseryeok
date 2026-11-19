import type { ReactNode } from "react";
import { BRANCHES, BRANCHES_KO, STEMS, STEMS_KO, type Element } from "@saju/engine";
import { TrackedLink } from "@/components/track/TrackedLink";
import { PaidInvite } from "@/components/PaidInvite";
import { SajuPowerBars } from "@/components/SajuPowerBars";
import { SajuBalanceGauge } from "@/components/SajuBalanceGauge";
import { SajuUnseongCurve } from "@/components/SajuUnseongCurve";
import { SajuSinsalCards } from "@/components/SajuSinsalCards";
import { GROUP_SHORT, UNSEONG_NOTE, type ChartColumn, type SajuChart } from "@/lib/saju/chart";
import { KAKAO_CHANNEL_URL, PAID_PRICE, sajucowCardUrl, sajucowHomeUrl, sajucowReadingUrl } from "@/lib/sajucow";

const EL_KO: Record<Element, string> = { wood: "목", fire: "화", earth: "토", metal: "금", water: "수" };
/** 한자 → 한글 읽기 (천간·지지) */
const READ: Record<string, string> = Object.fromEntries([...STEMS.map((h, i) => [h, STEMS_KO[i]!] as const), ...BRANCHES.map((h, i) => [h, BRANCHES_KO[i]!] as const)]);

/** 명식 표의 행. kind = "cell"이면 정사각 글자 칸(천간·지지), 아니면 작은 글씨 줄 */
const ROWS: { key: string; label: string; kind?: "cell"; cell: (c: ChartColumn) => ReactNode }[] = [
  { key: "stemGod", label: "십신", cell: (c) => <span className={c.stemGod === "나" ? "ms__me" : undefined}>{c.stemGod}</span> },
  { key: "stem", label: "천간", kind: "cell", cell: (c) => <Glyph hanja={c.stem} el={c.stemElement} /> },
  { key: "branch", label: "지지", kind: "cell", cell: (c) => <Glyph hanja={c.branch} el={c.branchElement} /> },
  { key: "branchGod", label: "십신", cell: (c) => c.branchGod },
  { key: "hidden", label: "지장간", cell: (c) => <span lang="zh-Hant">{c.hidden.join(" ")}</span> },
  { key: "unseong", label: "12운성", cell: (c) => c.unseong ?? "" },
  { key: "sal12", label: "12신살", cell: (c) => c.sal12 ?? "" },
];

/** 정사각 글자 칸: 한자 크게(명조) + 아래 한글 작게. 바탕 = 그 글자 오행의 옅은 색, 글자 = 오행 진한 색 (globals.css .ms__glyph) */
function Glyph({ hanja, el }: { hanja: string; el: Element | null }) {
  return (
    <span className="ms__glyph" data-el={el ?? undefined}>
      <span className="ms__han font-serif" lang="zh-Hant">
        {hanja}
      </span>
      <span className="ms__ko">{READ[hanja] ?? ""}</span>
    </span>
  );
}

interface Props {
  chart: SajuChart;
  /** 내 일주 한글("갑자")과 얼굴 — 사주카우 카드 버튼 */
  ganjiKo: string;
  faceSrc: string;
  /** 유료 풀이 결제가 열렸는지 (paidReadingOpen, 서버에서 5분 캐시) */
  open: boolean;
  /** 표 아래 한 줄: 생년월일 + "고치기" 링크 (부모가 그려 넘긴다) */
  birth?: ReactNode;
}

/**
 * 만세력 낱장의 안 (2026-10-31 → 명세 47 낱장 → 명세 48, 톤 v3.52). 서버 컴포넌트, 계산은 lib/saju/chart.ts.
 * 앱 주인: "그냥 좀 일반적인 만세력이었으면 좋겠어 … 펼치면 사주 코어에 있는 그래프처럼".
 * 순서: 명식(흔히 보는 만세력 표 — 시·일·월·연 × 십신 / 천간 칸 / 지지 칸 / 십신 / 지장간 / 12운성 / 12신살) + 생년월일 줄 →
 * 다섯 힘(세로 막대, SajuPowerBars) → 힘의 균형(반원 게이지, SajuBalanceGauge) →
 * 풀이 낱말 줄(중심 기운 · 격 · 용신 · 희신 · 기신 — 사주 용어는 여기서만) → 신살(기호 카드, SajuSinsalCards — 명세 53) → 십이운성 → 대운 →
 * 사주카우에서 더 보기(유료 풀이 권유 PaidInvite 한 곳 → 내 조선시대 직업 카드 → 궁합. 2026-11-18 권유를 이 칸으로 모았다).
 * 한 화면에 % 계산은 한 가지: chart.power(판정용 세력)만 쓰고 chart.elements(엔진 분포율 — 오행 방울 · 오행 분포 막대)는 내지 않는다.
 * 나무 패 표(.saju-table)는 더 쓰지 않는다. 십이운성·신살은 이름과 한 줄 뜻만, 길흉 단정 없음. 모양은 디자이너(.ms*, .power*, .balance*).
 */
export function SajuChartPanel({ chart, ganjiKo, faceSrc, open, birth }: Props) {
  const unseongSeen = [...new Set(chart.columns.map((c) => c.unseong).filter((u): u is NonNullable<typeof u> => u !== null))];
  const me = { ganjiKo, faceSrc };
  return (
    <div className="saju-page flex flex-col gap-6">
      {/* 명식 — 오른쪽에서 왼쪽으로 읽는 관례대로 시·일·월·연. 일주 열은 가는 테로 강조 */}
      <section className="ms" aria-label="명식">
        <table className="ms__table">
          <thead>
            <tr>
              <th className="ms__corner" />
              {chart.columns.map((c) => (
                <th key={c.pos} scope="col" className="ms__head" data-day={c.pos === "day" ? "" : undefined}>
                  {c.label.endsWith("주") ? c.label : `${c.label}주`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.key} className="ms__row" data-row={r.key}>
                <th scope="row" className="ms__label">
                  {r.label}
                </th>
                {chart.columns.map((c) => (
                  <td key={c.pos} className="ms__td" data-day={c.pos === "day" ? "" : undefined}>
                    {c.unknown ? (
                      r.kind === "cell" ? (
                        <span className="ms__glyph" data-unknown="">
                          <span className="ms__han font-serif">?</span>
                        </span>
                      ) : r.key === "stemGod" ? (
                        <span className="ms__unknown">시간 모름</span>
                      ) : (
                        ""
                      )
                    ) : (
                      r.cell(c)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {birth}
      </section>

      {/* 다섯 힘 · 힘의 균형 — 유료 풀이 진단 낱장과 같은 판정용 세력(chart.power · center.inbi) */}
      <SajuPowerBars power={chart.power} hourUnknown={chart.hourUnknown} />
      <SajuBalanceGauge center={chart.center} />

      {/* 풀이 낱말 줄 — 사주 용어는 여기서만 */}
      <section className="saju-terms" aria-label="풀이 낱말">
        <h3 className="saju-h">풀이 낱말</h3>
        <dl className="kv saju-terms__rows">
          <div className="kv__row">
            <dt>중심 기운</dt>
            <dd>
              {chart.center.centerGroup} <span className="saju-terms__plain">{chart.center.centerPlain}</span>
            </dd>
          </div>
          {chart.center.gyeok && (
            <div className="kv__row">
              <dt>격</dt>
              <dd>
                {chart.center.gyeok}
                {chart.center.gyeokVerdict && chart.center.gyeokVerdict !== "판정보류" && <span className="saju-terms__plain">{chart.center.gyeokVerdict}</span>}
              </dd>
            </div>
          )}
          {chart.yongsin && (
            <>
              <div className="kv__row">
                <dt>용신</dt>
                {/* 오행 한 글자 = 오행 색 원형 도장(옅은 오행 면 + 진한 글자). 용신이 가장 진하고 희신은 한 단계 옅다 */}
                <dd>
                  <span className="saju-yongsin__el" data-el={chart.yongsin.use} data-rank="use">
                    {EL_KO[chart.yongsin.use]}
                  </span>
                  {chart.yongsin.useGroup} <span className="saju-terms__plain">가장 필요한 기운</span>
                </dd>
              </div>
              <div className="kv__row">
                <dt>희신</dt>
                <dd>
                  <span className="saju-yongsin__el" data-el={chart.yongsin.hee} data-rank="hee">
                    {EL_KO[chart.yongsin.hee]}
                  </span>
                  {chart.yongsin.heeGroup} <span className="saju-terms__plain">용신을 돕는 기운</span>
                </dd>
              </div>
              <div className="kv__row">
                <dt>기신</dt>
                <dd>
                  <span className="saju-yongsin__el" data-el={chart.yongsin.gi} data-rank="gi">
                    {EL_KO[chart.yongsin.gi]}
                  </span>
                  {chart.yongsin.giGroup} <span className="saju-terms__plain">덜어 내면 좋은 기운</span>
                </dd>
              </div>
            </>
          )}
        </dl>
        {chart.yongsin && (
          <p className="saju-fine">
            {GROUP_SHORT[chart.yongsin.useGroup]}이 나를 편하게 해요.
            {chart.yongsin.unstable && " 경계에 있는 사주라 풀이에 따라 달라질 수 있어요."}
          </p>
        )}
      </section>

      {/* 특별한 신살 — 기호 카드(명세 53). 하나도 없으면 칸을 그리지 않는다 */}
      <SajuSinsalCards specials={chart.specials} />

      {/* 12운성 한살이 곡선(명세 50 1번) — 예전 "십이운성" 뜻풀이 칸을 대신한다. 명식 표 안의 12운성 행은 그대로 */}
      <SajuUnseongCurve columns={chart.columns} />

      {/* 대운 */}
      {chart.daeun && (chart.daeun.current || chart.daeun.next) && (
        <section className="saju-daeun card-frame card-light card-paper p-5" aria-label="대운">
          <h2 className="text-[15px] font-bold">대운</h2>
          <dl className="kv mt-3">
            {chart.daeun.current && (
              <div className="kv__row">
                <dt>지금 대운</dt>
                <dd>
                  <span className="text-ganji">{chart.daeun.current.ganjiKo}</span>
                  {chart.daeun.current.until && <span className="text-muted">, {chart.daeun.current.until.slice(0, 4)}년까지</span>}
                </dd>
              </div>
            )}
            {chart.daeun.next && (
              <div className="kv__row">
                <dt>다음 대운</dt>
                <dd>
                  <span className="text-ganji">{chart.daeun.next.ganjiKo}</span>
                  <span className="text-muted">, {chart.daeun.next.age}세부터</span>
                </dd>
              </div>
            )}
          </dl>
        </section>
      )}

      {/* 바이럴(사주카우)로 — 생년월일은 주소에 싣지 않는다. 일주 카드 페이지는 일주 이름만으로 정해진다 */}
      <section className="saju-viral card-frame card-light card-paper flex flex-col gap-3 p-5" aria-label="사주카우">
        <h2 className="text-[15px] font-bold">사주카우에서 더 보기</h2>
        {/* 유료 풀이 권유 — 이 칸 안 한 곳(2026-11-18 앱 주인 "유료풀이광고는 사주카우와 같이 놓아줘"). 같은 서비스의 세 가지가 한 묶음: 풀이 → 직업 카드 → 궁합.
            결제가 열렸으면 풀이로, 닫혔으면 알림 받기. "다음에"로 30일 접히면 카드 보기 · 궁합 보기 둘만 남는다(PaidInvite). 낱장 안의 금색 면 버튼은 이 하나뿐 */}
        <PaidInvite open={open} readingHref={sajucowReadingUrl()} notifyHref={`${KAKAO_CHANNEL_URL}/friend`} price={PAID_PRICE} />
        {/* 명세 50 3번(앱 주인 "둘 다 동등한 버튼으로"): 같은 테 버튼 둘 — 같은 높이 · 같은 글자 크기, 왼쪽에 작은 얼굴(궁합은 같은 얼굴 둘을 겹친 꼴, 새 그림 아님) */}
        <div className="saju-viral__pair">
          <TrackedLink event="sajucow_link_click" eventProps={{ at: "saju", to: "card" }} href={sajucowCardUrl(me.ganjiKo)} target="_blank" rel="noopener" className="saju-viral__btn">
            <span className="saju-viral__faces" aria-hidden>
              <img src={me.faceSrc} alt="" width={28} height={28} className="saju-viral__face" />
            </span>
            직업 카드 보기
          </TrackedLink>
          <TrackedLink event="sajucow_link_click" eventProps={{ at: "saju", to: "pair" }} href={sajucowHomeUrl()} target="_blank" rel="noopener" className="saju-viral__btn">
            <span className="saju-viral__faces" aria-hidden>
              <img src={me.faceSrc} alt="" width={28} height={28} className="saju-viral__face" />
              <img src={me.faceSrc} alt="" width={28} height={28} className="saju-viral__face" />
            </span>
            궁합 보기
          </TrackedLink>
        </div>
      </section>
    </div>
  );
}
