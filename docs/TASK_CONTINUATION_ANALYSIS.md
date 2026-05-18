# Task Continuation & Lifecycle Management — Gap Analysis

**Date:** 2026-05-14  
**Author:** Chandan (x288712)  
**Status:** Analysis Complete — Pending Implementation Decision

---

## 1. Executive Summary

WorkTrack AI currently treats every work submission as an independent, isolated entry. There is **no mechanism** for users to continue, update, or link tasks across days. This forces users into redundant data entry and creates disconnected records for what is conceptually the same piece of work.

This document identifies **6 real-world failure scenarios**, traces them to **7 architectural root causes**, and proposes a comprehensive solution covering data model changes, new API endpoints, frontend UX enhancements, and LLM prompt improvements.

---

## 2. Problem Statement

When a user logs a task as "in_progress" on Day 1 and continues working on it Day 2, they have no way to:
- Add hours to the existing task
- Update its status (e.g., in_progress → done)
- Link the new day's entry to the previous one

The only available options today are:
1. **Re-type the entire task** in a new free-text submission (creates a duplicate, old entry stays stale)
2. **Navigate to the dashboard**, find the item in a large table, and inline-edit it (clunky, no hours history)

Both approaches result in either **data duplication** or **lost time-tracking granularity**.

---

## 3. Failure Scenarios

### Scenario 1: Continue an In-Progress Task

> **User intent:** "I worked on CI/CD pipeline fix yesterday (2.5h, in_progress). Today I spent 2 more hours and it's done."

| Aspect | Current Behavior | Expected Behavior |
|--------|-----------------|-------------------|
| Action available | Must submit entirely new work log | Pick existing task, add hours, change status |
| Data result | Two unlinked entries (2.5h + 2h) for same work | Single logical task showing 4.5h total, status: done |
| Old entry | Stays "in_progress" forever (stale) | Automatically superseded or linked |

---

### Scenario 2: Complete a Planned/Pending Task

> **User intent:** "I had 'Create IT4You ticket for GenMI' logged as planned. Did it today in 30 minutes."

| Aspect | Current Behavior | Expected Behavior |
|--------|-----------------|-------------------|
| Action available | Inline-edit from dashboard table OR create duplicate | Quick action: mark done + add hours |
| Discovery | Must scroll/search through all historical items | See "Open Tasks" list filtered to planned items |
| UX friction | High — requires 5+ clicks in dashboard | Low — 1-2 clicks from submit page |

---

### Scenario 3: Unblock a Blocked Task

> **User intent:** "GenMI endpoints were blocked waiting on stakeholder context. Got the context today, spent 3h implementing."

| Aspect | Current Behavior | Expected Behavior |
|--------|-----------------|-------------------|
| Action available | Edit existing item (loses blocker history) OR create new entry | Clear blocker, change status, add hours — all in one action |
| Blocker history | Overwritten on edit, no audit trail | Preserved as part of task lifecycle |
| Status transition | Manual edit: blocked → in_progress/done | One-click "Unblock" with optional hours |

---

### Scenario 4: Add Hours to a Multi-Day Task (No Status Change)

> **User intent:** "Still working on InfographicAI prototype. Put in 4 more hours today."

| Aspect | Current Behavior | Expected Behavior |
|--------|-----------------|-------------------|
| Action available | Create duplicate entry OR overwrite hours on original | "Add hours" to existing task for today's date |
| Hours tracking | Single flat number (2.5 or 6.5, pick one) | Per-day breakdown: Day 1: 2.5h, Day 2: 4h = 6.5h total |
| Task identity | Two separate UUIDs, no connection | Same logical task, accumulated hours |

---

### Scenario 5: Split a Continued Task (Partially Done)

> **User intent:** "The Patient Voice documentation was in_progress. Finished the API docs (3h), but the deployment guide is still pending."

| Aspect | Current Behavior | Expected Behavior |
|--------|-----------------|-------------------|
| Action available | Edit original OR create unlinked new item | Close original (partial: done), spawn linked child task for remaining work |
| Relationship | No parent-child concept | `logical_task_id` links parent and child |
| Reporting | Two unrelated items | Hierarchical view showing task decomposition |

---

### Scenario 6: Bulk Status Update at End of Sprint

> **User intent:** "Mark all three GenMI tasks as done — spent total 6h finishing them today."

| Aspect | Current Behavior | Expected Behavior |
|--------|-----------------|-------------------|
| Action available | Individually find and edit each item (3+ separate edits) | Multi-select → batch update status + distribute hours |
| UX friction | Very high — 15+ clicks across table navigation | Low — select all, one action |
| API support | No bulk endpoint exists | `PATCH /worklogs/bulk-update` |

