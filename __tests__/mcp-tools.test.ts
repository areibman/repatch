import { TOOL_DEFINITIONS } from "@/app/api/mcp/tools/definitions";

describe("MCP tool definitions", () => {
  it("includes summary and video tools", () => {
    const toolNames = TOOL_DEFINITIONS.map((tool) => tool.name);
    expect(toolNames).toContain("summary.generate");
    expect(toolNames).toContain("video.render");
  });

  it("provides JSON schemas for inputs", () => {
    TOOL_DEFINITIONS.forEach((tool) => {
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema).toHaveProperty("type", "object");
    });
  });
});


