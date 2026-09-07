import { describe, it } from "node:test";
import assert from "node:assert";
import {
  analyzeDiffForCommit,
  performPrReview,
  generateReleaseChangelog,
  suggestConflictResolution
} from "./analyzer.js";
import { GitRepoStatus, GitConflictBlock } from "./git.js";

describe("mcp-smart-git analyzer", () => {
  it("should generate a feat conventional commit for feature diffs", () => {
    const mockStatus: GitRepoStatus = {
      branch: "feature/auth",
      isClean: false,
      stagedCount: 1,
      unstagedCount: 0,
      untrackedCount: 0,
      files: [{ path: "src/auth/login.ts", status: "added", staged: true }]
    };
    const mockDiff = `+ export function loginUser() { return true; }`;
    const suggestion = analyzeDiffForCommit(mockDiff, mockStatus);

    assert.strictEqual(suggestion.type, "feat");
    assert.strictEqual(suggestion.scope, "auth");
    assert.ok(suggestion.fullMessage.includes("feat(auth):"));
    assert.strictEqual(suggestion.isBreakingChange, false);
  });

  it("should detect potential security leaks in PR diffs", () => {
    const mockStatus: GitRepoStatus = {
      branch: "hotfix/api",
      isClean: false,
      stagedCount: 1,
      unstagedCount: 0,
      untrackedCount: 0,
      files: [{ path: "src/config.ts", status: "modified", staged: true }]
    };
    const mockDiff = `
+++ b/src/config.ts
+ const api_key = "AKIA1234567890ABCDEF";
+ eval("danger");
`;
    const report = performPrReview(mockDiff, mockStatus);

    assert.strictEqual(report.verdict, "REQUEST_CHANGES");
    assert.ok(report.securityScore < 100);
    assert.ok(report.findings.some(f => f.category === "security"));
  });

  it("should generate categorized release changelog", () => {
    const commits = [
      { hash: "1111111", author: "Dev", date: "2026-09-01", message: "feat(api): add v2 endpoint" },
      { hash: "2222222", author: "Dev", date: "2026-09-01", message: "fix(auth): prevent token bypass" }
    ];
    const changelog = generateReleaseChangelog(commits);

    assert.ok(changelog.includes("✨ Features"));
    assert.ok(changelog.includes("🐛 Bug Fixes"));
    assert.ok(changelog.includes("add v2 endpoint"));
    assert.ok(changelog.includes("prevent token bypass"));
  });

  it("should propose conflict resolutions", () => {
    const conflict: GitConflictBlock = {
      filePath: "src/app.ts",
      currentBranchName: "HEAD",
      currentContent: "const PORT = 3000;",
      incomingBranchName: "feature",
      incomingContent: "const PORT = 8080;",
      lineNumber: 12
    };
    const res = suggestConflictResolution(conflict);

    assert.strictEqual(res.strategy, "synthesized_union");
    assert.ok(res.resolution.includes("3000"));
    assert.ok(res.resolution.includes("8080"));
  });
});
