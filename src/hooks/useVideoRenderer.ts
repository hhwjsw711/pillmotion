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

// [NEW] Update the argument type to include the optional bgmUrl
export type RenderConfig = {
  clips: RenderData[];
  bgmUrl?: string | null;
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

  // [MODIFIED] Update function signature to accept RenderConfig
  const renderVideo = async (config: RenderConfig) => {
    const { clips, bgmUrl } = config;
    try {
      setIsRendering(true);
      setProgress(0);

      await load();
      const ffmpeg = ffmpegRef.current;

      ffmpeg.on("log", ({ message }) => {
        console.log(message);
      });

      // [MODIFIED] Calculate total duration from clips
      const totalDuration = clips.length * 5;

      ffmpeg.on("progress", (p) => {
        const timeInSeconds = p.time / 1_000_000;
        const progressRatio = timeInSeconds / totalDuration;
        const safeProgress = Math.max(0, Math.min(1, progressRatio || 0));
        setProgress(Math.round(safeProgress * 100));
      });

      let filelist = "";
      for (let i = 0; i < clips.length; i++) {
        const item = clips[i];
        if (!item) continue;
        const filename = `input${String(i).padStart(3, "0")}.mp4`;
        await ffmpeg.writeFile(filename, await fetchFile(item.url));
        filelist += `file '${filename}'\n`;
      }

      await ffmpeg.writeFile("filelist.txt", filelist);

      // [NEW] Handle BGM if it exists
      if (bgmUrl) {
        await ffmpeg.writeFile("bgm.mp3", await fetchFile(bgmUrl));
      }

      // [MODIFIED] Update ffmpeg command to include BGM
      const ffmpegCommand = [
        // Video inputs
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        "filelist.txt",
      ];

      if (bgmUrl) {
        // Audio input
        ffmpegCommand.push("-i", "bgm.mp3");
        // Use the shortest input as the stream duration
        ffmpegCommand.push("-shortest");
      }

      // Output settings
      ffmpegCommand.push(
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-pix_fmt",
        "yuv420p",
        "-r",
        "30",
        "output.mp4",
      );

      await ffmpeg.exec(ffmpegCommand);

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
