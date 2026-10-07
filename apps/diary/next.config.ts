import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 저장소 루트. packages/saju-engine까지 배포 번들 추적에 포함시킨다
  outputFileTracingRoot: path.join(__dirname, "../.."),
  // 엔진은 TypeScript 원본 그대로 링크돼 있어 Next가 직접 변환한다
  transpilePackages: ["@saju/engine", "@saju/core-rules", "lunar-javascript"],
  // Vercel에는 eslint가 설치돼 있지 않다(개발 의존성 아님). 빌드 때 ESLint 단계는 건너뛴다
  eslint: { ignoreDuringBuilds: true },
  webpack(config) {
    // packages/saju-engine 링크를 실제 경로로 풀지 않는다.
    // 그래야 엔진 안의 import("lunar-javascript")가 이 앱의 node_modules에서 찾아진다 (Vercel에서도 동일).
    config.resolve.symlinks = false;
    return config;
  },
};

export default nextConfig;
