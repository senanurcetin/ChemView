'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type EditPhase = 'editing' | 'pending';

interface LocalEdit {
  value: number;
  runId: string;
  baseSeq: number;
  expectedValue: number;
  token: number;
  phase: EditPhase;
}

interface SyncedSetpointOptions {
  appliedValue: number;
  runId: string | null;
  seq: number;
  enabled: boolean;
  send: (value: number, expectedValue: number, expectedRunId: string) => Promise<{ ok: boolean }>;
}

/** An optimistic setpoint is shown only while editing or awaiting a matching SSE echo. */
export function useSyncedSetpoint({
  appliedValue,
  runId,
  seq,
  enabled,
  send,
}: SyncedSetpointOptions) {
  const [edit, setEdit] = useState<LocalEdit | null>(null);
  const nextToken = useRef(0);
  const draftRef = useRef<LocalEdit | null>(null);
  const localEdit = edit?.runId === runId && enabled ? edit : null;

  // Remote operator writes and server-side clamps always win when we are idle.
  // An accepted local command is confirmed by a newer SSE sequence carrying its value.
  useEffect(() => {
    if (!edit) return;
    if (!enabled || edit.runId !== runId) {
      if (draftRef.current?.token === edit.token) draftRef.current = null;
      setEdit((current) => (current?.token === edit.token ? null : current));
      return;
    }
    // A matching SSE value confirms our command. A distinct third value means
    // another operator has already changed the target; stop showing our draft.
    if (
      edit.phase === 'pending' &&
      seq > edit.baseSeq &&
      (appliedValue === edit.value || appliedValue !== edit.expectedValue)
    ) {
      setEdit((current) => (current?.token === edit.token ? null : current));
    }
  }, [appliedValue, edit, enabled, runId, seq]);

  // Avoid displaying a provisional setpoint indefinitely if SSE confirmation is lost.
  useEffect(() => {
    if (!edit || edit.phase !== 'pending') return;
    const timer = setTimeout(() => {
      setEdit((current) => (current?.token === edit.token ? null : current));
    }, 5_000);
    return () => clearTimeout(timer);
  }, [edit]);

  const onChange = useCallback(
    (value: number) => {
      if (!enabled || !runId) return;
      // Capture the original server readback at the *start* of a drag, even
      // if a remote operator's SSE update arrives during the interaction.
      const existing = draftRef.current;
      const expectedValue =
        existing?.phase === 'editing' && existing.runId === runId
          ? existing.expectedValue
          : appliedValue;
      const next: LocalEdit = {
        value,
        expectedValue,
        runId,
        baseSeq: seq,
        token: ++nextToken.current,
        phase: 'editing',
      };
      draftRef.current = next;
      setEdit(next);
    },
    [appliedValue, enabled, runId, seq],
  );

  const onCommit = useCallback(
    (value: number) => {
      const draft = draftRef.current;
      const staleDrag = draft && draft.phase === 'editing' && draft.runId !== runId;
      const expectedValue =
        draft?.phase === 'editing' && draft.runId === runId
          ? draft.expectedValue
          : appliedValue;
      draftRef.current = null;
      if (!enabled || !runId || staleDrag || value === expectedValue) {
        ++nextToken.current;
        setEdit(null);
        return;
      }
      const token = ++nextToken.current;
      setEdit({ value, expectedValue, runId, baseSeq: seq, token, phase: 'pending' });
      void send(value, expectedValue, runId)
        .then(({ ok }) => {
          if (!ok) setEdit((current) => (current?.token === token ? null : current));
        })
        .catch(() => {
          setEdit((current) => (current?.token === token ? null : current));
        });
    },
    [appliedValue, enabled, runId, send, seq],
  );

  return {
    value: localEdit?.value ?? appliedValue,
    pending: localEdit?.phase === 'pending',
    onChange,
    onCommit,
  };
}
