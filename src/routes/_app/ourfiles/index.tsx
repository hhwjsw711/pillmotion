import { createFileRoute } from "@tanstack/react-router";
import { AppTitle } from "./-components/AppTitle";
import { FileUpload } from "./-components/FileUpload";

export const Route = createFileRoute("/_app/ourfiles/")({
  component: OurFiles,
});

export default function OurFiles() {
  return (
    <div className="min-h-screen">
      <AppTitle />
      <FileUpload />
    </div>
  );
}
