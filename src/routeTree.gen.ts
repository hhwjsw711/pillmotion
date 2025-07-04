/* prettier-ignore-start */

/* eslint-disable */

// @ts-nocheck

// noinspection JSUnusedGlobalSymbols

// This file is auto-generated by TanStack Router

import { createFileRoute } from '@tanstack/react-router'

// Import Routes

import { Route as rootRoute } from './routes/__root'
import { Route as AppImport } from './routes/_app'
import { Route as IndexImport } from './routes/index'
import { Route as AppAuthImport } from './routes/_app/_auth'
import { Route as AppLoginLayoutImport } from './routes/_app/login/_layout'
import { Route as AppLoginLayoutIndexImport } from './routes/_app/login/_layout.index'
import { Route as AppAuthVideoToMarkdownLayoutImport } from './routes/_app/_auth/video-to-markdown/_layout'
import { Route as AppAuthOnboardingLayoutImport } from './routes/_app/_auth/onboarding/_layout'
import { Route as AppAuthImageGenerationLayoutImport } from './routes/_app/_auth/image-generation/_layout'
import { Route as AppAuthImageEditingLayoutImport } from './routes/_app/_auth/image-editing/_layout'
import { Route as AppAuthDashboardLayoutImport } from './routes/_app/_auth/dashboard/_layout'
import { Route as AppAuthAgentInboxLayoutImport } from './routes/_app/_auth/agent-inbox/_layout'
import { Route as AppAuthVideoToMarkdownLayoutIndexImport } from './routes/_app/_auth/video-to-markdown/_layout.index'
import { Route as AppAuthImageGenerationLayoutIndexImport } from './routes/_app/_auth/image-generation/_layout.index'
import { Route as AppAuthImageEditingLayoutIndexImport } from './routes/_app/_auth/image-editing/_layout.index'
import { Route as AppAuthDashboardLayoutIndexImport } from './routes/_app/_auth/dashboard/_layout.index'
import { Route as AppAuthAgentInboxLayoutIndexImport } from './routes/_app/_auth/agent-inbox/_layout.index'
import { Route as AppAuthOnboardingLayoutUsernameImport } from './routes/_app/_auth/onboarding/_layout.username'
import { Route as AppAuthGenerateGuidedLayoutImport } from './routes/_app/_auth/generate/guided/_layout'
import { Route as AppAuthDashboardLayoutSettingsImport } from './routes/_app/_auth/dashboard/_layout.settings'
import { Route as AppAuthDashboardLayoutCheckoutImport } from './routes/_app/_auth/dashboard/_layout.checkout'
import { Route as AppAuthAgentInboxAgentAgentIdImport } from './routes/_app/_auth/agent-inbox/agent/$agentId'
import { Route as AppAuthGenerateGuidedLayoutIndexImport } from './routes/_app/_auth/generate/guided/_layout.index'
import { Route as AppAuthDashboardLayoutSettingsIndexImport } from './routes/_app/_auth/dashboard/_layout.settings.index'
import { Route as AppAuthStoriesStoryIdRefineLayoutImport } from './routes/_app/_auth/stories/$storyId/refine/_layout'
import { Route as AppAuthDashboardLayoutSettingsBillingImport } from './routes/_app/_auth/dashboard/_layout.settings.billing'
import { Route as AppAuthStoriesStoryIdRefineLayoutIndexImport } from './routes/_app/_auth/stories/$storyId/refine/_layout.index'

// Create Virtual Routes

const AppLoginImport = createFileRoute('/_app/login')()
const AppAuthVideoToMarkdownImport = createFileRoute(
  '/_app/_auth/video-to-markdown',
)()
const AppAuthOnboardingImport = createFileRoute('/_app/_auth/onboarding')()
const AppAuthImageGenerationImport = createFileRoute(
  '/_app/_auth/image-generation',
)()
const AppAuthImageEditingImport = createFileRoute('/_app/_auth/image-editing')()
const AppAuthDashboardImport = createFileRoute('/_app/_auth/dashboard')()
const AppAuthAgentInboxImport = createFileRoute('/_app/_auth/agent-inbox')()
const AppAuthGenerateGuidedImport = createFileRoute(
  '/_app/_auth/generate/guided',
)()
const AppAuthStoriesStoryIdRefineImport = createFileRoute(
  '/_app/_auth/stories/$storyId/refine',
)()

