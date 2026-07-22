# Cursor AI용 사주일기 앱 대규모 개편 마스터 프롬프트

아래 지시를 현재 열려 있는 저장소 전체에 적용하라. 이 작업의 목적은 기존 핵심 기능을 삭제하지 않고 `Legacy` 영역에 안전하게 보존한 뒤, 새로운 일기·카테고리 점수·사주 특징 추출·사용자 개인화 통계 분석 시스템을 구축하는 것이다.

## 0. 역할과 최종 목표

너는 이 저장소의 시니어 소프트웨어 아키텍트, 데이터 엔지니어, 통계 모델 엔지니어, QA 엔지니어 역할을 동시에 수행한다.

최종 제품은 다음 원칙을 만족해야 한다.

1. 기존 만세력, 날짜 관련 화면/기능, 행복도 및 기분 선택, 기존 계정 등록·프로필 화면을 삭제하지 않는다.
2. 기존 기능은 사용자 메뉴의 `이전 기능` 또는 `Legacy` 영역에 모아 계속 접근 가능하게 한다.
3. 인증·세션·사용자 식별 인프라는 새 시스템에서도 재사용한다. 기존 인증 코드를 복제하거나 별도의 계정 체계를 만들지 않는다.
4. 새 메인 경험은 `오늘 기록`, `일기`, `분석`, `나의 사주`, `설정` 중심으로 재구성한다.
5. 사주 계산 결과는 사용자의 삶을 결정하는 정답으로 취급하지 않는다.
6. 원국·운에서 해석 가설을 만들고, 사용자의 실제 일기 점수와 사건 기록을 이용해 사용자별 반응 패턴을 학습한다.
7. 수치 예측 모델과 AI 상담 문장 생성을 분리한다.
8. 모델의 예측·통계·근거를 재현할 수 있도록 계산 버전과 상세값을 저장한다.
9. 새 기능을 구현하면서 기존 데이터 손실, 로그인 불가, 만세력 계산 변경이 발생하면 안 된다.
10. 모든 단계가 끝나면 구현 문서, 데이터 사전, 테스트 체크리스트, 통계 대시보드 명세, 출시 보고서를 저장소의 `/docs`에 남긴다.

현재 기술 스택을 임의로 바꾸지 말고, 저장소를 조사한 뒤 기존 프레임워크·ORM·상태관리·라우팅·테스트 도구의 관례를 따른다. 아래 예시의 테이블명과 디렉터리명은 현재 스택에 맞게 번역하되, 개념과 책임 분리는 유지한다.

---

## 1. 반드시 먼저 수행할 저장소 조사

코드를 수정하기 전에 다음 내용을 조사하고 `/docs/LEGACY_INVENTORY.md`를 생성하라.

### 조사 항목

- 프론트엔드 및 백엔드 기술 스택
- 앱 진입점과 라우팅 구조
- 인증, 회원가입, 로그인, 사용자 프로필 흐름
- 만세력 계산 모듈의 위치, 공개 함수, 입력·출력 타입
- 날짜·시간대·출생지·진태양시 관련 처리 위치
- 행복도 및 기분 선택 화면과 저장 구조
- 일기 관련 기존 테이블, API, 컴포넌트
- 현재 데이터베이스 스키마와 마이그레이션 방식
- 분석 프롬프트, LLM 호출, 오행 계산 모듈 위치
- 테스트 프레임워크와 현재 테스트 현황
- 환경변수 및 외부 서비스 의존성
- 삭제하거나 이동하면 위험한 공유 모듈

### 조사 결과에 반드시 포함할 표

| 기능 | 현재 경로/파일 | 데이터 저장소 | 공유 의존성 | Legacy 이동 방식 | 회귀 위험 |
|---|---|---|---|---|---|

조사가 끝나기 전에는 기존 테이블 삭제, 대규모 이름 변경, 인증 교체, 만세력 계산식 변경을 하지 않는다.

---

## 2. 변경 금지 및 안전 규칙

### 절대 금지

