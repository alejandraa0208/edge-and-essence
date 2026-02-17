import type { OpenNextConfig } from "@opennextjs/cloudflare";

const config: OpenNextConfig = {
  // Disable incremental cache on R2 to avoid permissions issues
  incrementalCache: {
    disable: true,
  },
};

export default config;