// Create/Update Routes

const AppRoute = AppImport.update({
  id: '/_app',
  getParentRoute: () => rootRoute,
} as any)

const IndexRoute = IndexImport.update({
  path: '/',
  getParentRoute: () => rootRoute,
} as any)

const AppLoginRoute = AppLoginImport.update({
  path: '/login',
  getParentRoute: () => AppRoute,
} as any)

const AppAuthRoute = AppAuthImport.update({
  id: '/_auth',
  getParentRoute: () => AppRoute,
} as any)

const AppAuthVideoToMarkdownRoute = AppAuthVideoToMarkdownImport.update({
  path: '/video-to-markdown',
  getParentRoute: () => AppAuthRoute,
} as any)

const AppAuthOnboardingRoute = AppAuthOnboardingImport.update({
  path: '/onboarding',
  getParentRoute: () => AppAuthRoute,
} as any)

const AppAuthImageGenerationRoute = AppAuthImageGenerationImport.update({
  path: '/image-generation',
  getParentRoute: () => AppAuthRoute,
} as any)

const AppAuthImageEditingRoute = AppAuthImageEditingImport.update({
  path: '/image-editing',
  getParentRoute: () => AppAuthRoute,
} as any)

const AppAuthDashboardRoute = AppAuthDashboardImport.update({
  path: '/dashboard',
  getParentRoute: () => AppAuthRoute,
} as any)

const AppAuthAgentInboxRoute = AppAuthAgentInboxImport.update({
  path: '/agent-inbox',
  getParentRoute: () => AppAuthRoute,
} as any)

const AppLoginLayoutRoute = AppLoginLayoutImport.update({
  id: '/_layout',
  getParentRoute: () => AppLoginRoute,
} as any)

const AppAuthGenerateGuidedRoute = AppAuthGenerateGuidedImport.update({
  path: '/generate/guided',
  getParentRoute: () => AppAuthRoute,
} as any)

const AppLoginLayoutIndexRoute = AppLoginLayoutIndexImport.update({
  path: '/',
  getParentRoute: () => AppLoginLayoutRoute,
} as any)

const AppAuthVideoToMarkdownLayoutRoute =
  AppAuthVideoToMarkdownLayoutImport.update({
    id: '/_layout',
    getParentRoute: () => AppAuthVideoToMarkdownRoute,
  } as any)

const AppAuthOnboardingLayoutRoute = AppAuthOnboardingLayoutImport.update({
  id: '/_layout',
  getParentRoute: () => AppAuthOnboardingRoute,
} as any)

const AppAuthImageGenerationLayoutRoute =
  AppAuthImageGenerationLayoutImport.update({
    id: '/_layout',
    getParentRoute: () => AppAuthImageGenerationRoute,
  } as any)

const AppAuthImageEditingLayoutRoute = AppAuthImageEditingLayoutImport.update({
  id: '/_layout',
  getParentRoute: () => AppAuthImageEditingRoute,
} as any)

const AppAuthDashboardLayoutRoute = AppAuthDashboardLayoutImport.update({
  id: '/_layout',
  getParentRoute: () => AppAuthDashboardRoute,
} as any)

const AppAuthAgentInboxLayoutRoute = AppAuthAgentInboxLayoutImport.update({
  id: '/_layout',
  getParentRoute: () => AppAuthAgentInboxRoute,
} as any)

const AppAuthStoriesStoryIdRefineRoute =
  AppAuthStoriesStoryIdRefineImport.update({
    path: '/stories/$storyId/refine',
    getParentRoute: () => AppAuthRoute,
  } as any)

const AppAuthVideoToMarkdownLayoutIndexRoute =
  AppAuthVideoToMarkdownLayoutIndexImport.update({
    path: '/',
    getParentRoute: () => AppAuthVideoToMarkdownLayoutRoute,
  } as any)

const AppAuthImageGenerationLayoutIndexRoute =
  AppAuthImageGenerationLayoutIndexImport.update({
    path: '/',
    getParentRoute: () => AppAuthImageGenerationLayoutRoute,
  } as any)

const AppAuthImageEditingLayoutIndexRoute =
  AppAuthImageEditingLayoutIndexImport.update({
    path: '/',
    getParentRoute: () => AppAuthImageEditingLayoutRoute,
  } as any)

