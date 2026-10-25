import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Nothing here uploads a file; Next's own default is 1MB too, stated
      // explicitly so it can't regress by accident.
      bodySizeLimit: "1mb",
    },
  },
};

export default withNextIntl(nextConfig);