---

## 4. Root Cause Analysis

### 4.1 Architectural Gaps

| # | Root Cause | Technical Detail | Impact |
|---|-----------|------------------|--------|
| 1 | **No task identity across days** | Each `WorkItem` has a unique UUID (`id`). No `logical_task_id` or `parent_task_id` field exists in the model. | Same conceptual task on Day 1 and Day 2 are completely unrelated database records. Cannot aggregate hours or track lifecycle. |
| 2 | **No "Quick Update" UI path** | Frontend only offers: (a) full free-text submission with LLM extraction, (b) dashboard inline table editor. No middle ground. | User must choose between "re-type everything" or "hunt through a data table." No lightweight update flow. |
| 3 | **No "Active Tasks" view** | No API endpoint or UI that shows only the user's open tasks (in_progress, planned, blocked). | User must scroll through ALL historical items (potentially hundreds) to find what to update. |
| 4 | **Extraction prompt has no prior-task context** | The LLM receives only today's raw message. It has zero knowledge of the user's existing tasks. | Cannot auto-detect "this is a continuation of yesterday's CI/CD work." Every input treated as brand new. |
| 5 | **No hours accumulation model** | `hours_spent` is a single `FLOAT` field per WorkItem. No time entries table, no per-day breakdown. | Either overwrite hours (lose Day 1 data) or create duplicate items (lose logical connection). |
| 6 | **ChromaDB not updated on edits** | `PUT /worklogs/{item_id}` only writes to SQLite. ChromaDB index becomes stale. | Semantic search (used by RAG chat) returns outdated task data after manual edits. |
| 7 | **`superseded_by` field is dead code** | `WorkLog` model declares `superseded_by: FK → WorkLog` but no code ever populates it. | No audit trail when a user re-submits or replaces a work log. History is lost. |

### 4.2 Data Model Visualization

```
CURRENT STATE (no linkage):

Day 1: WorkLog_A → WorkItem_001 ("CI/CD pipeline fix", 2.5h, in_progress)
Day 2: WorkLog_B → WorkItem_002 ("CI/CD pipeline fix", 2h, done)
                    ↑ completely separate record, no link to 001

DESIRED STATE (linked):

Day 1: WorkLog_A → WorkItem_001 ("CI/CD pipeline fix", 2.5h, in_progress)
                                   logical_task_id = "abc-123"
Day 2: WorkLog_B → WorkItem_002 ("CI/CD pipeline fix", 2h, done)
                                   logical_task_id = "abc-123"  ← SAME
                                   continuation_of = "WorkItem_001"

Aggregation query: WHERE logical_task_id = "abc-123" → total 4.5h, final status: done
```

---

## 5. Current System Capabilities (What Works Today)

For completeness, here is what the system CAN do related to task lifecycle:

| Capability | How It Works | Limitation |
|-----------|-------------|-----------|
| **Submit new work log** | POST `/updates/submit` → LLM extraction → preview → confirm | Always creates new, unlinked items |
| **Edit a confirmed item** | PUT `/worklogs/{item_id}` — update description, hours, status, etc. | Must find item in dashboard table; no ChromaDB re-sync; no hours history |
| **Re-submit a work log** | PUT `/updates/{work_log_id}` — soft-deletes old, creates new extraction | Loses the old entry entirely (soft-deleted); `superseded_by` never set |
| **Delete a work log** | DELETE `/updates/{work_log_id}` — soft-delete + ChromaDB removal | Irreversible from user's perspective |
| **View own items** | GET `/worklogs/my?start_date=X&end_date=Y&status=Z` | No "only open tasks" convenience filter; no grouping by logical task |
| **Dashboard inline editing** | Streamlit `st.data_editor()` with save button | Clunky for quick status updates; requires finding the row first |

---

## 6. Proposed Solution

### 6.1 Data Model Changes

#### A. Add `logical_task_id` to WorkItem

```python
# backend/models/work_item.py
logical_task_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
continuation_of: Mapped[str | None] = mapped_column(String(36), ForeignKey("work_items.id"), nullable=True)
```

- **Purpose:** All instances of the "same work" share this UUID.
- **When set:** Automatically by LLM (with user confirmation) or manually by user in UI.
- **Aggregation:** `SELECT SUM(hours_spent) FROM work_items WHERE logical_task_id = ?` gives total effort.

#### B. Add `time_entries` Table (Optional — Richer Model)

