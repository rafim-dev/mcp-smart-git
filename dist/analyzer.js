"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeDiffForCommit = analyzeDiffForCommit;
exports.performPrReview = performPrReview;
exports.generateReleaseChangelog = generateReleaseChangelog;
exports.suggestConflictResolution = suggestConflictResolution;
function analyzeDiffForCommit(diff, status) {
    const filePaths = status.files.map(f => f.path);
    // Determine primary scope
    let scope = "core";
    if (filePaths.length > 0) {
        const firstDir = filePaths[0].split("/")[0];
        if (firstDir && firstDir !== "src") {
            scope = firstDir;
        }
        else if (filePaths[0].includes("/")) {
            const parts = filePaths[0].split("/");
            scope = parts[1] || "core";
        }
    }
    // Determine commit type by analyzing diff & paths
    let type = "chore";
    const lowerDiff = diff.toLowerCase();
    const allInDocs = filePaths.every(p => p.endsWith(".md") || p.includes("docs/"));
    const allInTests = filePaths.every(p => p.includes("test") || p.includes("spec"));
    if (allInDocs) {
        type = "docs";
    }
    else if (allInTests) {
        type = "test";
    }
    else if (lowerDiff.includes("fix") || lowerDiff.includes("bug") || lowerDiff.includes("error") || lowerDiff.includes("patch")) {
        type = "fix";
    }
    else if (lowerDiff.includes("feature") || lowerDiff.includes("add ") || status.stagedCount > 0 && status.files.some(f => f.status === "added")) {
        type = "feat";
    }
    else if (lowerDiff.includes("refactor") || lowerDiff.includes("cleanup")) {
        type = "refactor";
    }
    else if (lowerDiff.includes("perf") || lowerDiff.includes("optimize")) {
        type = "perf";
    }
    // Detect breaking changes
    const isBreakingChange = lowerDiff.includes("breaking change") ||
        lowerDiff.includes("deprecated") ||
        lowerDiff.includes("removed") && type !== "test";
    // Build subject and body
    const changedFileNames = filePaths.map(p => p.split("/").pop()).join(", ");
    const subject = `${type}(${scope}): update ${changedFileNames || "codebase"}`;
    const body = [
        `Summary of changes across ${status.files.length} file(s):`,
        ...status.files.map(f => `- ${f.status.toUpperCase()}: ${f.path}`)
    ];
    if (isBreakingChange) {
        body.push("\nBREAKING CHANGE: Core API interfaces or behaviors have been modified.");
    }
    const fullMessage = `${subject}\n\n${body.join("\n")}`;
    return {
        type,
        scope,
        subject,
        body,
        fullMessage,
        isBreakingChange,
        breakingChangeReason: isBreakingChange ? "Detected removal or deprecation of interfaces/logic." : undefined
    };
}
function performPrReview(diff, status) {
    const findings = [];
    const lines = diff.split("\n");
    let totalAdditions = 0;
    let totalDeletions = 0;
    let currentFile = "";
    // Common secret regex patterns
    const secretPatterns = [
        { name: "AWS Key", regex: /AKIA[0-9A-Z]{16}/i },
        { name: "Generic API Key", regex: /(?:api_key|apikey|secret_key|private_key)\s*[:=]\s*['\"][a-zA-Z0-9_\-]{16,}['\"]/i },
        { name: "Bearer Token", regex: /bearer\s+[a-zA-Z0-9_\-\.]{20,}/i },
        { name: "Private Key Header", regex: /-----BEGIN (?:RSA )?PRIVATE KEY-----/ }
    ];
    for (const line of lines) {
        if (line.startsWith("+++ b/")) {
            currentFile = line.substring(6).trim();
        }
        if (line.startsWith("+") && !line.startsWith("+++")) {
            totalAdditions++;
            const addedContent = line.substring(1);
            // 1. Security scan: Leaked secrets
            for (const pattern of secretPatterns) {
                if (pattern.regex.test(addedContent)) {
                    findings.push({
                        severity: "critical",
                        category: "security",
                        file: currentFile,
                        lineSnippet: addedContent.trim().substring(0, 80),
                        description: `Potential hardcoded secret detected: ${pattern.name}`,
                        recommendation: "Move sensitive credentials to environment variables or secret vaults immediately."
                    });
                }
            }
            // 2. Code smell: Leftover debug logs in production files
            if (!currentFile.includes("test") && !currentFile.includes("scripts")) {
                if (/console\.(log|debug)\(/.test(addedContent)) {
                    findings.push({
                        severity: "suggestion",
                        category: "maintainability",
                        file: currentFile,
                        lineSnippet: addedContent.trim(),
                        description: "Debug console.log statement found in production code.",
                        recommendation: "Remove or replace with a structured logger before merging."
                    });
                }
            }
            // 3. Dangerous execution / Eval
            if (/\beval\(|new\s+Function\(|execSync\(/i.test(addedContent)) {
                findings.push({
                    severity: "critical",
                    category: "security",
                    file: currentFile,
                    lineSnippet: addedContent.trim(),
                    description: "Dangerous dynamic execution call (eval/execSync).",
                    recommendation: "Avoid arbitrary code execution or sanitize inputs with strict allowlists."
                });
            }
        }
        else if (line.startsWith("-") && !line.startsWith("---")) {
            totalDeletions++;
        }
    }
    const hasTests = status.files.some(f => f.path.includes("test") || f.path.includes("spec"));
    if (!hasTests && totalAdditions > 30) {
        findings.push({
            severity: "warning",
            category: "maintainability",
            file: "General",
            description: "Significant code changes without new or updated test files.",
            recommendation: "Add unit or integration tests verifying the new behavior."
        });
    }
    // Security score
    let securityScore = 100;
    const criticalCount = findings.filter(f => f.severity === "critical").length;
    const warningCount = findings.filter(f => f.severity === "warning").length;
    securityScore = Math.max(0, 100 - (criticalCount * 35) - (warningCount * 10));
    let verdict = "APPROVED";
    if (criticalCount > 0) {
        verdict = "REQUEST_CHANGES";
    }
    else if (warningCount > 1) {
        verdict = "NEEDS_DISCUSSION";
    }
    const summary = `Reviewed ${status.files.length} files with +${totalAdditions} / -${totalDeletions} changes. ${findings.length} findings identified. Security Score: ${securityScore}/100.`;
    return {
        summary,
        totalAdditions,
        totalDeletions,
        changedFilesCount: status.files.length,
        securityScore,
        findings,
        hasTests,
        verdict
    };
}
function generateReleaseChangelog(commits) {
    const categories = {
        "✨ Features": [],
        "🐛 Bug Fixes": [],
        "⚡ Performance": [],
        "♻️ Refactoring": [],
        "📝 Documentation": [],
        "🔧 Maintenance": []
    };
    for (const c of commits) {
        const msg = c.message.trim();
        const entry = `- ${msg} (\`${c.hash.substring(0, 7)}\`) - *${c.author}*`;
        if (/^feat/i.test(msg))
            categories["✨ Features"].push(entry);
        else if (/^fix/i.test(msg))
            categories["🐛 Bug Fixes"].push(entry);
        else if (/^perf/i.test(msg))
            categories["⚡ Performance"].push(entry);
        else if (/^refactor/i.test(msg))
            categories["♻️ Refactoring"].push(entry);
        else if (/^docs/i.test(msg))
            categories["📝 Documentation"].push(entry);
        else
            categories["🔧 Maintenance"].push(entry);
    }
    let md = `# Release Changelog\n\n*Generated on ${new Date().toISOString().split("T")[0]}*\n\n`;
    for (const [title, list] of Object.entries(categories)) {
        if (list.length > 0) {
            md += `### ${title}\n${list.join("\n")}\n\n`;
        }
    }
    return md;
}
function suggestConflictResolution(conflict) {
    return {
        strategy: "synthesized_union",
        resolution: `${conflict.currentContent}\n\n// --- Combined from ${conflict.incomingBranchName} ---\n${conflict.incomingContent}`,
        explanation: `Conflict in ${conflict.filePath} at line ${conflict.lineNumber}. Proposed merging both branches (${conflict.currentBranchName} and ${conflict.incomingBranchName}) while keeping current branch logic precedence.`
    };
}
