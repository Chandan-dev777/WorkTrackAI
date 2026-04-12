"""Admin Panel — admin-only system management page."""

import os

import httpx
import pandas as pd
import streamlit as st

st.set_page_config(page_title="Admin Panel", page_icon="🔧", layout="wide")

if not st.session_state.get("token"):
    st.switch_page("app.py")

user = st.session_state.get("user", {})
if user.get("role") != "admin":
    st.error("Access denied — admins only.")
    st.stop()

API_BASE = os.getenv("API_BASE_URL", "http://localhost:8000")


def _auth_headers():
    return {"Authorization": f"Bearer {st.session_state['token']}"}


def _api(method, path, timeout: float = 30.0, **kwargs):
    return httpx.request(
        method, f"{API_BASE}{path}",
        headers=_auth_headers(),
        timeout=timeout,
        **kwargs,
    )


# ── Page header ───────────────────────────────────────────────────────────────
st.title("🔧 Admin Panel")
st.caption(f"Logged in as **{user.get('full_name')}** ({user.get('employee_id')})")

# ── Sidebar ───────────────────────────────────────────────────────────────────
with st.sidebar:
    if st.button("📝 Submit Update"):
        st.switch_page("pages/1_Submit_Update.py")
    if st.button("📊 My Dashboard"):
        st.switch_page("pages/2_My_Dashboard.py")
    if st.button("👥 Team Dashboard"):
        st.switch_page("pages/3_Team_Dashboard.py")
    if st.button("🚪 Logout"):
        st.session_state.clear()
        st.switch_page("app.py")

# ── Tabs ──────────────────────────────────────────────────────────────────────
tab_users, tab_system, tab_errors = st.tabs([
    "👤 User Management",
    "⚙️ System Actions",
    "⚠️ Extraction Errors",
])


# ═══════════════════════════════════════════════════════════════════════════════
# TAB 1 — USER MANAGEMENT
# ═══════════════════════════════════════════════════════════════════════════════

with tab_users:
    st.subheader("User Management")
    st.caption("Change roles, activate/deactivate accounts, and update team assignments.")

    if st.button("🔄 Refresh Users", key="refresh_users"):
        st.rerun()

    r_users = _api("GET", "/admin/users")
    if r_users.status_code != 200:
        st.error(f"Failed to load users: {r_users.text}")
        st.stop()

    users_data = r_users.json()

    if not users_data:
        st.info("No users found.")
    else:
        df_users = pd.DataFrame(users_data)
        current_admin_id = None
        # Identify self by employee_id so we can lock that row
        current_emp_id = user.get("employee_id")

        # Display summary metrics
        m1, m2, m3, m4 = st.columns(4)
        m1.metric("Total Users", len(df_users))
        m2.metric("Active", int((df_users["is_active"] == True).sum()))  # noqa: E712
        m3.metric("Admins", int((df_users["role"] == "admin").sum()))
        m4.metric("Inactive", int((df_users["is_active"] == False).sum()))  # noqa: E712

        st.divider()

        # ── Per-user edit cards ───────────────────────────────────────────────
        st.markdown("#### Edit Users")
        st.info("Use the controls below to change roles or account status. Changes apply immediately.")

        # Group by role for clarity
        for section_role, section_label in [("admin", "Admins"), ("manager", "Managers"), ("employee", "Employees")]:
            section_users = [u for u in users_data if u["role"] == section_role]
            if not section_users:
                continue

            with st.expander(f"**{section_label}** ({len(section_users)})", expanded=(section_role == "employee")):
                for u in section_users:
                    is_self = u["employee_id"] == current_emp_id
                    cols = st.columns([2, 1, 1, 1, 1])

                    with cols[0]:
                        status_icon = "✅" if u["is_active"] else "🚫"
                        st.markdown(
                            f"{status_icon} **{u['full_name']}**  \n"
                            f"<small>{u['employee_id']} · {u['email']}</small>  \n"
                            f"<small>Team: {u['team_name'] or '—'} | Dept: {u['department'] or '—'}</small>",
                            unsafe_allow_html=True,
                        )

                    with cols[1]:
                        new_role = st.selectbox(
                            "Role",
                            ["employee", "manager", "admin"],
                            index=["employee", "manager", "admin"].index(u["role"]),
                            key=f"role_{u['id']}",
                            disabled=is_self,
                            help="Cannot change your own role" if is_self else None,
                        )

                    with cols[2]:
                        new_team = st.text_input(
                            "Team",
                            value=u["team_name"] or "",
                            key=f"team_{u['id']}",
                        )

                    with cols[3]:
                        new_active = st.checkbox(
                            "Active",
                            value=u["is_active"],
                            key=f"active_{u['id']}",
                            disabled=is_self,
                            help="Cannot deactivate your own account" if is_self else None,
                        )

                    with cols[4]:
                        if not is_self:
                            if st.button("💾 Save", key=f"save_{u['id']}"):
                                payload: dict = {}
                                if new_role != u["role"]:
                                    payload["role"] = new_role
                                if new_active != u["is_active"]:
                                    payload["is_active"] = new_active
                                if (new_team.strip() or None) != u["team_name"]:
                                    payload["team_name"] = new_team.strip()

                                if payload:
                                    resp = _api("PUT", f"/admin/users/{u['id']}", json=payload)
                                    if resp.status_code == 200:
                                        st.success(f"Updated {u['full_name']}")
                                        st.rerun()
                                    else:
                                        st.error(f"Error: {resp.json().get('detail', resp.text)}")
                                else:
                                    st.info("No changes to save.")
                        else:
                            st.caption("_(you)_")

                    st.divider()