```python
# backend/models/time_entry.py
class TimeEntry(Base):
    __tablename__ = "time_entries"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    work_item_id: Mapped[str] = mapped_column(ForeignKey("work_items.id"))
    work_date: Mapped[date]
    hours: Mapped[float]
    note: Mapped[str | None]
    created_at: Mapped[datetime]
```

- **Purpose:** Multiple time entries per work item without duplicating the task.
- **Benefit:** `hours_spent` on WorkItem becomes a computed sum; full daily breakdown preserved.
- **Trade-off:** More complex model; may be overkill for initial implementation.

#### C. Populate `superseded_by` on Re-submit

```python
# In PUT /updates/{work_log_id} handler:
old_log.superseded_by = new_log.id  # Actually set this!
```

---

### 6.2 New API Endpoints

#### A. `GET /worklogs/my/open` — Active Tasks

```
Response: List of WorkItems where status IN ('in_progress', 'planned', 'blocked')
          AND work_date within last 14 days
          AND is_deleted = false
Sorted by: work_date DESC, then priority DESC
```

**Purpose:** Powers the "Pick a task to continue" UI. Lightweight, fast.

#### B. `POST /worklogs/{item_id}/continue` — Continue Existing Task

```json
// Request
{
  "hours_today": 2.0,
  "status": "done",          // optional — update status
  "note": "Finished the implementation",  // optional
  "work_date": "2026-05-14"  // defaults to today
}

// Response: Updated WorkItemResponse (or new linked item)
```

**Behavior options (design decision needed):**
- **Option A — Mutate in place:** Update `hours_spent += hours_today`, update `status`. Simpler but loses per-day history.
- **Option B — Create linked entry:** Create new WorkItem with same `logical_task_id`, link via `continuation_of`. Preserves history but more complex.

#### C. `PATCH /worklogs/bulk-update` — Batch Update

```json
// Request
{
  "item_ids": ["uuid-1", "uuid-2", "uuid-3"],
  "status": "done",
  "hours_to_distribute": 6.0  // optional — split evenly or weighted
}
```

#### D. `GET /worklogs/my/grouped` — Tasks Grouped by Logical ID

```
Response: Grouped view where items sharing a logical_task_id are nested:
[
  {
    "logical_task_id": "abc-123",
    "project_name": "Patient Voice",
    "task_description": "CI/CD pipeline fix",
    "total_hours": 4.5,
    "current_status": "done",
    "entries": [
      { "work_date": "2026-05-10", "hours": 2.5, "status": "in_progress" },
      { "work_date": "2026-05-11", "hours": 2.0, "status": "done" }
    ]
  }
]
```

---

### 6.3 Frontend UX Changes

#### A. "Open Tasks" Panel on Submit Page

```
┌─────────────────────────────────────────────────────────┐
│  📋 Your Open Tasks (last 7 days)                       │
├─────────────────────────────────────────────────────────┤
│  ● CI/CD pipeline fix (Patient Voice)     2.5h  [▶][✓] │
│    in_progress since May 10                             │
│                                                         │
│  ● Prototype tool (InfographicAI)         —h    [▶][✓] │
│    in_progress since May 11                             │
│                                                         │
│  ● GenMI endpoints (GenMI)                —h    [⏸]    │
│    blocked — waiting on stakeholder context             │
│                                                         │
│  ● IT4You ticket for GenMI                —h    [▶][✓] │
│    planned since May 11                                 │
├─────────────────────────────────────────────────────────┤
│  [▶] = Add Hours   [✓] = Mark Done   [⏸] = Unblock    │
└─────────────────────────────────────────────────────────┘

── OR submit a new update below ──

┌─────────────────────────────────────────────────────────┐
│  Describe your work today...                            │
│  ┌───────────────────────────────────────────────────┐  │
│  │                                                   │  │
│  └───────────────────────────────────────────────────┘  │
│                               [Extract & Preview]       │
└─────────────────────────────────────────────────────────┘
```

**Quick-action modals:**

```
┌─────────────────────────────────────┐
│  Add Hours: CI/CD pipeline fix      │
├─────────────────────────────────────┤
│  Hours today:  [ 2.0        ]       │
│  Status:       [● Done (changed)]   │
│  Note:         [ Fixed and deployed]│
│                                     │
│         [Cancel]  [Save Update]     │
└─────────────────────────────────────┘
```

#### B. Dashboard Quick Actions

Each row in the dashboard table gets action icons:

```
| Date  | Task                    | Hours | Status      | Actions       |
|-------|-------------------------|-------|-------------|---------------|
| 05/11 | CI/CD pipeline fix      | 2.5h  | in_progress | [▶] [✓] [✎] |
| 05/11 | Quick Start Guide video | 2.0h  | in_progress | [▶] [✓] [✎] |
| 05/11 | GenMI endpoints         | —     | blocked     | [⏸] [✎]     |
```

