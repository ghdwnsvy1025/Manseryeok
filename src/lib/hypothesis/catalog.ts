/**
 * 가설 카탈로그
 *
 * 이 파일이 제품의 핵심 자산이다. 각 항목은 사주 이론이 말하는 바를
 * "체크인으로 확인 가능한 한 문장"으로 옮긴 것이다.
 *
 * 문구 원칙 — 인스타 사주카드(`인스타\사주카드\주제은행.json`)의 톤을 그대로 가져왔다.
 * 1. 추상어 대신 장면을 쓴다. "생각이 많아집니다"(X) → "장바구니에 담아만 둡니다"(O)
 * 2. 두 줄 구조로 뒤집는다. 앞줄에서 세우고, 뒷줄에서 "그런데 / 대신"으로 친다.
 * 3. 숫자로 못 박는다. "가끔"(X) → "1년에 서른 번쯤"(O)
 * 4. claim 은 **사용자가 자기 경험만으로 답할 수 있는 문장**이어야 한다.
 *    Day 0 에 사용자는 이 문장에 '맞아요/글쎄요'로 답한다. 그런데
 *    "그 날짜에는 규칙이 있습니다", "1년에 서른 번쯤 옵니다", "나무 기운이 들어오는 날"
 *    같은 문장은 사주가 알려주는 정보라 사용자가 판단할 수 없다.
 *    사주가 아는 것(규칙·주기·오행·간지)은 전부 basis 로 내린다.
 * 5. "틀렸다"는 어디에도 쓰지 않는다. 이론과 다르면 "당신은 달랐다"이다.
 * 6. 판정 문구는 수치를 반드시 동반한다. 근거 없는 단정은 넣지 않는다.
 * 7. **제목은 반드시 '날'로 끝난다.** 이 카드가 아는 것은 성격이 아니라
 *    '어떤 날에 당신 숫자가 어땠나'뿐이다. "…사는 사람" 같은 제목은
 *    측정하지 않은 것을 주장하는 것이라 쓰지 않는다.
 *
 * 치환자
 *   {days}          조건에 해당한 날 수
 *   {gap}           평소와의 차이 (절댓값)
 *   {metric}        지표 이름
 *   {elementPhrase} 오행 규칙 전용 — generate.ts 가 이 사람의 실제 오행으로 채운다
 */
import type { HypothesisRule } from "./types";

