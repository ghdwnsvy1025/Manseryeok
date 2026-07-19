import { NextRequest } from "next/server";

/**
 * 개인정보 보호: 일기 원문을 외부 AI로 전송하지 않습니다.
 * 감정·흐름 해석은 클라이언트 로컬 해석 레이어를 사용하세요.
 */
export async function POST(_req: NextRequest) {
  return Response.json(
    {
      error:
        "일기 원문 외부 분석은 비활성화되었습니다. 로컬 기록·로컬 해석만 사용합니다.",
    },
    { status: 410 }
  );
}
