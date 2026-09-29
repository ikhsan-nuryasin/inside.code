# Student Hub — Phased Completion Roadmap

## Phase 1 — Authorization and data integrity (v1.0.8 current)
- RLS and role boundaries
- position invariants
- group leader authority
- task authority
- no-attendance invariant
- polling integrity

## Phase 2 — Feature completeness
- fully usable materials with file attachments
- assignment checklist management
- announcement read state
- forum topic/category/pin/edit/delete/report
- group membership UI for class leadership/group leader
- wheel/manual group leader flow
- separated cash workspace with proof/verification
- documentation albums and photo management
- class administrative notes/notulen

## Phase 3 — Offline-first completion
- persistent cache for every read-heavy module
- outbox for every supported offline mutation
- retry/backoff
- failed/conflict state
- sync cursor/versioning
- offline file manifest and selected file caching
- multi-tab browser coordination

## Phase 4 — UX and performance
- unified tasks across classes
- cross-class calendar
- global search
- lazy-loaded class tabs
- eliminate N+1 queries
- mobile navigation hierarchy
- accessibility
- PWA update UX

## Phase 5 — Release validation
- production build
- RLS test matrix
- browser/PWA matrix
- offline/online transition tests
- storage tests
- security review
- backup/export verification
