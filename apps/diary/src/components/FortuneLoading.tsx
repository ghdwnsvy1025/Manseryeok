/**
 * 운세 카드 자리 — 모델이 글을 쓰는 3~6초 동안 보인다 (docs/ANON_START.md 4절).
 * 톤 v3.2 "로딩": 열린 운세 카드와 같은 틀(card-gold card-paper) 안에 붓이 한 획 긋는 금색 선 + "오늘 글자를 읽고 있어요".
 * 높이는 닫힌 운세 카드와 같다(.fortune-loading min-height) — 운세가 도착해도 화면이 튀지 않는다.
 */
export function FortuneLoading() {
  return (
    <section className="fortune-loading card-gold card-paper flex flex-col justify-center p-5" aria-busy="true" aria-live="polite">
      <h2 className="text-[15px] text-muted">오늘의 운세</h2>
      <span aria-hidden className="brush-loading mt-3" />
      <p className="fortune-loading__text mt-3 text-[15px] text-muted">오늘 글자를 읽고 있어요</p>
    </section>
  );
}
