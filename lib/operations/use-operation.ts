import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import { useFetcher } from "react-router";
import type { Operation, OperationResult } from "./operation";
import { runAndReport } from "@/lib/telemetry.client";
import { createSubmitGate } from "./submit-gate";

interface Callbacks<O> {
  onSuccess?: (result: { data: O }) => void;
  onError?: (result: { error: Omit<OperationResult<O>, "data"> }) => void;
}

/** Mutation via a router action; the router cancels stale responses and revalidates the loaders. */
export function useOperation<I, O>(command: Operation<I, O>, callbacks: Callbacks<O> = {}) {
  const fetcher = useFetcher<OperationResult<O>>();
  const { submit } = fetcher;
  const previous = useRef(fetcher.data);
  const [input, setInput] = useState<I>();
  const [gate] = useState(createSubmitGate);
  // Always the latest callbacks, without making them a reason to run the effect.
  const report = useEffectEvent((result: OperationResult<O>) => {
    if (result.data !== undefined) {
      callbacks.onSuccess?.({ data: result.data });
      return;
    }
    callbacks.onError?.({ error: result });
  });
  useEffect(() => {
    if (fetcher.state === "submitting" || !fetcher.data || fetcher.data === previous.current) {
      return;
    }
    previous.current = fetcher.data;
    report(fetcher.data);
  }, [fetcher.state, fetcher.data]);
  const execute = useCallback(
    (...args: undefined extends I ? [input?: I] : [input: I]) => {
      const payload = JSON.stringify({ input: args[0] });
      if (command.method === "get") {
        setInput(args[0]);
        void runAndReport(() => submit({ payload }, { action: command.url, method: "get" }));
        return;
      }
      // A double click would create or send twice: changes go one at a time.
      if (!gate.enter()) return;
      setInput(args[0]);
      void runAndReport(async () => {
        try {
          await submit(payload, {
            action: command.url,
            method: "post",
            encType: "application/json",
          });
        } finally {
          gate.release();
        }
      });
    },
    [command.url, command.method, submit, gate],
  );
  return {
    execute,
    input,
    result: fetcher.data ?? {},
    isPending: fetcher.state !== "idle",
  };
}
