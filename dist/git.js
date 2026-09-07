"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runGit = runGit;
exports.getGitStatus = getGitStatus;
exports.getDiff = getDiff;
exports.getCommitHistory = getCommitHistory;
exports.findConflictBlocks = findConflictBlocks;
const child_process_1 = require("child_process");
const util_1 = require("util");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
async function runGit(args, cwd = process.cwd()) {
    try {
        const { stdout } = await execFileAsync("git", args, { cwd, maxBuffer: 10 * 1024 * 1024 });
        return stdout.trim();
    }
    catch (error) {
        throw new Error(`Git error (git ${args.join(" ")}): ${error.stderr || error.message}`);
    }
}
async function getGitStatus(cwd = process.cwd()) {
    const branch = (await runGit(["rev-parse", "--abbrev-ref", "HEAD"], cwd)).trim() || "HEAD";
    const rawStatus = await runGit(["status", "--porcelain"], cwd);
    const files = [];
    let stagedCount = 0;
    let unstagedCount = 0;
    let untrackedCount = 0;
    if (rawStatus.length > 0) {
        const lines = rawStatus.split("\n");
        for (const line of lines) {
            if (line.length < 3)
                continue;
            const indexCode = line[0];
            const workTreeCode = line[1];
            const filePath = line.substring(3).trim();
            if (indexCode === "?" && workTreeCode === "?") {
                untrackedCount++;
                files.push({ path: filePath, status: "untracked", staged: false });
            }
            else {
                if (indexCode !== " " && indexCode !== "?") {
                    stagedCount++;
                    let st = "modified";
                    if (indexCode === "A")
                        st = "added";
                    else if (indexCode === "D")
                        st = "deleted";
                    else if (indexCode === "R")
                        st = "renamed";
                    files.push({ path: filePath, status: st, staged: true });
                }
                if (workTreeCode !== " " && workTreeCode !== "?") {
                    unstagedCount++;
                    let st = "modified";
                    if (workTreeCode === "A")
                        st = "added";
                    else if (workTreeCode === "D")
                        st = "deleted";
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
async function getDiff(cwd = process.cwd(), staged = false, targetBranch) {
    const args = ["diff"];
    if (staged) {
        args.push("--staged");
    }
    else if (targetBranch) {
        args.push(`${targetBranch}...HEAD`);
    }
    return await runGit(args, cwd);
}
async function getCommitHistory(cwd = process.cwd(), maxCount = 20, fromRef, toRef) {
    const args = ["log", `--max-count=${maxCount}`, "--pretty=format:%H|%an|%ad|%s", "--date=short"];
    if (fromRef && toRef) {
        args.push(`${fromRef}..${toRef}`);
    }
    else if (fromRef) {
        args.push(fromRef);
    }
    const raw = await runGit(args, cwd);
    if (!raw)
        return [];
    return raw.split("\n").map(line => {
        const [hash, author, date, message] = line.split("|");
        return { hash, author, date, message };
    });
}
async function findConflictBlocks(cwd = process.cwd()) {
    const status = await getGitStatus(cwd);
    const conflicts = [];
    for (const file of status.files) {
        const fullPath = path.resolve(cwd, file.path);
        if (!fs.existsSync(fullPath))
            continue;
        try {
            const content = fs.readFileSync(fullPath, "utf-8");
            if (!content.includes("<<<<<<<"))
                continue;
            const lines = content.split("\n");
            let inConflict = false;
            let currentBranch = "";
            let incomingBranch = "";
            let currentLines = [];
            let incomingLines = [];
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
                }
                else if (inConflict && line.startsWith("=======")) {
                    pastDivider = true;
                }
                else if (inConflict && line.startsWith(">>>>>>>")) {
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
                }
                else if (inConflict) {
                    if (!pastDivider) {
                        currentLines.push(line);
                    }
                    else {
                        incomingLines.push(line);
                    }
                }
            }
        }
        catch {
            // Ignore read errors
        }
    }
    return conflicts;
}
