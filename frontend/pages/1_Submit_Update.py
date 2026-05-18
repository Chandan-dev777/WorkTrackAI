"""Submit Update page — Phase 2 + Task Continuation (Phase A-B)."""

import os
from datetime import date

import httpx
import pandas as pd
import streamlit as st

st.set_page_config(page_title="Submit Update", page_icon="📝", layout="wide")

if not st.session_state.get("token"):
    st.switch_page("app.py")

API_BASE = os.getenv("API_BASE_URL", "http://localhost:8000")


def _auth_headers():
    return {"Authorization": f"Bearer {st.session_state['token']}"}


def _api(method, path, timeout: float = 120.0, **kwargs):
    return httpx.request(
        method, f"{API_BASE}{path}",
        headers=_auth_headers(),
        timeout=timeout,
        **kwargs,
    )


def _fetch_open_tasks() -> list[dict]:
    resp = _api("GET", "/worklogs/my/open?days_back=14")
    if resp.status_code == 200:
        return resp.json()
    return []


def _status_emoji(s: str) -> str:
    return {"in_progress": "🔄", "planned": "📋", "blocked": "🚫"}.get(s, "❓")


def _status_label(s: str) -> str:
    return {"in_progress": "In Progress", "planned": "Planned", "blocked": "Blocked"}.get(s, s)


# ── Page header ───────────────────────────────────────────────────────────────
user = st.session_state.get("user", {})
st.title("📝 Submit Work Update")
st.caption(f"Logged in as **{user.get('full_name')}** ({user.get('employee_id')})")

# ── Sidebar navigation ────────────────────────────────────────────────────────
with st.sidebar:
    if st.button("🏠 My Dashboard"):
        st.switch_page("pages/2_My_Dashboard.py")
    if st.button("🚪 Logout"):
        st.session_state.clear()
        st.switch_page("app.py")

# ── Open Tasks Panel (shown only on Step 1) ───────────────────────────────────
if "preview" not in st.session_state:

    open_tasks = _fetch_open_tasks()

    if open_tasks:
        with st.expander(
            f"📋 Your Open Tasks ({len(open_tasks)}) — click an action to update without re-typing",
            expanded=True,
        ):
            for task in open_tasks:
                tid = task["id"]
                desc = task["task_description"]
                proj = task.get("project_name") or ""
                hours = task.get("hours_spent")
                st_val = task.get("status", "")
                work_dt = task.get("work_date", "")

                col_info, col_add, col_done, col_unblock = st.columns([4, 1.2, 1.2, 1.2])

                with col_info:
                    hrs_txt = f"{hours}h" if hours else "—h"
                    proj_txt = f" · {proj}" if proj else ""
                    st.markdown(
                        f"{_status_emoji(st_val)} **{desc[:80]}{'…' if len(desc) > 80 else ''}**  \n"
                        f"<small>{_status_label(st_val)}{proj_txt} · {hrs_txt} · since {work_dt}</small>",
                        unsafe_allow_html=True,
                    )

                with col_add:
                    if st.button("➕ Add Hours", key=f"add_{tid}"):
                        st.session_state["quick_action"] = {"type": "add_hours", "task": task}
                        st.rerun()

                with col_done:
                    if st_val != "blocked":
                        if st.button("✅ Mark Done", key=f"done_{tid}"):
                            st.session_state["quick_action"] = {"type": "mark_done", "task": task}
                            st.rerun()

                with col_unblock:
                    if st_val == "blocked":
                        if st.button("🔓 Unblock", key=f"unblock_{tid}"):
                            st.session_state["quick_action"] = {"type": "unblock", "task": task}
                            st.rerun()

                st.divider()

    # ── Quick Action Modal ─────────────────────────────────────────────────────
    if "quick_action" in st.session_state:
        action = st.session_state["quick_action"]
        task = action["task"]
        atype = action["type"]

        titles = {
            "add_hours": f"➕ Add Hours to: {task['task_description'][:60]}",
            "mark_done": f"✅ Mark Done: {task['task_description'][:60]}",
            "unblock": f"🔓 Unblock: {task['task_description'][:60]}",
        }

        with st.container(border=True):
            st.subheader(titles.get(atype, "Quick Update"))

            col_h, col_s, col_n = st.columns([1.5, 1.5, 3])
            with col_h:
                hours_today = st.number_input(
                    "Hours today", min_value=0.0, step=0.5, value=1.0, key="qa_hours"
                )
            with col_s:
                default_status = {
                    "add_hours": task.get("status") or "in_progress",
                    "mark_done": "done",
                    "unblock": "in_progress",
                }[atype]
                status_options = ["in_progress", "planned", "blocked", "done"]
                new_status = st.selectbox(
                    "Status",
                    status_options,
                    index=status_options.index(default_status),
                    key="qa_status",
                )
            with col_n:
                note = st.text_input("Note (optional)", key="qa_note", placeholder="e.g. Deployed to staging")

            c1, c2 = st.columns(2)
            with c1:
                if st.button("💾 Save Update", type="primary", use_container_width=True):
                    payload = {
                        "hours_today": hours_today if hours_today > 0 else None,
                        "status": new_status,
                        "note": note or None,
                        "work_date": date.today().isoformat(),
                    }
                    resp = _api("POST", f"/worklogs/{task['id']}/continue", json=payload)
                    if resp.status_code == 200:
                        st.success(f"Task updated — {new_status}, {hours_today}h logged today.")
                        del st.session_state["quick_action"]
                        st.rerun()
                    else:
                        st.error(f"Update failed: {resp.text}")
            with c2:
                if st.button("✖ Cancel", use_container_width=True):
                    del st.session_state["quick_action"]
                    st.rerun()

    st.markdown("---")

