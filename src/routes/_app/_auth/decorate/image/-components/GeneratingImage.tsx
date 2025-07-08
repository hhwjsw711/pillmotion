import { ImageViewer } from "./ImageViewer";

interface GeneratingImageProps {
  imageUrl: string;
  prompt: string;
}

export function GeneratingImage({ imageUrl, prompt }: GeneratingImageProps) {
  return (
    <ImageViewer src={imageUrl} alt="Original">
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 backdrop-blur-sm rounded-2xl z-10 p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-blue-500 border-gray-200 mb-4 bg-white/80"></div>
        <p className="text-xl text-gray-700 font-semibold mb-2">
          Generating...
        </p>
        <p className="text-base text-gray-600 text-center px-2 mb-4">
          This may take a minute or two
        </p>
        <p
          className="text-sm text-gray-500 italic text-center truncate max-w-full"
          title={prompt}
        >
          "{prompt}"
        </p>
      </div>
    </ImageViewer>
  );
}
