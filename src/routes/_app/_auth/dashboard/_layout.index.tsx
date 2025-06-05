import { createFileRoute, Link } from "@tanstack/react-router";
import { List, Pencil, Wand2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/utils/misc.js";
import { buttonVariants } from "@/ui/button-util";
import siteConfig from "~/site.config";

export const Route = createFileRoute("/_app/_auth/dashboard/_layout/")({
  component: Dashboard,
  beforeLoad: () => ({
    title: `${siteConfig.siteTitle} - Dashboard`,
    headerTitle: "Dashboard",
    headerDescription: "Manage your Apps and view your usage.",
  }),
});

export default function Dashboard() {
  const { t } = useTranslation();

  const apps = [
    {
      to: "/dashboard/script",
      icon: <Pencil className="h-8 w-8 stroke-[1.5px] text-primary/60" />,
      title: t("scriptTitle"),
    },
    {
      to: "/dashboard/guided",
      icon: <Wand2 className="h-8 w-8 stroke-[1.5px] text-primary/60" />,
      title: t("guidedTitle"),
    },
    {
      to: "/dashboard/segment",
      icon: <List className="h-8 w-8 stroke-[1.5px] text-primary/60" />,
      title: t("segmentTitle"),
    },
  ];

  return (
    <div className="flex h-full w-full bg-secondary px-6 py-8 dark:bg-black">
      <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
        <div className="flex w-full flex-col rounded-lg border border-border bg-card dark:bg-black">
          <div className="flex w-full flex-col rounded-lg p-6">
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-medium text-primary">
                {t("craftYourVideo")}
              </h2>
              <p className="text-sm font-normal text-primary/60">
                {t("selectMode")}
              </p>
            </div>
          </div>
          <div className="flex w-full px-6">
            <div className="w-full border-b border-border" />
          </div>
          <div className="relative mx-auto flex w-full  flex-col items-center p-6">
            <div className="relative flex w-full flex-row items-center justify-center gap-6 overflow-hidden rounded-lg border border-border bg-secondary px-6 py-24 dark:bg-card">
              {apps.map((app, idx) => (
                <div
                  key={idx}
                  className="z-10 flex max-w-[320px] flex-1 flex-col items-center gap-4"
                >
                  <Link
                    to={app.to}
                    className={cn(
                      `${buttonVariants({ variant: "ghost", size: "sm" })} flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-card hover:border-primary/40`,
                    )}
                  >
                    {app.icon}
                  </Link>
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-base font-medium text-primary">
                      {app.title}
                    </p>
                  </div>
                </div>
              ))}
              <div className="base-grid absolute h-full w-full opacity-40" />
              <div className="absolute bottom-0 h-full w-full bg-gradient-to-t from-[hsl(var(--card))] to-transparent" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
