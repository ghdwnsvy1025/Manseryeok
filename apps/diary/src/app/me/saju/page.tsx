import Link from "next/link";
import { redirect } from "next/navigation";
import type { Element } from "@saju/engine";
import { Booting } from "@/components/Booting";
import { TrackedLink } from "@/components/track/TrackedLink";
import { characterOf } from "@/lib/character";
import { birthProfileOf, getSajuProfile } from "@/lib/db";
import { GROUP_PLAIN, UNSEONG_NOTE, sajuChart, type ChartColumn } from "@/lib/saju/chart";
import { KAKAO_CHANNEL_URL, PAID_PRICE, paidReadingOpen, sajucowCardUrl, sajucowHomeUrl, sajucowReadingUrl } from "@/lib/sajucow";
import { getUser } from "@/lib/supabase/server";
import { todayKST } from "@/lib/time";

export const dynamic = "force-dynamic";

/** 오행 글자색 (톤 v3.6). 토큰 el-* */
const EL_TEXT: Record<Element, string> = { wood: "text-el-wood", fire: "text-el-fire", earth: "text-el-earth", metal: "text-el-metal", water: "text-el-water" };
const EL_KO: Record<Element, string> = { wood: "목", fire: "화", earth: "토", metal: "금", water: "수" };

const ROWS: { key: string; label: string; cell: (c: ChartColumn) => React.ReactNode }[] = [
  { key: "stemGod", label: "십신", cell: (c) => <span className={c.stemGod === "나" ? "font-bold text-gold-ink" : undefined}>{c.stemGod}</span> },
  { key: "stem", label: "천간", cell: (c) => <span className={`saju-table__char ${c.stemElement ? EL_TEXT[c.stemElement] : ""}`}>{c.stem}</span> },
  { key: "branch", label: "지지", cell: (c) => <span className={`saju-table__char ${c.branchElement ? EL_TEXT[c.branchElement] : ""}`}>{c.branch}</span> },
  { key: "branchGod", label: "십신", cell: (c) => c.branchGod },
  { key: "hidden", label: "지장간", cell: (c) => <span lang="zh-Hant">{c.hidden.join(" ")}</span> },
  { key: "unseong", label: "십이운성", cell: (c) => c.unseong ?? "" },
  { key: "sal12", label: "12신살", cell: (c) => c.sal12 ?? "" },
];

/**
 * 만세력 화면 (2026-10-31 사용자 결정, 나 탭 "내 사주" 요약 카드에서 들어온다). 서버에서 다 계산한다(lib/saju/chart.ts).
 * 순서: 생년월일 줄 → 만세력 표(시·일·월·연 × 십신/천간/지지/십신/지장간/십이운성/12신살) → 오행 분포 → 특별한 신살 칩 →
 * 중심 기운 → 용신 → 대운 → 바이럴(내 조선시대 직업 카드·궁합) → 유료 전체 풀이.
 * 십이운성·신살은 이름과 한 줄 뜻만, 길흉 단정 없음. 유료 풀이는 결제가 열렸는지 바이럴에 물어 버튼을 바꾼다(paidReadingOpen).
 * 모양은 디자이너(.saju-page*, .saju-table*). 여기서는 구조와 글.
 */
