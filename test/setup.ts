import { resolve } from "node:path";

/**
 * loadCatalog() will `go run . host-manifest` for every nested MCP repo
 * (90s exec each). Unit tests never want that — point at a missing tree
 * so discover falls back to PACKAGES without compiling Go.
 */
process.env.GANTREE_MCP_ROOT ??= resolve("/tmp/gantree-test-no-mcp-repos");
