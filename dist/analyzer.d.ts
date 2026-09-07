import { GitRepoStatus, GitConflictBlock } from "./git.js";
export interface CommitSuggestion {
    type: "feat" | "fix" | "docs" | "style" | "refactor" | "perf" | "test" | "chore";
    scope: string;
    subject: string;
    body: string[];
    fullMessage: string;
    isBreakingChange: boolean;
    breakingChangeReason?: string;
}
export interface ReviewFinding {
    severity: "critical" | "warning" | "suggestion";
    category: "security" | "bug_risk" | "performance" | "maintainability";
    file: string;
    lineSnippet?: string;
    description: string;
    recommendation: string;
}
export interface PrReviewReport {
    summary: string;
    totalAdditions: number;
    totalDeletions: number;
    changedFilesCount: number;
    securityScore: number;
    findings: ReviewFinding[];
    hasTests: boolean;
    verdict: "APPROVED" | "REQUEST_CHANGES" | "NEEDS_DISCUSSION";
}
export declare function analyzeDiffForCommit(diff: string, status: GitRepoStatus): CommitSuggestion;
export declare function performPrReview(diff: string, status: GitRepoStatus): PrReviewReport;
export declare function generateReleaseChangelog(commits: Array<{
    hash: string;
    author: string;
    date: string;
    message: string;
}>): string;
export declare function suggestConflictResolution(conflict: GitConflictBlock): {
    strategy: string;
    resolution: string;
    explanation: string;
};
