import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "~/convex/_generated/api";
import { Doc } from "~/convex/_generated/dataModel";
import { Link } from "@tanstack/react-router";

type SegmentWithVersion = Doc<"segments"> & {
  selectedVersion: Doc<"imageVersions"> | null;
};

interface SegmentCardProps {
  segment: SegmentWithVersion;
}

export function SegmentCard({ segment }: SegmentCardProps) {
  const previewImageUrl = useQuery(
    api.files.getUrl,
    segment.selectedVersion?.previewImage
      ? { storageId: segment.selectedVersion.previewImage }
      : "skip",
  );
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [text, setText] = useState(segment.text);
  const updateTextMutation = useMutation(api.segments.updateSegmentText);

  useEffect(() => {
    setText(segment.text);
  }, [segment.text]);

  useEffect(() => {
    if (text === segment.text) {
      return;
    }
    const handler = setTimeout(() => {
      updateTextMutation({
        segmentId: segment._id,
        text,
      });
    }, 500);
    return () => clearTimeout(handler);
  }, [text, segment._id, segment.text, updateTextMutation]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownRef]);

  return (
    <div className="w-full max-w-sm overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between px-4 pb-2 pt-3">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
          {`场景 ${segment.order + 1}`}
        </span>
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <svg
              className="w-4 h-4 text-gray-500 dark:text-gray-400"
              xmlns="http://www.w3.org/2000/svg"
              fill="currentColor"
              viewBox="0 0 16 3"
            >
              <path d="M2 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm6.041 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM14 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z" />
            </svg>
          </button>
          {isDropdownOpen && (
            <div className="absolute right-0 top-full mt-2 z-10 w-44 bg-white rounded-lg shadow-lg dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
              <ul className="py-2">
                <li>
                  <button className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-600">
                    <svg
                      className="w-4 h-4 mr-2"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    编辑
                  </button>
                </li>
                <li>
                  <button className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-600">
                    <svg
                      className="w-4 h-4 mr-2"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                      <polyline points="16 6 12 2 8 6" />
                      <line x1="12" y1="2" x2="12" y2="15" />
                    </svg>
                    导出
                  </button>
                </li>
                <li>
                  <button className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-gray-100 dark:text-red-500 dark:hover:bg-gray-600">
                    <svg
                      className="w-4 h-4 mr-2"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    删除
                  </button>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>

      <Link
        to="/stories/$storyId/segments/$segmentId"
        params={{ storyId: segment.storyId, segmentId: segment._id }}
        className="block aspect-video w-full cursor-pointer bg-gray-100 transition-opacity hover:opacity-80 dark:bg-gray-700"
      >
        {segment.isGenerating ? (
          <div className="flex h-full w-full items-center justify-center text-gray-400">
            图片生成中...
          </div>
        ) : previewImageUrl ? (
          <img
            src={previewImageUrl}
            alt={`场景 ${segment.order + 1}`}
            className="h-full w-full object-contain"
          />
        ) : segment.error ? (
          <div className="flex h-full w-full items-center justify-center p-2 text-center text-xs text-red-500">
            生成失败: {segment.error}
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-400">
            暂无图片
          </div>
        )}
      </Link>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        className="block w-full resize-none border-0 bg-gray-50 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
        placeholder="请输入场景描述..."
      />
    </div>
  );
}
