# Graph Report - .  (2026-06-23)

## Corpus Check
- Corpus is ~18,512 words - fits in a single context window. You may not need a graph.

## Summary
- 133 nodes · 162 edges · 21 communities (14 shown, 7 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_File System|File System]]
- [[_COMMUNITY_Files API|Files API]]
- [[_COMMUNITY_Window Manager|Window Manager]]
- [[_COMMUNITY_Dashboard Wizard|Dashboard Wizard]]
- [[_COMMUNITY_Log View|Log View]]
- [[_COMMUNITY_Widgets|Widgets]]
- [[_COMMUNITY_App Notifications|App Notifications]]
- [[_COMMUNITY_Desktop UI|Desktop UI]]
- [[_COMMUNITY_Auth Module|Auth Module]]

## God Nodes (most connected - your core abstractions)
1. `FileSystem` - 23 edges
2. `WindowManager` - 18 edges
3. `DashboardWizard` - 16 edges
4. `Widgets` - 8 edges
5. `safePath()` - 6 edges
6. `jsonExit()` - 4 edges
7. `cleanRelPath()` - 4 edges
8. `trashMetaPath()` - 4 edges
9. `Desktop` - 4 edges
10. `ensureDir()` - 3 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Import Cycles
- None detected.

## Communities (21 total, 7 thin omitted)

### Community 1 - "Files API"
Cohesion: 0.18
Nodes (10): cleanRelPath(), ensureDir(), isWithinBase(), jsonExit(), loadTrashMeta(), resolvePrefixedPath(), safePath(), saveTrashMeta() (+2 more)

### Community 4 - "Log View"
Cohesion: 0.15
Nodes (11): btnPause, btnPlay, clockElement, currentSequence, doorElement, hudText, layer, logSelector (+3 more)

## Knowledge Gaps
- **9 isolated node(s):** `logSelector`, `btnPlay`, `btnPause`, `clockElement`, `doorElement` (+4 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `WindowManager` connect `Window Manager` to `Widgets`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **What connects `logSelector`, `btnPlay`, `btnPause` to the rest of the system?**
  _9 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `File System` be split into smaller, more focused modules?**
  _Cohesion score 0.11956521739130435 - nodes in this community are weakly interconnected._