const AppAuthDashboardLayoutIndexRoute =
  AppAuthDashboardLayoutIndexImport.update({
    path: '/',
    getParentRoute: () => AppAuthDashboardLayoutRoute,
  } as any)

const AppAuthAgentInboxLayoutIndexRoute =
  AppAuthAgentInboxLayoutIndexImport.update({
    path: '/',
    getParentRoute: () => AppAuthAgentInboxLayoutRoute,
  } as any)

const AppAuthOnboardingLayoutUsernameRoute =
  AppAuthOnboardingLayoutUsernameImport.update({
    path: '/username',
    getParentRoute: () => AppAuthOnboardingLayoutRoute,
  } as any)

const AppAuthGenerateGuidedLayoutRoute =
  AppAuthGenerateGuidedLayoutImport.update({
    id: '/_layout',
    getParentRoute: () => AppAuthGenerateGuidedRoute,
  } as any)

const AppAuthDashboardLayoutSettingsRoute =
  AppAuthDashboardLayoutSettingsImport.update({
    path: '/settings',
    getParentRoute: () => AppAuthDashboardLayoutRoute,
  } as any)

const AppAuthDashboardLayoutCheckoutRoute =
  AppAuthDashboardLayoutCheckoutImport.update({
    path: '/checkout',
    getParentRoute: () => AppAuthDashboardLayoutRoute,
  } as any)

const AppAuthAgentInboxAgentAgentIdRoute =
  AppAuthAgentInboxAgentAgentIdImport.update({
    path: '/agent/$agentId',
    getParentRoute: () => AppAuthAgentInboxRoute,
  } as any)

const AppAuthGenerateGuidedLayoutIndexRoute =
  AppAuthGenerateGuidedLayoutIndexImport.update({
    path: '/',
    getParentRoute: () => AppAuthGenerateGuidedLayoutRoute,
  } as any)

const AppAuthDashboardLayoutSettingsIndexRoute =
  AppAuthDashboardLayoutSettingsIndexImport.update({
    path: '/',
    getParentRoute: () => AppAuthDashboardLayoutSettingsRoute,
  } as any)

const AppAuthStoriesStoryIdRefineLayoutRoute =
  AppAuthStoriesStoryIdRefineLayoutImport.update({
    id: '/_layout',
    getParentRoute: () => AppAuthStoriesStoryIdRefineRoute,
  } as any)

const AppAuthDashboardLayoutSettingsBillingRoute =
  AppAuthDashboardLayoutSettingsBillingImport.update({
    path: '/billing',
    getParentRoute: () => AppAuthDashboardLayoutSettingsRoute,
  } as any)

const AppAuthStoriesStoryIdRefineLayoutIndexRoute =
  AppAuthStoriesStoryIdRefineLayoutIndexImport.update({
    path: '/',
    getParentRoute: () => AppAuthStoriesStoryIdRefineLayoutRoute,
  } as any)

// Populate the FileRoutesByPath interface

declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/': {
      id: '/'
      path: '/'
      fullPath: '/'
      preLoaderRoute: typeof IndexImport
      parentRoute: typeof rootRoute
    }
    '/_app': {
      id: '/_app'
      path: ''
      fullPath: ''
      preLoaderRoute: typeof AppImport
      parentRoute: typeof rootRoute
    }
    '/_app/_auth': {
      id: '/_app/_auth'
      path: ''
      fullPath: ''
      preLoaderRoute: typeof AppAuthImport
      parentRoute: typeof AppImport
    }
    '/_app/login': {
      id: '/_app/login'
      path: '/login'
      fullPath: '/login'
      preLoaderRoute: typeof AppLoginImport
      parentRoute: typeof AppImport
    }
    '/_app/login/_layout': {
      id: '/_app/login/_layout'
      path: '/login'
      fullPath: '/login'
      preLoaderRoute: typeof AppLoginLayoutImport
      parentRoute: typeof AppLoginRoute
    }
    '/_app/_auth/agent-inbox': {
      id: '/_app/_auth/agent-inbox'
      path: '/agent-inbox'
      fullPath: '/agent-inbox'
      preLoaderRoute: typeof AppAuthAgentInboxImport
      parentRoute: typeof AppAuthImport
    }
    '/_app/_auth/agent-inbox/_layout': {
      id: '/_app/_auth/agent-inbox/_layout'
      path: '/agent-inbox'
      fullPath: '/agent-inbox'
      preLoaderRoute: typeof AppAuthAgentInboxLayoutImport
      parentRoute: typeof AppAuthAgentInboxRoute
    }
    '/_app/_auth/dashboard': {
      id: '/_app/_auth/dashboard'
      path: '/dashboard'
      fullPath: '/dashboard'
      preLoaderRoute: typeof AppAuthDashboardImport
      parentRoute: typeof AppAuthImport
    }
    '/_app/_auth/dashboard/_layout': {
      id: '/_app/_auth/dashboard/_layout'
      path: '/dashboard'
      fullPath: '/dashboard'
      preLoaderRoute: typeof AppAuthDashboardLayoutImport
      parentRoute: typeof AppAuthDashboardRoute
    }
    '/_app/_auth/image-editing': {
      id: '/_app/_auth/image-editing'
      path: '/image-editing'
      fullPath: '/image-editing'
      preLoaderRoute: typeof AppAuthImageEditingImport
      parentRoute: typeof AppAuthImport
    }
    '/_app/_auth/image-editing/_layout': {
      id: '/_app/_auth/image-editing/_layout'
      path: '/image-editing'
      fullPath: '/image-editing'
      preLoaderRoute: typeof AppAuthImageEditingLayoutImport
      parentRoute: typeof AppAuthImageEditingRoute
    }
    '/_app/_auth/image-generation': {
      id: '/_app/_auth/image-generation'
      path: '/image-generation'
      fullPath: '/image-generation'
      preLoaderRoute: typeof AppAuthImageGenerationImport
      parentRoute: typeof AppAuthImport
    }
    '/_app/_auth/image-generation/_layout': {
      id: '/_app/_auth/image-generation/_layout'
      path: '/image-generation'
      fullPath: '/image-generation'
      preLoaderRoute: typeof AppAuthImageGenerationLayoutImport
      parentRoute: typeof AppAuthImageGenerationRoute
    }
    '/_app/_auth/onboarding': {
      id: '/_app/_auth/onboarding'
      path: '/onboarding'
      fullPath: '/onboarding'
      preLoaderRoute: typeof AppAuthOnboardingImport
      parentRoute: typeof AppAuthImport
    }
    '/_app/_auth/onboarding/_layout': {
      id: '/_app/_auth/onboarding/_layout'
      path: '/onboarding'
      fullPath: '/onboarding'
      preLoaderRoute: typeof AppAuthOnboardingLayoutImport
      parentRoute: typeof AppAuthOnboardingRoute
    }
    '/_app/_auth/video-to-markdown': {
      id: '/_app/_auth/video-to-markdown'
      path: '/video-to-markdown'
      fullPath: '/video-to-markdown'
      preLoaderRoute: typeof AppAuthVideoToMarkdownImport
      parentRoute: typeof AppAuthImport
    }
    '/_app/_auth/video-to-markdown/_layout': {
      id: '/_app/_auth/video-to-markdown/_layout'
      path: '/video-to-markdown'
      fullPath: '/video-to-markdown'
      preLoaderRoute: typeof AppAuthVideoToMarkdownLayoutImport
      parentRoute: typeof AppAuthVideoToMarkdownRoute
    }
    '/_app/login/_layout/': {
      id: '/_app/login/_layout/'
      path: '/'
      fullPath: '/login/'
      preLoaderRoute: typeof AppLoginLayoutIndexImport
      parentRoute: typeof AppLoginLayoutImport
    }
    '/_app/_auth/agent-inbox/agent/$agentId': {
      id: '/_app/_auth/agent-inbox/agent/$agentId'
      path: '/agent/$agentId'
      fullPath: '/agent-inbox/agent/$agentId'
      preLoaderRoute: typeof AppAuthAgentInboxAgentAgentIdImport
      parentRoute: typeof AppAuthAgentInboxImport
    }
    '/_app/_auth/dashboard/_layout/checkout': {
      id: '/_app/_auth/dashboard/_layout/checkout'
      path: '/checkout'
      fullPath: '/dashboard/checkout'
      preLoaderRoute: typeof AppAuthDashboardLayoutCheckoutImport
      parentRoute: typeof AppAuthDashboardLayoutImport
    }
    '/_app/_auth/dashboard/_layout/settings': {
      id: '/_app/_auth/dashboard/_layout/settings'
      path: '/settings'
      fullPath: '/dashboard/settings'
      preLoaderRoute: typeof AppAuthDashboardLayoutSettingsImport
      parentRoute: typeof AppAuthDashboardLayoutImport
    }
    '/_app/_auth/generate/guided': {
      id: '/_app/_auth/generate/guided'
      path: '/generate/guided'
      fullPath: '/generate/guided'
      preLoaderRoute: typeof AppAuthGenerateGuidedImport
      parentRoute: typeof AppAuthImport
    }
    '/_app/_auth/generate/guided/_layout': {
      id: '/_app/_auth/generate/guided/_layout'
      path: '/generate/guided'
      fullPath: '/generate/guided'
      preLoaderRoute: typeof AppAuthGenerateGuidedLayoutImport
      parentRoute: typeof AppAuthGenerateGuidedRoute
    }
    '/_app/_auth/onboarding/_layout/username': {
      id: '/_app/_auth/onboarding/_layout/username'
      path: '/username'
      fullPath: '/onboarding/username'
      preLoaderRoute: typeof AppAuthOnboardingLayoutUsernameImport
      parentRoute: typeof AppAuthOnboardingLayoutImport
    }
    '/_app/_auth/agent-inbox/_layout/': {
      id: '/_app/_auth/agent-inbox/_layout/'
      path: '/'
      fullPath: '/agent-inbox/'
      preLoaderRoute: typeof AppAuthAgentInboxLayoutIndexImport
      parentRoute: typeof AppAuthAgentInboxLayoutImport
    }
    '/_app/_auth/dashboard/_layout/': {
      id: '/_app/_auth/dashboard/_layout/'
      path: '/'
      fullPath: '/dashboard/'
      preLoaderRoute: typeof AppAuthDashboardLayoutIndexImport
      parentRoute: typeof AppAuthDashboardLayoutImport
    }
    '/_app/_auth/image-editing/_layout/': {
      id: '/_app/_auth/image-editing/_layout/'
      path: '/'
      fullPath: '/image-editing/'
      preLoaderRoute: typeof AppAuthImageEditingLayoutIndexImport
      parentRoute: typeof AppAuthImageEditingLayoutImport
    }
    '/_app/_auth/image-generation/_layout/': {
      id: '/_app/_auth/image-generation/_layout/'
      path: '/'
      fullPath: '/image-generation/'
      preLoaderRoute: typeof AppAuthImageGenerationLayoutIndexImport
      parentRoute: typeof AppAuthImageGenerationLayoutImport
    }
    '/_app/_auth/video-to-markdown/_layout/': {
      id: '/_app/_auth/video-to-markdown/_layout/'
      path: '/'
      fullPath: '/video-to-markdown/'
      preLoaderRoute: typeof AppAuthVideoToMarkdownLayoutIndexImport
      parentRoute: typeof AppAuthVideoToMarkdownLayoutImport
    }
    '/_app/_auth/dashboard/_layout/settings/billing': {
      id: '/_app/_auth/dashboard/_layout/settings/billing'
      path: '/billing'
      fullPath: '/dashboard/settings/billing'
      preLoaderRoute: typeof AppAuthDashboardLayoutSettingsBillingImport
      parentRoute: typeof AppAuthDashboardLayoutSettingsImport
    }
    '/_app/_auth/stories/$storyId/refine': {
      id: '/_app/_auth/stories/$storyId/refine'
      path: '/stories/$storyId/refine'
      fullPath: '/stories/$storyId/refine'
      preLoaderRoute: typeof AppAuthStoriesStoryIdRefineImport
      parentRoute: typeof AppAuthImport
    }
    '/_app/_auth/stories/$storyId/refine/_layout': {
      id: '/_app/_auth/stories/$storyId/refine/_layout'
      path: '/stories/$storyId/refine'
      fullPath: '/stories/$storyId/refine'
      preLoaderRoute: typeof AppAuthStoriesStoryIdRefineLayoutImport
      parentRoute: typeof AppAuthStoriesStoryIdRefineRoute
    }
    '/_app/_auth/dashboard/_layout/settings/': {
      id: '/_app/_auth/dashboard/_layout/settings/'
      path: '/'
      fullPath: '/dashboard/settings/'
      preLoaderRoute: typeof AppAuthDashboardLayoutSettingsIndexImport
      parentRoute: typeof AppAuthDashboardLayoutSettingsImport
    }
    '/_app/_auth/generate/guided/_layout/': {
      id: '/_app/_auth/generate/guided/_layout/'
      path: '/'
      fullPath: '/generate/guided/'
      preLoaderRoute: typeof AppAuthGenerateGuidedLayoutIndexImport
      parentRoute: typeof AppAuthGenerateGuidedLayoutImport
    }
    '/_app/_auth/stories/$storyId/refine/_layout/': {
      id: '/_app/_auth/stories/$storyId/refine/_layout/'
      path: '/'
      fullPath: '/stories/$storyId/refine/'
      preLoaderRoute: typeof AppAuthStoriesStoryIdRefineLayoutIndexImport
      parentRoute: typeof AppAuthStoriesStoryIdRefineLayoutImport
    }
  }
}

