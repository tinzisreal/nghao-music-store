import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../utils/api";
import { StoreData } from "../types/store";

export type StoreDataState =
{status: "loading";} |
{status: "error";error: string;} |
{status: "ready";data: StoreData;};

export function useStoreData() {
  const [state, setState] = useState<StoreDataState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    api.
    getStoreData().
    then((data) => !cancelled && setState({ status: "ready", data })).
    catch((err: unknown) => {
      if (cancelled) return;
      const message = err instanceof ApiError ? err.message : "Không tải được dữ liệu.";
      setState({ status: "error", error: message });
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  return { state, retry };
}