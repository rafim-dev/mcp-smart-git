# ⚡ Smart Git MCP Server & CLI

[![mcp-smart-git MCP server](https://glama.ai/mcp/servers/rafim-dev/mcp-smart-git/badges/score.svg)](https://glama.ai/mcp/servers/rafim-dev/mcp-smart-git)
[![Awesome-MCP](https://img.shields.io/badge/Awesome--MCP-Merged%20%E2%AD%90-blue)](https://github.com/punkpeye/awesome-mcp-servers/pull/13847)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![MCP Protocol](https://img.shields.io/badge/MCP-Standard%20Stdio-blue.svg)](https://modelcontextprotocol.io)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-green.svg)](https://nodejs.org)
[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey.svg)](https://nodejs.org)

> **Next-generation Model Context Protocol (MCP) server & CLI for Git workflows.**  
> Semantic Conventional Commits, Pre-PR Secret Audits, Conflict Resolution, and Automated Release Notes for **Claude Desktop**, **Cursor**, **Command Code**, and **Cline**.

---

## 🌟 Why mcp-smart-git?

AI coding assistants are brilliant at writing code, but they have zero hesitation about:
1. **Accidentally staging API keys, `.env` tokens, or database credentials** in unified diffs.
2. **Writing lazy, chaotic commit messages** (`"update stuff"`, `"fix"`).
3. **Creating catastrophic merge conflicts** during branch merges.

`mcp-smart-git` gives your AI assistant a senior DevOps partner that analyzes git diffs safely and semantically.

---

## 🚀 Quick Setup (MCP Stdio)

### 1. Cursor (`.cursor/mcp.json`)
```json
{
  "mcpServers": {
    "smart-git": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/mcp-smart-git/dist/index.js"]
    }
  }
}
```

### 2. Claude Desktop (`claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "smart-git": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/mcp-smart-git/dist/index.js"]
    }
  }
}
```

---

## 🛠️ MCP Tools Exposed

| Tool | Parameters | Description |
| :--- | :--- | :--- |
| `git_smart_commit` | `staged_only?: boolean` | Parses diffs to generate structured **Conventional Commits** (`feat:`, `fix:`, `refactor:`) with semantic rationale and breaking-change detection. |
| `git_review_diff` | `staged_only?: boolean` | Runs static analysis on diff lines for **secret leaks** (AWS keys, OpenAI tokens, private keys), `eval()` hazards, and forgotten debug logs. Generates a 0–100 security score. |
| `git_resolve_conflicts` | `file_path?: string` | Scans repository for `<<<<<<< HEAD` conflict markers and synthesizes clean merge recommendations. |
| `git_release_changelog` | `since_tag?: string` | Categorizes recent commit history into clean markdown release notes grouped by features, fixes, and chores. |
| `git_status` | - | Returns clean, token-efficient repository branch and tracking metrics. |

---

## 💻 Standalone Terminal CLI Usage

No MCP client required! You can also execute it directly from your terminal:

```bash
# Clone & install dependencies
git clone https://github.com/rafim-dev/mcp-smart-git.git
cd mcp-smart-git
npm install
npm run build

# Generate conventional commit from current diff
node dist/index.js commit

# Run pre-PR secret audit & security score
node dist/index.js review

# Synthesize conflict resolution
node dist/index.js conflicts

# Generate release changelog
node dist/index.js changelog
```

*(Tip: Run `npm link` inside the directory to make the `mcp-smart-git` command globally available anywhere in your shell).*

---

## 🧪 Testing & Verification

Includes a complete automated test suite (100% passing):

```bash
npm test
```

---

## 📦 Pro Distribution & Power Bundle

* ⚡ [**Download Compiled Zero-Config Bundle on Gumroad**](https://rafi860.gumroad.com/l/mcp-smart-git) ($5.00+ Pay-What-You-Want)
* 🎮 [**Download on itch.io**](https://rafi-m.itch.io/mcp-smart-git) ($5.00+ Pay-What-You-Want)
* 🎁 [**Get the 2-in-1 AI Developer Power Bundle**](https://rafi860.gumroad.com/l/ai-developer-bundle) (Includes `mcp-smart-git` + `schema-bridge-mcp` at 20% off)

---

## 📄 License

MIT License. Authored by [rafim_dev](https://x.com/rafim_dev).