- 기존 데이터베이스 테이블이나 컬럼을 즉시 삭제하지 않는다.
- 기존 사용자 데이터를 새 포맷으로 강제 덮어쓰지 않는다.
- 만세력 계산 결과를 새 알고리즘 구현 과정에서 임의로 수정하지 않는다.
- 기존 계정 ID와 새 시스템 사용자 ID를 분리하지 않는다.
- 점수 예측에 LLM이 임의의 숫자를 생성하게 하지 않는다.
- 오행 하나 또는 십신 하나만으로 사용자 상태를 단정하지 않는다.
- 통계적 동반 관계를 원인이라고 표현하지 않는다.
- 건강, 사고, 파산, 죽음, 결혼 등을 확정적으로 예언하지 않는다.
- 사용자 화면에 내부 회귀계수, 개인정보가 포함된 로그, 원문 프롬프트를 노출하지 않는다.

### 안전 장치

- `legacyEnabled`, `newDiaryEnabled`, `personalizationEnabled`에 해당하는 기능 플래그를 현재 프로젝트 방식에 맞게 추가한다.
- 주요 마이그레이션은 되돌릴 수 있어야 한다.
- 기존 기능에 대한 스모크 테스트와 스냅샷/회귀 테스트를 먼저 만든다.
- 새 기능 장애 시 Legacy 화면과 기존 만세력은 계속 동작해야 한다.
- 사주 계산 결과에는 `calculationVersion`, `theoryVersion`, `featureVersion`을 저장한다.

---

## 3. Legacy 영역 설계

### 사용자 정보 구조

새 메인 내비게이션은 다음을 기본으로 한다.

1. 오늘
2. 일기
3. 분석
4. 나의 사주
5. 설정

`설정 > 이전 기능` 또는 `더보기 > Legacy` 안에 다음 기존 화면을 모은다.

- 기존 만세력 화면
- 기존 날짜 관련 화면
- 기존 행복도 기록
- 기존 기분 선택
- 기존 회원가입/프로필 관리 화면 중 새 온보딩에서 직접 사용하지 않는 화면

### 중요 원칙

- 인증 서비스, 세션, 사용자 테이블은 Legacy가 아니라 `shared/core` 계층으로 유지한다.
- 기존 회원가입 UI는 Legacy에 보관할 수 있지만, 새 온보딩은 동일한 인증 서비스를 호출해야 한다.
- 기존 URL이나 딥링크가 있다면 리다이렉트 또는 별칭 라우트를 제공한다.
- Legacy 데이터는 원본 테이블을 유지한다.
- 새 분석에서 과거 행복도·기분 데이터를 사용하려면 읽기 전용 Adapter를 통한다.
- 과거 값을 새 테이블로 가져올 때는 `source = legacy_import`와 원본 ID를 기록한다.
- 동일 데이터가 중복 import되지 않도록 idempotent migration을 구현한다.

권장 구조 예시:

```text
src/
  core/
    auth/
    user/
    date-time/
  legacy/
    calendar/
    mood/
    happiness/
    account-ui/
    adapters/
  diary/
  saju/
  personalization/
  insights/
```

현재 저장소 구조가 다르면 책임만 동일하게 분리한다.

---

## 4. 새로운 일기 경험

### 오늘 기록 플로우

한 화면에서 다음 순서로 기록하게 한다.

1. 날짜 확인
2. 사용자가 활성화한 카테고리 점수
3. 오늘 있었던 사건 태그 0~3개
4. 자유 일기
5. 선택 사항: 오늘 가장 큰 영향을 준 사건
6. 저장
7. 저장 직후 간단한 기록 요약 표시

기존 행복도·기분 선택 UI를 새 화면에 그대로 복사하지 않는다. 필요하면 Legacy Adapter를 통해 과거 기록만 분석에 연결한다.

### 카테고리 선택 온보딩

사용자는 아래 시스템 카테고리 중 최소 4개, 권장 6개, 최대 9개를 활성화한다.

| code | 표시 이름 | 질문 | 내부 의미 |
|---|---|---|---|
| emotional_balance | 감정 균형 | 오늘 감정은 편안하고 안정적이었나요? | 감정 안정과 만족 |
| energy | 에너지 | 오늘 몸과 마음에 움직일 힘이 있었나요? | 활력과 활동성 |
| recovery_sleep | 수면·회복 | 오늘 충분히 쉬고 회복되었다고 느끼나요? | 수면과 회복 |
| physical_condition | 신체 상태 | 오늘 몸의 컨디션은 어땠나요? | 신체 체감 상태 |
| focus_execution | 집중·실행 | 계획한 일을 집중해서 실행했나요? | 집중, 결정, 마무리 |
| work_study | 일·학업 | 오늘 일이나 공부의 결과에 만족하나요? | 생산, 성취, 평가 |
| relationship | 관계 | 오늘 사람들과의 관계는 원만했나요? | 가족, 친구, 연애, 직장 관계 |
| finance_resource | 재정·자원 | 오늘 돈과 자원을 잘 관리했다고 느끼나요? | 수입, 지출, 현실 관리 |
| change_opportunity | 변화·기회 | 오늘 새로운 시도나 변화의 기회가 있었나요? | 시작, 이동, 새 만남 |

