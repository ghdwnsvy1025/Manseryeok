import type { Bucket, Highlights } from "@/lib/stats/ganji";

interface Props {
  h: Highlights;
  fitPercent: number;
  stems: Bucket[];
  branches: Bucket[];
  elements: Bucket[];
}

function Row({ b }: { b: Bucket }) {
  const width = b.mean === null ? 0 : ((b.mean - 1) / 9) * 100;
  return (
    <li className="grid grid-cols-[4.5rem_1fr_3.5rem] items-center gap-3 text-[15px]">
      <span className={b.n ? "" : "text-faint"}>{b.ko}</span>
      <span className="h-1.5 rounded-full bg-paper-3">
        <span className="block h-full rounded-full bg-gold" style={{ width: `${width}%` }} />
      </span>
      <span className="text-right font-serif tabular-nums text-muted">{b.mean === null ? "·" : `${b.mean} / ${b.n}`}</span>
    </li>
  );
}

function Group({ title, items }: { title: string; items: Bucket[] }) {
  if (items.every((b) => b.n === 0)) return null;
  // 기록이 1건이라도 있으면 펼친 상태가 기본 (v3.2)
  return (
    <details open className="card-frame card-paper px-5 py-3">
      <summary className="cursor-pointer list-none text-[15px] font-bold [&::-webkit-details-marker]:hidden">
        {title} <span className="ml-1 text-sm font-normal text-faint">평균 / 횟수</span>
      </summary>
      <ul className="mt-3 flex flex-col gap-2">
        {items.map((b) => (
          <Row key={b.key} b={b} />
        ))}
      </ul>
    </details>
  );
}

/** 맞춤도 + 사실 한 줄들 + 천간·지지·오행 묶음. 기간 약속·재촉 문구는 쓰지 않는다 */
export function StatsSummary({ h, fitPercent, stems, branches, elements }: Props) {
  const facts: string[] = [];
  if (h.bestGanji) facts.push(`가장 행복한 날은 ${h.bestGanji.ko}일(${h.bestGanji.hanja}) · 평균 ${h.bestGanji.mean}, ${h.bestGanji.n}번`);
  if (h.worstGanji && h.worstGanji.index !== h.bestGanji?.index)
    facts.push(`가장 힘든 날은 ${h.worstGanji.ko}일(${h.worstGanji.hanja}) · 평균 ${h.worstGanji.mean}, ${h.worstGanji.n}번`);
  if (h.bestStem) facts.push(`천간 중엔 ${h.bestStem.ko}이 든 날이 좋았어요 · 평균 ${h.bestStem.mean}, ${h.bestStem.n}번`);
  if (h.bestBranch) facts.push(`지지 중엔 ${h.bestBranch.ko}가 든 날이 좋았어요 · 평균 ${h.bestBranch.mean}, ${h.bestBranch.n}번`);

  return (
    <div className="flex flex-col gap-4">
      <div className="card-frame card-paper px-5 py-4">
        <div className="flex items-baseline justify-between">
          <span className="text-[15px] font-bold">맞춤도</span>
          <span className="font-serif text-[32px] leading-none">
            {fitPercent}
            <span className="text-[17px] text-muted">%</span>
          </span>
        </div>
        <span aria-hidden className="rule mt-2" />
        <p className="mt-2 text-sm text-muted">
          기록 {h.total}일{h.overallMean !== null && <> · 평균 행복도 {h.overallMean}</>} · 아직 안 겪은 간지 {h.unseen}개
        </p>
      </div>

      {facts.length > 0 ? (
        <ul className="flex flex-col gap-2 text-[15px] leading-relaxed">
          {facts.map((f) => (
            <li key={f} className="border-l-2 border-gold pl-3">
              {f}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[15px] text-muted">같은 간지 날을 두 번 이상 겪으면 가장 행복한 날이 여기 떠요.</p>
      )}

      {h.total === 0 ? (
        <p className="card-frame card-paper px-5 py-4 text-[15px] text-muted">첫 기록을 남기면 여기에 천간·지지·오행별 평균이 쌓여요.</p>
      ) : (
        <>
          <Group title="천간별" items={stems} />
          <Group title="지지별" items={branches} />
          <Group title="오행별" items={elements} />
        </>
      )}
    </div>
  );
}
