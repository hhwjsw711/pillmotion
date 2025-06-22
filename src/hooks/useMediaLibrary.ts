import { create } from "zustand";
import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import { api } from "~/convex/_generated/api";
import { Doc } from "~/convex/_generated/dataModel";
import { useDebounce } from "use-debounce";

// --- Types for Search Results ---
export type ImageSearchResult = Doc<"imageVersions"> & {
  resultType: "image";
  previewUrl: string | null;
  _score: number;
};

// [FIX] The type definition is now aligned with the backend, including `posterUrl`.
export type VideoSearchResult = Doc<"videoClipVersions"> & {
  resultType: "video";
  previewUrl: string | null;
  posterUrl: string | null; // This was the missing property.
  videoUrl: string | null;
  _score: number;
};

export type SearchResult = ImageSearchResult | VideoSearchResult;

// Zustand store for managing the modal's global state
interface MediaLibraryState {
  isOpen: boolean;
  onSelect: (result: SearchResult) => void;
  open: () => void;
  close: () => void;
  setOnSelect: (callback: (result: SearchResult) => void) => void;
}

export const useMediaLibraryStore = create<MediaLibraryState>((set) => ({
  isOpen: false,
  onSelect: () => {}, // Default empty callback
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false, onSelect: () => {} }), // Reset callback on close
  setOnSelect: (callback) => set({ onSelect: callback }),
}));

// [REFACTORED] The main hook now correctly uses `useAction` for the search functionality.
export function useMediaLibrary() {
  const { isOpen } = useMediaLibraryStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm] = useDebounce(searchTerm, 300);

  // State to manually manage results, loading, and errors from the action.
  const [state, setState] = useState<{
    results: SearchResult[];
    isLoading: boolean;
    error: string | null;
  }>({
    results: [],
    isLoading: false,
    error: null,
  });

  const searchAction = useAction(api.media.searchMedia);
  const [refetchIndex, setRefetchIndex] = useState(0);

  useEffect(() => {
    // Do not run the action if the modal is closed.
    if (!isOpen) {
      // Clear state when modal is not visible to avoid showing stale data.
      setState({ results: [], isLoading: false, error: null });
      return;
    }

    let isCancelled = false;

    const performSearch = async () => {
      setState((s) => ({ ...s, isLoading: true, error: null }));
      try {
        const data = await searchAction({
          searchText: debouncedSearchTerm || undefined,
        });
        if (!isCancelled) {
          setState({ results: data, isLoading: false, error: null });
        }
      } catch (err) {
        if (!isCancelled) {
          setState({
            results: [],
            isLoading: false,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }
    };

    performSearch();

    // Cleanup function to prevent state updates on an unmounted component.
    return () => {
      isCancelled = true;
    };
  }, [isOpen, debouncedSearchTerm, searchAction, refetchIndex]);

  const refetch = () => setRefetchIndex((i) => i + 1);

  return {
    isOpen,
    searchTerm,
    setSearchTerm,
    results: state.results,
    isLoading: state.isLoading,
    error: state.error,
    refetch,
  };
}
