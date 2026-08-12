#!/usr/bin/env node
/**
 * Skill Router MCP Server
 * Two tools: find_skills(task), load_skill(id)
 * Progressive loading: index in context, SKILL.md body on demand
 */

const fs = require("node:fs");
const path = require("node:path");

const REGISTRY_PATH = path.join(process.env.HOME, ".config", "opencode", "skill-router", "registry.json");

let registry = null;

function loadRegistry() {
  if (registry) return registry;
  if (!fs.existsSync(REGISTRY_PATH)) {
    throw new Error(`Registry not found at ${REGISTRY_PATH}. Run generator first.`);
  }
  registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8"));
  return registry;
}

function tokenize(text) {
  return text.toLowerCase().match(/[a-z0-9][a-z0-9-]{2,}/g) || [];
}

function findSkills(task, opts = {}) {
  const reg = loadRegistry();
  const topK = opts.top_k || 3;
  const categoryFilter = opts.category;
  const tokens = tokenize(task);

  const scored = reg.skills
    .filter((s) => !categoryFilter || (s.category && s.category.includes(categoryFilter)))
    .map((s) => {
      let score = 0;
      for (const t of tokens) {
        for (const tag of s.tags || []) {
          if (tag === t) score += 2;
          else if (tag.startsWith(t) || t.startsWith(tag)) score += 1;
        }
        for (const alias of s.aliases || []) {
          if (alias === t) score += 3;
          else if (alias.startsWith(t) || t.startsWith(alias)) score += 1;
        }
        if (s.summary.toLowerCase().includes(t)) score += 1;
      }
      return { id: s.id, summary: s.summary, tags: s.tags, score, related: s.related || [] };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  // Fast path threshold: if top score >= 2, return fast path results
  if (scored.length > 0 && scored[0].score >= 2) {
    return { results: scored, method: "fast" };
  }

  // TF-IDF fallback (simplified: cosine similarity on token overlap)
  const tfidfScored = reg.skills
    .filter((s) => !categoryFilter || (s.category && s.category.includes(categoryFilter)))
    .map((s) => {
      const skillTokens = new Set([
        ...(s.tags || []),
        ...(s.aliases || []),
        ...tokenize(s.summary),
        ...(s.description ? tokenize(s.description) : [])
      ]);
      let overlap = 0;
      for (const t of tokens) {
        if (skillTokens.has(t)) overlap++;
      }
      const score = overlap / Math.sqrt(tokens.length * skillTokens.size + 1);
      return { id: s.id, summary: s.summary, tags: s.tags, score, related: s.related || [] };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return { results: tfidfScored, method: "tfidf" };
}

function loadSkill(id) {
  const reg = loadRegistry();
  const skill = reg.skills.find((s) => s.id === id);
  if (!skill) throw new Error(`Skill not found: ${id}`);

  let body = "";
  if (skill.location?.path && fs.existsSync(skill.location.path)) {
    body = fs.readFileSync(skill.location.path, "utf8");
  } else if (skill.location?.url) {
    body = `[Remote skill: ${skill.location.url}]`;
  } else {
    body = `[No body available for ${id}]`;
  }

  return {
    id: skill.id,
    summary: skill.summary,
    tags: skill.tags,
    body,
    allowed_tools: skill.metadata?.allowed_tools,
    embedded_mcp: skill.metadata?.embedded_mcp,
    model: skill.metadata?.model,
    license: skill.metadata?.license,
    source_path: skill.location?.path
  };
}

// MCP stdio protocol
function sendResponse(id, result) {
  console.log(JSON.stringify({ jsonrpc: "2.0", id, result }));
}

function sendError(id, code, message) {
  console.log(JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }));
}

function handleRequest(req) {
  const { id, method, params } = req;
  try {
    switch (method) {
      case "initialize":
        sendResponse(id, {
          protocolVersion: "2026-07-28",
          capabilities: { tools: {} },
          serverInfo: { name: "skill-router", version: "0.1.0" }
        });
        break;
      case "tools/list":
        sendResponse(id, {
          tools: [
            {
              name: "find_skills",
              description: "Find relevant skills for a task using two-tier routing (fast path + TF-IDF fallback)",
              inputSchema: {
                type: "object",
                properties: {
                  task: { type: "string", description: "Work description or category label" },
                  top_k: { type: "integer", default: 3, minimum: 1, maximum: 10 },
                  category: { type: "string", description: "Optional category filter" }
                },
                required: ["task"]
              }
            },
            {
              name: "load_skill",
              description: "Load full SKILL.md body for a skill ID",
              inputSchema: {
                type: "object",
                properties: {
                  id: { type: "string", description: "Skill ID from find_skills" }
                },
                required: ["id"]
              }
            }
          ]
        });
        break;
      case "tools/call":
        if (params.name === "find_skills") {
          const result = findSkills(params.arguments.task, params.arguments);
          sendResponse(id, { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] });
        } else if (params.name === "load_skill") {
          const result = loadSkill(params.arguments.id);
          sendResponse(id, { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] });
        } else {
          sendError(id, -32601, `Unknown tool: ${params.name}`);
        }
        break;
      default:
        sendError(id, -32601, `Method not found: ${method}`);
    }
  } catch (e) {
    sendError(id, -32603, e.message);
  }
}

// Read stdin line by line
let buffer = "";
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let lines = buffer.split("\n");
  buffer = lines.pop();
  for (const line of lines) {
    if (line.trim()) {
      try {
        handleRequest(JSON.parse(line));
      } catch (e) {
        // Ignore parse errors
      }
    }
  }
});

process.stdin.on("end", () => {
  if (buffer.trim()) {
    try {
      handleRequest(JSON.parse(buffer));
    } catch (e) {}
  }
});