- `[▶]` Continue — Opens "Add Hours" modal
- `[✓]` Done — One-click mark complete (prompts for hours if null)
- `[⏸]` Unblock — Clears blocker, sets in_progress
- `[✎]` Edit — Full inline edit (existing behavior)

#### C. Task Timeline View (New Page/Tab)

A dedicated view showing task lifecycle across days:

```
CI/CD pipeline fix (Patient Voice)
├── May 10: 2.5h — in_progress
├── May 11: 2.0h — done ✓
└── Total: 4.5h across 2 days

InfographicAI prototype
├── May 11: 3.5h — in_progress
├── May 12: 4.0h — in_progress
├── May 13: 2.0h — in_progress
└── Total: 9.5h across 3 days (ongoing)
```

---

### 6.4 LLM Extraction Enhancement

#### Current Prompt (No Context)

The LLM sees only:
```
User: "Continued CI/CD work, 2 more hours, done now"
```

It has no idea this relates to an existing task.

#### Enhanced Prompt (With Active Task Context)

```python
CONTEXT_ADDENDUM = """
## Active Tasks Context
The user has these open tasks from recent days:
{active_tasks_json}

If the user's update clearly refers to one of these existing tasks (same project, 
same ticket_id, or very similar description), set:
  "continuation_of": "<work_item_id>"
  "is_continuation": true
Otherwise set:
  "continuation_of": null
  "is_continuation": false

When a task is a continuation:
- Inherit project_name, ticket_id, and tags from the original task
- Only extract NEW hours (not cumulative total)
- Status should reflect the CURRENT state (may differ from original)
"""
```

#### Example LLM Input/Output

**Input (with context):**
```
Active tasks:
- id: "abc-001", task: "CI/CD pipeline fix", project: "Patient Voice", status: "in_progress", hours: 2.5

User message: "Finished the CI/CD pipeline work today, 2 more hours"
```

**Output:**
```json
{
  "items": [{
    "task_description": "CI/CD pipeline fix — completed implementation and testing",
    "continuation_of": "abc-001",
    "is_continuation": true,
    "project_name": "Patient Voice",
    "hours_spent": 2.0,
    "status": "done"
  }]
}
```

---

### 6.5 ChromaDB Sync Fix

```python
# In PUT /worklogs/{item_id} handler (backend/routers/worklogs.py):
# AFTER SQLite commit:
chroma_service.upsert_work_items([updated_item], current_user.id)
```

This ensures semantic search always returns current data after manual edits.

---

## 7. Implementation Roadmap

### Phase A — Foundation (P0, ~2-3 days)

| Task | File(s) | Effort |
|------|---------|--------|
| Add `logical_task_id` + `continuation_of` columns | `backend/models/work_item.py` | Small |
| Alembic migration for new columns | `migrations/` | Small |
| `GET /worklogs/my/open` endpoint | `backend/routers/worklogs.py` | Small |
| `POST /worklogs/{item_id}/continue` endpoint | `backend/routers/worklogs.py` | Medium |
| Fix ChromaDB re-index on PUT | `backend/routers/worklogs.py`, `chroma_service.py` | Small |
| Unit tests for new endpoints | `tests/backend/` | Medium |

### Phase B — Frontend Quick Actions (P1, ~3-4 days)

| Task | File(s) | Effort |
|------|---------|--------|
| "Open Tasks" panel on Submit page | `frontend/pages/submit.py` | Medium |
| Quick-action modals (Add Hours, Mark Done, Unblock) | `frontend/pages/submit.py` | Medium |
| Dashboard action buttons per row | `frontend/pages/dashboard.py` | Medium |
| Integration with `POST /continue` endpoint | Frontend API layer | Small |

### Phase C — Smart Extraction (P2, ~2-3 days)

| Task | File(s) | Effort |
|------|---------|--------|
| Fetch user's open tasks before extraction | `backend/services/extraction_service.py` | Small |
| Add active task context to extraction prompt | `backend/prompts/extraction_prompt.py` | Medium |
| Add `continuation_of` to extraction schema | `backend/schemas/extraction.py` | Small |
| UI: Show "Continuing task X" in preview with confirm/reject | `frontend/pages/submit.py` | Medium |
| Tests for continuation detection | `tests/backend/` | Medium |

### Phase D — Advanced Features (P3, ~3-5 days)

