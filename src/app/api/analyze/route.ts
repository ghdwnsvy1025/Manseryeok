import { NextRequest } from "next/server";

/**
 * 개인정보 보호: 정확한 생년월일·사주 원국을 외부 AI로 전송하지 않습니다.
 * 전문 만세력 화면의 로컬 해석 레이어를 사용하세요.
 */
export async function POST(_req: NextRequest) {
  return Response.json(
    {
      error:
        "사주 원국 외부 분석은 비활성화되었습니다. 로컬 해석 및 참고 의견을 사용합니다.",
    },
    { status: 410 }
  );
}
