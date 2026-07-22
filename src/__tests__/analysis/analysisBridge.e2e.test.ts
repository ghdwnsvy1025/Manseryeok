/**
 * Bridge: invoked by verify-analysis-remote-e2e.mjs / verify-analysis-narrative-live.mjs
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import { assembleAnalysis } from "@/lib/analysis/assemble";
import { loadRemoteAssembleInput } from "@/lib/analysis/loadRemoteContext";
import { generateAnalysisNarrative } from "@/lib/analysis/narrative";
import { buildNarrativeInput } from "@/lib/analysis/narrativeContract";
import { auditViewModelPrivacy } from "@/lib/analysis/privacyAudit";
import type { AssembleInput, PeriodType } from "@/lib/analysis/types";

type BridgeInput = {
  mode: "remote_assemble" | "narrative_live" | "assemble_local";
  url?: string;
  anonKey?: string;
  accessToken?: string | null;
  periodType?: PeriodType;
  periodStart?: string;
  periodEnd?: string;
  focusDate?: string;
  categoryKey?: string;
  assembleInput?: AssembleInput;
  /** narrative_live scenarios */
  scenario?: string;
};

describe("Phase 5 — analysis remote bridge", () => {
  test("run bridge once", async () => {
    const path = process.env.P5_E2E_INPUT_PATH;
    const outPath = process.env.P5_E2E_OUTPUT_PATH;
    if (!path || !outPath) {
      expect(true).toBe(true);
      return;
    }

    const input = JSON.parse(fs.readFileSync(path, "utf8")) as BridgeInput;
    let result: unknown;

    if (input.mode === "assemble_local" && input.assembleInput) {
      const vm = assembleAnalysis(input.assembleInput);
      const privacy = auditViewModelPrivacy(vm);
      const narrativeInput = buildNarrativeInput(vm);
      result = {
        mode: "assemble_local",
        viewModel: vm,
        privacy,
        narrativeInput,
        sampleCount: vm.sampleCount,
        modelExposureAllowed: vm.modelExposureAllowed,
        predictionVisible: vm.predictionVisible,
        hideReasons: vm.hideReasons,
      };
    } else if (input.mode === "remote_assemble") {
      const sb = createClient(input.url!, input.anonKey!, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: input.accessToken
          ? { headers: { Authorization: `Bearer ${input.accessToken}` } }
          : undefined,
      });
      const loaded = await loadRemoteAssembleInput(sb, {
        periodType: input.periodType!,
        periodStart: input.periodStart!,
        periodEnd: input.periodEnd!,
        focusDate: input.focusDate,
        categoryKey: input.categoryKey || "energy",
      });
      const vm = assembleAnalysis(loaded.assembleInput);
      const privacy = auditViewModelPrivacy(vm);
      const narrativeInput = buildNarrativeInput(vm);
      result = {
        mode: "remote_assemble",
        authenticated: loaded.authenticated,
        loadOk: loaded.ok,
        loadError: loaded.error ?? null,
        audit: loaded._audit ?? null,
        viewModel: {
          periodType: vm.periodType,
          periodStart: vm.periodStart,
          periodEnd: vm.periodEnd,
          categoryKey: vm.categoryKey,
          sampleCount: vm.sampleCount,
          modelStatus: vm.modelStatus,
          dataStage: vm.dataStage,
          predictionVisible: vm.predictionVisible,
          modelExposureAllowed: vm.modelExposureAllowed,
          confidenceScore: vm.confidenceScore,
          confidenceBand: vm.confidenceBand,
          hideReasons: vm.hideReasons,
          baselineSummary: vm.baselineSummary,
          versionMetadata: vm.versionMetadata,
          astrologyAvailable: vm.astrologyTheoryLayer?.available ?? false,
          recordAvailable: vm.personalRecordLayer?.available ?? false,
          theoryTextPreview: (vm.astrologyTheoryLayer?.text || "").slice(0, 80),
          recordTextPreview: (vm.personalRecordLayer?.text || "").slice(0, 80),
          suggestionTextPreview: (
            vm.actionSuggestionLayer?.text || ""
          ).slice(0, 80),
        },
        privacy: { ok: privacy.ok, reasons: privacy.reasons },
        narrativeInputKeys: Object.keys(narrativeInput),
        narrativeHasUserId: JSON.stringify(narrativeInput).includes("userId"),
        narrativeBlob: JSON.stringify(narrativeInput),
      };
    } else if (input.mode === "narrative_live") {
      if (!input.assembleInput) {
        result = { mode: "narrative_live", error: "missing_assembleInput" };
      } else {
        const vm = assembleAnalysis(input.assembleInput);
        const narrative = await generateAnalysisNarrative(vm);
        result = {
          mode: "narrative_live",
          scenario: input.scenario || "default",
          source: narrative.source,
          reasons: narrative.reasons,
          output: narrative.output,
          privacy: auditViewModelPrivacy(vm),
          llmFlag: process.env.FF_ANALYSIS_NARRATIVE_LLM || "",
          hasApiKey: Boolean(process.env.OPENAI_API_KEY),
        };
      }
    } else {
      result = { error: "unknown_mode", mode: input.mode };
    }

    fs.writeFileSync(outPath, JSON.stringify(result, null, 2), "utf8");
    expect(true).toBe(true);
  }, 120_000);
});
