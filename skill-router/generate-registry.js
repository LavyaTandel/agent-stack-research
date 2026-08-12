#!/usr/bin/env node
/**
 * Skill Registry Generator
 * Scans ~/.config/opencode/skills and ~/.agents/skills for SKILL.md files
 * Emits registry.json matching REGISTRY-v0.1.md schema
 */

const fs = require("node:fs");
const path = require("node:path");

const SKILL_DIRS = [
  { harness: "opencode", path: path.join(process.env.HOME, ".config", "opencode", "skills") },
  { harness: "claude-code", path: path.join(process.env.HOME, ".agents", "skills") },
  // Codex path would be ~/.codex/skills/<hash>/<name>/SKILL.md - handled by adapter
];

const OUTPUT_DIR = path.join(process.env.HOME, ".config", "opencode", "skill-router");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "registry.json");
const OVERRIDES_PATH = path.join(OUTPUT_DIR, "registry.overrides.jsonc");

function readFrontmatter(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { body: content };
  try {
    const fm = JSON.parse(`{${match[1].replace(/^(\w+):/gm, '"$1":').replace(/'/g, '"')}}`);
    return { ...fm, body: content.slice(match[0].length).trim() };
  } catch {
    return { body: content };
  }
}

function extractSummary(fm, body) {
  if (fm.description && typeof fm.description === "string") {
    return fm.description.slice(0, 160);
  }
  const firstHeading = body.match(/^#\s+(.+)$/m);
  if (firstHeading) return firstHeading[1].slice(0, 160);
  const firstLine = body.split("\n").find(l => l.trim().length > 20);
  return firstLine ? firstLine.slice(0, 160) : "No summary available";
}

function extractTags(fm, body) {
  const tags = new Set();
  if (Array.isArray(fm.tags)) {
    for (const t of fm.tags) tags.add(t.toLowerCase());
  }
  // Auto-derive from body word frequency (simple heuristic)
  const words = body.toLowerCase().match(/[a-z]{4,}/g) || [];
  const freq = {};
  for (const w of words) freq[w] = (freq[w] || 0) + 1;
  const topWords = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([w]) => w);
  for (const w of topWords) tags.add(w);
  return Array.from(tags).slice(0, 12);
}

function extractAliases(fm, id) {
  const aliases = new Set();
  if (Array.isArray(fm.aliases)) {
    for (const a of fm.aliases) aliases.add(a.toLowerCase());
  }
  // Add common variations
  aliases.add(id.replace(/-/g, " "));
  aliases.add(id.replace(/-/g, ""));
  return Array.from(aliases).slice(0, 8);
}

function extractCategory(fm, dirName) {
  if (Array.isArray(fm.category)) return fm.category.slice(0, 3);
  // Infer from directory structure or tags
  const domainMap = {
    "design": ["design", "frontend", "ui", "ux", "css", "typography", "animation"],
    "code-quality": ["code-review", "verify", "lint", "security", "test", "refactor"],
    "writing": ["edit", "doc", "research", "article", "blog"],
    "infrastructure": ["devops", "k8s", "docker", "ci", "deploy", "cloud"],
    "agent": ["agent", "orchestrat", "multi-agent", "delegate", "team"],
    "video": ["video", "animation", "hyperframes", "remotion", "animejs"],
    "data": ["data", "pipeline", "etl", "analytics", "sql"],
    "mobile": ["mobile", "ios", "android", "react-native", "flutter"],
  };
  const tags = new Set([...(fm.tags || []), dirName]);
  for (const [domain, keywords] of Object.entries(domainMap)) {
    for (const kw of keywords) {
      if (Array.from(tags).some(t => t.includes(kw))) {
        return [domain, dirName];
      }
    }
  }
  return ["general", dirName];
}

function loadOverrides() {
  if (fs.existsSync(OVERRIDES_PATH)) {
    try {
      const content = fs.readFileSync(OVERRIDES_PATH, "utf8");
      // Simple JSONC parse (strip comments)
      const json = content.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
      return JSON.parse(json);
    } catch {
      return {};
    }
  }
  return {};
}

function applyOverrides(skill, overrides) {
  const override = overrides[skill.id];
  if (!override) return skill;
  return { ...skill, ...override, id: skill.id }; // never override id
}

function scanSkills() {
  const skills = [];
  const seen = new Set();

  for (const { harness, path: skillDir } of SKILL_DIRS) {
    if (!fs.existsSync(skillDir)) continue;
    const entries = fs.readdirSync(skillDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillPath = path.join(skillDir, entry.name, "SKILL.md");
      if (!fs.existsSync(skillPath)) continue;
      if (seen.has(entry.name)) continue; // prefer opencode over claude-code
      seen.add(entry.name);

      const fm = readFrontmatter(skillPath);
      const summary = extractSummary(fm, fm.body);
      const tags = extractTags(fm, fm.body);
      const aliases = extractAliases(fm, entry.name);
      const category = extractCategory(fm, entry.name);

      skills.push({
        id: entry.name,
        summary,
        description: fm.body.slice(0, 500), // truncated for semantic fallback
        tags,
        aliases,
        category,
        version: fm.version || "1.0.0",
        location: {
          harness,
          path: skillPath,
          type: "file"
        },
        related: [],
        metadata: {
          license: fm.license || "MIT",
          author: fm.author || "community",
          cost_tier: "cheap"
        }
      });
    }
  }

  // Sort by id for stable output
  skills.sort((a, b) => a.id.localeCompare(b.id));
  return skills;
}

function main() {
  console.log("Scanning skill directories...");
  const skills = scanSkills();
  console.log(`Found ${skills.length} skills`);

  const overrides = loadOverrides();
  if (Object.keys(overrides).length > 0) {
    console.log(`Applying ${Object.keys(overrides).length} manual overrides`);
  }

  const finalSkills = skills.map(s => applyOverrides(s, overrides));

  const registry = {
    $schema: "./skill-registry.schema.json",
    version: "0.1.0",
    updated: new Date().toISOString().slice(0, 10),
    defaults: {
      category_hierarchy: ["domain", "family", "skill"],
      max_candidates: 3
    },
    skills: finalSkills
  };

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(registry, null, 2));
  console.log(`Registry written to ${OUTPUT_PATH}`);
  console.log(`Skills: ${finalSkills.length}`);
}

main();