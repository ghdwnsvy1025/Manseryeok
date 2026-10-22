"use client";

import Link from "next/link";
import type { ComponentProps, MouseEvent } from "react";
import { track } from "@/lib/analytics";
import type { Props } from "@/lib/analytics/core";

type LinkProps = ComponentProps<typeof Link>;

/** 누르면 이벤트 하나 보내는 Link (서버 컴포넌트 화면의 버튼용). 모양·동작은 Link 그대로 */
export function TrackedLink({ event, eventProps, onClick, ...rest }: LinkProps & { event: string; eventProps?: Props }) {
  return (
    <Link
      {...rest}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        track(event, eventProps);
        onClick?.(e);
      }}
    />
  );
}
