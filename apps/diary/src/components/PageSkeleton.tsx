/**
 * 화면 뼈대 — 탭을 누르는 즉시 그려진다 (app/·write/me/settings의 loading.tsx와 Booting이 쓴다).
 * 톤 v3.2 "로딩": 제목 자리(한지보다 한 단계 어두운 네모, 4px) + 한지 카드 n장. 정지 상태, 깜빡임(shimmer) 없음.
 * 카드는 빈 상자가 아니라 글자 자리를 둔다 (전수조사 A-3): 제목 한 줄 + 본문 두 줄, 같은 색의 네모.
 * 제목 글자는 네모 안에 투명하게 둔다 — 네모 폭이 제목 길이를 따르고, 읽기 도구에는 제목이 읽힌다.
 */
export function PageSkeleton({ title, cards = 2 }: { title: string; cards?: number }) {
  return (
    <main className="page-skeleton flex flex-col gap-5" aria-busy="true">
      <header>
        <h1 className="page-skeleton__title font-serif text-[26px] leading-snug">{title}</h1>
      </header>
      {Array.from({ length: cards }, (_, i) => (
        <section key={i} className="page-skeleton__card card-frame card-paper min-h-[140px] p-5" aria-hidden>
          <span className="page-skeleton__line page-skeleton__line--title" />
          <span className="page-skeleton__line mt-4 w-full" />
          <span className="page-skeleton__line mt-2 w-[72%]" />
        </section>
      ))}
    </main>
  );
}