기본 추천 선택은 `감정 균형`, `에너지`, `수면·회복`, `집중·실행`, `일·학업`, `관계`로 한다.

### 카테고리 변경 규칙

- 사용자는 설정에서 카테고리를 켜고 끌 수 있다.
- 비활성화해도 과거 점수는 삭제하지 않는다.
- 다시 활성화하면 기존 기록을 이어서 사용한다.
- 카테고리 질문 문구와 내부 code는 분리한다.
- 내부 code는 한번 배포 후 함부로 변경하지 않는다.
- MVP에서는 임의의 사용자 정의 카테고리를 만들지 않는다.
- 사용자 정의 카테고리는 향후 기능으로 문서에만 남긴다.

---

## 5. 점수 입력과 정확도 규칙

### 원점수

모든 카테고리는 1~5점 척도를 사용한다.

- 1: 매우 좋지 않았음
- 2: 좋지 않았음
- 3: 보통
- 4: 좋았음
- 5: 매우 좋았음
- 별도 값: 해당 없음 / 판단하기 어려움

### UX 규칙

- 기본값으로 3점을 미리 선택하지 않는다.
- 사용자가 직접 값을 선택해야 저장된다.
- `해당 없음`은 결측값으로 저장하고 3점으로 바꾸지 않는다.
- 모든 카테고리를 강제로 입력시키지 않는다.
- 저장 전 완료된 카테고리 수를 보여준다.
- 점수 방향은 모든 기본 카테고리에서 높을수록 좋은 상태로 통일한다.
- 스트레스·갈등 같은 부정 사건은 점수가 아니라 사건 태그로 기록한다.

### 개인 기준 정규화

사람마다 점수 사용 습관이 다르므로 사용자·카테고리별 기준선을 만든다.

```text
rawScore ∈ {1,2,3,4,5}

baselineMean = 최근 유효 기록의 가중 평균
baselineStd  = 최근 유효 기록의 가중 표준편차
normalizedZ  = clamp((rawScore - baselineMean) / max(baselineStd, 0.5), -2.5, 2.5)
```

- 기본 관찰 창은 최근 60개 유효 기록이다.
- 최근 기록에 더 큰 가중치를 주며 권장 반감기는 30일이다.
- 유효 기록이 14개 미만이면 개인 표준화를 확정하지 않는다.
- 14개 미만에서는 `(rawScore - 3)`을 임시 중심값으로 사용하되 신뢰도를 낮게 표시한다.
- 특정 카테고리에서 최근 14개 기록이 모두 동일하거나 서로 다른 점수가 2개 이하이면 `low_variance` 품질 경고를 남긴다.
- 사용자에게 특정 분포를 강요하지 않는다. 정규분포라고 가정하지 않는다.

정규화 코드는 순수 함수로 만들고 단위 테스트를 작성한다.

---

## 6. 사건 태그 데이터

MVP 기본 태그:

- 새로운 시작
- 성과·칭찬
- 갈등
- 만남·소개
- 수입
- 큰 지출
- 운동
- 휴식
- 질병·통증
- 여행·이동
- 실수·사고
- 계약·결정
- 학습
- 가족
- 연애
- 직장·학교

각 태그 기록에는 다음 속성을 둘 수 있다.

```ts
type EventValence = -2 | -1 | 0 | 1 | 2;
type EventIntensity = 1 | 2 | 3;
type EventAgency = 'self' | 'external' | 'mixed' | 'unknown';
```

- 태그 선택은 0~3개를 권장하되 강제하지 않는다.
- 자유 일기에서 LLM이 태그를 제안할 수 있지만 사용자가 수정·확정해야 한다.
- LLM 자동 추출 결과와 사용자 확정값을 구분해서 저장한다.
- 일기 원문을 외부 분석 서비스로 보낼 경우 현재 프로젝트의 동의·보안 정책을 따른다.

