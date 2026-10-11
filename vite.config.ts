import { fileURLToPath } from "node:url";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import babel from "@rolldown/plugin-babel";
import { reactCompilerPreset } from "@vitejs/plugin-react";
import { reactRouterHonoServer } from "react-router-hono-server/dev";
import { defineConfig } from "vite";

export default defineConfig({
  // The Hono server (app/server.ts) must come before React Router.
  plugins: [
    tailwindcss(),
    // The plugin only lets Vite serve source files under app/; the "@/" alias also
    // imports from these folders, which would otherwise fall through to Hono (404).
    reactRouterHonoServer({
      dev: { exclude: [/^\/(components|features|lib|server|types)\/.+\.[^/?]+(\?.*)?$/] },
    }),
    reactRouter(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  // Bundle and tree-shake the calendar's locale barrels instead of loading every
  // locale and date helper from node_modules before the production server can listen.
  ssr: { noExternal: ["react-day-picker", "date-fns", "@date-fns/tz"] },
  // Fixed origin (saved logins in the browser); fails instead of switching ports when taken.
  server: { host: "127.0.0.1", port: 3111, strictPort: true },
  optimizeDeps: {
    // Avoids rebuilding the cache during the first form submission or navigation.
    noDiscovery: true,
    include: [
      "better-auth/react",
      "better-auth/client/plugins",
      "zod",
      "@livekit/components-react",
      "livekit-client",
      "gsap",
      "@gsap/react",
      "radix-ui",
      "@tanstack/react-table",
      "date-fns",
      "nuqs",
      "nuqs/adapters/react-router/v8",
      "nuqs/server",
      "@sentry/react-router",
      "class-variance-authority",
      "cn",
      "cmdk",
      "lucide-react",
      "sonner",
      "uqr",
      "@date-fns/tz",
      "react-day-picker",
    ],
  },
});
