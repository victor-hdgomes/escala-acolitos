import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Nada aqui sobe arquivo; o default do Next também é 1MB, explícito pra
      // não regredir sem querer.
      bodySizeLimit: "1mb",
    },
  },
};

export default nextConfig;
