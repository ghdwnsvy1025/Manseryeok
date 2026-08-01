"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import SajuForm from "@/components/SajuForm";
import SajuResult from "@/components/SajuResult";
import { registerSajuProfileFromResult } from "@/lib/diary/registerSajuProfile";
import {
  loadJournalSajuProfile,
  loadSajuProfileById,
  loadViewSajuProfile,
  profileDisplayName,
  sajuInputFromProfile,
  setLocalViewProfileId,
  setViewSajuProfile,
  SAJU_PROFILE_CHANGED_EVENT,
} from "@/lib/diary/profileStorage";
import { useViewMode } from "@/contexts/ViewModeContext";
import type { SajuInput, SajuResult as SajuResultType } from "@/lib/saju/types";
import { calculateSaju } from "@/lib/saju/calculator";
import type { SajuProfile } from "@/lib/diary/types";

/** 서버 전용 모듈이 클라이언트 번들에 섞이지 않도록 분리 로드 */
const SajuNatalReadingPanel = dynamic(
  () => import("@/components/saju/SajuNatalReadingPanel"),
  {
    ssr: false,
    loading: () => (
      <div
        className="h-16 border-2"
        style={{ borderColor: "var(--px-border)", background: "var(--px-bg2)" }}
        aria-hidden
      />
    ),
  }
);

type PageMode = "loading" | "empty" | "register" | "view";

function SajuPageInner() {
  const { isMobile } = useViewMode();
  const searchParams = useSearchParams();
  const profileParam = searchParams.get("profile");
  const [mode, setMode] = useState<PageMode>("loading");
  const [result, setResult] = useState<SajuResultType | null>(null);
  const [resultKey, setResultKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [isOwnProfile, setIsOwnProfile] = useState(true);
  const [activeProfile, setActiveProfile] = useState<SajuProfile | null>(null);

  useEffect(() => {
    let cancelled = false;

    const applyProfile = (profile: SajuProfile, journalId: string | null) => {
      const res = calculateSaju(sajuInputFromProfile(profile));
      setProfileName(profileDisplayName(profile));
      setActiveProfile(profile);
      setIsOwnProfile(!journalId || journalId === profile.id);
      setResult(res);
      setResultKey((k) => k + 1);
      setMode("view");
      void import("@/lib/analytics/posthog").then(
        ({ ANALYTICS_EVENTS, captureEvent }) => {
          captureEvent(ANALYTICS_EVENTS.sajuOpened, {
            surface: "saju_page",
            is_own_profile: !journalId || journalId === profile.id,
          });
        }
      );
    };

    const load = async () => {
      setError(null);
      setMode("loading");

      try {
        let profile: SajuProfile | null = null;
        if (profileParam) {
          setLocalViewProfileId(profileParam);
          profile = await loadSajuProfileById(profileParam);
          void setViewSajuProfile(profileParam, { notify: false });
        } else {
          profile = await loadViewSajuProfile();
        }
        if (cancelled) return;
        if (!profile) {
          setResult(null);
          setProfileName(null);
          setActiveProfile(null);
          setIsOwnProfile(true);
          setMode("empty");
          return;
        }
        const journal = await loadJournalSajuProfile();
        if (cancelled) return;
        applyProfile(profile, journal?.id ?? null);
      } catch (err) {
        if (cancelled) return;
        setResult(null);
        setProfileName(null);
        setActiveProfile(null);
        setIsOwnProfile(true);
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
  }, [profileParam]);

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
      await setViewSajuProfile(saved.id);
      setProfileName(profileDisplayName(saved));
      setActiveProfile(saved);
      setIsOwnProfile(true);
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
            }}
          >
            ★ 내 사주 ★
          </div>
          <p className="ui-hint max-w-xs mx-auto">
            아직 등록된 사주 프로필이 없어요. 생년월일을 입력해 주세요.
          </p>
          {error && (
            <p className="text-sm font-bold" style={{ color: "#f87171" }}>
              {error}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setMode("register")}
          className="ui-primary-btn px-8 py-4 text-base"
          style={{ boxShadow: "4px 4px 0 #000" }}
        >
          사주 등록하기
        </button>
        <Link
          href="/saju/profiles"
          className="text-xs font-bold underline"
          style={{ color: "var(--px-text2)" }}
        >
          프로필 관리
        </Link>
      </div>
    );
  }

  if (mode === "register") {
    return (
      <div className={`space-y-6 ${isMobile ? "space-y-5" : ""}`}>
        <div className="text-center">
          <div
            className="inline-block px-3 py-2 border-2 text-[15px] font-bold display-font"
            style={{
              color: "var(--px-accent)",
              borderColor: "var(--px-accent)",
              background: "var(--px-bg3)",
              boxShadow: "4px 4px 0 #4a3a00",
            }}
          >
            ★ 사주 등록 ★
          </div>
        </div>
        <SajuForm
          onCalculate={(input, meta) => void handleRegister(input, meta)}
          isLoading={isLoading}
        />
        {error && (
          <p
            className="text-sm font-bold text-center"
            style={{ color: "#f87171" }}
          >
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {profileSaved && (
        <p className="ui-hint text-center">프로필이 저장되었어요.</p>
      )}
      {result && (
        <div id="result-section" className="space-y-6">
          <SajuResult
            key={resultKey}
            result={result}
            showJournalCta={isOwnProfile}
            profileName={profileName}
          />
          {activeProfile && (
            <SajuNatalReadingPanel
              key={`reading-${activeProfile.id}-${resultKey}`}
              profile={activeProfile}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default function SajuPage() {
  return (
    <Suspense
      fallback={<p className="ui-hint p-4 text-center">불러오는 중...</p>}
    >
      <SajuPageInner />
    </Suspense>
  );
}
