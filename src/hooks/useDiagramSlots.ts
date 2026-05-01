/**
 * useDiagramSlots — per-session, per-type slot state for the SAD diagram phase.
 *
 * Backed by the server's `design_sessions.diagram_slots` JSONB column via
 * the API client in [src/services/designSessionApi.ts](../services/designSessionApi.ts).
 * localStorage is kept as a stale-cache fallback so a slow first GET (or a
 * brief network hiccup) doesn't make the hub flicker through Pending.
 *
 * Optimistic mutation pattern: every action flips local state immediately
 * (the hub paints the receipt) and reconciles with the server's authoritative
 * response when the call settles. On failure, we roll back and surface a
 * `lastError` field the host can render in a Banner.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getDiagramSlots,
  patchDiagramSlot,
  setDesignSessionTool,
  type AuthoringTool as ApiAuthoringTool,
  type DiagramSlot as ApiDiagramSlot,
  type DiagramSlotsState as ApiDiagramSlotsState,
  type DiagramType as ApiDiagramType,
  type SlotStatus as ApiSlotStatus,
} from "@/services/designSessionApi";

// Re-export the API types under the hook's namespace so existing
// importers (DiagramPhaseHost, the screens) don't need to change.
export type DiagramType = ApiDiagramType;
export type SlotStatus = ApiSlotStatus;
export type AuthoringTool = ApiAuthoringTool;

export interface DiagramSlot {
  type: DiagramType;
  status: SlotStatus;
  tool?: AuthoringTool;
  artifactKey?: string;
  /** epoch ms — converted from the server's epoch seconds for parity with
   *  the existing UI, which formats with `new Date(ms)`. */
  savedAt?: number;
  edited?: boolean;
  error?: string;
}

export interface DiagramSlotsState {
  tool: AuthoringTool | null;
  slots: Record<DiagramType, DiagramSlot>;
}

const TYPE_ORDER: DiagramType[] = ["logical", "infrastructure", "security"];

const SAD_SECTION_BY_TYPE: Record<DiagramType, number> = {
  logical: 4,
  infrastructure: 7,
  security: 6,
};

/** Stable display labels — kept in the hook so screens stay in sync. */
export const TYPE_LABEL: Record<DiagramType, { plate: string; title: string; subtitle: string; marginalia: string }> = {
  logical: {
    plate: "Plate · 01",
    title: "Logical · What & Why",
    subtitle: "Vendor-agnostic capabilities and the data flowing between them.",
    marginalia: "Vendor-agnostic capabilities and the data flowing between them. Audience: developers, architects, business stakeholders.",
  },
  infrastructure: {
    plate: "Plate · 02",
    title: "Infrastructure · Where & How",
    subtitle: "AWS services, networks, and how the pieces wire up.",
    marginalia: "AWS services, networks, and how the deployed pieces wire up. Audience: DevOps, SRE, platform.",
  },
  security: {
    plate: "Plate · 03",
    title: "Security · Who & Protected",
    subtitle: "Trust boundaries, controls, and access policies.",
    marginalia: "Trust boundaries, controls, and access policies. Audience: security, auditors, compliance.",
  },
};

const sectionFor = (t: DiagramType): number => SAD_SECTION_BY_TYPE[t];

const emptySlot = (type: DiagramType): DiagramSlot => ({ type, status: "pending" });

function emptyState(): DiagramSlotsState {
  return {
    tool: null,
    slots: {
      logical: emptySlot("logical"),
      infrastructure: emptySlot("infrastructure"),
      security: emptySlot("security"),
    },
  };
}

/** Convert the API's snake_case + epoch-seconds shape to the hook's
 *  camelCase + epoch-ms shape consumed by the UI components. */
function fromApi(api: ApiDiagramSlotsState): DiagramSlotsState {
  const norm = (type: DiagramType, raw?: ApiDiagramSlot): DiagramSlot => ({
    type,
    status: raw?.status ?? "pending",
    tool: raw?.tool,
    artifactKey: raw?.artifact_key,
    savedAt: raw?.saved_at ? raw.saved_at * 1000 : undefined,
    error: raw?.error,
  });
  return {
    tool: api.tool,
    slots: {
      logical: norm("logical", api.slots?.logical),
      infrastructure: norm("infrastructure", api.slots?.infrastructure),
      security: norm("security", api.slots?.security),
    },
  };
}

