"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SajuForm from "@/components/SajuForm";
import SajuResult from "@/components/SajuResult";
import { registerSajuProfileFromResult } from "@/lib/diary/registerSajuProfile";
import {
  loadPrimarySajuProfile,
  profileDisplayName,
  sajuInputFromProfile,
  SAJU_PROFILE_CHANGED_EVENT,
} from "@/lib/diary/profileStorage";
import { useViewMode } from "@/contexts/ViewModeContext";
import type { SajuInput, SajuResult as SajuResultType } from "@/lib/saju/types";
import { calculateSaju } from "@/lib/saju/calculator";

type PageMode = "loading" | "empty" | "register" | "view";

export default function SajuPage() {
  const { isMobile } = useViewMode();
  const [mode, setMode] = useState<PageMode>("loading");
  const [result, setResult] = useState<SajuResultType | null>(null);
  const [resultKey, setResultKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileName, setProfileName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setError(null);
      try {
        const profile = await loadPrimarySajuProfile();
        if (cancelled) return;
        if (!profile) {
          setResult(null);
          setProfileName(null);
          setMode("empty");
          return;
        }
        const res = calculateSaju(sajuInputFromProfile(profile));
        setProfileName(profileDisplayName(profile));
        setResult(res);
        setResultKey((k) => k + 1);
        setMode("view");
      } catch (err) {
        if (cancelled) return;
        setResult(null);
        setProfileName(null);
        setError(
          err instanceof Error ? err.message : "사주를 불러오지 못했어요."
        );
        setMode("empty");
      }
    };

    void load();

    const onChange = () => void load();
    window.addEventListener(SAJU_PROFILE_CHANGED_EVENT, onChange);
    return () => {
      cancelled = true;
      window.removeEventListener(SAJU_PROFILE_CHANGED_EVENT, onChange);
    };
  }, []);

  const handleRegister = async (
    input: SajuInput,
    meta: { label?: string }
  ) => {
    setError(null);
    setProfileSaved(false);
    setIsLoading(true);
    try {
      const res = calculateSaju(input);
      const saved = await registerSajuProfileFromResult(res, {
        label: meta.label,
        makePrimary: true,
      });
      setProfileName(profileDisplayName(saved));
      setResultKey((k) => k + 1);
      setResult(res);
      setProfileSaved(true);
      setMode("view");
      setTimeout(() => {
        document
          .getElementById("result-section")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (err) {
      setResult(null);
      setError(
        err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다."
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (mode === "loading") {
    return <p className="ui-hint p-4 text-center">불러오는 중...</p>;
  }

  if (mode === "empty") {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-6 py-16 px-4 ${
          isMobile ? "py-12" : ""
        }`}
      >
        <div className="text-center space-y-3">
          <div
            className="inline-block px-3 sm:px-4 py-2 border-2 text-[15px] font-bold display-font"
            style={{
              color: "var(--px-accent)",
              borderColor: "var(--px-accent)",
              background: "var(--px-bg3)",
              boxShadow: "4px 4px 0 #4a3a00",
              letterSpacing: "0.1em",
            }}
          >
            ★ 내 사주 ★
          </div>
          <p className="ui-page-intro max-w-sm mx-auto">
            아직 등록된 사주가 없어요.
            <br />
            생년월일을 등록하면 내 만세력을 볼 수 있어요.
          </p>
        </div>

        {error && (
          <p className="text-sm font-bold" style={{ color: "#f87171" }}>
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => {
            setError(null);
            setMode("register");
          }}
          className="ui-primary-btn px-8 py-3 text-sm font-black"
        >
          등록하러 가기
        </button>
      </div>
    );
  }

  if (mode === "register") {
    return (
      <div className={`space-y-6 sm:space-y-8 ${isMobile ? "space-y-5" : ""}`}>
        <div className="text-center">
          <div
            className="inline-block px-3 sm:px-4 py-2 border-2 text-[15px] font-bold display-font"
            style={{
              color: "var(--px-accent)",
              borderColor: "var(--px-accent)",
              background: "var(--px-bg3)",
              boxShadow: "4px 4px 0 #4a3a00",
              letterSpacing: "0.1em",
            }}
          >
            ★ 내 사주 등록 ★
          </div>
        </div>

        <div id="saju-form">
          <SajuForm
            onCalculate={(input, meta) => void handleRegister(input, meta)}
            isLoading={isLoading}
          />
        </div>

        {error && (
          <div
            className="border-2 px-4 py-4"
            style={{
              borderColor: "#f87171",
              background: "#1a0a0a",
              boxShadow: "4px 4px 0 #7f1d1d",
              color: "#f87171",
            }}
          >
            <p className="text-sm font-bold mb-1">■ 오류</p>
            <p className="text-sm">{error}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-6 sm:space-y-8 ${isMobile ? "space-y-5" : ""}`}>
      <div className="text-center space-y-3 sm:space-y-4">
        <div
          className="inline-block px-3 sm:px-4 py-2 border-2 text-[15px] font-bold display-font"
          style={{
            color: "var(--px-accent)",
            borderColor: "var(--px-accent)",
            background: "var(--px-bg3)",
            boxShadow: "4px 4px 0 #4a3a00",
            letterSpacing: "0.1em",
          }}
        >
          ★ 내 사주 ★
        </div>
        <p className="ui-page-intro max-w-md mx-auto">
          {profileName ? (
            <>
              <strong style={{ color: "var(--px-text)" }}>{profileName}</strong>
              님의 만세력이에요.
            </>
          ) : (
            "내가 등록한 만세력이에요."
          )}
        </p>
      </div>

      {profileSaved && (
        <div
          className="px-4 py-3 border-2 space-y-1"
          style={{
            borderColor: "var(--px-accent)",
            background: "var(--px-bg2)",
            boxShadow: "4px 4px 0 #000",
          }}
          role="status"
        >
          <p className="text-sm font-black" style={{ color: "var(--px-accent)" }}>
            성공적으로 등록되었습니다.
          </p>
          <p className="text-xs" style={{ color: "var(--px-text)" }}>
            이제 이 사주 프로필이 오늘의 흐름과 기록에 적용됩니다.
          </p>
        </div>
      )}

      {error && (
        <div
          className="border-2 px-4 py-4"
          style={{
            borderColor: "#f87171",
            background: "#1a0a0a",
            boxShadow: "4px 4px 0 #7f1d1d",
            color: "#f87171",
          }}
        >
          <p className="text-sm font-bold mb-1">■ 오류</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {result && (
        <div id="result-section">
          <div
            className="px-3 py-1.5 text-xs font-bold border-2 border-b-0 inline-block"
            style={{
              background: "var(--px-bg3)",
              borderColor: "var(--px-accent)",
              color: "var(--px-accent)",
            }}
          >
            ★ 만세력 상세
          </div>
          <SajuResult key={resultKey} result={result} />
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-4 pt-2">
        <Link
          href="/saju/profiles"
          className="text-xs font-bold underline"
          style={{ color: "var(--px-text2)" }}
        >
          프로필 관리
        </Link>
      </div>
    </div>
  );
}
