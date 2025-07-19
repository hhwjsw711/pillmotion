import { useCallback } from "react";
import { toast } from "sonner";

export function useApiErrorHandler() {
  return useCallback((error: unknown) => {
    console.error("API Error:", error);
    toast.error(`API Error: ${error}`);
  }, []);
}