| Task | File(s) | Effort |
|------|---------|--------|
| `PATCH /worklogs/bulk-update` endpoint | `backend/routers/worklogs.py` | Medium |
| Bulk selection UI on dashboard | `frontend/pages/dashboard.py` | Medium |
| Task Timeline view (grouped by logical_task_id) | `frontend/pages/timeline.py` (new) | Large |
| `time_entries` table (optional) | `backend/models/time_entry.py` | Medium |
| Populate `superseded_by` on re-submit | `backend/routers/updates.py` | Small |
| Seed data with multi-day task continuations | `backend/seed_data.py` | Medium |

---

## 8. Design Decisions Needed

| Decision | Options | Recommendation |
|----------|---------|----------------|
| **Continue behavior** | (A) Mutate existing item in-place, (B) Create linked new item | **Option B** — preserves per-day history, enables timeline view |
| **Hours model** | (A) Single float with accumulation, (B) Separate time_entries table | **Option A first** — simpler; upgrade to B later if needed |
| **Auto-linking** | (A) LLM auto-detects + user confirms, (B) User must manually link | **Option A** — reduces friction; user can always reject |
| **Open tasks window** | (A) Last 7 days, (B) Last 14 days, (C) All non-done items | **Option B** — balances relevance vs completeness |
| **Scope of quick actions** | (A) Submit page only, (B) Dashboard only, (C) Both | **Option C** — maximum accessibility |

---

## 9. Impact Assessment

### User Experience Improvement

| Scenario | Current Clicks/Time | After Implementation |
|----------|--------------------|--------------------|
| Continue a task | 8-10 clicks + typing (navigate dashboard → find → edit) | 2-3 clicks (see open task → Add Hours → Save) |
| Mark task done | 6-8 clicks (navigate → find → change dropdown → save) | 1-2 clicks (click ✓ → confirm hours) |
| Unblock a task | 6-8 clicks (navigate → find → clear blocker → change status) | 1-2 clicks (click ⏸ → confirm) |
| Bulk update | 15-20+ clicks (repeat per item) | 5-6 clicks (multi-select → batch action) |
| Daily continuation entry | Full re-type (30-60 seconds + LLM extraction wait) | 5-10 seconds (pick task → add hours) |

### Data Quality Improvement

- **Before:** Duplicate entries for same work; stale "in_progress" items never closed; no cross-day aggregation possible.
- **After:** Linked task history; accurate status tracking; meaningful "total effort per task" metrics; clean data for reporting.

---

## 10. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| LLM incorrectly auto-links unrelated tasks | Medium — wrong hours attributed | User confirmation step before linking; confidence threshold |
| Migration breaks existing data | High — data loss | `logical_task_id` is nullable; no existing data changes; purely additive |
| UI complexity increases | Medium — confusing for new users | "Open Tasks" panel is collapsible; progressive disclosure |
| Performance with large open task lists | Low — slow queries | Index on `(user_id, status, work_date)`; limit to 14 days |
| ChromaDB sync issues during transition | Low — stale search | Full reindex after migration; sync on every write path |

---

## 11. Success Metrics

| Metric | Target |
|--------|--------|
| Reduction in duplicate task entries per user | >60% decrease |
| "Stale in_progress" items (never updated after creation) | <10% of items |
| Average time to update an existing task | <15 seconds (from 45-60s) |
| User adoption of Quick Actions (vs full re-submission) | >40% of updates |
| Cross-day task linking accuracy (LLM auto-detection) | >85% precision |

---

## 12. References

### Key Source Files

| File | Purpose |
|------|---------|
| `backend/models/work_item.py` | WorkItem ORM model — needs `logical_task_id` |
| `backend/models/work_log.py` | WorkLog ORM model — has unused `superseded_by` |
| `backend/schemas/work_item.py` | API I/O schemas — needs continuation fields |
| `backend/schemas/extraction.py` | LLM extraction output schema |
| `backend/routers/updates.py` | Submit/confirm/resubmit/delete endpoints |
| `backend/routers/worklogs.py` | Work item CRUD — needs new endpoints |
| `backend/services/extraction_service.py` | LLM chain — needs active task context |
| `backend/services/chroma_service.py` | ChromaDB — needs sync-on-edit fix |
| `backend/prompts/extraction_prompt.py` | LLM prompt — needs continuation rules |
| `frontend/pages/` (submit page) | Submission UI — needs Open Tasks panel |
| `frontend/pages/` (dashboard page) | Dashboard — needs quick-action buttons |

### Related Design Docs

- `Plans/consolidated_plan.md` — Original project design specification
- `docs/BACKEND.md` — Backend architecture documentation
- `docs/FRONTEND.md` — Frontend architecture documentation