const cacheKey = (sessionId: string) => `velox.designSlots.${sessionId}`;

function loadCache(sessionId: string): DiagramSlotsState | null {
  try {
    const raw = localStorage.getItem(cacheKey(sessionId));
    if (!raw) return null;
    return JSON.parse(raw) as DiagramSlotsState;
  } catch {
    return null;
  }
}

function saveCache(sessionId: string, state: DiagramSlotsState) {
  try {
    localStorage.setItem(cacheKey(sessionId), JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export interface UseDiagramSlots {
  state: DiagramSlotsState;
  slot: (type: DiagramType) => DiagramSlot;
  sectionFor: (type: DiagramType) => number;

  /** True while the first server load is in flight; the hub renders a
   *  cached state under this so first paint isn't all-Pending. */
  loading: boolean;
  /** Last server error (PATCH failure, refresh failure). The hub surfaces
   *  this as a recoverable Banner. Cleared on next successful call. */
  lastError: string | null;
  /** Force-refresh the slots from the server (used after /save-diagram). */
  refresh: () => Promise<void>;

  /** Tool ops. */
  setTool: (tool: AuthoringTool) => Promise<void>;

  /** Hub-facing transitions — all server-roundtripped + optimistic. */
  open: (type: DiagramType) => void;
  /** Atomic save isn't local — caller (DiagramPhaseHost) calls
   *  /api/design/save-diagram which moves the slot to Done server-side, then
   *  refresh() pulls the new state. The local `markSaved` is for the
   *  optimistic UI flip pre-server-confirmation. */
  markSaved: (type: DiagramType, info: { artifactKey?: string }) => void;
  closeWithoutSave: (type: DiagramType) => void;
  skip: (type: DiagramType) => Promise<void>;
  unskip: (type: DiagramType) => Promise<void>;
  retry: (type: DiagramType) => void;
  fail: (type: DiagramType, error: string) => void;

  anyInProgress: boolean;
  hasAnyTerminal: boolean;
  allPending: boolean;
}

const previousStatusByType: Partial<Record<DiagramType, SlotStatus>> = {};

export function useDiagramSlots(sessionId: string | null): UseDiagramSlots {
  const [state, setState] = useState<DiagramSlotsState>(() => {
    if (!sessionId) return emptyState();
    return loadCache(sessionId) ?? emptyState();
  });
  const [loading, setLoading] = useState<boolean>(!!sessionId);
  const [lastError, setLastError] = useState<string | null>(null);
  // Track the most recent fetch to ignore late responses for stale sessions.
  const fetchTokenRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!sessionId) return;
    const myToken = ++fetchTokenRef.current;
    try {
      const api = await getDiagramSlots(sessionId);
      if (myToken !== fetchTokenRef.current) return; // ignore late
      const next = fromApi(api);
      setState(next);
      saveCache(sessionId, next);
      setLastError(null);
    } catch (e) {
      if (myToken !== fetchTokenRef.current) return;
      setLastError(e instanceof Error ? e.message : "Couldn't load diagram slots.");
    } finally {
      if (myToken === fetchTokenRef.current) setLoading(false);
    }
  }, [sessionId]);

  // Initial / session-change load.
  useEffect(() => {
    if (!sessionId) {
      setState(emptyState());
      setLoading(false);
      return;
    }
    const cached = loadCache(sessionId);
    setState(cached ?? emptyState());
    setLoading(true);
    void refresh();
  }, [sessionId, refresh]);

  // Persist locally on every state change so a refresh paints something
  // sensible immediately on next mount.
  useEffect(() => {
    if (sessionId) saveCache(sessionId, state);
  }, [sessionId, state]);

  const update = useCallback((type: DiagramType, patch: Partial<DiagramSlot>) => {
    setState((prev) => ({
      ...prev,
      slots: { ...prev.slots, [type]: { ...prev.slots[type], ...patch } },
    }));
  }, []);

  const setTool = useCallback<UseDiagramSlots["setTool"]>(
    async (tool) => {
      // Optimistic.
      setState((prev) => ({ ...prev, tool }));
      if (!sessionId) return;
      try {
        const api = await setDesignSessionTool(sessionId, tool);
        const next = fromApi(api);
        setState(next);
        saveCache(sessionId, next);
        setLastError(null);
      } catch (e) {
        setLastError(e instanceof Error ? e.message : "Couldn't save your tool choice.");
      }
    },
    [sessionId],
  );

  const open = useCallback<UseDiagramSlots["open"]>((type) => {
    // Local-only — opening the editor doesn't need server confirmation.
    // The corresponding skip / save / closeWithoutSave actions sync state.
    setState((prev) => {
      const cur = prev.slots[type];
      previousStatusByType[type] = cur.status;
      return {
        ...prev,
        slots: {
          ...prev.slots,
          [type]: { ...cur, status: "in_progress", error: undefined },
        },
      };
    });
  }, []);

  const markSaved = useCallback<UseDiagramSlots["markSaved"]>(
    (type, info) => {
      // Optimistic flip; the parent will refresh() right after to pick
      // up the server's canonical timestamps.
      update(type, {
        status: "done",
        artifactKey: info.artifactKey,
        savedAt: Date.now(),
        edited: false,
        error: undefined,
      });
      previousStatusByType[type] = undefined;
    },
    [update],
  );

  const closeWithoutSave = useCallback<UseDiagramSlots["closeWithoutSave"]>(
    (type) => {
      const prev = previousStatusByType[type] ?? "pending";
      update(type, { status: prev === "done" ? "done" : prev });
      previousStatusByType[type] = undefined;
    },
    [update],
  );

  const skip = useCallback<UseDiagramSlots["skip"]>(
    async (type) => {
      if (!sessionId) return;
      const cur = state.slots[type];
      const target: SlotStatus = cur.status === "done" ? "skipped_saved" : "skipped";
      // Optimistic.
      update(type, { status: target });
      try {
        await patchDiagramSlot(sessionId, type, { status: target });
        setLastError(null);
      } catch (e) {
        // Roll back.
        update(type, { status: cur.status });
        setLastError(e instanceof Error ? e.message : "Couldn't record the skip.");
      }
    },
    [sessionId, state.slots, update],
  );

  const unskip = useCallback<UseDiagramSlots["unskip"]>(
    async (type) => {
      if (!sessionId) return;
      const cur = state.slots[type];
      // skipped_saved → restore Done (artifact intact).
      // skipped → drop back to Pending.
      const target: SlotStatus = cur.status === "skipped_saved" ? "done" : "pending";
      update(type, { status: target });
      try {
        await patchDiagramSlot(sessionId, type, { status: target });
        setLastError(null);
      } catch (e) {
        update(type, { status: cur.status });
        setLastError(e instanceof Error ? e.message : "Couldn't un-skip the slot.");
      }
    },
    [sessionId, state.slots, update],
  );

  const retry = useCallback<UseDiagramSlots["retry"]>((type) => {
    update(type, { status: "in_progress", error: undefined });
  }, [update]);

  const fail = useCallback<UseDiagramSlots["fail"]>(
    (type, error) => update(type, { status: "failed", error }),
    [update],
  );

  const slot = useCallback(
    (type: DiagramType) => state.slots[type],
    [state.slots],
  );

  const aggregates = useMemo(() => {
    const statuses = TYPE_ORDER.map((t) => state.slots[t].status);
    return {
      anyInProgress: statuses.includes("in_progress"),
      hasAnyTerminal: statuses.some((s) =>
        s === "done" || s === "skipped" || s === "skipped_saved",
      ),
      allPending: statuses.every((s) => s === "pending"),
    };
  }, [state.slots]);

  return {
    state,
    slot,
    sectionFor,
    loading,
    lastError,
    refresh,
    setTool,
    open,
    markSaved,
    closeWithoutSave,
    skip,
    unskip,
    retry,
    fail,
    ...aggregates,
  };
}

export const DIAGRAM_TYPE_ORDER = TYPE_ORDER;
