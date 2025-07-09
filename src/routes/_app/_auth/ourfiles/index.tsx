import { createFileRoute } from "@tanstack/react-router";
import { AppTitle } from "./-components/AppTitle";
import { FileUpload } from "./-components/FileUpload";

export const Route = createFileRoute("/_app/_auth/ourfiles/")({
  component: OurFilesPage,
});

export default function OurFilesPage() {
  return (
    <div className="min-h-screen">
      <AppTitle />
      <FileUpload />
    </div>
  );
}
