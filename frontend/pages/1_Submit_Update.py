"""Submit Update page — Phase 2."""

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

# ── Step 1: Input form ────────────────────────────────────────────────────────
if "preview" not in st.session_state:
    st.subheader("What did you work on today?")

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

    # Fallback mode — LLM was unavailable, user fills in fields manually
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
