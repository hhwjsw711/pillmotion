import { createFileRoute } from "@tanstack/react-router";
import { Id } from "~/convex/_generated/dataModel";
import ImagePageComponent from "./-components/ImagePage";

export const Route = createFileRoute("/_app/_auth/decorate/image/$imageId")({
  component: ImagePageRouteComponent,
  parseParams: (params) => ({
    imageId: params.imageId as Id<"images">,
  }),
  stringifyParams: (params) => ({ imageId: params.imageId }),
});

function ImagePageRouteComponent() {
  const { imageId } = Route.useParams();
  return <ImagePageComponent imageId={imageId} />;
}
