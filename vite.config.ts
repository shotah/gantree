import vinext from "vinext";
import { defineConfig } from "vite";

/** dockerode is Node/CJS (protobufjs). Keep it out of the Vite RSC pipeline. */
const dockerNative = ["dockerode", "docker-modem", "protobufjs", "ssh2", "cpu-features", "node:sqlite"];

export default defineConfig({
  plugins: [vinext()],
  optimizeDeps: {
    exclude: dockerNative,
  },
  ssr: {
    external: dockerNative,
  },
});