---

## 7. 데이터 모델

현재 ORM과 DB 관례에 맞추어 아래 개념을 구현한다.

### diary_entries

```text
id
user_id
entry_date
user_timezone
content
main_event_text nullable
source enum(new_diary, legacy_import)
created_at
updated_at
```

`user_id + entry_date`에 대해 제품 정책에 맞게 하루 1개를 기본으로 하되, 기존 앱이 다중 일기를 지원하면 entry type 또는 sequence를 도입한다.

### category_catalog

```text
code PK
name
question
meaning
sort_order
is_active
schema_version
```

### user_category_preferences

```text
user_id
category_code
enabled
sort_order
enabled_at
disabled_at nullable
```

### category_scores

```text
id
entry_id
category_code
raw_score nullable
is_not_applicable
normalized_z nullable
normalization_version
created_at
updated_at
```

### event_tag_catalog / diary_event_tags

```text
tag_code
name

entry_id
tag_code
valence nullable
intensity nullable
agency nullable
source enum(user, ai_suggested, legacy_import)
confirmed_by_user
```

### saju_feature_snapshots

```text
id
user_id
feature_date
calculation_mode
natal_chart_hash
luck_input_hash
calculation_version
theory_version
feature_version
features_json
calculation_detail_json
created_at
```

동일한 사용자·날짜·입력 hash·버전에 대해서는 중복 계산하지 않는다.

### personalization_models

```text
id
user_id
category_code
model_type
model_version
status enum(insufficient_data, early, active, degraded)
trained_at
sample_count
feature_names_json
coefficients_json
intercept
training_window_json
metrics_json
created_at
```

### analysis_reports

```text
id
user_id
period_type enum(day, week, month, custom)
period_start
period_end
model_version
confidence_score
report_json
created_at
```

### legacy_migration_map

```text
source_table
source_id
target_table
target_id
migration_version
migrated_at
```

개인정보 삭제 요청 및 계정 탈퇴 시 새 테이블도 기존 정책에 맞게 삭제 또는 익명화되도록 한다.

---

## 8. 사주 계산 및 특징 추출 파이프라인

첨부되어 있는 기존 사주 이론·오행 공식 파일과 현재 만세력 모듈을 소스 오브 트루스로 사용한다.

### 계산 모드

```ts
function getCalculationModeByViewMode(viewMode) {
  if (viewMode === 'diary_detail') return 'native_with_luck';
  if (viewMode === 'simple') return 'luck_only';
  return 'native_with_luck';
}

function resolveCalculationMode({ calculationMode, viewMode }) {
  if (calculationMode) return calculationMode;
  return getCalculationModeByViewMode(viewMode);
}
```

새 개인화 일기 분석은 기본적으로 `native_with_luck`를 사용한다.

### 계산과 해석 분리

1. 기존 만세력에서 원국, 대운, 세운, 월운, 일운을 구한다.
2. 기존 공식으로 오행 분포와 계산 detail을 구한다.
3. 일간, 월지, 일지, T존, 십신, 자리, 지장간, 합충형파해를 특징값으로 변환한다.
4. 사용자 일기 모델에는 그 날짜에 변하는 특징 또는 원국과 운의 상호작용 특징을 사용한다.
5. 고정된 원국값은 한 사용자 내부의 일별 회귀 모델에서 단독 변수로 넣지 않는다. 매일 변하지 않기 때문에 설명력이 없기 때문이다.
6. 원국은 운과의 상호작용값을 만드는 데 사용한다.
7. AI 문장 생성은 계산 및 통계 결과가 나온 뒤 수행한다.

### MVP 특징 벡터

아래 특징을 가능한 한 수치형으로 정규화하여 저장한다.

#### 오행

```text
wood_pct
fire_pct
earth_pct
metal_pct
water_pct
```

원국+운 기준 분포이며 합계와 계산 detail을 검증한다.

#### 십신 기능축

십신 10개를 바로 모두 모델에 넣지 말고 MVP에서는 5개 축으로 집계한다.

```text
self_competition_axis   = 비견 + 겁재
expression_output_axis = 식신 + 상관
resource_reality_axis  = 편재 + 정재
authority_pressure_axis = 편관 + 정관
recovery_cognition_axis = 편인 + 정인
```

축 이름은 DB code로 고정하고, 표시 문구는 별도 관리한다.

#### 관계 특징