// Create and export the route tree

export const routeTree = rootRoute.addChildren({
  IndexRoute,
  AppRoute: AppRoute.addChildren({
    AppAuthRoute: AppAuthRoute.addChildren({
      AppAuthAgentInboxRoute: AppAuthAgentInboxRoute.addChildren({
        AppAuthAgentInboxLayoutRoute: AppAuthAgentInboxLayoutRoute.addChildren({
          AppAuthAgentInboxLayoutIndexRoute,
        }),
        AppAuthAgentInboxAgentAgentIdRoute,
      }),
      AppAuthDashboardRoute: AppAuthDashboardRoute.addChildren({
        AppAuthDashboardLayoutRoute: AppAuthDashboardLayoutRoute.addChildren({
          AppAuthDashboardLayoutCheckoutRoute,
          AppAuthDashboardLayoutSettingsRoute:
            AppAuthDashboardLayoutSettingsRoute.addChildren({
              AppAuthDashboardLayoutSettingsBillingRoute,
              AppAuthDashboardLayoutSettingsIndexRoute,
            }),
          AppAuthDashboardLayoutIndexRoute,
        }),
      }),
      AppAuthImageEditingRoute: AppAuthImageEditingRoute.addChildren({
        AppAuthImageEditingLayoutRoute:
          AppAuthImageEditingLayoutRoute.addChildren({
            AppAuthImageEditingLayoutIndexRoute,
          }),
      }),
      AppAuthImageGenerationRoute: AppAuthImageGenerationRoute.addChildren({
        AppAuthImageGenerationLayoutRoute:
          AppAuthImageGenerationLayoutRoute.addChildren({
            AppAuthImageGenerationLayoutIndexRoute,
          }),
      }),
      AppAuthOnboardingRoute: AppAuthOnboardingRoute.addChildren({
        AppAuthOnboardingLayoutRoute: AppAuthOnboardingLayoutRoute.addChildren({
          AppAuthOnboardingLayoutUsernameRoute,
        }),
      }),
      AppAuthVideoToMarkdownRoute: AppAuthVideoToMarkdownRoute.addChildren({
        AppAuthVideoToMarkdownLayoutRoute:
          AppAuthVideoToMarkdownLayoutRoute.addChildren({
            AppAuthVideoToMarkdownLayoutIndexRoute,
          }),
      }),
      AppAuthGenerateGuidedRoute: AppAuthGenerateGuidedRoute.addChildren({
        AppAuthGenerateGuidedLayoutRoute:
          AppAuthGenerateGuidedLayoutRoute.addChildren({
            AppAuthGenerateGuidedLayoutIndexRoute,
          }),
      }),
      AppAuthStoriesStoryIdRefineRoute:
        AppAuthStoriesStoryIdRefineRoute.addChildren({
          AppAuthStoriesStoryIdRefineLayoutRoute:
            AppAuthStoriesStoryIdRefineLayoutRoute.addChildren({
              AppAuthStoriesStoryIdRefineLayoutIndexRoute,
            }),
        }),
    }),
    AppLoginRoute: AppLoginRoute.addChildren({
      AppLoginLayoutRoute: AppLoginLayoutRoute.addChildren({
        AppLoginLayoutIndexRoute,
      }),
    }),
  }),
})

