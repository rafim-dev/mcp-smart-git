#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from "@modelcontextprotocol/sdk/types.js";

import {
  getGitStatus,
  getDiff,
  getCommitHistory,
  findConflictBlocks
} from "./git.js";

import {
  analyzeDiffForCommit,
  performPrReview,
  generateReleaseChangelog,
  suggestConflictResolution
} from "./analyzer.js";

// Define MCP Tools
const TOOLS: Tool[] = [
  {
    name: "git_status",
    description: "Get structured status of current repository including staged, unstaged, untracked files and active branch.",
    inputSchema: {
      type: "object",
      properties: {
        cwd: { type: "string", description: "Target repository directory path (defaults to current working directory)" }
      }
    }
  },
  {
    name: "git_smart_commit",
    description: "Analyze staged or current git diff to generate a standard Conventional Commit message with scope, rationale, and breaking change warnings.",
    inputSchema: {
      type: "object",
      properties: {
        cwd: { type: "string", description: "Target repository directory path" },
        stagedOnly: { type: "boolean", description: "If true, only analyze staged changes; otherwise analyzes all working directory diffs." }
      }
    }
  },
  {
    name: "git_review_diff",
    description: "Perform an automated AI code review on git diff. Scans for security leaks, dangerous calls, code smells, and missing tests.",
    inputSchema: {
      type: "object",
      properties: {
        cwd: { type: "string", description: "Target repository directory path" },
        targetBranch: { type: "string", description: "Base branch to compare against (e.g. 'main' or 'origin/main'). If omitted, reviews local uncommitted changes." },
        stagedOnly: { type: "boolean", description: "Analyze only staged changes." }
      }
    }
  },
  {
    name: "git_resolve_conflicts",
    description: "Scan the repository for merge conflict markers (<<<<<<< HEAD) and provide synthesized resolution options.",
    inputSchema: {
      type: "object",
      properties: {
        cwd: { type: "string", description: "Target repository directory path" }
      }
    }
  },
  {
    name: "git_release_changelog",
    description: "Generate structured GitHub/GitLab release notes and changelog markdown categorized by features, fixes, and breaking changes.",
    inputSchema: {
      type: "object",
      properties: {
        cwd: { type: "string", description: "Target repository directory path" },
        maxCommits: { type: "number", description: "Maximum number of recent commits to analyze (default: 25)" },
        fromRef: { type: "string", description: "Starting git tag or commit hash" },
        toRef: { type: "string", description: "Ending git tag or commit hash (default: HEAD)" }
      }
    }
  }
];

async function startMcpServer() {
  const server = new Server(
    {
      name: "mcp-smart-git",
      version: "1.0.0"
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const cwd = (args?.cwd as string) || process.cwd();

    try {
      if (name === "git_status") {
        const status = await getGitStatus(cwd);
        return {
          content: [{ type: "text", text: JSON.stringify(status, null, 2) }]
        };
      }

      if (name === "git_smart_commit") {
        const stagedOnly = Boolean(args?.stagedOnly);
        const status = await getGitStatus(cwd);
        const diff = await getDiff(cwd, stagedOnly);
        const suggestion = analyzeDiffForCommit(diff, status);
        return {
          content: [
            {
              type: "text",
              text: `Suggested Commit Message:\n\n${suggestion.fullMessage}\n\nType: ${suggestion.type}\nScope: ${suggestion.scope}\nBreaking: ${suggestion.isBreakingChange}`
            }
          ]
        };
      }

      if (name === "git_review_diff") {
        const stagedOnly = Boolean(args?.stagedOnly);
        const targetBranch = args?.targetBranch as string | undefined;
        const status = await getGitStatus(cwd);
        const diff = await getDiff(cwd, stagedOnly, targetBranch);
        const review = performPrReview(diff, status);
        return {
          content: [{ type: "text", text: JSON.stringify(review, null, 2) }]
        };
      }

      if (name === "git_resolve_conflicts") {
        const conflicts = await findConflictBlocks(cwd);
        if (conflicts.length === 0) {
          return { content: [{ type: "text", text: "No merge conflict markers detected in repository." }] };
        }
        const resolutions = conflicts.map(c => suggestConflictResolution(c));
        return { content: [{ type: "text", text: JSON.stringify(resolutions, null, 2) }] };
      }

      if (name === "git_release_changelog") {
        const maxCommits = (args?.maxCommits as number) || 25;
        const fromRef = args?.fromRef as string | undefined;
        const toRef = args?.toRef as string | undefined;
        const history = await getCommitHistory(cwd, maxCommits, fromRef, toRef);
        const changelog = generateReleaseChangelog(history);
        return { content: [{ type: "text", text: changelog }] };
      }

      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `Tool error: ${error.message}` }],
        isError: true
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Standalone CLI Mode handler
async function runCliMode(command: string) {
  const cwd = process.cwd();
  try {
    if (command === "status") {
      const status = await getGitStatus(cwd);
      console.log(`Branch: ${status.branch} (Clean: ${status.isClean})`);
      console.log(`Staged: ${status.stagedCount} | Unstaged: ${status.unstagedCount} | Untracked: ${status.untrackedCount}`);
      for (const f of status.files) {
        console.log(`  ${f.staged ? "[STAGED]" : "[UNSTAGED]"} ${f.status.toUpperCase()}: ${f.path}`);
      }
    } else if (command === "commit") {
      const status = await getGitStatus(cwd);
      const diff = await getDiff(cwd, false);
      const suggestion = analyzeDiffForCommit(diff, status);
      console.log("\n--- Recommended Commit Message ---");
      console.log(suggestion.fullMessage);
    } else if (command === "review") {
      const status = await getGitStatus(cwd);
      const diff = await getDiff(cwd, false);
      const review = performPrReview(diff, status);
      console.log(`\n--- Code Review Verdict: [${review.verdict}] (Security: ${review.securityScore}/100) ---`);
      console.log(review.summary);
      for (const find of review.findings) {
        console.log(`\n[${find.severity.toUpperCase()}] (${find.category}) in ${find.file}:`);
        console.log(`  Issue: ${find.description}`);
        console.log(`  Fix:   ${find.recommendation}`);
      }
    } else if (command === "changelog") {
      const history = await getCommitHistory(cwd, 25);
      console.log(generateReleaseChangelog(history));
    } else {
      console.log(`mcp-smart-git v1.0.0
Commands:
  mcp-smart-git status      Show structured git status
  mcp-smart-git commit      Generate Conventional Commit message from current diff
  mcp-smart-git review      Run AI code review and security audit on local diff
  mcp-smart-git changelog   Generate categorized release notes from git log
Run with no arguments to launch standard MCP stdio server.
`);
    }
  } catch (err: any) {
    console.error("CLI error:", err.message);
    process.exit(1);
  }
}

const arg = process.argv[2];
if (arg && !arg.startsWith("-")) {
  runCliMode(arg);
} else {
  startMcpServer().catch((err) => {
    console.error("MCP Server startup error:", err);
    process.exit(1);
  });
}
