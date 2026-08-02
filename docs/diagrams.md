# Diagrams

Mermaid diagrams — rendered natively on GitHub. Animated GIF versions are a
planned follow-up (pipeline: HTML animation → ffmpeg → GIF).

## 1. Progressive tool loading (index → lazy detail)

```mermaid
flowchart LR
    subgraph "Context window"
        IDX["INDEX (always in context)
        tool / skill name + one-line purpose
        ~10-30 tokens each"]
        DET["LAZY DETAIL (loaded on demand)
        full JSON schema / SKILL.md body
        falls out after use (strict-lazy)"]
    end

    AGENT["Agent"] -->|"decides to call X"| RT["Runtime layer"]
    RT -->|"schema for X seen?"| IDX
    IDX -. "no, fetch" .-> RT
    RT -->|"intercept, fetch, validate"| DET
    DET -->|"schema"| RT
    RT -->|"execute"| SRV["MCP server / skill"]
    SRV -->|"result"| AGENT
```

## 2. Session start vs task time — skill activation today vs with a router

```mermaid
flowchart TB
    subgraph TODAY["Today: static activation (config-time)"]
        A1["Session start"] --> A2["Scan 100+ SKILL.md descriptions"]
        A2 --> A3["Match against FIRST user message only"]
        A3 -->|"match"| A4["Load skill — stays all session"]
        A3 -->|"no match / mid-session subtask"| A5["Skill never loaded — even if relevant"]
    end

    subgraph ROUTER["With skill router (task-time)"]
        B1["Any task, any agent"] --> B2["find_skills(task)"]
        B2 --> B3["Registry index: tag+keyword match (~1ms)
        semantic fallback for fuzzy tasks"]
        B3 --> B4["2-3 candidates"]
        B4 --> B5["load_skill(name) — only chosen SKILL.md enters context"]
        B5 --> B6["Skill used, then falls out (strict-lazy)"]
    end
```

## 3. The skill-router protocol (v0.1)

```mermaid
sequenceDiagram
    participant A as Agent (any harness)
    participant R as Skill Router (local stdio MCP)
    participant G as Registry (registry.json)
    participant S as SKILL.md (on disk)

    A->>R: find_skills("responsive card component")
    R->>G: keyword/tag scan + alias expansion
    G-->>R: 3 candidates (name, one-liner, tags)
    R-->>A: [{design-taste-frontend, ...}, {frontend-design, ...}]
    A->>R: load_skill("design-taste-frontend")
    R->>S: read SKILL.md + embedded config
    S-->>R: full body
    R-->>A: body + allowed-tools + optional embedded MCP manifest
    Note over A: skill instructions in context; body falls out after task
```

## 4. Multi-harness portability (the wedge shape)

```mermaid
flowchart TD
    CORE["Shared Core
    registry format + router protocol + routing logic
    (harness-agnostic)"]
    AD1["Adapter: OpenCode
    (TS plugin)"]
    AD2["Adapter: Codex CLI
    (hooks, hash-trusted)"]
    AD3["Adapter: Grok Build
    (plugin)"]
    AD4["Adapter: Claude Code
    (plugin, hardest)"]
    CORE --> AD1 & AD2 & AD3 & AD4
    AD1 --> H1["OpenCode"]
    AD2 --> H2["Codex"]
    AD3 --> H3["Grok Build"]
    AD4 --> H4["Claude Code"]
```

## 5. MCP 2026-07-28 — stateless architecture

```mermaid
flowchart LR
    subgraph BEFORE["2025-11-25 (stateful)"]
        X1["initialize handshake"] --> X2["Mcp-Session-Id returned"]
        X2 --> X3["every request pinned to one instance"]
        X3 --> X4["sticky sessions / session stores at gateways"]
    end

    subgraph AFTER["2026-07-28 (stateless)"]
        Y1["self-contained request
        clientInfo in _meta"] --> Y2["Mcp-Method / Mcp-Name headers"]
        Y2 --> Y3["any instance handles any request
        round-robin LB, no session store"]
        Y3 --> Y4["tools/list cached via ttlMs / cacheScope
        server/discover preflight"]
    end
```
