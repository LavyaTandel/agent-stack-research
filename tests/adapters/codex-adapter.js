const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const REGISTRY_PATH = path.join(process.env.HOME, ".config", "opencode", "skill-router", "registry.json");
const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8"));

// Codex uses hash-trusted paths: ~/.codex/skills/<hash>/<name>/SKILL.md
const CODEX_SKILL_DIR = path.join(process.env.HOME, ".codex", "skills");

function hashPath(p) {
  return crypto.createHash("sha256").update(p).digest("hex").slice(0, 12);
}

module.exports = {
  load() { return registry; },
  mapPath(opencodePath) {
    const basename = path.basename(path.dirname(opencodePath));
    const h = hashPath(opencodePath);
    return path.join(CODEX_SKILL_DIR, h, basename, "SKILL.md");
  },
  validatePath(p) {
    // Codex paths must be under ~/.codex/skills/<hash>/<name>/SKILL.md
    if (!p.startsWith(CODEX_SKILL_DIR)) return false;
    const rel = path.relative(CODEX_SKILL_DIR, p);
    const parts = rel.split(path.sep);
    // Must be: <hash>/<name>/SKILL.md (3 parts)
    return parts.length === 3 && parts[2] === "SKILL.md" && /^[a-f0-9]{12}$/.test(parts[0]);
  },
  find(query) {
    const tokens = query.toLowerCase().match(/[a-z0-9][a-z0-9-]{2,}/g) || [];
    return registry.skills
      .map((s) => {
        let score = 0;
        for (const t of tokens) {
          for (const tag of s.tags) {
            if (tag === t) score += 2;
            else if (tag.startsWith(t) || t.startsWith(tag)) score += 1;
          }
          if (s.summary.toLowerCase().includes(t)) score += 1;
        }
        return { id: s.id, summary: s.summary, score };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  },
  load_skill(id) {
    const skill = registry.skills.find((s) => s.id === id);
    if (!skill) throw new Error(`skill not found: ${id}`);
    const body = fs.readFileSync(skill.location.path, "utf8");
    return { id: skill.id, summary: skill.summary, body };
  },
};