# ═══════════════════════════════════════════════════════════════════════════════
# TAB 2 — SYSTEM ACTIONS
# ═══════════════════════════════════════════════════════════════════════════════

with tab_system:
    st.subheader("System Actions")

    # ── Seed Dummy Data ───────────────────────────────────────────────────────
    with st.container(border=True):
        st.markdown("#### 🌱 Seed Dummy Data")
        st.caption(
            "Populates the database with 16 sample users (1 admin + 3 managers + 12 employees) "
            "and 30 days of realistic work logs. Safe to run on an empty database — "
            "skips automatically if users already exist."
        )
        if st.button("Run Seed", type="primary", key="btn_seed"):
            with st.spinner("Seeding..."):
                resp = _api("POST", "/admin/seed-dummy-data")
            if resp.status_code == 200:
                st.success(resp.json().get("message", "Done."))
            else:
                st.error(f"Failed: {resp.text}")

    st.divider()

    # ── Reindex ChromaDB ──────────────────────────────────────────────────────
    with st.container(border=True):
        st.markdown("#### 🔍 Rebuild ChromaDB Index")
        st.caption(
            "Drops and rebuilds the entire ChromaDB vector index from SQLite. "
            "Use this if vector search results seem stale or out of sync. "
            "The operation may take a minute for large datasets."
        )
        if st.button("Reindex Now", key="btn_reindex"):
            with st.spinner("Rebuilding ChromaDB index..."):
                resp = _api("POST", "/admin/reindex", timeout=120.0)
            if resp.status_code == 200:
                data = resp.json()
                st.success(data.get("message", f"Indexed {data.get('indexed', '?')} items."))
            else:
                st.error(f"Reindex failed: {resp.text}")


# ═══════════════════════════════════════════════════════════════════════════════
# TAB 3 — EXTRACTION ERRORS
# ═══════════════════════════════════════════════════════════════════════════════

with tab_errors:
    st.subheader("Extraction Error Queue")
    st.caption(
        "Work log submissions that failed LLM extraction or were flagged for review. "
        "These entries may have incomplete or missing work items."
    )

    if st.button("🔄 Refresh", key="refresh_errors"):
        st.rerun()

    r_errors = _api("GET", "/admin/extraction-errors")
    if r_errors.status_code != 200:
        st.error(f"Failed to load errors: {r_errors.text}")
    else:
        errors_data = r_errors.json()
        if not errors_data:
            st.success("No extraction errors — all submissions processed cleanly.")
        else:
            df_errors = pd.DataFrame(errors_data)

            # Summary counts
            e1, e2 = st.columns(2)
            failed_count = int((df_errors["extraction_status"] == "failed").sum())
            review_count = int((df_errors["extraction_status"] == "needs_review").sum())
            e1.metric("Failed", failed_count, delta=None)
            e2.metric("Needs Review", review_count, delta=None)

            st.divider()

            # Filter by status
            status_filter = st.radio(
                "Filter by status",
                ["All", "failed", "needs_review"],
                horizontal=True,
                key="error_filter",
            )
            df_filtered = df_errors if status_filter == "All" else df_errors[df_errors["extraction_status"] == status_filter]

            # Display table
            display_cols = ["work_date", "employee_id", "extraction_status", "model_name", "submitted_at"]
            display_cols = [c for c in display_cols if c in df_filtered.columns]

            st.dataframe(
                df_filtered[display_cols].rename(columns={
                    "work_date": "Date",
                    "employee_id": "Employee",
                    "extraction_status": "Status",
                    "model_name": "Model",
                    "submitted_at": "Submitted",
                }),
                use_container_width=True,
            )

            # Raw message viewer
            st.divider()
            st.markdown("#### Raw Message Inspector")
            st.caption("Select a row index to view the original submission text.")

            if len(df_filtered) > 0:
                row_idx = st.number_input(
                    "Row index",
                    min_value=0,
                    max_value=len(df_filtered) - 1,
                    value=0,
                    step=1,
                    key="error_row_idx",
                )
                selected = df_filtered.iloc[int(row_idx)]
                st.markdown(f"**Employee:** {selected.get('employee_id', '—')}  "
                            f"**Date:** {selected.get('work_date', '—')}  "
                            f"**Status:** `{selected.get('extraction_status', '—')}`")
                st.text_area(
                    "Raw submission",
                    value=selected.get("raw_message", ""),
                    height=150,
                    disabled=True,
                    key="raw_msg_viewer",
                )
