import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "오늘의 사주 일기",
    short_name: "사주일기",
    description:
      "오늘의 흐름과 행복도·컨디션을 기록하고 나만의 반복 패턴을 확인하는 사주 기반 일기",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#11100d",
    theme_color: "#f5c451",
    lang: "ko-KR",
    categories: ["lifestyle", "productivity"],
    icons: [
      {
        src: "/icons/app-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/app-icon-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