/* prettier-ignore-end */

/* ROUTE_MANIFEST_START
{
  "routes": {
    "__root__": {
      "filePath": "__root.tsx",
      "children": [
        "/",
        "/_app"
      ]
    },
    "/": {
      "filePath": "index.tsx"
    },
    "/_app": {
      "filePath": "_app.tsx",
      "children": [
        "/_app/_auth",
        "/_app/login"
      ]
    },
    "/_app/_auth": {
      "filePath": "_app/_auth.tsx",
      "parent": "/_app",
      "children": [
        "/_app/_auth/agent-inbox",
        "/_app/_auth/dashboard",
        "/_app/_auth/image-editing",
        "/_app/_auth/image-generation",
        "/_app/_auth/onboarding",
        "/_app/_auth/video-to-markdown",
        "/_app/_auth/generate/guided",
        "/_app/_auth/stories/$storyId/refine"
      ]
    },
    "/_app/login": {
      "filePath": "_app/login",
      "parent": "/_app",
      "children": [
        "/_app/login/_layout"
      ]
    },
    "/_app/login/_layout": {
      "filePath": "_app/login/_layout.tsx",
      "parent": "/_app/login",
      "children": [
        "/_app/login/_layout/"
      ]
    },
    "/_app/_auth/agent-inbox": {
      "filePath": "_app/_auth/agent-inbox",
      "parent": "/_app/_auth",
      "children": [
        "/_app/_auth/agent-inbox/_layout",
        "/_app/_auth/agent-inbox/agent/$agentId"
      ]
    },
    "/_app/_auth/agent-inbox/_layout": {
      "filePath": "_app/_auth/agent-inbox/_layout.tsx",
      "parent": "/_app/_auth/agent-inbox",
      "children": [
        "/_app/_auth/agent-inbox/_layout/"
      ]
    },
    "/_app/_auth/dashboard": {
      "filePath": "_app/_auth/dashboard",
      "parent": "/_app/_auth",
      "children": [
        "/_app/_auth/dashboard/_layout"
      ]
    },
    "/_app/_auth/dashboard/_layout": {
      "filePath": "_app/_auth/dashboard/_layout.tsx",
      "parent": "/_app/_auth/dashboard",
      "children": [
        "/_app/_auth/dashboard/_layout/checkout",
        "/_app/_auth/dashboard/_layout/settings",
        "/_app/_auth/dashboard/_layout/"
      ]
    },
    "/_app/_auth/image-editing": {
      "filePath": "_app/_auth/image-editing",
      "parent": "/_app/_auth",
      "children": [
        "/_app/_auth/image-editing/_layout"
      ]
    },
    "/_app/_auth/image-editing/_layout": {
      "filePath": "_app/_auth/image-editing/_layout.tsx",
      "parent": "/_app/_auth/image-editing",
      "children": [
        "/_app/_auth/image-editing/_layout/"
      ]
    },
    "/_app/_auth/image-generation": {
      "filePath": "_app/_auth/image-generation",
      "parent": "/_app/_auth",
      "children": [
        "/_app/_auth/image-generation/_layout"
      ]
    },
    "/_app/_auth/image-generation/_layout": {
      "filePath": "_app/_auth/image-generation/_layout.tsx",
      "parent": "/_app/_auth/image-generation",
      "children": [
        "/_app/_auth/image-generation/_layout/"
      ]
    },
    "/_app/_auth/onboarding": {
      "filePath": "_app/_auth/onboarding",
      "parent": "/_app/_auth",
      "children": [
        "/_app/_auth/onboarding/_layout"
      ]
    },
    "/_app/_auth/onboarding/_layout": {
      "filePath": "_app/_auth/onboarding/_layout.tsx",
      "parent": "/_app/_auth/onboarding",
      "children": [
        "/_app/_auth/onboarding/_layout/username"
      ]
    },
    "/_app/_auth/video-to-markdown": {
      "filePath": "_app/_auth/video-to-markdown",
      "parent": "/_app/_auth",
      "children": [
        "/_app/_auth/video-to-markdown/_layout"
      ]
    },
    "/_app/_auth/video-to-markdown/_layout": {
      "filePath": "_app/_auth/video-to-markdown/_layout.tsx",
      "parent": "/_app/_auth/video-to-markdown",
      "children": [
        "/_app/_auth/video-to-markdown/_layout/"
      ]
    },
    "/_app/login/_layout/": {
      "filePath": "_app/login/_layout.index.tsx",
      "parent": "/_app/login/_layout"
    },
    "/_app/_auth/agent-inbox/agent/$agentId": {
      "filePath": "_app/_auth/agent-inbox/agent/$agentId.tsx",
      "parent": "/_app/_auth/agent-inbox"
    },
    "/_app/_auth/dashboard/_layout/checkout": {
      "filePath": "_app/_auth/dashboard/_layout.checkout.tsx",
      "parent": "/_app/_auth/dashboard/_layout"
    },
    "/_app/_auth/dashboard/_layout/settings": {
      "filePath": "_app/_auth/dashboard/_layout.settings.tsx",
      "parent": "/_app/_auth/dashboard/_layout",
      "children": [
        "/_app/_auth/dashboard/_layout/settings/billing",
        "/_app/_auth/dashboard/_layout/settings/"
      ]
    },
    "/_app/_auth/generate/guided": {
      "filePath": "_app/_auth/generate/guided",
      "parent": "/_app/_auth",
      "children": [
        "/_app/_auth/generate/guided/_layout"
      ]
    },
    "/_app/_auth/generate/guided/_layout": {
      "filePath": "_app/_auth/generate/guided/_layout.tsx",
      "parent": "/_app/_auth/generate/guided",
      "children": [
        "/_app/_auth/generate/guided/_layout/"
      ]
    },
    "/_app/_auth/onboarding/_layout/username": {
      "filePath": "_app/_auth/onboarding/_layout.username.tsx",
      "parent": "/_app/_auth/onboarding/_layout"
    },
    "/_app/_auth/agent-inbox/_layout/": {
      "filePath": "_app/_auth/agent-inbox/_layout.index.tsx",
      "parent": "/_app/_auth/agent-inbox/_layout"
    },
    "/_app/_auth/dashboard/_layout/": {
      "filePath": "_app/_auth/dashboard/_layout.index.tsx",
      "parent": "/_app/_auth/dashboard/_layout"
    },
    "/_app/_auth/image-editing/_layout/": {
      "filePath": "_app/_auth/image-editing/_layout.index.tsx",
      "parent": "/_app/_auth/image-editing/_layout"
    },
    "/_app/_auth/image-generation/_layout/": {
      "filePath": "_app/_auth/image-generation/_layout.index.tsx",
      "parent": "/_app/_auth/image-generation/_layout"
    },
    "/_app/_auth/video-to-markdown/_layout/": {
      "filePath": "_app/_auth/video-to-markdown/_layout.index.tsx",
      "parent": "/_app/_auth/video-to-markdown/_layout"
    },
    "/_app/_auth/dashboard/_layout/settings/billing": {
      "filePath": "_app/_auth/dashboard/_layout.settings.billing.tsx",
      "parent": "/_app/_auth/dashboard/_layout/settings"
    },
    "/_app/_auth/stories/$storyId/refine": {
      "filePath": "_app/_auth/stories/$storyId/refine",
      "parent": "/_app/_auth",
      "children": [
        "/_app/_auth/stories/$storyId/refine/_layout"
      ]
    },
    "/_app/_auth/stories/$storyId/refine/_layout": {
      "filePath": "_app/_auth/stories/$storyId/refine/_layout.tsx",
      "parent": "/_app/_auth/stories/$storyId/refine",
      "children": [
        "/_app/_auth/stories/$storyId/refine/_layout/"
      ]
    },
    "/_app/_auth/dashboard/_layout/settings/": {
      "filePath": "_app/_auth/dashboard/_layout.settings.index.tsx",
      "parent": "/_app/_auth/dashboard/_layout/settings"
    },
    "/_app/_auth/generate/guided/_layout/": {
      "filePath": "_app/_auth/generate/guided/_layout.index.tsx",
      "parent": "/_app/_auth/generate/guided/_layout"
    },
    "/_app/_auth/stories/$storyId/refine/_layout/": {
      "filePath": "_app/_auth/stories/$storyId/refine/_layout.index.tsx",
      "parent": "/_app/_auth/stories/$storyId/refine/_layout"
    }
  }
}
ROUTE_MANIFEST_END */
