import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PDF v Base64 může být velké tělo požadavku – zvedáme limit pro server actions.
  experimental: {
    serverActions: {
      bodySizeLimit: "15mb",
    },
  },
};

export default nextConfig;
