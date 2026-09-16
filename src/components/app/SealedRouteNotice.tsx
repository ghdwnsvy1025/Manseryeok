"use client";

/**
 * 접힌 화면에 들어왔을 때 대신 보여주는 안내.
 *
 * 막다른 벽을 만들지 않는 게 핵심이다.
 * 이 화면들은 링크가 없어서 대부분 북마크나 예전 주소로 들어온다.
 * 그 사람은 **뭔가를 찾으러** 온 것이므로, "없어졌습니다"가 아니라
 * "그건 지금 여기 있어요"라고 말하고 데려다줘야 한다.
 */
import Link from "next/link";
import type { SealedRoute } from "@/lib/app/sealedRoutes";

export default function SealedRouteNotice({ route }: { route: SealedRoute }) {
  return (
    <div className="p-4 max-w-lg mx-auto w-full">
      <section className="px-card p-5 space-y-3">
        <p className="ui-hint">{route.title}</p>
        <h1
          className="text-xl font-black leading-snug"
          style={{ color: "var(--px-text)" }}
        >
          이 화면은 접었어요
        </h1>
        <p className="ui-guide">{route.where}</p>
        <Link
          href={route.href}
          className="ui-primary-btn block w-full py-3 text-center text-sm font-black"
        >
          {route.hrefLabel}
        </Link>
      </section>
    </div>
  );
}
