'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type EditPhase = 'editing' | 'pending';

interface LocalEdit {
  value: number;
  runId: string;
  baseSeq: number;
  token: number;
  phase: EditPhase;
}

interface SyncedSetpointOptions {
  appliedValue: number;
  runId: string | null;
  seq: number;
  enabled: boolean;
  send: (value: number) => Promise<{ ok: boolean }>;
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
  const localEdit = edit?.runId === runId && enabled ? edit : null;

  // Remote operator writes and server-side clamps always win when we are idle.
  // An accepted local command is confirmed by a newer SSE sequence carrying its value.
  useEffect(() => {
    if (!edit) return;
    if (!enabled || edit.runId !== runId) {
      setEdit((current) => (current?.token === edit.token ? null : current));
      return;
    }
    if (edit.phase === 'pending' && seq > edit.baseSeq && appliedValue === edit.value) {
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
      setEdit({
        value,
        runId,
        baseSeq: seq,
        token: ++nextToken.current,
        phase: 'editing',
      });
    },
    [enabled, runId, seq],
  );

  const onCommit = useCallback(
    (value: number) => {
      if (!enabled || !runId || value === appliedValue) {
        ++nextToken.current;
        setEdit(null);
        return;
      }
      const token = ++nextToken.current;
      setEdit({ value, runId, baseSeq: seq, token, phase: 'pending' });
      void send(value)
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
