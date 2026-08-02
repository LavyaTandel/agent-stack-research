# MCP Specification Evolution: 2025-06-18 through 2026-07-28

## TL;DR

- The 2026-07-28 release is the **largest MCP revision since launch**: stateless core, extensions framework, Tasks, MCP Apps, auth hardening, and a formal deprecation policy ([MCP Blog](https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/)).
- The `initialize`/`initialized` handshake and `Mcp-Session-Id` header are **removed** (SEP-2575, SEP-2567). Every request now carries protocol version, client info, and capabilities in `_meta` — any server instance can handle any request.
- **Three core features deprecated** (not removed): Roots, Sampling, and Logging, with a guaranteed 12-month minimum deprecation window ([SEP-2577](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2577)).
- Required `Mcp-Method` and `Mcp-Name` headers on Streamable HTTP requests enable routing without body inspection — gateways that validate MCP traffic will reject old clients.
- Remote HTTP servers are the primary migration target. Local stdio servers are mostly unaffected except for deprecated features and `server/discover` support.

## Timeline of Spec Versions

### 2025-06-18 — The Baseline

The first widely-adopted stable spec. Defined the JSON-RPC message format, `initialize`/`initialized` handshake, `Mcp-Session-Id` session binding, Streamable HTTP and stdio transports, tools/resources/prompts primitives, sampling, elicitation, and the SSE-based server-to-client request flow. This is what most production MCP servers still implement today ([specification](https://modelcontextprotocol.io/specification/2025-06-18)).

### 2025-11-25 — The Anniversary Release

The first major revision after the one-year mark. Key additions:

- **Tasks** (experimental): polling-based durable work tracking for long-running operations ([SEP-1686](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1686)).
- **Authorization improvements**: OpenID Connect Discovery support, Client ID Metadata Documents for DCR ([SEP-991](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/1296)), incremental scope consent via `WWW-Authenticate` ([SEP-835](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/835)).
- **URL mode elicitation** ([SEP-1036](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1036)): out-of-band credential acquisition via browser redirect, never exposing secrets to the client.
- **Sampling with tools** ([SEP-1577](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1577)): servers can now include tool definitions in sampling requests, enabling agentic server-side loops.
- **Extensions framework** (informal): introduction of the concept with `MCP Apps` as the first proposed extension.
- **SDK tier system** ([SEP-1730](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1730)): formal requirements for official SDK feature support and maintenance.
- **Governance formalization** ([SEP-932](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/932), [SEP-1302](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1302)): working groups, interest groups, and governance structure.

Backward compatible — existing implementations keep working ([changelog](https://modelcontextprotocol.io/specification/2025-11-25/changelog)).

### 2026-07-28 — The Stateless Rewrite (Release Candidate)

Locked May 21, 2026; final spec published July 28, 2026. Breaking changes. See next section.

## 2026-07-28 Headline Changes

### Stateless Core

The `initialize`/`initialized` handshake is gone ([SEP-2575](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2575)). The `Mcp-Session-Id` header is gone ([SEP-2567](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2567)). Protocol version, client info, and capabilities travel in `_meta` on every request. A new `server/discover` method lets clients fetch server capabilities on demand. Servers that need cross-call state must use explicit, server-minted opaque handles passed as ordinary tool arguments — the "handle pattern" ([blog](https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/)).

### Routing, Caching, and Tracing

- **`Mcp-Method` and `Mcp-Name` headers** required on every Streamable HTTP request ([SEP-2243](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2243)). Load balancers route without JSON-RPC body inspection.
- **`ttlMs` and `cacheScope`** on list/read results ([SEP-2549](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2549)): clients know how long a `tools/list` is fresh and whether it's cacheable across users.
- **W3C Trace Context** propagated in `_meta` ([SEP-414](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/414)): `traceparent`, `tracestate`, `baggage` keys fixed for OpenTelemetry correlation.

### Extensions Framework

Formalized in [SEP-2133](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2133): extensions use reverse-DNS IDs, negotiate through `extensions` maps in capabilities, live in their own `ext-*` repos, and version independently. Two official extensions ship:

- **MCP Apps** ([SEP-1865](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/1865)): servers ship interactive HTML UIs rendered in sandboxed iframes, declared ahead of time for security review.
- **Tasks** ([SEP-2663](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2663)): moved from experimental core to an extension. Lifecycle redesigned around statelessness — server returns a task handle on `tools/call`, client drives with `tasks/get`, `tasks/update`, `tasks/cancel`. `tasks/list` removed.

### Multi Round-Trip Requests (MRTR)

[SEP-2322](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2322) replaces the old SSE-based server-initiated request flow. Servers return `InputRequiredResult` with `inputRequests` and opaque `requestState`; client gathers inputs and re-issues the call with `inputResponses`. No long-lived connection needed.

### Auth Hardening

Six SEPs align MCP with OAuth 2.0 / OpenID Connect ([blog](https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/)):

| SEP | Change |
|-----|--------|
| [SEP-2468](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2468) | Validate `iss` per RFC 9207 (mix-up attack defense) |
| [SEP-837](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/837) | Declare `application_type` in Dynamic Client Registration |
| [SEP-2352](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2352) | Credentials bound to authorization server issuer |
| [SEP-2207](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2207) | Refresh token request semantics clarified |
| [SEP-2350](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2350) | Scope accumulation during step-up defined |
| [SEP-2351](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2351) | Stable `.well-known` discovery suffix |

### Deprecations

[SEP-2577](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2577) deprecates (does not remove) three features with documented replacements:

- **Roots** → tool parameters, resource URIs, server config
- **Sampling** → direct LLM provider API integration
- **Logging** → `stderr` for stdio; OpenTelemetry for structured observability

Also deprecated: HTTP+SSE transport (reclassifying a soft deprecation from 2025-03-26) and `includeContext` values `"thisServer"`/`"allServers"`.

### Other Notable Changes

- **JSON Schema 2020-12** for tool `inputSchema`/`outputSchema` ([SEP-2106](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2106)): composition keywords, conditionals, `$ref`/`$defs` now allowed.
- **Error code `-32002` → `-32602`** for missing resources ([SEP-2164](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2164)), aligning with JSON-RPC standard.
- **Feature lifecycle policy** ([SEP-2596](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2596)): Active → Deprecated → Removed, minimum 12-month deprecation window.
- **`ping`, `logging/setLevel`, `notifications/roots/list_changed` removed**. Log level set per-request via `_meta`.

## SEP Process and Significant SEPs

The SEP (Specification Enhancement Proposal) process was formalized in [SEP-1850](https://github.com/modelcontextprotocol/specification/pull/1850). SEPs are markdown files in the `seps/` directory, PR-derived numbered, with a lifecycle: Draft → In-Review → Accepted → Final. A sponsor (Core Maintainer or Maintainer) champions each SEP through review. Standards Track SEPs require a reference implementation and a conformance test scenario before reaching Final status ([SEP guidelines](https://modelcontextprotocol.io/community/sep-guidelines)).

**Three significant SEPs:**

1. **SEP-2575** — Stateless core. The single most impactful change, removing the handshake and restructuring every request's metadata envelope.
2. **SEP-2322** — Multi Round-Trip Requests. Replaces SSE streams with a request-response pattern that works statelessly, enabling server-initiated work without persistent connections.
3. **SEP-2596** — Feature lifecycle policy. Establishes the governance framework that makes future breaking changes rare by guaranteeing deprecation windows.

## What This Means for stdio vs HTTP Servers

**Local stdio servers** are minimally affected. The stateless core changes are Streamable HTTP transport changes — stdio doesn't use sessions or routing headers in the same way. The main impacts for stdio servers:

- Should implement `server/discover` for client capability queries.
- Deprecated features (Roots, Sampling, Logging) still work; migrate at your pace.
- Error code change (`-32002` → `-32602`) affects all transports.

**Remote HTTP servers** face the bulk of the migration: removing handshake/session logic, externalizing state into opaque handles, adding `Mcp-Method`/`Mcp-Name` headers, and implementing MRTR for server-initiated work. The payoff is real: plain round-robin load balancing, horizontal scaling, and standard HTTP observability.

## Migration Risk Summary

| Risk | Severity | Mitigation |
|------|----------|------------|
| Session state in server process | **High** | Externalize to client-held opaque handles |
| Missing routing headers | **High** | Update client SDKs; gateways reject old clients |
| Premature deprecation removal | Medium | Don't remove Roots/Sampling/Logging for 12+ months |
| `-32002` error code match | Low | Update client code matching on the literal value |
| SSE stream resumability removed | Low | Broken streams require re-issuing the full request |
| `requestState` mishandling | Medium | Treat as opaque, server-signed, echoed verbatim |

The transport and header changes are the urgent work. Feature deprecations are safe to ignore initially.

## Sources

1. [The 2026-07-28 MCP Specification Release Candidate — MCP Blog (May 21, 2026)](https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/)
2. [One Year of MCP: November 2025 Spec Release — MCP Blog (Nov 25, 2025)](https://blog.modelcontextprotocol.io/posts/2025-11-25-first-mcp-anniversary/)
3. [2026-07-28 Changelog — modelcontextprotocol.io](https://modelcontextprotocol.io/specification/2026-07-28/changelog)
4. [2025-11-25 Changelog — modelcontextprotocol.io](https://modelcontextprotocol.io/specification/2025-11-25/changelog)
5. [MCP 2026-07-28 Release Candidate — GitHub Releases](https://github.com/modelcontextprotocol/modelcontextprotocol/releases)
6. [SEP Guidelines — modelcontextprotocol.io](https://modelcontextprotocol.io/community/sep-guidelines)
7. [MCP Goes Stateless: 2026-07-28 Spec Migration Guide — luismori.dev](https://luismori.dev/article/mcp-goes-stateless-2026-07-28-migration-guide/)
8. [MCP 2026-07-28: The Stateless Release Candidate, Explained — MCP.Directory](https://mcp.directory/blog/mcp-2026-07-28-release-candidate)
