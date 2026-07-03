"use client";

import { useState, useRef } from "react";

type EmbedStatus = "idle" | "loading" | "success" | "error";

export default function AdminPage() {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<EmbedStatus>("idle");
  const [message, setMessage] = useState("");
  const [chunkCount, setChunkCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 파일 선택 시 내용 읽기
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      setText(content);
    };
    reader.readAsText(file, "utf-8");
  };

  // 임베딩 생성 (학습 시작)
  const handleEmbed = async () => {
    if (!text.trim()) {
      setMessage("텍스트를 먼저 입력하거나 파일을 선택해주세요.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setMessage("학습 중... (텍스트 양에 따라 1~3분 소요될 수 있습니다)");

    try {
      const res = await fetch("/api/embed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setMessage(`오류: ${data.error}`);
        return;
      }

      setStatus("success");
      setChunkCount(data.chunks);
      setCharCount(data.totalChars);
      setMessage(`학습 완료! ${data.totalChars.toLocaleString()}자를 ${data.chunks}개 청크로 분할하여 저장했습니다.`);
    } catch {
      setStatus("error");
      setMessage("서버 오류가 발생했습니다. 서버가 실행 중인지 확인해주세요.");
    }
  };

  const statusColor = {
    idle: "var(--px-text2)",
    loading: "#fbbf24",
    success: "#4ade80",
    error: "#f87171",
  }[status];

  return (
    <div className="space-y-6">
      {/* 타이틀 */}
      <div
        className="px-4 py-3 border-2 text-center"
        style={{
          background: "var(--px-bg3)",
          borderColor: "var(--px-accent)",
          boxShadow: "4px 4px 0 #4a3a00",
        }}
      >
        <h1 className="font-black text-lg" style={{ color: "var(--px-accent)" }}>
          ⚙ 관리자 — AI 학습 설정
        </h1>
        <p className="text-xs mt-1" style={{ color: "var(--px-text2)" }}>
          사주 해석 텍스트를 업로드하고 AI 학습을 시작합니다.
        </p>
      </div>

      {/* 안내 */}
      <div
        className="p-4 border-2 space-y-2 text-xs"
        style={{
          background: "var(--px-bg2)",
          borderColor: "var(--px-border2)",
          color: "var(--px-text2)",
        }}
      >
        <p className="font-bold" style={{ color: "var(--px-accent)" }}>■ 사용 순서</p>
        <p>① .env.local 파일에 OPENAI_API_KEY를 입력 (서버 재시작 필요)</p>
        <p>② 아래에서 txt 파일을 선택하거나 텍스트를 직접 붙여넣기</p>
        <p>③ [학습 시작] 버튼 클릭 (1~3분 소요)</p>
        <p>④ 완료 후 메인 페이지에서 사주 계산 → AI 분석하기 버튼 사용</p>
      </div>

      {/* 파일 업로드 */}
      <div className="space-y-2">
        <p className="text-xs font-bold" style={{ color: "var(--px-accent)" }}>■ TXT 파일 선택</p>
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

      {/* 텍스트 직접 입력 */}
      <div className="space-y-2">
        <p className="text-xs font-bold" style={{ color: "var(--px-accent)" }}>
          ■ 또는 텍스트 직접 붙여넣기
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="사주 해석 텍스트를 여기에 붙여넣어 주세요..."
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

      {/* 학습 시작 버튼 */}
      <button
        type="button"
        onClick={handleEmbed}
        disabled={status === "loading"}
        className="px-btn w-full py-3 text-base"
      >
        {status === "loading" ? "[ 학습 중... 잠시 기다려주세요 ]" : "[ 학습 시작 ]"}
      </button>

      {/* 상태 메시지 */}
      {message && (
        <div
          className="p-4 border-2 text-sm"
          style={{
            borderColor: statusColor,
            background: "var(--px-bg2)",
            color: statusColor,
          }}
        >
          <p>{message}</p>
          {status === "success" && (
            <div className="mt-3 space-y-1 text-xs" style={{ color: "var(--px-text2)" }}>
              <p>총 글자수: {charCount.toLocaleString()}자</p>
              <p>청크(조각) 수: {chunkCount}개</p>
              <p>
                →{" "}
                <a href="/" style={{ color: "var(--px-accent)", textDecoration: "underline" }}>
                  메인 페이지
                </a>
                로 돌아가서 사주를 계산해보세요!
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
