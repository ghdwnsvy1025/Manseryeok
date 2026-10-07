"use client";

import { useActionState } from "react";
import { saveNameAction, type FormState } from "@/app/actions";

interface Props {
  /** 지금 이름. "손님"(익명 기본값)이면 빈 칸으로 보인다 */
  current: string | null;
}

/** 익명 기본 이름 — 화면에는 비워 보인다 (B4). me/page.tsx도 같은 글자를 본다 */
const GUEST_NAME = "손님";

/** 설정 "이름" 한 줄 (B4): 현재 이름 + 입력칸 + 저장. 운세 문장·공유 문구·"나" 머리가 이 이름을 쓴다 */
export function NameForm({ current }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveNameAction, { error: null });
  const shown = current && current !== GUEST_NAME ? current : "";

  return (
    <form action={action} className="mt-3 flex flex-col gap-2">
      <label htmlFor="settings-name" className="sr-only">
        이름
      </label>
      <div className="flex items-center gap-2">
        <input
          id="settings-name"
          name="name"
          key={shown}
          defaultValue={shown}
          maxLength={40}
          autoComplete="nickname"
          placeholder={shown ? "" : "불릴 이름"}
          className="field field--text min-w-0 flex-1"
          aria-invalid={state.error ? true : undefined}
          required
        />
        <button
          type="submit"
          disabled={pending}
          className="h-11 shrink-0 rounded-lg border border-frame px-4 text-[15px] font-bold text-ink disabled:opacity-60"
        >
          {pending ? "저장 중…" : "저장"}
        </button>
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : (
        <p className="text-sm text-muted">운세 문장·공유 문구·나 화면에 이 이름이 들어가요.</p>
      )}
    </form>
  );
}