# ── Step 1: Input form ────────────────────────────────────────────────────────
if "preview" not in st.session_state:
    st.subheader("Or describe new work below")

    with st.form("submit_form"):
        raw_message = st.text_area(
            "Work update",
            height=150,
            placeholder=(
                "e.g. Fixed login bug (INC-231) — 2h, done. "
                "Attended sprint planning — 1h. "
                "Reviewed PR for data pipeline — 1.5h, in progress."
            ),
        )
        work_date = st.date_input("Work date", value=date.today())
        submitted = st.form_submit_button("🔍 Extract & Preview", use_container_width=True)

    if submitted:
        if not raw_message.strip():
            st.error("Please enter your work update.")
        else:
            with st.spinner("Analysing your update with AI..."):
                resp = _api("POST", "/updates/submit", json={
                    "raw_message": raw_message.strip(),
                    "work_date": work_date.isoformat(),
                })

            if resp.status_code == 200:
                st.session_state["preview"] = resp.json()
                st.session_state["raw_message"] = raw_message
                st.rerun()
            elif resp.status_code == 422:
                st.error(
                    "The AI could not parse your update. "
                    "Try adding more detail (task, time, status) and resubmit."
                )
            else:
                st.error(f"Submission failed: {resp.text}")

# ── Step 2: Preview + clarification + confirm ─────────────────────────────────
else:
    preview = st.session_state["preview"]
    items = preview["items"]

    st.subheader("Step 2 — Review Extracted Items")
    st.caption(
        f"Work date: **{preview['work_date']}** · "
        f"Extraction status: **{preview['extraction_status']}** · "
        f"{len(items)} item(s) extracted"
    )

    # Continuation detection banner
    continuations = [i for i in items if i.get("is_continuation") and i.get("continuation_of")]
    if continuations:
        st.info(
            f"🔗 **{len(continuations)} item(s) detected as continuations of previous tasks.** "
            "Review the links below — uncheck any that don't look right before confirming.",
            icon="ℹ️",
        )
        for i, item in enumerate(items):
            if item.get("is_continuation"):
                col_a, col_b = st.columns([5, 1])
                with col_a:
                    st.caption(
                        f"↩ *\"{item['task_description'][:70]}\"* continues a previous task"
                    )
                with col_b:
                    if not st.checkbox("Keep link", value=True, key=f"keep_link_{i}"):
                        items[i]["continuation_of"] = None
                        items[i]["is_continuation"] = False

    # Fallback mode
    if preview.get("extraction_status") == "needs_review" and preview.get("has_clarification_needed"):
        st.warning(
            "**AI extraction is currently unavailable.** "
            "Your message has been saved — please select the correct category, "
            "hours, and status below, then click Confirm & Save.",
            icon="⚠️",
        )

    if preview.get("total_hours_warning"):
        st.warning("Total logged hours exceed 12 — please check the hours below.")

    # ── Clarification prompts ─────────────────────────────────────────────────
    if preview.get("has_clarification_needed"):
        st.info(
            "Some items need clarification. "
            "Please fill in the highlighted fields before confirming."
        )
        for i, item in enumerate(items):
            if item.get("clarification_needed"):
                with st.expander(
                    f"⚠️ Clarification needed: {item['task_description'][:60]}...",
                    expanded=True,
                ):
                    st.caption(f"Reason: {item.get('clarification_reason', 'Unknown')}")
                    col1, col2 = st.columns(2)
                    with col1:
                        items[i]["hours_spent"] = st.number_input(
                            "Hours spent",
                            min_value=0.0,
                            step=0.5,
                            value=float(item.get("hours_spent") or 0.0),
                            key=f"hours_{i}",
                        )
                    with col2:
                        items[i]["status"] = st.selectbox(
                            "Status",
                            ["planned", "in_progress", "blocked", "done"],
                            index=1,
                            key=f"status_{i}",
                        )
                    items[i]["clarification_needed"] = False

    # ── Editable preview table ────────────────────────────────────────────────
    st.subheader("Extracted Work Items")

    display_cols = [
        "task_description", "work_category", "hours_spent",
        "status", "priority", "ticket_id", "project_name",
        "confidence_score", "clarification_needed",
    ]
    df = pd.DataFrame(items)[display_cols].rename(columns={
        "task_description": "Task",
        "work_category": "Category",
        "hours_spent": "Hours",
        "status": "Status",
        "priority": "Priority",
        "ticket_id": "Ticket",
        "project_name": "Project",
        "confidence_score": "Confidence",
        "clarification_needed": "Needs Clarification",
    })

    edited_df = st.data_editor(
        df,
        use_container_width=True,
        num_rows="dynamic",
        column_config={
            "Category": st.column_config.SelectboxColumn(
                options=[
                    "project", "ticket", "polaris_classification", "admin",
                    "meeting", "learning", "support", "documentation", "review", "other",
                ]
            ),
            "Status": st.column_config.SelectboxColumn(
                options=["planned", "in_progress", "blocked", "done"]
            ),
            "Priority": st.column_config.SelectboxColumn(
                options=["low", "medium", "high"]
            ),
            "Hours": st.column_config.NumberColumn(min_value=0.0, step=0.5),
            "Confidence": st.column_config.ProgressColumn(min_value=0.0, max_value=1.0),
        },
    )

    col_confirm, col_back = st.columns([1, 1])

    with col_back:
        if st.button("← Edit Message", use_container_width=True):
            del st.session_state["preview"]
            st.rerun()

    with col_confirm:
        if st.button("✅ Confirm & Save", type="primary", use_container_width=True):
            # Merge edits back into items
            for i, row in edited_df.iterrows():
                if i < len(items):
                    items[i]["task_description"] = row["Task"]
                    items[i]["work_category"] = row["Category"]
                    items[i]["hours_spent"] = row["Hours"] if row["Hours"] else None
                    items[i]["status"] = row["Status"] if row["Status"] else None
                    items[i]["priority"] = row["Priority"] if row["Priority"] else None
                    items[i]["ticket_id"] = row["Ticket"] if row["Ticket"] else None
                    items[i]["project_name"] = row["Project"] if row["Project"] else None

            with st.spinner("Saving..."):
                resp = _api(
                    "PUT",
                    f"/updates/{preview['work_log_id']}/confirm",
                    json={"items": items, "work_date": preview["work_date"]},
                )

            if resp.status_code == 200:
                st.success("Work log saved successfully!")
                del st.session_state["preview"]
                if "raw_message" in st.session_state:
                    del st.session_state["raw_message"]
                st.balloons()
                st.page_link("pages/2_My_Dashboard.py", label="View in My Dashboard →")
            else:
                st.error(f"Save failed: {resp.text}")
