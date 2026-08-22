import { describe, expect, it } from "vitest";
import { parseMcpToml, stringifyMcpToml } from "./files";

describe("mcp toml", () => {
  it("round-trips a grant list", () => {
    const text = stringifyMcpToml([
      { name: "math", command: "mcp-go-math" },
      { name: "google", command: "google-mcp", args: ["--preset", "everyday"], download_tag: "latest", download_url: "https://example.com/{tag}.tgz" },
    ]);
    const servers = parseMcpToml(text);
    expect(servers.map((s) => s.name)).toEqual(["math", "google"]);
    expect(servers[1]?.args).toEqual(["--preset", "everyday"]);
    expect(servers[1]?.download_url).toContain("{tag}");
  });

  it("treats empty as no grant", () => {
    expect(parseMcpToml(null)).toEqual([]);
    expect(parseMcpToml("# none\n")).toEqual([]);
  });
});