```text
stem_combination_count
branch_combination_count
clash_count
punishment_count
break_count
harm_count
three_harmony_strength
directional_harmony_strength
useful_element_activation
burden_element_activation
```

기존 이론에 실제 계산 규칙이 없는 값을 임의로 만들지 않는다. 계산할 수 없는 항목은 nullable로 두고 문서화한다.

#### 시간 단위

대운·세운·월운·일운의 기여를 합계 하나로만 뭉개지 말고 각 horizon을 구분한다.

```text
major_luck_features
yearly_luck_features
monthly_luck_features
daily_luck_features
```

MVP 모델 입력 차원이 지나치게 커지면 각 horizon별 오행 5개와 십신축 5개를 요약하여 사용한다.

### 계산 결과 기본 타입

```ts
interface SajuFeatureSnapshot {
  userId: string;
  date: string;
  calculationMode: 'native_with_luck' | 'luck_only';
  elements: Record<'wood'|'fire'|'earth'|'metal'|'water', number>;
  tenGodAxes: {
    selfCompetition: number;
    expressionOutput: number;
    resourceReality: number;
    authorityPressure: number;
    recoveryCognition: number;
  };
  relations: Record<string, number | null>;
  horizons: Record<string, unknown>;
  versions: {
    calculation: string;
    theory: string;
    feature: string;
  };
  detail: unknown;
}
```

`detail`은 내부 디버그와 “왜 이렇게 나왔나요?” 설명에 사용하고 일반 화면에는 그대로 노출하지 않는다.

---

## 9. MVP 개인화 알고리즘

### 목표

각 사용자·카테고리별로 다음 질문에 답한다.

> 이 사용자에게 특정 사주 특징이 활성화된 날, 해당 카테고리 점수가 개인 평소 수준보다 높거나 낮게 나타나는 패턴이 반복되는가?

사주 이론의 진위를 증명한다고 표현하지 않는다. 관찰된 사용자 기록에서 동반 패턴을 찾는 것이다.

### 단계별 동작

#### 0~13개 유효 기록: 이론·기술통계 모드

- 개인화 예측 모델을 학습하지 않는다.
- 원국·운에 대한 이론 요약과 실제 점수의 단순 추세만 보여준다.
- “개인 패턴을 만들기 위해 기록이 더 필요합니다”라고 표시한다.
- 숫자 예측을 제공하지 않는다.

#### 14~29개 유효 기록: 초기 개인 패턴

- 카테고리별 Ridge Regression을 학습한다.
- 입력은 오행 5개 + 십신 기능축 5개를 기본으로 한다.
- 관계·lag 특징은 아직 넣지 않는다.
- 규제 강도를 높게 설정하여 과적합을 억제한다.
- 결과는 “초기 경향”으로만 표시한다.

#### 30~89개 유효 기록: 활성 개인 모델

- 관계 특징 중 데이터가 안정적인 항목을 추가한다.
- 전날 점수 또는 전날 특징의 1일 lag를 선택적으로 추가한다.
- 시간 순서 기반 검증을 수행한다.
- 모델이 기준선 예측보다 나쁠 경우 개인화 예측을 숨기고 기술통계만 보여준다.

#### 90개 이상: 안정화 분석

- 7일 이동평균, 월별 패턴, 계수 안정성을 평가한다.
- 계절성 또는 장기 변화 분석을 추가할 수 있다.
- 여전히 인과관계로 표현하지 않는다.

### 모델

MVP 모델은 카테고리별 Ridge Regression으로 한다.

```text
X_t = 날짜 t의 사주 특징 벡터
y_t = 날짜 t의 해당 카테고리 normalizedZ

predictedZ = intercept + Σ(coefficient_i × feature_i)
```

권장 초기 규제값은 `lambda = 10`이다. 현재 언어의 검증된 라이브러리가 있으면 사용하고, 없다면 안정적인 선형대수 구현 또는 서버 분석 모듈을 사용한다.

- 데이터 순서를 섞지 않는다.
- 마지막 20% 기간을 holdout으로 사용하는 rolling/time split을 적용한다.
- 유효 기록 45개 이상일 때만 `[1, 3, 10, 30]` 중 검증 MAE가 가장 좋은 lambda를 선택한다.
- 학습과 추론에 동일한 feature order를 사용한다.
- 모델 버전과 feature 목록을 저장한다.
- 랜덤 요소가 있으면 seed를 고정한다.

