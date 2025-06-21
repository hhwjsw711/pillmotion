import { Settings, LogOut, Library } from "lucide-react";
import { cn, useSignOut } from "@/utils/misc";
import { ThemeSwitcher } from "@/ui/theme-switcher";
import { LanguageSwitcher } from "@/ui/language-switcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/ui/dropdown-menu";
import { Button } from "@/ui/button";
import { buttonVariants } from "@/ui/button-util";
import { Link, useMatchRoute, useNavigate } from "@tanstack/react-router";
import { Route as DashboardRoute } from "@/routes/_app/_auth/dashboard/_layout.index";
import { Route as GenerateRoute } from "@/routes/_app/_auth/generate/_layout.index";
import { Route as StoriesRoute } from "@/routes/_app/_auth/stories/_layout.index";
import { Route as SettingsRoute } from "@/routes/_app/_auth/dashboard/_layout.settings.index";
import { Route as BillingSettingsRoute } from "@/routes/_app/_auth/dashboard/_layout.settings.billing";
import { User } from "~/types";
import { Badge } from "@/ui/badge";
import { useTranslation } from "react-i18next";
import { useMediaLibraryStore } from "@/hooks/useMediaLibrary";

export function Navigation({ user }: { user: User }) {
  const signOut = useSignOut();
  const matchRoute = useMatchRoute();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { open: openMediaLibrary } = useMediaLibraryStore();
  const isDashboardPath = matchRoute({ to: DashboardRoute.fullPath });
  const isGeneratePath = matchRoute({ to: GenerateRoute.fullPath });
  const isStoriesPath = matchRoute({ to: StoriesRoute.fullPath });
  const isSettingsPath = matchRoute({ to: SettingsRoute.fullPath });
  const isBillingPath = matchRoute({ to: BillingSettingsRoute.fullPath });

  if (!user) {
    return null;
  }

  return (
    <nav className="sticky top-0 z-50 flex w-full flex-col border-b border-border bg-card px-6">
      <div className="mx-auto flex w-full max-w-screen-xl items-center justify-between py-3">
        <div className="flex h-10 items-center gap-2">
          <Link
            to={DashboardRoute.fullPath}
            className="flex h-10 items-center gap-1"
          >
            <img
              className="rounded-lg"
              src={`/images/pill-logo.jpg`}
              width="35"
              height="35"
              alt="icon"
            />
          </Link>
        </div>

        <div className="flex h-10 items-center gap-3">
          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className="h-8 px-3 py-1.5 text-xs font-medium"
            >
              {t("credits", { count: user.credits })}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              asChild
              className="h-8 text-xs font-medium"
            >
              <Link to={BillingSettingsRoute.fullPath}>{t("buyMore")}</Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={openMediaLibrary}
            >
              <Library className="h-4 w-4" />
            </Button>
          </div>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 rounded-full">
                {user.avatarUrl ? (
                  <img
                    className="min-h-8 min-w-8 rounded-full object-cover"
                    alt={user.username ?? user.email}
                    src={user.avatarUrl}
                  />
                ) : (
                  <span className="min-h-8 min-w-8 rounded-full bg-gradient-to-br from-lime-400 from-10% via-cyan-300 to-blue-500" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              sideOffset={8}
              className="fixed -right-4 min-w-56 bg-card p-2"
            >
              <DropdownMenuItem className="group flex-col items-start focus:bg-transparent">
                <p className="text-sm font-medium text-primary/80 group-hover:text-primary group-focus:text-primary">
                  {user?.username || ""}
                </p>
                <p className="text-sm text-primary/60">{user?.email}</p>
              </DropdownMenuItem>

              <DropdownMenuItem
                className="group h-9 w-full cursor-pointer justify-between rounded-md px-2"
                onClick={() => navigate({ to: SettingsRoute.fullPath })}
              >
                <span className="text-sm text-primary/60 group-hover:text-primary group-focus:text-primary">
                  {t("navSettings")}
                </span>
                <Settings className="h-[18px] w-[18px] stroke-[1.5px] text-primary/60 group-hover:text-primary group-focus:text-primary" />
              </DropdownMenuItem>

              <DropdownMenuItem
                className={cn(
                  "group flex h-9 justify-between rounded-md px-2 hover:bg-transparent",
                )}
              >
                <span className="w-full text-sm text-primary/60 group-hover:text-primary group-focus:text-primary">
                  {t("navTheme")}
                </span>
                <ThemeSwitcher />
              </DropdownMenuItem>

              <DropdownMenuItem
                className={cn(
                  "group flex h-9 justify-between rounded-md px-2 hover:bg-transparent",
                )}
              >
                <span className="w-full text-sm text-primary/60 group-hover:text-primary group-focus:text-primary">
                  {t("navLanguage")}
                </span>
                <LanguageSwitcher />
              </DropdownMenuItem>

              <DropdownMenuSeparator className="mx-0 my-2" />

              <DropdownMenuItem
                className="group h-9 w-full cursor-pointer justify-between rounded-md px-2"
                onClick={() => signOut()}
              >
                <span className="text-sm text-primary/60 group-hover:text-primary group-focus:text-primary">
                  {t("navLogOut")}
                </span>
                <LogOut className="h-[18px] w-[18px] stroke-[1.5px] text-primary/60 group-hover:text-primary group-focus:text-primary" />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-screen-xl items-center gap-3">
        <div
          className={cn(
            `flex h-12 items-center border-b-2`,
            isDashboardPath ? "border-primary" : "border-transparent",
          )}
        >
          <Link
            to={DashboardRoute.fullPath}
            className={cn(
              `${buttonVariants({ variant: "ghost", size: "sm" })} text-primary/80`,
            )}
          >
            Dashboard
          </Link>
        </div>
        <div
          className={cn(
            `flex h-12 items-center border-b-2`,
            isGeneratePath ? "border-primary" : "border-transparent",
          )}
        >
          <Link
            to={GenerateRoute.fullPath}
            className={cn(
              `${buttonVariants({ variant: "ghost", size: "sm" })} text-primary/80`,
            )}
          >
            Generate
          </Link>
        </div>
        <div
          className={cn(
            `flex h-12 items-center border-b-2`,
            isStoriesPath ? "border-primary" : "border-transparent",
          )}
        >
          <Link
            to={StoriesRoute.fullPath}
            className={cn(
              `${buttonVariants({ variant: "ghost", size: "sm" })} text-primary/80`,
            )}
          >
            Stories
          </Link>
        </div>
        <div
          className={cn(
            `flex h-12 items-center border-b-2`,
            isSettingsPath ? "border-primary" : "border-transparent",
          )}
        >
          <Link
            to={SettingsRoute.fullPath}
            className={cn(
              `${buttonVariants({ variant: "ghost", size: "sm" })} text-primary/80`,
            )}
          >
            Settings
          </Link>
        </div>
        <div
          className={cn(
            `flex h-12 items-center border-b-2`,
            isBillingPath ? "border-primary" : "border-transparent",
          )}
        >
          <Link
            to={BillingSettingsRoute.fullPath}
            className={cn(
              `${buttonVariants({ variant: "ghost", size: "sm" })} text-primary/80`,
            )}
          >
            Billing
          </Link>
        </div>
      </div>
    </nav>
  );
}
