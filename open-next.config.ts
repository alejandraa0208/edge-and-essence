import type { OpenNextConfig } from "@opennextjs/cloudflare";

const config: OpenNextConfig = {
    default: {
        override: {
            wrapper: "cloudflare-node",
            converter: "edge",
            proxyExternalRequest: "fetch",
            tagCache: "dummy",
            incrementalCache: "dummy",
            queue: "dummy",
        },
    },
};

export default config;