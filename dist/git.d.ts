export interface GitFileStatus {
    path: string;
    status: "added" | "modified" | "deleted" | "untracked" | "renamed";
    staged: boolean;
}
export interface GitRepoStatus {
    branch: string;
    isClean: boolean;
    stagedCount: number;
    unstagedCount: number;
    untrackedCount: number;
    files: GitFileStatus[];
}
export interface GitConflictBlock {
    filePath: string;
    currentBranchName: string;
    currentContent: string;
    incomingBranchName: string;
    incomingContent: string;
    lineNumber: number;
}
export declare function runGit(args: string[], cwd?: string): Promise<string>;
export declare function getGitStatus(cwd?: string): Promise<GitRepoStatus>;
export declare function getDiff(cwd?: string, staged?: boolean, targetBranch?: string): Promise<string>;
export declare function getCommitHistory(cwd?: string, maxCount?: number, fromRef?: string, toRef?: string): Promise<Array<{
    hash: string;
    author: string;
    date: string;
    message: string;
}>>;
export declare function findConflictBlocks(cwd?: string): Promise<GitConflictBlock[]>;
