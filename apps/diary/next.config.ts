import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 저장소 루트. packages/saju-engine까지 배포 번들 추적에 포함시킨다
  outputFileTracingRoot: path.join(__dirname, "../.."),
  // 엔진은 TypeScript 원본 그대로 링크돼 있어 Next가 직접 변환한다
  transpilePackages: ["@saju/engine", "@saju/core-rules", "lunar-javascript"],
  // Vercel에는 eslint가 설치돼 있지 않다(개발 의존성 아님). 빌드 때 ESLint 단계는 건너뛴다
  eslint: { ignoreDuringBuilds: true },
  // 키트 이미지·카드·캐릭터는 내용이 바뀌면 파일명이 바뀐다(에셋 재납품). 1년 캐시로 탭 전환마다 304 왕복이 생기지 않게 한다
  async headers() {
    const immutable = [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }];
    return [
      { source: "/ui/:path*", headers: immutable },
      { source: "/cards/:path*", headers: immutable },
      { source: "/characters/:path*", headers: immutable },
      { source: "/icons/:path*", headers: immutable },
    ];
  },
  webpack(config) {
    // packages/saju-engine 링크를 실제 경로로 풀지 않는다.
    // 그래야 엔진 안의 import("lunar-javascript")가 이 앱의 node_modules에서 찾아진다 (Vercel에서도 동일).
    config.resolve.symlinks = false;
    return config;
  },
};

export default nextConfig;
