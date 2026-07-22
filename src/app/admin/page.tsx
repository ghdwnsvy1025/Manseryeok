"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getDiaryStorage } from "@/lib/diary/getStorage";
import { buildRealTestSeedEntries, buildTwoMonthDemoEntries } from "@/lib/diary/seedDemoEntries";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type DocRow = {
  id: string;
  title: string;
  charCount: number;
  chunkCount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type AuthState =
  | { kind: "loading" }
  | { kind: "need_login" }
  | { kind: "forbidden"; email: string }
  | { kind: "ready"; email: string };

export default function AdminPage() {
  const [auth, setAuth] = useState<AuthState>({ kind: "loading" });
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  );
  const [message, setMessage] = useState("");
  const [documents, setDocuments] = useState<DocRow[]>([]);
  const [listError, setListError] = useState("");
  const [seedStatus, setSeedStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle"
  );
  const [seedMessage, setSeedMessage] = useState("");
  const [realSeedStatus, setRealSeedStatus] = useState<
    "idle" | "loading" | "done" | "error"
  >("idle");
  const [realSeedMessage, setRealSeedMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshDocs = useCallback(async () => {
    setListError("");
    try {
      const res = await fetch("/api/admin/documents");
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setAuth({ kind: "need_login" });
          return;
        }
        if (res.status === 403) {
          setAuth((prev) =>
            prev.kind === "ready"
              ? { kind: "forbidden", email: prev.email }
              : { kind: "forbidden", email: "" }
          );
          return;
        }
        setListError(data.error ?? "목록을 불러오지 못했습니다.");
        return;
      }
      setDocuments(data.documents ?? []);
    } catch {
      setListError("목록 요청에 실패했습니다.");
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        setAuth({ kind: "need_login" });
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.email) {
        setAuth({ kind: "need_login" });
        return;
      }
      // API로 실제 권한 확인
      const res = await fetch("/api/admin/documents");
      if (res.status === 401) {
        setAuth({ kind: "need_login" });
        return;
      }
      if (res.status === 403) {
        setAuth({ kind: "forbidden", email: user.email });
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setAuth({ kind: "ready", email: user.email });
        setListError(
          (data as { error?: string }).error ?? "문서 목록을 불러오지 못했습니다."
        );
        return;
      }
      const data = await res.json();
      setAuth({ kind: "ready", email: user.email });
      setDocuments(data.documents ?? []);
    })();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setText(String(ev.target?.result ?? ""));
      if (!title.trim()) {
        setTitle(file.name.replace(/\.txt$/i, "") || "사주 이론");
      }
    };
    reader.readAsText(file, "utf-8");
  };

  const handleCreate = async () => {
    if (!text.trim()) {
      setStatus("error");
      setMessage("텍스트를 입력하거나 파일을 선택해주세요.");
      return;
    }
    setStatus("loading");
    setMessage("학습 중... 문서가 길면 몇 분 걸릴 수 있습니다. 창을 닫지 마세요.");
    try {
      const res = await fetch("/api/admin/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || "사주 이론",
          text,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setMessage(`오류: ${data.error}`);
        return;
      }
      setStatus("success");
      setMessage(
        `학습 완료! ${Number(data.totalChars).toLocaleString()}자를 ${data.chunks}개 청크로 Supabase에 저장했습니다. 배포 환경의 모든 사용자가 이 이론을 근거로 해설을 받습니다.`
      );
      setText("");
      setTitle("");
      await refreshDocs();
    } catch {
      setStatus("error");
      setMessage("서버 오류가 발생했습니다.");
    }
  };

  const handleReindex = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/documents/${id}/reindex`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(`재학습 실패: ${data.error}`);
        setStatus("error");
      } else {
        setMessage(`재학습 완료: ${data.chunks}개 청크`);
        setStatus("success");
        await refreshDocs();
      }
    } catch {
      setStatus("error");
      setMessage("재학습 요청 실패");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 이론 문서를 삭제할까요? 관련 청크도 함께 삭제됩니다.")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/documents/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setMessage(`삭제 실패: ${data.error}`);
        setStatus("error");
      } else {
        setMessage("문서를 삭제했습니다.");
        setStatus("success");
        await refreshDocs();
      }
    } catch {
      setStatus("error");
      setMessage("삭제 요청 실패");
    } finally {
      setBusyId(null);
    }
  };

  const handleSeedDemoDiary = async () => {
    setSeedStatus("loading");
    setSeedMessage("2개월 데모 일기를 저장하는 중...");
    try {
      const entries = buildTwoMonthDemoEntries();
      const storage = await getDiaryStorage();
      await storage.upsertMany(entries);
      setSeedStatus("done");
      setSeedMessage(
        `${entries.length}일분 데모 일기를 저장했습니다. 일반 통계에서는 제외됩니다.`
      );
    } catch (err) {
      setSeedStatus("error");
      setSeedMessage(
        err instanceof Error ? err.message : "데모 일기 저장에 실패했습니다."
      );
    }
  };

  const handleSeedRealTestDiary = async () => {
    setRealSeedStatus("loading");
    setRealSeedMessage("실일기 테스트 시드 20일을 저장하는 중...");
    try {
      const entries = buildRealTestSeedEntries(20);
      const storage = await getDiaryStorage();
      await storage.upsertMany(entries);
      setRealSeedStatus("done");
      setRealSeedMessage(
        `${entries.length}일분 실일기 시드를 저장했습니다. 예보 성숙도·통계에 포함됩니다.`
      );
    } catch (err) {
      setRealSeedStatus("error");
      setRealSeedMessage(
        err instanceof Error ? err.message : "실일기 시드 저장에 실패했습니다."
      );
    }
  };

  if (auth.kind === "loading") {
    return <p className="ui-hint p-4">관리자 권한을 확인하는 중…</p>;
  }

  if (auth.kind === "need_login") {
    return (
      <div className="p-4 space-y-3 border-2" style={{ borderColor: "var(--px-border)" }}>
        <p className="text-sm font-bold">관리자 로그인이 필요합니다.</p>
        <p className="ui-hint">
          ADMIN_EMAILS에 등록된 계정으로 로그인한 뒤 다시 열어주세요.
        </p>
        <Link
          href="/diary/login?next=/admin"
          className="ui-primary-btn inline-block px-3 py-2 text-sm"
        >
          로그인하러 가기
        </Link>
      </div>
    );
  }

  if (auth.kind === "forbidden") {
    return (
      <div className="p-4 space-y-3 border-2" style={{ borderColor: "#f87171" }}>
        <p className="text-sm font-bold" style={{ color: "#f87171" }}>
          관리자 권한이 없습니다.
        </p>
        <p className="ui-hint">
          현재 계정: {auth.email || "(이메일 없음)"}
          <br />
          서버 환경변수 ADMIN_EMAILS에 이 이메일을 추가하세요.
        </p>
        <Link href="/" className="text-xs font-bold underline" style={{ color: "var(--px-accent)" }}>
          홈으로
        </Link>
      </div>
    );
  }

  const statusColor = {
    idle: "var(--px-text2)",
    loading: "#fbbf24",
    success: "#4ade80",
    error: "#f87171",
  }[status];

  return (
    <div className="space-y-6">
      <div
        className="px-4 py-3 border-2 text-center"
        style={{
          background: "var(--px-bg3)",
          borderColor: "var(--px-accent)",
          boxShadow: "4px 4px 0 #4a3a00",
        }}
      >
        <h1 className="font-black text-lg" style={{ color: "var(--px-accent)" }}>
          관리자 — 사주 이론 학습
        </h1>
        <p className="text-xs mt-1" style={{ color: "var(--px-text2)" }}>
          {auth.email} · 등록한 이론은 Supabase에 저장되어 배포 사이트 모든 사용자 해설에
          사용됩니다.
        </p>
      </div>

      <div
        className="p-4 border-2 space-y-2 text-xs"
        style={{
          background: "var(--px-bg2)",
          borderColor: "var(--px-border2)",
          color: "var(--px-text2)",
        }}
      >
        <p className="font-bold" style={{ color: "var(--px-accent)" }}>
          사용 순서
        </p>
        <p>1. OPENAI_API_KEY, ADMIN_EMAILS, SUPABASE_SERVICE_ROLE_KEY 설정</p>
        <p>2. migration 006_rag_knowledge.sql 실행</p>
        <p>3. 아래에 이론 텍스트 등록 (TXT 또는 붙여넣기)</p>
        <p>4. 홈·만세력·내일 예보 해설이 자동으로 이 이론을 참고합니다</p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-bold" style={{ color: "var(--px-accent)" }}>
          문서 제목
        </p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예: 십신·합충 해설집"
          className="w-full px-3 py-2 text-sm border-2"
          style={{
            background: "var(--px-bg2)",
            borderColor: "var(--px-border)",
            color: "var(--px-text)",
          }}
        />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-bold" style={{ color: "var(--px-accent)" }}>
          TXT 파일 선택
        </p>
        <div className="flex gap-2 items-center">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-btn px-4 py-2 text-sm"
          >
            [ 파일 선택 ]
          </button>
          <span className="text-xs" style={{ color: "var(--px-text2)" }}>
            {text ? `${text.length.toLocaleString()}자 로드됨` : "선택된 파일 없음"}
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-bold" style={{ color: "var(--px-accent)" }}>
          또는 텍스트 직접 붙여넣기
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="사주 해석 이론 텍스트를 붙여넣으세요..."
          rows={10}
          className="w-full p-3 text-xs font-mono border-2 resize-y"
          style={{
            background: "var(--px-bg2)",
            borderColor: "var(--px-border)",
            color: "var(--px-text)",
            outline: "none",
          }}
        />
        <p className="text-xs" style={{ color: "var(--px-text2)" }}>
          현재 입력: {text.length.toLocaleString()}자
        </p>
      </div>

      <button
        type="button"
        onClick={handleCreate}
        disabled={status === "loading"}
        className="px-btn w-full py-3 text-base"
      >
        {status === "loading" ? "[ 학습 중... ]" : "[ 이론 등록 · 학습 시작 ]"}
      </button>

      {message && (
        <div
          className="p-4 border-2 text-sm"
          style={{ borderColor: statusColor, background: "var(--px-bg2)", color: statusColor }}
        >
          {message}
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold" style={{ color: "var(--px-accent)" }}>
            등록된 이론 문서
          </p>
          <button
            type="button"
            onClick={() => void refreshDocs()}
            className="text-xs font-bold underline"
            style={{ color: "#60a5fa" }}
          >
            새로고침
          </button>
        </div>
        {listError && (
          <p className="text-xs font-bold" style={{ color: "#f87171" }}>
            {listError}
          </p>
        )}
        {documents.length === 0 ? (
          <p className="ui-hint">아직 등록된 이론이 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="p-3 border-2 space-y-1"
                style={{ borderColor: "var(--px-border)", background: "var(--px-bg3)" }}
              >
                <p className="text-sm font-black" style={{ color: "var(--px-accent)" }}>
                  {doc.title}
                </p>
                <p className="ui-hint">
                  {doc.status} · {doc.charCount.toLocaleString()}자 · {doc.chunkCount}청크
                  <br />
                  업데이트 {new Date(doc.updatedAt).toLocaleString("ko-KR")}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    disabled={busyId === doc.id}
                    onClick={() => void handleReindex(doc.id)}
                    className="text-xs font-bold underline"
                    style={{ color: "#60a5fa" }}
                  >
                    재학습
                  </button>
                  <button
                    type="button"
                    disabled={busyId === doc.id}
                    onClick={() => void handleDelete(doc.id)}
                    className="text-xs font-bold underline"
                    style={{ color: "#f87171" }}
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div
        className="p-4 border-2 space-y-3"
        style={{ background: "var(--px-bg2)", borderColor: "var(--px-border)" }}
      >
        <p className="font-bold text-sm" style={{ color: "var(--px-accent)" }}>
          실일기 테스트 시드 (관리자 전용)
        </p>
        <p className="text-xs" style={{ color: "var(--px-text2)" }}>
          최근 20일 연속 일기를 <strong>user</strong> 출처로 넣습니다. 예보
          성숙도·맞춤 패턴 테스트에 사용하세요.
        </p>
        <button
          type="button"
          onClick={() => void handleSeedRealTestDiary()}
          disabled={realSeedStatus === "loading"}
          className="px-btn w-full py-2 text-sm"
        >
          {realSeedStatus === "loading"
            ? "[ 저장 중... ]"
            : "[ 실일기 20일 시드 넣기 ]"}
        </button>
        {realSeedMessage && (
          <p
            className="text-xs font-bold"
            style={{
              color:
                realSeedStatus === "error"
                  ? "#f87171"
                  : realSeedStatus === "done"
                    ? "#4ade80"
                    : "var(--px-text2)",
            }}
          >
            {realSeedMessage}
          </p>
        )}
      </div>

      <div
        className="p-4 border-2 space-y-3"
        style={{ background: "var(--px-bg2)", borderColor: "var(--px-border)" }}
      >
        <p className="font-bold text-sm" style={{ color: "var(--px-accent)" }}>
          통계용 데모 일기 (관리자 전용)
        </p>
        <p className="text-xs" style={{ color: "var(--px-text2)" }}>
          최근 약 2개월치 임의 일기를 현재 저장소에 넣습니다. 이론 RAG와 무관합니다.
        </p>
        <button
          type="button"
          onClick={handleSeedDemoDiary}
          disabled={seedStatus === "loading"}
          className="px-btn w-full py-2 text-sm"
        >
          {seedStatus === "loading" ? "[ 저장 중... ]" : "[ 2개월 데모 일기 넣기 ]"}
        </button>
        {seedMessage && (
          <p
            className="text-xs font-bold"
            style={{
              color:
                seedStatus === "error"
                  ? "#f87171"
                  : seedStatus === "done"
                    ? "#4ade80"
                    : "var(--px-text2)",
            }}
          >
            {seedMessage}
          </p>
        )}
      </div>
    </div>
  );
}
