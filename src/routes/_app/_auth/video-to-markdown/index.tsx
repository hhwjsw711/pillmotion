import { createFileRoute } from "@tanstack/react-router";
import VideoForm from "./-components/VideoForm";
import VideosList from "./-components/VideosList";
import ConvexCorner from "./-components/ConvexCorner";

export const Route = createFileRoute("/_app/_auth/video-to-markdown/")({
  component: VideoToMarkdown,
});

const Logo = () => (
  <div className="w-10 h-10 bg-red-600 rounded flex items-center justify-center">
    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  </div>
);

const HeroSection = () => (
  <div className="text-center">
    <div className="mb-8 flex items-center justify-center gap-3">
      <Logo />
      <h1 className="text-xl font-bold text-white">Video to Markdown</h1>
    </div>
    <p className="text-lg text-gray-300 max-w-2xl mx-auto">
      Simply paste a YouTube URL and get beautiful markdown code with
      thumbnails, perfect for documentation, READMEs, and blog posts.
    </p>
  </div>
);

const VideosSection = () => (
  <div>
    <h3 className="text-xl font-semibold text-white mb-6">Generated Videos</h3>
    <VideosList />
  </div>
);

export default function VideoToMarkdown() {
  return (
    <div className="min-h-screen bg-gray-900 relative">
      <ConvexCorner />
      <div className="relative z-10">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-8">
            <HeroSection />
            <VideoForm />
            <VideosSection />
          </div>
        </main>
      </div>
    </div>
  );
}
