const fs = require("node:fs");
const path = require("node:path");

const REGISTRY_PATH = path.join(process.env.HOME, ".config", "opencode", "skill-router", "registry.json");
const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8"));

module.exports = {
  load() { return registry; },
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
