import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";

const execFileAsync = promisify(execFile);

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

export async function runGit(args: string[], cwd: string = process.cwd()): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", args, { cwd, maxBuffer: 10 * 1024 * 1024 });
    return stdout.trim();
  } catch (error: any) {
    throw new Error(`Git error (git ${args.join(" ")}): ${error.stderr || error.message}`);
  }
}

export async function getGitStatus(cwd: string = process.cwd()): Promise<GitRepoStatus> {
  const branch = (await runGit(["rev-parse", "--abbrev-ref", "HEAD"], cwd)).trim() || "HEAD";
  const rawStatus = await runGit(["status", "--porcelain"], cwd);

  const files: GitFileStatus[] = [];
  let stagedCount = 0;
  let unstagedCount = 0;
  let untrackedCount = 0;

  if (rawStatus.length > 0) {
    const lines = rawStatus.split("\n");
    for (const line of lines) {
      if (line.length < 3) continue;
      const indexCode = line[0];
      const workTreeCode = line[1];
      const filePath = line.substring(3).trim();

      if (indexCode === "?" && workTreeCode === "?") {
        untrackedCount++;
        files.push({ path: filePath, status: "untracked", staged: false });
      } else {
        if (indexCode !== " " && indexCode !== "?") {
          stagedCount++;
          let st: GitFileStatus["status"] = "modified";
          if (indexCode === "A") st = "added";
          else if (indexCode === "D") st = "deleted";
          else if (indexCode === "R") st = "renamed";
          files.push({ path: filePath, status: st, staged: true });
        }
        if (workTreeCode !== " " && workTreeCode !== "?") {
          unstagedCount++;
          let st: GitFileStatus["status"] = "modified";
          if (workTreeCode === "A") st = "added";
          else if (workTreeCode === "D") st = "deleted";
          files.push({ path: filePath, status: st, staged: false });
        }
      }
    }
  }

  return {
    branch,
    isClean: files.length === 0,
    stagedCount,
    unstagedCount,
    untrackedCount,
    files
  };
}

export async function getDiff(cwd: string = process.cwd(), staged: boolean = false, targetBranch?: string): Promise<string> {
  const args = ["diff"];
  if (staged) {
    args.push("--staged");
  } else if (targetBranch) {
    args.push(`${targetBranch}...HEAD`);
  }
  return await runGit(args, cwd);
}

export async function getCommitHistory(cwd: string = process.cwd(), maxCount: number = 20, fromRef?: string, toRef?: string): Promise<Array<{ hash: string; author: string; date: string; message: string }>> {
  const args = ["log", `--max-count=${maxCount}`, "--pretty=format:%H|%an|%ad|%s", "--date=short"];
  if (fromRef && toRef) {
    args.push(`${fromRef}..${toRef}`);
  } else if (fromRef) {
    args.push(fromRef);
  }

  const raw = await runGit(args, cwd);
  if (!raw) return [];

  return raw.split("\n").map(line => {
    const [hash, author, date, message] = line.split("|");
    return { hash, author, date, message };
  });
}

export async function findConflictBlocks(cwd: string = process.cwd()): Promise<GitConflictBlock[]> {
  const status = await getGitStatus(cwd);
  const conflicts: GitConflictBlock[] = [];

  for (const file of status.files) {
    const fullPath = path.resolve(cwd, file.path);
    if (!fs.existsSync(fullPath)) continue;

    try {
      const content = fs.readFileSync(fullPath, "utf-8");
      if (!content.includes("<<<<<<<")) continue;

      const lines = content.split("\n");
      let inConflict = false;
      let currentBranch = "";
      let incomingBranch = "";
      let currentLines: string[] = [];
      let incomingLines: string[] = [];
      let startLine = 0;
      let pastDivider = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith("<<<<<<<")) {
          inConflict = true;
          startLine = i + 1;
          currentBranch = line.substring(7).trim() || "HEAD";
          currentLines = [];
          incomingLines = [];
          pastDivider = false;
        } else if (inConflict && line.startsWith("=======")) {
          pastDivider = true;
        } else if (inConflict && line.startsWith(">>>>>>>")) {
          incomingBranch = line.substring(7).trim() || "Incoming";
          conflicts.push({
            filePath: file.path,
            currentBranchName: currentBranch,
            currentContent: currentLines.join("\n"),
            incomingBranchName: incomingBranch,
            incomingContent: incomingLines.join("\n"),
            lineNumber: startLine
          });
          inConflict = false;
          pastDivider = false;
        } else if (inConflict) {
          if (!pastDivider) {
            currentLines.push(line);
          } else {
            incomingLines.push(line);
          }
        }
      }
    } catch {
      // Ignore read errors
    }
  }

  return conflicts;
}