export const HYPOTHESIS_CATALOG: HypothesisRule[] = [
  // ── 관성(officer): 역할·평가·압박 ──────────────────────
  {
    id: "officer_focus_up",
    title: "역할이 주어지는 날",
    condition: { kind: "any_family", family: "officer" },
    metric: "focus_execution",
    direction: "higher",
    requires: { kind: "family_min", family: "officer", min: 2 },
    weight: 9,
    copy: {
      claim:
        "혼자 세운 계획은 미루면서, 남이 정해준 마감은 지킵니다. " +
        "누가 시켜야 유능해지는 쪽이에요.",
      basis:
        "원국에 관성이 뚜렷합니다. 스스로 세운 계획보다 남이 준 기준에서 힘이 붙는 구조입니다.",
      confirmed:
        "맞았습니다. 그런 날 {metricJosa} 평소보다 {gap} 높았어요({days}일 기준). " +
        "당신은 자유보다 마감에 강한 사람입니다.",
      exception:
        "당신은 달랐습니다. 그런 날 {metricJosa} 오히려 {gap} 낮았어요({days}일 기준). " +
        "남이 정해준 기준은 당신에게 연료가 아니라 짐입니다.",
      neutral:
        "당신에게는 큰 차이가 없었습니다({days}일 기준). " +
        "시켜서 하든 알아서 하든 실행력이 흔들리지 않는 쪽이에요.",
    },
  },
  {
    id: "officer_emotion_down",
    title: "책임이 겹치는 날",
    condition: { kind: "any_family", family: "officer" },
    metric: "emotional_balance",
    direction: "lower",
    requires: { kind: "family_min", family: "officer", min: 3 },
    weight: 8,
    copy: {
      claim:
        "책임이 겹치는 날, 겉으론 아무렇지 않은 척할 겁니다. " +
        "속은 이미 조여오고 있는데도요.",
      basis:
        "원국에 관성이 많습니다(관다). 역할이 몰릴 때 그것이 압박으로 체감되기 쉬운 구조입니다.",
      confirmed:
        "맞았습니다. 그런 날 {metricJosa} 평소보다 {gap} 낮았어요({days}일 기준). " +
        "티를 안 냈을 뿐, 힘들었던 겁니다.",
      exception:
        "당신은 달랐습니다. 그런 날 {metricJosa} 오히려 {gap} 높았어요({days}일 기준). " +
        "할 일이 분명할 때 도리어 마음이 놓이는 사람입니다.",
      neutral:
        "당신에게는 큰 차이가 없었습니다({days}일 기준). " +
        "책임의 무게가 마음까지 내려오지는 않는 쪽이에요.",
    },
  },

  // ── 식상(output): 표현·창작·실행 ──────────────────────
  {
    id: "output_happiness_up",
    title: "표현하고 싶어지는 날",
    condition: { kind: "any_family", family: "output" },
    metric: "happiness",
    direction: "higher",
    requires: { kind: "family_min", family: "output", min: 2 },
    weight: 9,
    copy: {
      claim:
        "하고 싶은 말을 삼킨 날은 하루가 통째로 가라앉습니다. " +
        "반대로 실컷 말한 날은 눈에 띄게 기분이 좋습니다.",
      basis:
        "원국에 식상이 뚜렷합니다. 안에 있는 것을 밖으로 꺼낼 때 만족이 오는 구조입니다.",
      confirmed:
        "맞았습니다. 그런 날 {metricJosa} 평소보다 {gap} 높았어요({days}일 기준). " +
        "당신은 쏟아내야 사는 사람입니다.",
      exception:
        "당신은 달랐습니다. 그런 날 {metricJosa} {gap} 낮았어요({days}일 기준). " +
        "표현이 당신에겐 해소가 아니라 소모입니다.",
      neutral:
        "당신에게는 큰 차이가 없었습니다({days}일 기준). " +
        "말을 하든 삼키든 기분이 흔들리지 않는 쪽이에요.",
    },
  },
  {
    id: "output_energy_up",
    title: "쏟아내게 되는 날",
    condition: { kind: "any_family", family: "output" },
    metric: "energy",
    direction: "higher",
    requires: { kind: "family_min", family: "output", min: 2 },
    weight: 6,
    copy: {
      claim: "많이 쏟아낸 날일수록 오히려 덜 지칠 겁니다.",
      basis: "식상은 에너지를 밖으로 쓰는 축입니다. 원국에 식상이 있어 이 축이 활성화됩니다.",
      confirmed:
        "맞았습니다. 그런 날 {metricJosa} 평소보다 {gap} 높았어요({days}일 기준). " +
        "당신은 아껴 쓰는 쪽이 아니라 쓸수록 차오르는 쪽입니다.",
      exception:
        "당신은 달랐습니다. 그런 날 {metricJosa} {gap} 낮았어요({days}일 기준). " +
        "쏟아낸 만큼 그대로 빠지는 체질입니다. 쉬는 날을 따로 챙겨야 합니다.",
      neutral:
        "당신에게는 큰 차이가 없었습니다({days}일 기준). 활력이 표현량에 좌우되지 않는 쪽이에요.",
    },
  },
  {
    id: "output_vs_officer_tension",
    title: "방식까지 정해주는 날",
    condition: { kind: "any_family", family: "officer" },
    metric: "emotional_balance",
    direction: "lower",
    requires: { kind: "family_min", family: "output", min: 3 },
    weight: 7,
    copy: {
      claim:
        "누가 방식까지 정해주는 날, 유독 숨이 막힐 겁니다. " +
        "일이 싫은 게 아니라 방식이 싫은 겁니다.",
      basis:
        "원국의 식상이 강한데 관성이 들어오는 구조(상관견관)입니다. " +
        "자기 방식과 외부 기준이 정면으로 부딪칩니다.",
      confirmed:
        "맞았습니다. 그런 날 {metricJosa} 평소보다 {gap} 낮았어요({days}일 기준). " +
        "당신이 예민해지는 건 일의 양이 아니라 통제입니다.",
      exception:
        "당신은 달랐습니다. 그런 날 {metricJosa} 오히려 {gap} 높았어요({days}일 기준). " +
        "이론이 예상한 마찰이 당신에겐 일어나지 않습니다.",
      neutral:
        "당신에게는 큰 차이가 없었습니다({days}일 기준). " +
        "방식을 누가 정하든 크게 개의치 않는 쪽이에요.",
    },
  },

  // ── 비겁(peer): 자기 기운·경쟁·관계 마찰 ──────────────
  {
    id: "peer_energy_up",
    title: "같은 기운이 겹치는 날",
    condition: { kind: "any_family", family: "peer" },
    metric: "energy",
    direction: "higher",
    requires: { kind: "family_min", family: "peer", min: 2 },
    weight: 8,
    copy: {
      claim:
        "특별한 일이 없어도 유난히 힘이 나는 날이 있습니다. " +
        "스스로도 왜인지는 모릅니다.",
      basis: "원국에 비겁이 있습니다. 나와 같은 성질의 기운이 더해지면 힘이 실리는 구조입니다.",
      confirmed:
        "맞았습니다. 그런 날 {metricJosa} 평소보다 {gap} 높았어요({days}일 기준). " +
        "기분 탓이 아니었습니다.",
      exception:
        "당신은 달랐습니다. 그런 날 {metricJosa} {gap} 낮았어요({days}일 기준). " +
        "같은 기운이 겹치면 힘이 실리는 게 아니라 되레 지치는 쪽입니다.",
      neutral:
        "당신에게는 큰 차이가 없었습니다({days}일 기준).",
    },
  },
  {
    id: "peer_relationship_down",
    title: "비슷한 사람이 모이는 날",
    condition: { kind: "any_family", family: "peer" },
    metric: "relationship",
    direction: "lower",
    requires: { kind: "family_min", family: "peer", min: 3 },
    weight: 6,
    copy: {
      claim:
        "비슷한 사람들이 모이는 날, 은근히 지지 않으려 할 겁니다. " +
        "본인은 그러는 줄도 모르고요.",
      basis: "원국에 비겁이 많습니다. 같은 자리를 두고 겨루는 구도가 만들어지기 쉽습니다.",
      confirmed:
        "맞았습니다. 그런 날 {metricJosa} 평소보다 {gap} 낮았어요({days}일 기준). " +
        "불편한 사람이 아니라 비슷한 사람이 문제였습니다.",
      exception:
        "당신은 달랐습니다. 그런 날 {metricJosa} 오히려 {gap} 높았어요({days}일 기준). " +
        "비슷한 사람들 사이에서 더 편안해지는 쪽입니다.",
      neutral:
        "당신에게는 큰 차이가 없었습니다({days}일 기준).",
    },
  },

  // ── 재성(wealth): 성취·자원·현실 ──────────────────────
  {
    id: "wealth_work_up",
    title: "성과가 걸린 날",
    condition: { kind: "any_family", family: "wealth" },
    metric: "work_study",
    direction: "higher",
    requires: { kind: "family_min", family: "wealth", min: 2 },
    weight: 8,
    copy: {
      claim: "결과가 눈에 보이는 날, 평소의 두 배로 일할 겁니다.",
      basis: "원국에 재성이 뚜렷합니다. 현실적 결과를 만들어내는 축이 활성화됩니다.",
      confirmed:
        "맞았습니다. 그런 날 {metricJosa} 평소보다 {gap} 높았어요({days}일 기준). " +
        "의지가 부족한 게 아니라, 보이는 목표가 없었던 겁니다.",
      exception:
        "당신은 달랐습니다. 그런 날 {metricJosa} {gap} 낮았어요({days}일 기준). " +
        "성과가 걸리면 오히려 굳는 쪽입니다.",
      neutral:
        "당신에게는 큰 차이가 없었습니다({days}일 기준).",
    },
  },
  {
    id: "wealth_focus_up",
    title: "손에 잡히는 게 있는 날",
    condition: { kind: "any_family", family: "wealth" },
    metric: "focus_execution",
    direction: "higher",
    requires: { kind: "family_min", family: "wealth", min: 2 },
    weight: 5,
    copy: {
      claim: "손에 잡히는 게 걸린 날엔 딴생각이 사라질 겁니다.",
      basis: "재성은 구체적 결과를 향해 움직이는 축입니다.",
      confirmed:
        "맞았습니다. 그런 날 {metricJosa} 평소보다 {gap} 높았어요({days}일 기준).",
      exception:
        "당신은 달랐습니다. 그런 날 {metricJosa} {gap} 낮았어요({days}일 기준). " +
        "눈앞의 보상이 오히려 주의를 흩뜨리는 쪽입니다.",
      neutral:
        "당신에게는 큰 차이가 없었습니다({days}일 기준).",
    },
  },

  // ── 인성(resource): 배움·회복·보호 ────────────────────
  {
    id: "resource_recovery_up",
    title: "채워지는 날",
    condition: { kind: "any_family", family: "resource" },
    metric: "recovery_sleep",
    direction: "higher",
    requires: { kind: "family_min", family: "resource", min: 2 },
    weight: 7,
    copy: {
      claim: "같은 시간을 자도 개운한 날과 아닌 날이 뚜렷하게 갈립니다.",
      basis: "원국에 인성이 있습니다. 나를 채워주는 축이 들어오는 날입니다.",
      confirmed:
        "맞았습니다. 그런 날 {metricJosa} 평소보다 {gap} 높았어요({days}일 기준).",
      exception:
        "당신은 달랐습니다. 그런 날 {metricJosa} {gap} 낮았어요({days}일 기준).",
      neutral:
        "당신에게는 큰 차이가 없었습니다({days}일 기준).",
    },
  },
  {
    id: "resource_focus_down",
    title: "생각이 많아지는 날",
    condition: { kind: "any_family", family: "resource" },
    metric: "focus_execution",
    direction: "lower",
    requires: { kind: "family_min", family: "resource", min: 3 },
    weight: 7,
    copy: {
      claim:
        "생각이 많아지면 실행이 멈춥니다. " +
        "장바구니에 담아만 두고 결제는 안 하는 쪽이에요.",
      basis:
        "원국에 인성이 많습니다(인다). 들어오는 게 많아져 나가는 게 밀리는 구조입니다.",
      confirmed:
        "맞았습니다. 그런 날 {metricJosa} 평소보다 {gap} 낮았어요({days}일 기준). " +
        "게을러진 게 아니라 재고 있었던 겁니다.",
      exception:
        "당신은 달랐습니다. 그런 날 {metricJosa} 오히려 {gap} 높았어요({days}일 기준). " +
        "많이 받아들일수록 더 잘 움직이는 사람입니다.",
      neutral:
        "당신에게는 큰 차이가 없었습니다({days}일 기준). 입력이 실행을 막지는 않는 쪽이에요.",
    },
  },
  {
    id: "resource_emotion_up",
    title: "기대게 되는 날",
    condition: { kind: "any_family", family: "resource" },
    metric: "emotional_balance",
    direction: "higher",
    requires: { kind: "family_min", family: "resource", min: 2 },
    weight: 6,
    copy: {
      claim: "누가 챙겨주거나 배울 게 있는 날엔 마음이 눈에 띄게 놓입니다.",
      basis: "인성은 보호와 회복의 축입니다. 나를 받쳐주는 기운이 들어오는 날입니다.",
      confirmed:
        "맞았습니다. 그런 날 {metricJosa} 평소보다 {gap} 높았어요({days}일 기준).",
      exception:
        "당신은 달랐습니다. 그런 날 {metricJosa} {gap} 낮았어요({days}일 기준). " +
        "받쳐주는 손길이 당신에겐 오히려 부담일 수 있습니다.",
      neutral:
        "당신에게는 큰 차이가 없었습니다({days}일 기준).",
    },
  },

  // ── 관계(합충형파해): 원국과 오늘이 만나는 방식 ────────
  {
    id: "chung_condition_down",
    title: "부딪치는 날",
    condition: { kind: "relation", relation: "chung" },
    metric: "physical_condition",
    direction: "lower",
    requires: { kind: "always" },
    weight: 9,
    copy: {
      claim:
        "무리한 것도 없는데 유독 몸이 무거운 날이 " +
        "한 달에 두세 번쯤 있습니다.",
      basis:
        "원국의 지지와 그날의 지지가 충(沖)을 이루는 날입니다. 가장 강한 충돌 관계입니다.",
      confirmed:
        "맞았습니다. 그런 날 {metricJosa} 평소보다 {gap} 낮았어요({days}일 기준). " +
        "이유 없이 피곤했던 날들의 정체입니다.",
      exception:
        "당신은 달랐습니다. 그런 날 {metricJosa} 오히려 {gap} 높았어요({days}일 기준). " +
        "부딪치는 날에 오히려 몸이 깨어나는 쪽입니다.",
      neutral:
        "당신에게는 큰 차이가 없었습니다({days}일 기준). 충이 몸으로까지 오지는 않는 쪽이에요.",
    },
  },
  {
    id: "chung_change_up",
    title: "흔들리는 날",
    condition: { kind: "relation", relation: "chung" },
    metric: "change_opportunity",
    direction: "higher",
    requires: { kind: "always" },
    weight: 6,
    copy: {
      claim:
        "잠잠하다가 갑자기 일이 몰려 터지는 날이 있습니다. " +
        "나쁜 쪽만은 아니었을 겁니다.",
      basis: "충은 흔들어 깨우는 관계입니다. 고여 있던 것이 움직입니다.",
      confirmed:
        "맞았습니다. 그런 날 {metricJosa} 평소보다 {gap} 높았어요({days}일 기준). " +
        "당신의 변화는 편안한 날이 아니라 부딪친 날에 옵니다.",
      exception:
        "당신은 달랐습니다. 그런 날 {metricJosa} {gap} 낮았어요({days}일 기준). " +
        "충이 기회로 이어지지는 않는 쪽입니다.",
      neutral:
        "당신에게는 큰 차이가 없었습니다({days}일 기준).",
    },
  },
  {
    id: "hap_relationship_up",
    title: "맞물리는 날",
    condition: { kind: "relation", relation: "hap" },
    metric: "relationship",
    direction: "higher",
    requires: { kind: "always" },
    weight: 8,
    copy: {
      claim: "이상하게 대화가 술술 풀리고 사람들이 순해 보이는 날이 있습니다.",
      basis:
        "원국과 그날 사이에 합(合)이 성립하는 날입니다. 서로 끌어당기는 관계입니다.",
      confirmed:
        "맞았습니다. 그런 날 {metricJosa} 평소보다 {gap} 높았어요({days}일 기준). " +
        "중요한 대화는 이런 날로 잡으면 됩니다.",
      exception:
        "당신은 달랐습니다. 그런 날 {metricJosa} {gap} 낮았어요({days}일 기준). " +
        "가까워지는 날이 당신에겐 오히려 부담입니다.",
      neutral:
        "당신에게는 큰 차이가 없었습니다({days}일 기준).",
    },
  },
  // 삭제됨 — hap_happiness_up "하루가 순한 날" (2026-09-09 사용자 검토)
  // 이유 둘. ①합(合) 카드가 이미 hap_relationship_up 으로 있어 조건이 겹친다.
  // ②행복도는 너무 넓은 지표라 합 하나로 움직였다고 말하기 어렵다.
  // 같은 조건이면 더 구체적인 지표(관계) 쪽만 남긴다.
  {
    id: "hyeong_emotion_down",
    title: "엉키는 날",
    condition: { kind: "relation", relation: "hyeong" },
    metric: "emotional_balance",
    direction: "lower",
    requires: { kind: "always" },
    weight: 5,
    copy: {
      claim:
        "하는 일마다 한 번씩 걸리고 꼬이는 날이 있습니다. " +
        "그런 날은 사소한 것에도 예민해집니다.",
      basis:
        "원국과 그날 사이에 형(刑)이 성립합니다. 안으로 조이는 관계입니다.",
      confirmed:
        "맞았습니다. 그런 날 {metricJosa} 평소보다 {gap} 낮았어요({days}일 기준). " +
        "당신 탓이 아니라 날짜 탓이었습니다.",
      exception:
        "당신은 달랐습니다. 그런 날 {metricJosa} 오히려 {gap} 높았어요({days}일 기준).",
      neutral:
        "당신에게는 큰 차이가 없었습니다({days}일 기준).",
    },
  },

  // ── 오행 균형: 비는 것이 채워질 때 / 넘치는 것이 더해질 때 ──
  {
    id: "weak_element_happiness_up",
    title: "비는 기운이 채워지는 날",
    condition: { kind: "element", element: "wood" }, // generate 단계에서 실제 오행으로 교체
    metric: "happiness",
    direction: "higher",
    requires: { kind: "element_weakest" },
    weight: 9,
    copy: {
      claim:
        "이유를 딱 집을 수 없는데 유난히 마음이 편안한 날이 " +
        "드물게 있습니다.",
      // generate 단계에서 이 사람의 실제 오행·비율 문장으로 덮어쓴다
      basis: "원국에서 비율이 낮은 오행이 그날 들어옵니다. 균형이 맞춰지는 날입니다.",
      confirmed:
        "맞았습니다. 그런 날 {metricJosa} 평소보다 {gap} 높았어요({days}일 기준). " +
        "비어 있던 자리가 당신에게 실제로 영향을 줍니다.",
      exception:
        "당신은 달랐습니다. 그런 날 {metricJosa} {gap} 낮았어요({days}일 기준). " +
        "없던 기운은 당신에게 보충이 아니라 낯선 부담입니다.",
      neutral:
        "당신에게는 큰 차이가 없었습니다({days}일 기준). " +
        "오행 균형이 기분으로까지 오지는 않는 쪽이에요.",
    },
  },
  // ── 용신(用神) — 사주에서 가장 중요하게 보는 자리 ────────
  //
  // 지표를 행복도가 아니라 에너지로 잡은 이유:
  // "비는 기운이 채워지는 날"(행복도)의 claim 이 "이유 없이 마음이 편안한 날"이라
  // 용신 카드도 행복도로 잡으면 **두 장이 거의 같은 말**을 하게 된다.
  // 용신은 "나를 돕는 기운"이므로 힘·지침으로 묻는 게 겹치지도 않고 더 직관적이다.
  {
    id: "yongsin_energy_up",
    title: "힘이 덜 드는 날",
    condition: { kind: "yongsin" },
    metric: "energy",
    direction: "higher",
    requires: { kind: "yongsin_exists" },
    weight: 10,
    copy: {
      claim:
        "같은 일을 해도 어떤 날은 반나절 만에 지치고, " +
        "어떤 날은 저녁까지 멀쩡합니다. 따로 관리한 것도 아닌데요.",
      // generate 단계에서 이 사람의 실제 용신 문장으로 덮어쓴다
      basis: "사주의 균형을 잡아 주는 기운이 그날 들어옵니다.",
      confirmed:
        "맞았습니다. 그런 날 {metricJosa} 평소보다 {gap} 높았어요({days}일 기준). " +
        "사주가 짚은 자리가 당신 하루에서도 확인됐습니다.",
      exception:
        "당신은 달랐습니다. 그런 날 {metricJosa} 오히려 {gap} 낮았어요({days}일 기준). " +
        "사주에서 가장 중요하게 보는 자리인데 당신 기록은 반대였습니다. " +
        "이건 당신에게만 있는 사실이에요.",
      neutral:
        "당신에게는 큰 차이가 없었습니다({days}일 기준). " +
        "용신이 컨디션까지 밀고 오지는 않는 쪽이에요.",
    },
  },
  {
    id: "strong_element_emotion_down",
    title: "강한 기운이 겹치는 날",
    condition: { kind: "element", element: "wood" }, // generate 단계에서 실제 오행으로 교체
    metric: "emotional_balance",
    direction: "lower",
    requires: { kind: "element_strongest" },
    weight: 7,
    copy: {
      claim:
        "평소엔 장점이던 성격이 어떤 날은 과해져서 " +
        "오히려 발목을 잡습니다.",
      // generate 단계에서 이 사람의 실제 오행·비율 문장으로 덮어쓴다
      basis: "원국에서 비율이 높은 오행이 그날 또 들어옵니다. 한쪽으로 쏠리는 날입니다.",
      confirmed:
        "맞았습니다. 그런 날 {metricJosa} 평소보다 {gap} 낮았어요({days}일 기준). " +
        "부족해서가 아니라 과해서 생긴 문제입니다.",
      exception:
        "당신은 달랐습니다. 그런 날 {metricJosa} 오히려 {gap} 높았어요({days}일 기준). " +
        "익숙한 기운이 겹칠수록 편안해지는 사람입니다.",
      neutral:
        "당신에게는 큰 차이가 없었습니다({days}일 기준).",
    },
  },
];

export function findRule(id: string): HypothesisRule | undefined {
  return HYPOTHESIS_CATALOG.find((r) => r.id === id);
}