### 기준선 모델

개인화 모델은 반드시 아래 기준선과 비교한다.

```text
baselinePrediction = 해당 사용자의 카테고리 최근 가중 평균
```

개인화 모델의 holdout MAE가 기준선 MAE보다 개선되지 않으면:

- `status = degraded` 또는 `insufficient_signal`
- 사용자에게 예측 점수를 보여주지 않는다.
- “뚜렷한 반복 패턴이 아직 확인되지 않았습니다”라고 표시한다.

### 재학습 조건

- 마지막 학습 이후 유효 기록이 3개 이상 추가됨
- 또는 마지막 학습 후 7일 경과
- 또는 feature/calculation 버전 변경

현재 프로젝트에 background job이 없으면 분석 화면 진입 시 debounce된 서버 작업으로 실행하되, UI를 막지 않는다. 동일 데이터 버전에 대한 중복 학습을 방지한다.

### 신뢰도 점수

0~100의 내부 신뢰도 점수를 계산한다.

```text
volumeScore     = min(validSampleCount / 90, 1)
coverageScore   = 최근 30일 중 선택 카테고리 입력 비율
variationScore  = 점수 값 다양성과 표준편차가 충분한 정도
recencyScore    = 최근 기록일이 현재와 가까운 정도
validationScore = 기준선 대비 holdout 성능 개선 정도
stabilityScore  = 최근 두 모델 사이 주요 계수 방향의 안정성

confidence = 100 × (
  0.20 × volumeScore +
  0.15 × coverageScore +
  0.10 × variationScore +
  0.10 × recencyScore +
  0.30 × validationScore +
  0.15 × stabilityScore
)
```

개인화 모델이 없는 단계에서는 validation과 stability를 0으로 두고 최대 표시 등급을 `낮음`으로 제한한다.

표시 등급:

- 0~29: 자료 부족
- 30~49: 낮음
- 50~69: 보통
- 70~84: 높음
- 85~100: 매우 높음

`매우 높음`도 미래 사건의 확정 예측을 의미하지 않는다.

---

## 10. 사용자별 패턴 해석 규칙

분석 문장은 반드시 세 층으로 분리한다.

### 1. 명리 이론상

예시:

> 오늘은 원국과 운의 조합에서 관성 계열이 상대적으로 활성화되는 흐름으로 해석됩니다.

### 2. 내 기록상

예시:

> 최근 58개의 기록에서는 비슷한 특징의 날에 집중·실행 점수가 개인 평균보다 높게 나타나는 경향이 있었습니다.

### 3. 실천 제안

예시:

> 중요한 업무를 먼저 처리하되, 저녁에는 긴장을 낮출 수 있는 회복 시간을 확보해보세요.

### 금지 문장

- “관성이 강해서 반드시 업무가 잘됩니다.”
- “오늘 충이 있으니 사고가 납니다.”
- “수 기운이 부족해서 우울합니다.”
- “이 점수는 당신의 운명이 맞다는 증거입니다.”

### 권장 문장

- “함께 나타나는 경향이 관찰되었습니다.”
- “현재 기록 범위에서는 이런 패턴이 상대적으로 자주 나타났습니다.”
- “원인으로 단정할 수는 없으며, 생활 환경과 선택도 함께 영향을 줍니다.”

건강 영역은 생활 관리 조언 수준으로 제한하고 의학적 판단이나 진단을 하지 않는다.

---

## 11. 분석 화면

### 일간 분석

- 오늘의 사주 흐름 요약
- 사용자가 선택한 카테고리의 오늘 기록
- 개인 기준 대비 높음/보통/낮음
- 유사한 사주 특징이 있던 과거 날짜 3~5개
- 당시 평균 점수와 대표 사건 태그
- 신뢰도와 데이터 개수
- 실천 제안 1~2개

### 주간 분석

- 카테고리별 7일 추세
- 개인 기준선 대비 편차
- 자주 등장한 사건 태그
- 사주 특징과 점수의 동반 패턴 상위 3개
- 기록 누락일

### 월간 분석

- 카테고리 평균과 변동성
- 가장 좋아진 영역 / 가장 흔들린 영역
- 사주 특징별 평균 차이
- 기준선 모델 대비 개인화 모델 성능
- 신뢰도 변화

