export const TOOL_DEFINITIONS = [
  {
    name: "summary.generate",
    description:
      "Summarize GitHub commits into AI-ready changelog content for newsletters or MCP agents.",
    inputSchema: {
      type: "object",
      required: ["owner", "repo", "filters"],
      properties: {
        owner: {
          type: "string",
          description: "GitHub organization or username.",
        },
        repo: {
          type: "string",
          description: "Repository name (without owner).",
        },
        branch: {
          type: "string",
          description: "Optional branch to constrain the search window.",
        },
        filters: {
          type: "object",
          description:
            "PatchNoteFilters payload used by the dashboard (time presets, releases, custom ranges, etc.).",
        },
        templateId: {
          type: "string",
          format: "uuid",
          description: "Optional AI template ID to override the default prompt.",
        },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        content: { type: "string" },
        detailedContexts: { type: "array", items: { type: "object" } },
        totalCommits: { type: "number" },
        totalAdditions: { type: "number" },
        totalDeletions: { type: "number" },
      },
    },
  },
  {
    name: "video.render",
    description:
      "Trigger a Remotion render for an existing patch note and receive the render job identifiers.",
    inputSchema: {
      type: "object",
      required: ["patchNoteId"],
      properties: {
        patchNoteId: {
          type: "string",
          format: "uuid",
          description: "Patch note identifier owned by the authenticated user.",
        },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        renderId: { type: "string" },
        bucketName: { type: "string" },
      },
    },
  },
] as const;


