import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { useRef, useState } from "react";

// [降级] 使用单线程版本以避免 CORS/Header 问题
const BASE_URL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";

export type RenderData = {
  type: "image" | "video";
  url: string;
  duration?: number;
};

export const useVideoRenderer = () => {
  const ffmpegRef = useRef(new FFmpeg());
  const [isLoaded, setIsLoaded] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [progress, setProgress] = useState(0);

  const load = async () => {
    if (ffmpegRef.current.loaded) return;
    const ffmpeg = ffmpegRef.current;
    await ffmpeg.load({
      coreURL: await toBlobURL(`${BASE_URL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(
        `${BASE_URL}/ffmpeg-core.wasm`,
        "application/wasm",
      ),
    });
    setIsLoaded(true);
  };

  const renderVideo = async (renderData: RenderData[]) => {
    try {
      setIsRendering(true);
      setProgress(0);

      await load();
      const ffmpeg = ffmpegRef.current;

      ffmpeg.on("log", ({ message }) => {
        console.log(message);
      });

      // [最终修复] 基于控制台日志，我们发现 time 是可靠的，而 progress 不可靠。
      // 我们将手动计算总时长，并使用 time 来计算准确的进度。
      const totalDuration = renderData.length * 5;
      
      ffmpeg.on("progress", (p) => {
        const timeInSeconds = p.time / 1_000_000; // 将微秒转换为秒
        const progressRatio = timeInSeconds / totalDuration;
        const safeProgress = Math.max(0, Math.min(1, progressRatio || 0));
        setProgress(Math.round(safeProgress * 100));
      });

      let filelist = "";
      for (let i = 0; i < renderData.length; i++) {
        const item = renderData[i];
        if (!item) continue;
        const filename = `input${String(i).padStart(3, "0")}.mp4`;
        await ffmpeg.writeFile(filename, await fetchFile(item.url));
        filelist += `file '${filename}'\n`;
      }

      await ffmpeg.writeFile("filelist.txt", filelist);

      await ffmpeg.exec([
        "-f", "concat", "-safe", "0", "-i", "filelist.txt",
        "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-r", "30",
        "output.mp4",
      ]);

      const data = await ffmpeg.readFile("output.mp4");
      const url = URL.createObjectURL(
        new Blob([(data as Uint8Array).buffer], { type: "video/mp4" }),
      );

      setIsRendering(false);
      return url;
    } catch (error) {
      console.error("Error rendering video:", error);
      setIsRendering(false);
      return null;
    }
  };

  return { renderVideo, load, isLoaded, isRendering, progress };
};