차트에는 원점수와 개인 기준 대비 편차를 혼동하지 않도록 라벨을 분리한다.

---

## 12. 통계 및 제품 지표 이벤트

개인정보와 일기 원문을 분석 이벤트에 넣지 않는다.

필요 이벤트 예시:

```text
onboarding_started
category_preferences_saved
diary_started
diary_saved
diary_score_completed
event_tag_confirmed
analysis_viewed
personal_model_trained
personal_model_degraded
legacy_opened
legacy_error
saju_calculation_failed
```

필수 집계:

- 온보딩 완료율
- 1일/7일/30일 기록 유지율
- 선택 카테고리 수 분포
- 카테고리별 완료율
- `해당 없음` 비율
- 점수별 분포와 사용자별 low-variance 비율
- 개인 모델 학습 가능 사용자 비율
- 기준선 대비 MAE 개선율
- 방향 정확도
- 신뢰도 등급 분포
- Legacy 화면 오류율
- 만세력 계산 실패율

---

## 13. API와 서비스 책임 분리

현재 구조에 맞게 아래 책임을 분리한다.

```text
DiaryService
- saveEntry
- updateEntry
- getEntry
- listEntries

CategoryPreferenceService
- getCatalog
- savePreferences

SajuFeatureService
- resolveCalculationMode
- calculateOrLoadSnapshot
- extractFeatures

NormalizationService
- calculateBaseline
- normalizeScore
- calculateDataQuality

PersonalizationService
- buildDataset
- trainCategoryModel
- evaluateAgainstBaseline
- predictCategoryPattern
- calculateConfidence

AnalysisNarrativeService
- buildGroundedPrompt
- generateNarrative
- validateForbiddenClaims

LegacyAdapterService
- readLegacyMood
- readLegacyHappiness
- importLegacyRecordIdempotently
```

LLM 호출 전에 구조화된 계산 결과를 생성하고, LLM 출력은 JSON schema 또는 프로젝트의 구조화 응답 방식으로 검증한다.

---

## 14. 구현 단계

### Phase 1: 보호 장치와 Legacy 인벤토리

- 기존 기능 테스트 작성
- 기능 플래그 추가
- `/docs/LEGACY_INVENTORY.md` 작성
- 데이터베이스 백업·마이그레이션 전략 문서화

### Phase 2: Legacy 라우팅

- 기존 화면을 `이전 기능` 메뉴로 연결
- 기존 딥링크 호환
- 인증과 만세력 공유 모듈 유지
- 회귀 테스트 통과

### Phase 3: 새 데이터 모델

- 신규 테이블/컬렉션과 마이그레이션
- 카테고리 seed 데이터
- Legacy Adapter
- 데이터 사전 작성

### Phase 4: 일기 UI

- 카테고리 온보딩
- 점수 입력
- 사건 태그
- 자유 일기
- 저장·수정·조회
- 접근성 및 모바일 레이아웃 확인

### Phase 5: 사주 특징 스냅샷

- 기존 계산 엔진 연결
- `native_with_luck` 기본 적용
- feature snapshot 캐시
- version/hash 저장
- 계산 detail 테스트

### Phase 6: 개인화 MVP

- 정규화
- 데이터 품질
- 카테고리별 Ridge 모델
- 기준선 비교
- 신뢰도
- 모델 저장 및 재학습

### Phase 7: 분석 화면과 문장 생성

- 일간/주간/월간 통계
- 이론상/내 기록상/실천 제안 분리
- 근거와 신뢰도 표시
- 금지 문장 필터

### Phase 8: QA와 문서

- 전체 체크리스트 수행
- 성능과 오류 지표 확인
- `/docs/RELEASE_REPORT.md` 작성
- 미완료 항목과 기술 부채 명시

각 Phase가 끝날 때 다음을 보고하라.

```text
1. 변경 파일
2. 생성한 마이그레이션
3. 추가한 테스트
4. 실행한 명령어와 결과
5. 남은 위험
6. 다음 Phase 진입 가능 여부
```

한 Phase가 빌드 또는 테스트에 실패한 상태에서 다음 Phase로 넘어가지 않는다.

---

## 15. 필수 테스트

### Legacy

- 기존 로그인 및 세션 유지
- 기존 만세력 동일 입력의 결과가 변경 전과 동일
- 기존 날짜 화면 접근 가능
- 기존 행복도·기분 기록 조회 및 저장 가능
- 이전 URL 또는 딥링크 처리

