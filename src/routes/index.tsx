import { createFileRoute, Link } from "@tanstack/react-router";
import { cn } from "@/utils/misc";
import { buttonVariants } from "@/ui/button-util";
import { Check, Loader2 } from "lucide-react";
import { ThemeSwitcherHome } from "@/ui/theme-switcher";
import ShadowPNG from "/images/shadow.png";
import { useConvexAuth } from "@convex-dev/react-query";
import { Route as AuthLoginRoute } from "@/routes/_app/login/_layout.index";
import { Route as DashboardRoute } from "@/routes/_app/_auth/dashboard/_layout.index";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const theme = "dark";
  return (
    <div className="relative flex h-full w-full flex-col bg-card">
      {/* Navigation */}
      <div className="sticky top-0 z-50 mx-auto flex w-full max-w-screen-lg items-center justify-between p-6 py-3">
        <Link to="/" className="flex h-10 items-center gap-4">
          <img
            className="rounded-lg"
            src={`/images/app-icon.png`}
            width="40"
            height="40"
            alt="icon"
          />
        </Link>
        <div className="flex items-center gap-4">
          <Link
            to={
              isAuthenticated
                ? DashboardRoute.fullPath
                : AuthLoginRoute.fullPath
            }
            className={buttonVariants({ size: "sm" })}
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="animate-spin w-16 h-4" />}
            {!isLoading && isAuthenticated && "Dashboard"}
            {!isLoading && !isAuthenticated && "Get Started"}
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="z-10 mx-auto flex w-full max-w-screen-lg flex-col gap-4 px-6">
        <div className="z-10 flex h-full w-full flex-col items-center justify-center gap-4 p-12 md:p-24">
          <h1 className="text-center text-6xl font-bold leading-tight text-primary md:text-7xl lg:leading-tight">
            Create Faceless
            <br />
            Videos for your Channels in Minutes
          </h1>
          <p className="max-w-screen-md text-center text-lg !leading-normal text-muted-foreground md:text-xl">
            Transform your ideas into captivating content without needing a{" "}
            <br className="hidden lg:inline-block" /> subscription. Pay only for
            the videos you create.
          </p>
          <div className="mt-2 flex w-full items-center justify-center gap-2">
            <Link
              to={AuthLoginRoute.fullPath}
              className={cn(buttonVariants({ size: "sm" }), "hidden sm:flex")}
            >
              Get Started
            </Link>
          </div>
        </div>

        <div className="flex w-full flex-col items-center justify-center gap-2">
          <h2 className="text-center font-serif text-xl font-medium">
            Pricing
          </h2>
          <p className="text-lg text-primary/60">
            Purchase credits for generating images, refining scripts, and
            exporting your videos.
          </p>
        </div>
        <div className="relative z-10 flex flex-col border border-border backdrop-blur-sm lg:flex-row">
          <div className="flex w-full flex-col items-start justify-center gap-6 border-r border-primary/10 p-10 lg:p-12 **lg:w-1/3**">
            <h2 className="text-xl mb-2 text-left">Basic</h2>
            <div className="mt-1 flex items-baseline">
              <span className="text-2xl font-medium tracking-tight">$9</span>
              <span className="ml-1 text-xl font-medium">/mo</span>
              <span className="ml-2 text-xs text-muted-foreground">
                Excl. VAT
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-xs font-medium uppercase tracking-wide text-left text-[#878787] font-mono">
                INCLUDING
              </h3>
              <ul className="mt-4 space-y-2">
                <li className="flex items-start">
                  <Check className="h-4 w-4 text-primary flex-shrink-0 mr-2" />
                  <span className="text-xs">
                    Generate and export around 5 videos
                  </span>
                </li>
              </ul>
            </div>
            <Link
              to={AuthLoginRoute.fullPath}
              className={cn(
                `${buttonVariants({ variant: "outline", size: "sm" })} dark:bg-secondary dark:hover:opacity-80`,
              )}
            >
              Choose basic plan
            </Link>
          </div>

          <div className="flex w-full flex-col items-start justify-center gap-6 border-r border-primary/10 p-10 lg:p-12 **lg:w-1/3**">
            <h2 className="text-xl mb-2 text-left">Pro</h2>
            <div className="mt-1 flex items-baseline">
              <span className="text-2xl font-medium tracking-tight">$19</span>
              <span className="ml-1 text-xl font-medium">/mo</span>
              <span className="ml-2 text-xs text-muted-foreground">
                Excl. VAT
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-xs font-medium uppercase tracking-wide text-left text-[#878787] font-mono">
                INCLUDING
              </h3>
              <ul className="mt-4 space-y-2">
                <li className="flex items-start">
                  <Check className="h-4 w-4 text-primary flex-shrink-0 mr-2" />
                  <span className="text-xs">
                    Generate and export around 13 videos
                  </span>
                </li>
              </ul>
            </div>
            <Link
              to={AuthLoginRoute.fullPath}
              className={cn(
                `${buttonVariants({ variant: "outline", size: "sm" })} dark:bg-secondary dark:hover:opacity-80`,
              )}
            >
              Choose pro plan
            </Link>
          </div>

          <div className="flex w-full flex-col items-start justify-center gap-6 p-10 **lg:w-1/3** lg:border-b-0 lg:p-12">
            {" "}
            <div className="absolute top-6 right-6 rounded-full text-[#878787] text-[9px] font-normal border px-2 py-1 font-mono">
              Limited offer
            </div>
            <h2 className="text-xl text-left mb-2">Max</h2>
            <div className="mt-1 flex items-baseline">
              <span
                className={cn(
                  "text-2xl font-medium tracking-tight",
                  "line-through text-[#878787]",
                )}
              >
                $49
              </span>
              <span className="ml-1 text-2xl font-medium tracking-tight">
                $29
              </span>
              <span className="ml-1 text-xl font-medium">/mo</span>
              <span className="ml-2 text-xs text-muted-foreground">
                Excl. VAT
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-xs font-medium uppercase tracking-wide text-left text-[#878787] font-mono">
                INCLUDING
              </h3>
              <ul className="mt-4 space-y-2">
                <li className="flex items-start">
                  <Check className="h-4 w-4 text-primary flex-shrink-0 mr-2" />
                  <span className="text-xs">
                    Generate and export around 33 videos
                  </span>
                </li>
              </ul>
            </div>
            <Link
              to={AuthLoginRoute.fullPath}
              className={buttonVariants({ size: "sm" })}
            >
              Choose max plan
            </Link>
          </div>

          <div className="absolute left-0 top-0 z-10 flex flex-col items-center justify-center">
            <span className="absolute h-6 w-[1px] bg-primary/40" />
            <span className="absolute h-[1px] w-6 bg-primary/40" />
          </div>
          <div className="absolute bottom-0 right-0 z-10 flex flex-col items-center justify-center">
            <span className="absolute h-6 w-[1px] bg-primary/40" />
            <span className="absolute h-[1px] w-6 bg-primary/40" />
          </div>
        </div>

        <div className="z-10 flex h-full w-full flex-col items-center justify-center gap-6 p-12">
          <h1 className="text-center text-4xl font-bold leading-tight text-primary md:text-6xl">
            Credit Usage Breakdown
          </h1>
          <p className="text-center text-lg text-primary/60">
            The estimated exported videos is based around your credit usage. We
            assume around 300 credits per video, which include 12 segments, 8
            image regenerations, and the final video credit usage. Stories with
            more segments will cost most due to the cost of image generations.
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="z-10 flex w-full flex-col items-center justify-center gap-8 py-6">
        <ThemeSwitcherHome />

        <div className="flex flex-col items-center gap-2 sm:flex-row">
          <p className="flex items-center whitespace-nowrap text-center text-sm font-medium text-primary/60">
            © 2025 PILLMOTION / ALL RIGHTS RESERVED
          </p>
        </div>
      </footer>

      {/* Background */}
      <img
        src={ShadowPNG}
        alt="Hero"
        className={`fixed left-0 top-0 z-0 h-full w-full opacity-60 ${theme === "dark" ? "invert" : ""}`}
      />
      <div className="base-grid fixed h-screen w-screen opacity-40" />
      <div className="fixed bottom-0 h-screen w-screen bg-gradient-to-t from-[hsl(var(--card))] to-transparent" />
    </div>
  );
}