export default async function SajuPage() {
  const { supabase, user } = await getUser();
  if (!user) return <Booting title="내 사주" cards={2} />;
  const profile = await getSajuProfile(supabase, user.id);
  if (!profile) redirect("/onboarding?next=/me/saju");
  const today = todayKST();
  const chart = sajuChart(profile.pillars, birthProfileOf(profile), today);
  const me = characterOf(profile.pillars);
  const open = await paidReadingOpen();
  const top = Math.max(...chart.elements.map((e) => e.pct));
  const unseongSeen = [...new Set(chart.columns.map((c) => c.unseong).filter((u): u is NonNullable<typeof u> => u !== null))];

  return (
    <main className="saju-page flex flex-col gap-5">
      <header>
        <Link href="/me" className="tap text-sm text-muted underline underline-offset-4">
          ‹ 나
        </Link>
        <h1 className="mt-2 font-serif text-[26px] leading-snug">내 사주</h1>
        <p className="mt-1 flex items-center justify-between text-sm text-muted">
          <span>
            {profile.calendar === "lunar" ? "음력" : "양력"} {profile.birth_year}.{profile.birth_month}.{profile.birth_day}
            {profile.birth_hour !== null ? ` ${String(profile.birth_hour).padStart(2, "0")}:${String(profile.birth_minute).padStart(2, "0")}` : " 시간 모름"}
          </span>
          <Link href="/onboarding?next=/me/saju" className="tap underline underline-offset-4">
            고치기
          </Link>
        </p>
      </header>

      {/* 만세력 표 — 오른쪽에서 왼쪽으로 읽는 관례대로 시·일·월·연 */}
      <section className="saju-table card-frame card-light card-paper p-4" aria-label="만세력">
        <table className="w-full table-fixed border-collapse text-center text-[13px]">
          <thead>
            <tr>
              <th className="saju-table__corner" />
              {chart.columns.map((c) => (
                <th key={c.pos} scope="col" className="saju-table__head pb-2 font-normal text-muted" data-day={c.pos === "day" ? "" : undefined}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.key} className="saju-table__row" data-row={r.key}>
                <th scope="row" className="saju-table__label py-1.5 text-left text-[12px] font-normal text-muted">
                  {r.label}
                </th>
                {chart.columns.map((c) => (
                  <td key={c.pos} className="saju-table__cell py-1.5" data-day={c.pos === "day" ? "" : undefined} data-unknown={c.unknown ? "" : undefined}>
                    {c.unknown ? (r.key === "stem" || r.key === "branch" ? <span className="saju-table__char text-muted">?</span> : "") : r.cell(c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {chart.hourUnknown && <p className="mt-2 text-[13px] text-muted">태어난 시간을 모르면 시주는 비워 둬요.</p>}
      </section>

      {/* 오행 분포 */}
      <section className="card-frame card-light card-paper p-5" aria-label="오행 분포">
        <h2 className="text-[15px] font-bold">오행 분포</h2>
        <ul className="elements mt-3 flex flex-col gap-1.5">
          {chart.elements.map((r) => (
            <li key={r.el} className={`elements__row flex items-center gap-2 text-[14px] ${EL_TEXT[r.el]}`} data-el={r.el}>
              <span className="elements__label font-serif">{r.ko}</span>
              <span className="elements__track relative flex-1">
                <span className="elements__fill absolute inset-y-0 left-0 bg-current" style={{ width: `${Math.max(2, r.pct)}%` }} />
              </span>
              <span className={`elements__value w-10 text-right tabular-nums ${r.pct === top ? "font-bold text-ink" : "text-muted"}`}>{r.pct}%</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 중심 기운 */}
      <section className="saju-center card-frame card-light card-paper p-5" aria-label="중심 기운">
        <h2 className="text-[15px] font-bold">중심 기운</h2>
        <p className="mt-2 font-serif text-[22px] leading-snug">
          {chart.center.centerGroup}
          <span className="saju-center__strength ml-2 text-muted">{chart.center.strengthPlain}</span>
        </p>
        <p className="mt-1 text-[15px] leading-relaxed text-muted">{chart.center.centerPlain}이 사주의 중심에 있어요.</p>
        <dl className="kv mt-3">
          <div className="kv__row">
            <dt>강약</dt>
            <dd>
              {chart.center.strength} <span className="text-muted">(나를 돕는 기운 {chart.center.inbi}%)</span>
            </dd>
          </div>
          {chart.center.gyeok && (
            <div className="kv__row">
              <dt>격국</dt>
              <dd>
                {chart.center.gyeok}
                {chart.center.gyeokVerdict && chart.center.gyeokVerdict !== "판정보류" && <span className="text-muted">, {chart.center.gyeokVerdict}</span>}
              </dd>
            </div>
          )}
        </dl>
      </section>

      {/* 용신 */}
      {chart.yongsin && (
        <section className="saju-yongsin card-frame card-light card-paper p-5" aria-label="용신">
          <h2 className="text-[15px] font-bold">용신</h2>
          <dl className="kv mt-3">
            <div className="kv__row">
              <dt>용신 (가장 필요한 기운)</dt>
              {/* 오행 한 글자 = 오행 색 원형 도장 32px(옅은 오행 면 + 진한 글자). 용신이 가장 진하고 희신·기신은 한 단계 옅다. 기신에 빨강 없음 */}
              <dd>
                <span className="saju-yongsin__el" data-el={chart.yongsin.use} data-rank="use">{EL_KO[chart.yongsin.use]}</span> <span className="text-muted">{chart.yongsin.useGroup}</span>
              </dd>
            </div>
            <div className="kv__row">
              <dt>희신 (용신을 돕는 기운)</dt>
              <dd>
                <span className="saju-yongsin__el" data-el={chart.yongsin.hee} data-rank="hee">{EL_KO[chart.yongsin.hee]}</span> <span className="text-muted">{chart.yongsin.heeGroup}</span>
              </dd>
            </div>
            <div className="kv__row">
              <dt>기신 (덜어 내면 좋은 기운)</dt>
              <dd>
                <span className="saju-yongsin__el" data-el={chart.yongsin.gi} data-rank="gi">{EL_KO[chart.yongsin.gi]}</span> <span className="text-muted">{chart.yongsin.giGroup}</span>
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-[14px] leading-relaxed text-muted">
            {GROUP_PLAIN[chart.yongsin.useGroup]}이 나를 편하게 해요.
            {chart.yongsin.unstable && " 경계에 있는 사주라 풀이에 따라 달라질 수 있어요."}
          </p>
        </section>
      )}

      {/* 특별한 신살 — 이름과 한 줄 뜻만 */}
      {chart.specials.length > 0 && (
        <section className="saju-sinsal card-frame card-light card-paper p-5" aria-label="신살">
          <h2 className="text-[15px] font-bold">신살</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {chart.specials.map((s) => (
              <li key={`${s.name}${s.where}`} className="saju-sinsal__item flex items-baseline gap-2 text-[14px]">
                <span className="tag tag--on saju-sinsal__name h-8 shrink-0 px-1 text-[14px] text-paper-2">{s.name}</span>
                <span className="text-muted">
                  {s.note} <span className="text-[12px]">({s.where})</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12px] text-muted">신살은 옛 표식일 뿐, 좋고 나쁨을 정하지 않아요.</p>
        </section>
      )}

      {/* 십이운성 뜻 — 표에 나온 것만 */}
      <section className="card-frame card-light card-paper p-5" aria-label="십이운성">
        <h2 className="text-[15px] font-bold">십이운성</h2>
        <p className="mt-1 text-[13px] text-muted">일간의 기운이 각 기둥에서 어떤 때에 있는지를 사람의 한살이에 빗댄 이름이에요.</p>
        <dl className="kv saju-unseong mt-3">
          {unseongSeen.map((u) => (
            <div key={u} className="kv__row">
              <dt>{u}</dt>
              <dd className="text-muted">{UNSEONG_NOTE[u]}</dd>
            </div>
          ))}
        </dl>
      </section>

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
        <TrackedLink event="sajucow_link_click" eventProps={{ at: "saju", to: "card" }} href={sajucowCardUrl(me.ganjiKo)} target="_blank" rel="noopener" className="saju-viral__card flex h-13 items-center justify-center rounded-xl border border-frame text-[16px] font-bold text-ink">
          {/* 버튼 왼쪽 내 얼굴 28px (있는 얼굴 faces/, 새 그림 아님) */}
          <img src={me.faceSrc} alt="" width={28} height={28} className="saju-viral__face" />
          내 조선시대 직업 카드 보기 ({me.ganjiKo})
        </TrackedLink>
        <TrackedLink event="sajucow_link_click" eventProps={{ at: "saju", to: "pair" }} href={sajucowHomeUrl()} target="_blank" rel="noopener" className="tap text-center text-[15px] text-muted underline underline-offset-4">
          친구와 궁합 보기
        </TrackedLink>
      </section>

      {/* 유료 전체 풀이 — 결제가 열렸으면 풀이 페이지로, 닫혔으면 알림 받기 */}
      {/* 다른 카드보다 한 단계 힘 있게: 운세 카드와 같은 금테(card-gold). 이 화면의 금색 면 버튼은 이 안의 하나뿐 */}
      <section className="saju-paid card-gold card-paper flex flex-col gap-3 p-5" aria-label="전체 풀이">
        <h2 className="font-serif text-[20px] leading-snug">내 사주 전체 풀이</h2>
        <p className="text-[15px] leading-relaxed text-muted">성향, 일과 돈, 관계, 앞으로 10년의 흐름까지 한 사람을 위해 쓴 풀이예요.</p>
        {open ? (
          <TrackedLink event="paid_reading_click" eventProps={{ at: "saju", open: true }} href={sajucowReadingUrl()} target="_blank" rel="noopener" className="gold-plate flex h-14 items-center justify-center rounded-xl text-[17px] font-bold text-gold-ink">
            전체 풀이 받기 {PAID_PRICE.toLocaleString("ko-KR")}원
          </TrackedLink>
        ) : (
          <>
            <p className="text-[14px] text-muted">지금은 초대받은 분만 먼저 보고 있어요. 열리면 카카오톡 채널로 가장 먼저 알려 드려요.</p>
            <TrackedLink event="paid_reading_click" eventProps={{ at: "saju", open: false }} href={`${KAKAO_CHANNEL_URL}/friend`} target="_blank" rel="noopener" className="gold-plate flex h-14 items-center justify-center rounded-xl text-[17px] font-bold text-gold-ink">
              열리면 알림 받기
            </TrackedLink>
            <TrackedLink event="paid_reading_click" eventProps={{ at: "saju", open: false, code: true }} href={sajucowReadingUrl()} target="_blank" rel="noopener" className="tap text-center text-[14px] text-muted underline underline-offset-4">
              초대 코드가 있어요
            </TrackedLink>
          </>
        )}
      </section>
    </main>
  );
}
