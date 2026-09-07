"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const analyzer_js_1 = require("./analyzer.js");
(0, node_test_1.describe)("mcp-smart-git analyzer", () => {
    (0, node_test_1.it)("should generate a feat conventional commit for feature diffs", () => {
        const mockStatus = {
            branch: "feature/auth",
            isClean: false,
            stagedCount: 1,
            unstagedCount: 0,
            untrackedCount: 0,
            files: [{ path: "src/auth/login.ts", status: "added", staged: true }]
        };
        const mockDiff = `+ export function loginUser() { return true; }`;
        const suggestion = (0, analyzer_js_1.analyzeDiffForCommit)(mockDiff, mockStatus);
        node_assert_1.default.strictEqual(suggestion.type, "feat");
        node_assert_1.default.strictEqual(suggestion.scope, "auth");
        node_assert_1.default.ok(suggestion.fullMessage.includes("feat(auth):"));
        node_assert_1.default.strictEqual(suggestion.isBreakingChange, false);
    });
    (0, node_test_1.it)("should detect potential security leaks in PR diffs", () => {
        const mockStatus = {
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
        const report = (0, analyzer_js_1.performPrReview)(mockDiff, mockStatus);
        node_assert_1.default.strictEqual(report.verdict, "REQUEST_CHANGES");
        node_assert_1.default.ok(report.securityScore < 100);
        node_assert_1.default.ok(report.findings.some(f => f.category === "security"));
    });
    (0, node_test_1.it)("should generate categorized release changelog", () => {
        const commits = [
            { hash: "1111111", author: "Dev", date: "2026-09-01", message: "feat(api): add v2 endpoint" },
            { hash: "2222222", author: "Dev", date: "2026-09-01", message: "fix(auth): prevent token bypass" }
        ];
        const changelog = (0, analyzer_js_1.generateReleaseChangelog)(commits);
        node_assert_1.default.ok(changelog.includes("✨ Features"));
        node_assert_1.default.ok(changelog.includes("🐛 Bug Fixes"));
        node_assert_1.default.ok(changelog.includes("add v2 endpoint"));
        node_assert_1.default.ok(changelog.includes("prevent token bypass"));
    });
    (0, node_test_1.it)("should propose conflict resolutions", () => {
        const conflict = {
            filePath: "src/app.ts",
            currentBranchName: "HEAD",
            currentContent: "const PORT = 3000;",
            incomingBranchName: "feature",
            incomingContent: "const PORT = 8080;",
            lineNumber: 12
        };
        const res = (0, analyzer_js_1.suggestConflictResolution)(conflict);
        node_assert_1.default.strictEqual(res.strategy, "synthesized_union");
        node_assert_1.default.ok(res.resolution.includes("3000"));
        node_assert_1.default.ok(res.resolution.includes("8080"));
    });
});
