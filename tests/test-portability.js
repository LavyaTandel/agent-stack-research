const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const REGISTRY_PATH = path.join(process.env.HOME, ".config", "opencode", "skill-router", "registry.json");
const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8"));

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.log(`  ✗ ${name}: ${e.message}`); }
}

console.log("=== Schema Validation ===");

test("registry has version field", () => {
  assert.ok(registry.version, "missing version");
  assert.match(registry.version, /^\d+\.\d+\.\d+$/);
});

test("registry has updated field", () => {
  assert.ok(registry.updated, "missing updated");
});

test("registry has skills array", () => {
  assert.ok(Array.isArray(registry.skills), "skills is not array");
  assert.ok(registry.skills.length > 0, "skills is empty");
});

test("all skills have required fields (id, summary, tags, location)", () => {
  const required = ["id", "summary", "tags", "location"];
  for (const s of registry.skills) {
    for (const f of required) {
      assert.ok(s[f] !== undefined && s[f] !== null, `skill ${s.id} missing ${f}`);
    }
  }
});

test("all skill IDs are unique", () => {
  const ids = registry.skills.map((s) => s.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  assert.deepStrictEqual(dupes, [], `duplicate IDs: ${[...new Set(dupes)].join(", ")}`);
});

test("all skill IDs are non-empty strings", () => {
  for (const s of registry.skills) {
    assert.strictEqual(typeof s.id, "string", `skill has non-string id`);
    assert.ok(s.id.length > 0, `skill has empty id`);
  }
});

test("all tags are arrays of strings", () => {
  for (const s of registry.skills) {
    assert.ok(Array.isArray(s.tags), `skill ${s.id} tags is not array`);
    for (const t of s.tags) {
      assert.strictEqual(typeof t, "string", `skill ${s.id} tag is not string`);
    }
  }
});

test("location has path field", () => {
  for (const s of registry.skills) {
    assert.ok(s.location.path, `skill ${s.id} missing location.path`);
  }
});

console.log("\n=== File Existence ===");

test("all skill location paths exist on disk", () => {
  const missing = [];
  for (const s of registry.skills) {
    if (!fs.existsSync(s.location.path)) missing.push({ id: s.id, path: s.location.path });
  }
  if (missing.length > 0) {
    console.log(`    ${missing.length} missing files (first 5):`);
    missing.slice(0, 5).forEach((m) => console.log(`      ${m.id}: ${m.path}`));
  }
  assert.strictEqual(missing.length, 0, `${missing.length} skill files not found`);
});

console.log("\n=== OpenCode Adapter ===");

const opencodeAdapter = require("./adapters/opencode-adapter.js");

test("OpenCode adapter loads registry", () => {
  const r = opencodeAdapter.load();
  assert.ok(r.skills.length > 0);
});

test("OpenCode adapter find_skills returns results", () => {
  const results = opencodeAdapter.find("frontend design");
  assert.ok(results.length > 0);
  assert.ok(results[0].id);
});

test("OpenCode adapter load_skill returns body", () => {
  const first = registry.skills.find((s) => fs.existsSync(s.location.path));
  const result = opencodeAdapter.load_skill(first.id);
  assert.ok(result.body);
  assert.ok(result.body.length > 0);
});

console.log("\n=== Claude Code Adapter ===");

const claudeAdapter = require("./adapters/claude-code-adapter.js");

test("Claude Code adapter maps paths correctly", () => {
  const mapped = claudeAdapter.mapPath("/Users/lavyatandel/.config/opencode/skills/test/SKILL.md");
  assert.ok(mapped.includes(".claude"), `path not mapped to .claude: ${mapped}`);
});

test("Claude Code adapter loads registry", () => {
  const r = claudeAdapter.load();
  assert.ok(r.skills.length > 0);
});

test("Claude Code adapter find_skills returns results", () => {
  const results = claudeAdapter.find("commit message");
  assert.ok(results.length > 0);
});

console.log("\n=== Codex Adapter ===");

const codexAdapter = require("./adapters/codex-adapter.js");

test("Codex adapter maps paths to hash-trusted structure", () => {
  const mapped = codexAdapter.mapPath("/Users/lavyatandel/.config/opencode/skills/test/SKILL.md");
  assert.ok(mapped.includes("skills"), `path missing skills: ${mapped}`);
});

test("Codex adapter loads registry", () => {
  const r = codexAdapter.load();
  assert.ok(r.skills.length > 0);
});

test("Codex adapter validates hash-trusted path structure", () => {
  const codexHome = path.join(process.env.HOME, ".codex", "skills");
  // Valid Codex path: ~/.codex/skills/<12-char-hash>/<name>/SKILL.md
  assert.ok(codexAdapter.validatePath(path.join(codexHome, "a1b2c3d4e5f6", "frontend-design", "SKILL.md")));
  // Invalid: not under ~/.codex/skills
  assert.ok(!codexAdapter.validatePath("/path/to/skills/test/SKILL.md"));
  // Invalid: wrong structure (missing hash segment)
  assert.ok(!codexAdapter.validatePath(path.join(codexHome, "frontend-design", "SKILL.md")));
  // Invalid: non-hex hash
  assert.ok(!codexAdapter.validatePath(path.join(codexHome, "xyz-not-hex!", "test", "SKILL.md")));
});

console.log("\n=== Cross-Harness Compatibility ===");

test("same registry works for all three adapters", () => {
  const o = opencodeAdapter.load();
  const c = claudeAdapter.load();
  const x = codexAdapter.load();
  assert.strictEqual(o.skills.length, c.skills.length, "skill count mismatch OpenCode vs Claude");
  assert.strictEqual(o.skills.length, x.skills.length, "skill count mismatch OpenCode vs Codex");
});

test("all adapters return same skill IDs", () => {
  const o = opencodeAdapter.find("design").map((s) => s.id).sort();
  const c = claudeAdapter.find("design").map((s) => s.id).sort();
  assert.deepStrictEqual(o, c, "skill IDs differ between OpenCode and Claude adapters");
});

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