### 일기

- 카테고리 최소/최대 선택 규칙
- 카테고리 비활성화 후 과거 점수 보존
- `해당 없음`이 null로 저장
- 날짜와 사용자 timezone 보존
- 중복 저장 방지 또는 제품 정책에 따른 처리

### 정규화

- 기록 14개 미만 fallback
- 표준편차 0 또는 매우 작은 경우
- 1점과 5점 경계
- z-score clamp
- 오래된 기록의 가중치 감소

### 사주 특징

- `diary_detail -> native_with_luck`
- `simple -> luck_only`
- calculationMode 직접 전달 우선
- 오행 합계 및 출력 순서
- 지지 계산이 기존 공식 detail과 일치
- 동일 hash 캐시 재사용
- 계산 버전 변경 시 재계산

### 개인화 모델

- 13개 기록에서는 학습하지 않음
- 14개 기록에서 early 모델 생성
- 시간 순서 split 유지
- feature order 재현
- 기준선보다 나쁜 모델 숨김
- 모델 저장 후 동일 입력의 예측 재현
- 카테고리마다 독립 모델
- 결측 점수 제외

### 문장

- 이론상/내 기록상/실천 제안 구분
- 신뢰도와 표본 수 표시
- 인과 단정 금지
- 건강 진단 금지
- 데이터 부족 문구

### 비기능

- 앱 시작과 주요 화면 성능
- 실패한 사주 계산의 사용자 친화적 처리
- 네트워크 재시도 시 중복 저장 방지
- 접근 권한: 다른 사용자 기록 접근 불가
- 로그에 일기 원문·출생정보·토큰 노출 금지

---

## 16. 생성해야 할 문서

저장소에 다음 문서를 생성하고 실제 코드와 일치하게 유지한다.

```text
/docs/LEGACY_INVENTORY.md
/docs/REBUILD_PLAN.md
/docs/ARCHITECTURE.md
/docs/DATA_DICTIONARY.md
/docs/PERSONALIZATION_ALGORITHM.md
/docs/QA_CHECKLIST.md
/docs/METRICS_DASHBOARD_SPEC.md
/docs/MIGRATION_AND_ROLLBACK.md
/docs/RELEASE_REPORT.md
```

문서에는 미구현 항목을 구현된 것처럼 쓰지 않는다. 상태를 `완료`, `부분 완료`, `미완료`, `차단됨`으로 표시한다.

---

## 17. 완료 조건

다음 조건을 모두 만족해야 작업 완료로 간주한다.

- Legacy 영역에서 기존 핵심 기능에 접근할 수 있다.
- 기존 사용자와 계정 ID가 유지된다.
- 기존 만세력 회귀 테스트가 통과한다.
- 사용자가 4~9개 카테고리를 선택할 수 있다.
- 1~5점과 `해당 없음`을 정확히 저장한다.
- 일기·태그·점수·사주 특징이 날짜 기준으로 연결된다.
- 유효 기록 수에 따라 cold-start 단계가 달라진다.
- 14개 이상에서 카테고리별 Ridge 모델을 만들 수 있다.
- 기준선보다 나쁜 모델은 사용자 예측에 사용하지 않는다.
- 분석 화면에 표본 수와 신뢰도가 표시된다.
- AI가 생성한 문장은 수치 모델을 변경하지 못한다.
- 계산 detail과 모델 버전이 내부에 보존된다.
- 필수 테스트와 빌드가 통과한다.
- 요구된 `/docs` 문서가 실제 상태와 일치한다.

---

## 18. 지금 수행할 첫 응답

즉시 코드를 대량 수정하지 말고 먼저 저장소를 조사하라. 첫 응답에는 다음만 제공한다.

1. 현재 구조 요약
2. Legacy로 분류할 실제 파일과 라우트 목록
3. 공유 core로 남겨야 할 인증·만세력·날짜 모듈
4. 신규 모듈 예상 구조
5. 데이터 마이그레이션 위험
6. Phase 1에서 수정할 파일 목록
7. 발견된 모호점과 기본 가정

그다음 Phase 1부터 순서대로 구현한다. 사용자에게 이미 저장소에서 확인할 수 있는 정보를 다시 질문하지 않는다. 스택과 코드에 근거해 합리적인 기본값을 적용하고, 중요한 가정은 문서에 기록한다.
