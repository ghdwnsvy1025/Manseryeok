/**
 * 운세 카드 자리 — 모델이 글을 쓰는 3~6초 동안 보인다 (docs/ANON_START.md 4절).
 * 톤 v3.2 "로딩": 열린 운세 카드와 같은 틀(card-gold card-paper) 안에 붓이 한 획 긋는 금색 선 + "오늘 글자를 읽고 있어요".
 * 높이는 닫힌 운세 카드와 같다(.fortune-loading min-height) — 운세가 도착해도 화면이 튀지 않는다.
 * v3.3: `character`(내 캐릭터 그림 경로)가 있으면 붓선 대신 캐릭터 48px이 글자 왼쪽에 앉는다. 온보딩 전(캐릭터를 모름)에는 붓선 그대로.
 * 반복 모션 없음 — 캐릭터는 가만히 있다.
 */
export function FortuneLoading({ character }: { character?: string }) {
  return (
    <section className="fortune-loading card-gold card-paper flex flex-col justify-center p-5" aria-busy="true" aria-live="polite">
      <h2 className="text-[15px] text-muted">오늘의 운세</h2>
      {character ? (
        <div className="mt-3 flex items-center gap-3">
          <img src={character} alt="" width={48} height={48} className="h-12 w-12 shrink-0 object-contain" />
          <p className="fortune-loading__text text-[15px] text-muted">오늘 글자를 읽고 있어요</p>
        </div>
      ) : (
        <>
          <span aria-hidden className="brush-loading mt-3" />
          <p className="fortune-loading__text mt-3 text-[15px] text-muted">오늘 글자를 읽고 있어요</p>
        </>
      )}
    </section>
  );
}
