import { create } from "zustand";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Doc } from "../../convex/_generated/dataModel";
import { useState, useEffect } from "react";

// --- Types for Search Results ---
// We redefine these types on the frontend to ensure type safety.
export type ImageSearchResult = Doc<"imageVersions"> & {
  resultType: "image";
  previewUrl: string | null;
  _score: number;
};

export type VideoSearchResult = Doc<"videoClipVersions"> & {
  resultType: "video";
  previewUrl: string | null;
  videoUrl: string | null;
  _score: number;
};

export type SearchResult = ImageSearchResult | VideoSearchResult;

// Zustand store for managing the modal's global state (open/closed)
interface MediaLibraryState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const useMediaLibraryStore = create<MediaLibraryState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));

// The main hook that encapsulates all logic for the media library
export const useMediaLibrary = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchAction = useAction(api.media.searchMedia);

  // 1. Debounce the search term
  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300); // Wait for 300ms after user stops typing

    return () => {
      clearTimeout(timerId);
    };
  }, [searchTerm]);

  // 2. Perform the search action when the debounced term changes
  useEffect(() => {
    const performSearch = async () => {
      // [核心修改] 我们移除了之前的 `if (!debouncedSearchTerm)` 检查。
      // 现在，无论搜索词是否为空，我们都会执行搜索。

      setIsLoading(true);
      setError(null);
      try {
        // 如果搜索词是空字符串 ""，我们就传递 `undefined` 给后端。
        // 这会触发后端调用 getRecentMedia 函数，从而获取您最近的素材。
        const searchResults = await searchAction({
          searchText: debouncedSearchTerm || undefined,
        });
        setResults(searchResults);
      } catch (e: any) {
        setError("Failed to search media library. Please try again.");
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };

    performSearch();
  }, [debouncedSearchTerm, searchAction]);

  return {
    searchTerm,
    setSearchTerm,
    results,
    isLoading,
    error,
  };
};
