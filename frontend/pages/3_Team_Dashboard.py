"""Team Dashboard page — Phase 5 (manager/admin only)."""

import os
from datetime import date, timedelta

import httpx
import pandas as pd
import plotly.express as px
import streamlit as st

st.set_page_config(page_title="Team Dashboard", page_icon="👥", layout="wide")

if not st.session_state.get("token"):
    st.switch_page("app.py")

user = st.session_state.get("user", {})
if user.get("role") not in ("manager", "admin"):
    st.error("Access denied — managers and admins only.")
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
st.title("👥 Team Dashboard")
st.caption(f"Logged in as **{user.get('full_name')}** ({user.get('role')})")

# ── Sidebar ───────────────────────────────────────────────────────────────────
with st.sidebar:
    if st.button("📝 Submit Update"):
        st.switch_page("pages/1_Submit_Update.py")
    if st.button("📊 My Dashboard"):
        st.switch_page("pages/2_My_Dashboard.py")
    if st.button("🚪 Logout"):
        st.session_state.clear()
        st.switch_page("app.py")

    st.divider()
    st.subheader("Date Range")
    today = date.today()
    week_start = today - timedelta(days=today.weekday())

    preset = st.radio(
        "Quick select",
        ["This Week", "Last 7 Days", "Last 30 Days", "Custom"],
        index=2,
    )
    if preset == "This Week":
        start_date, end_date = week_start, today
    elif preset == "Last 7 Days":
        start_date, end_date = today - timedelta(days=6), today
    elif preset == "Last 30 Days":
        start_date, end_date = today - timedelta(days=29), today
    else:
        start_date = st.date_input("From", value=week_start)
        end_date = st.date_input("To", value=today)

    st.divider()
    st.subheader("Team Filter")
    user_team = user.get("team_name")
    if user.get("role") == "admin":
        team_filter = st.text_input("Team name (leave blank for all)", value="")
    else:
        team_filter = st.text_input("Team name", value=user_team or "")
    team_param = team_filter.strip() or None

# ── Fetch team data ───────────────────────────────────────────────────────────
params = {
    "start_date": start_date.isoformat(),
    "end_date": end_date.isoformat(),
}
if team_param:
    params["team_name"] = team_param

with st.spinner("Loading team data..."):
    r_team_summary = _api("GET", "/dashboard/team/summary", params=params)
    r_team_cats = _api("GET", "/dashboard/team/categories", params=params)
    r_team_items = _api("GET", "/worklogs/team", params={**params, "limit": 500})

if any(r.status_code != 200 for r in [r_team_summary, r_team_cats, r_team_items]):
    st.error("Failed to load team data. Is the backend running?")
    st.stop()

team_summary_data = r_team_summary.json()
team_cats_data = r_team_cats.json()
team_items_data = r_team_items.json()

# ── Date range header ─────────────────────────────────────────────────────────
team_label = f" — {team_param}" if team_param else ""
st.subheader(f"📅 {start_date.strftime('%d %b')} — {end_date.strftime('%d %b %Y')}{team_label}")

# ── Team KPI cards ────────────────────────────────────────────────────────────
if team_summary_data:
    df_summary = pd.DataFrame(team_summary_data)
    total_hours = df_summary["total_hours"].sum()
    total_done = df_summary["done_count"].sum()
    total_blocked = df_summary["blocked_count"].sum()
    active_members = int((df_summary["total_hours"] > 0).sum())

    kpi1, kpi2, kpi3, kpi4 = st.columns(4)
    kpi1.metric("⏱ Total Hours", f"{total_hours:.1f}h")
    kpi2.metric("✅ Done Tasks", int(total_done))
    kpi3.metric("🚫 Blocked Tasks", int(total_blocked))
    kpi4.metric("👤 Active Members", active_members)
else:
    st.info("No team data found for the selected period.")

st.divider()

# ── Employee selector ─────────────────────────────────────────────────────────
name_map: dict[str, str] = {}
if team_summary_data:
    name_map = {r["employee_id"]: r["full_name"] for r in team_summary_data}

all_employee_options = ["All Employees"] + sorted(name_map.values())
selected_employee = st.selectbox("Filter charts and tables by employee", all_employee_options)
selected_employee_id = None
if selected_employee != "All Employees":
    for eid, fname in name_map.items():
        if fname == selected_employee:
            selected_employee_id = eid
            break

# ── Charts row ────────────────────────────────────────────────────────────────
chart_col1, chart_col2 = st.columns([3, 2])

with chart_col1:
    st.subheader("Hours by Employee per Day")
    if team_items_data:
        df_items = pd.DataFrame(team_items_data)
        if selected_employee_id:
            df_items = df_items[df_items["employee_id"] == selected_employee_id]

        if not df_items.empty and "work_date" in df_items.columns:
            df_items["work_date"] = pd.to_datetime(df_items["work_date"])
            df_items["hours_spent"] = pd.to_numeric(df_items["hours_spent"], errors="coerce").fillna(0)
            df_pivot = (
                df_items.groupby(["work_date", "employee_id"])["hours_spent"]
                .sum()
                .reset_index()
            )
            df_pivot["employee"] = df_pivot["employee_id"].map(name_map).fillna(df_pivot["employee_id"])
            fig_stacked = px.bar(
                df_pivot,
                x="work_date",
                y="hours_spent",
                color="employee",
                barmode="stack",
                labels={"hours_spent": "Hours", "work_date": "Date", "employee": "Employee"},
            )
            fig_stacked.update_layout(
                margin=dict(t=20, b=20),
                legend=dict(orientation="h", yanchor="bottom", y=1.02),
            )
            st.plotly_chart(fig_stacked, use_container_width=True)
        else:
            st.info("No hours data for the selected period.")
    else:
        st.info("No team items found.")

with chart_col2:
    st.subheader("Hours by Category")
    if team_cats_data:
        df_cats = pd.DataFrame(team_cats_data)
        fig_cats = px.bar(
            df_cats,
            x="hours",
            y="category",
            orientation="h",
            color="category",
            text="hours",
            labels={"hours": "Hours", "category": "Category"},
        )
        fig_cats.update_traces(texttemplate="%{text:.1f}h", textposition="outside")
        fig_cats.update_layout(showlegend=False, margin=dict(t=20, b=20))
        st.plotly_chart(fig_cats, use_container_width=True)
    else:
        st.info("No category data.")

st.divider()

# ── Per-employee summary cards ────────────────────────────────────────────────
if team_summary_data:
    st.subheader("Employee Summary")
    df_members = pd.DataFrame(team_summary_data)
    if selected_employee_id:
        df_members = df_members[df_members["employee_id"] == selected_employee_id]

    cols_per_row = 3
    member_list = df_members.to_dict("records")
    for row_start in range(0, len(member_list), cols_per_row):
        row_members = member_list[row_start:row_start + cols_per_row]
        cols = st.columns(cols_per_row)
        for col, member in zip(cols, row_members):
            with col:
                last_activity = member.get("last_activity") or "—"
                blocked = int(member.get("blocked_count", 0) or 0)
                border_color = "#EF553B" if blocked > 0 else "#e0e0e0"
                st.markdown(
                    f"""<div style="border:1px solid {border_color};border-radius:8px;
                    padding:12px;margin-bottom:8px;">
                    <b>{member['full_name']}</b><br>
                    <small>{member['employee_id']}</small><br>
                    ⏱ {member['total_hours']:.1f}h &nbsp; ✅ {int(member['done_count'])} done
                    {"&nbsp; 🚫 <b>" + str(blocked) + " blocked</b>" if blocked > 0 else ""}
                    <br><small>Last activity: {last_activity}</small>
                    </div>""",
                    unsafe_allow_html=True,
                )

st.divider()

# ── Blocked items panel ───────────────────────────────────────────────────────
st.subheader("🚫 Blocked Items")
blocked_params: dict = {**params, "status": "blocked", "limit": 100}
if selected_employee_id:
    blocked_params["employee_id"] = selected_employee_id

r_blocked = _api("GET", "/worklogs/team", params=blocked_params)
if r_blocked.status_code == 200:
    blocked_data = r_blocked.json()
    if blocked_data:
        df_blocked = pd.DataFrame(blocked_data)
        df_blocked["employee"] = df_blocked["employee_id"].map(name_map).fillna(df_blocked["employee_id"])
        blocked_cols = ["work_date", "employee", "task_description", "hours_spent", "ticket_id", "blockers"]
        blocked_cols = [c for c in blocked_cols if c in df_blocked.columns]
        st.dataframe(
            df_blocked[blocked_cols].rename(columns={
                "work_date": "Date",
                "employee": "Employee",
                "task_description": "Task",
                "hours_spent": "Hours",
                "ticket_id": "Ticket",
                "blockers": "Blockers",
            }),
            use_container_width=True,
        )
    else:
        st.success("No blocked items for the selected period.")
else:
    st.warning("Could not load blocked items.")

st.divider()

# ── Filterable team items table ───────────────────────────────────────────────
st.subheader("All Team Work Items")

if team_items_data:
    df_all = pd.DataFrame(team_items_data)
    df_all["employee"] = df_all["employee_id"].map(name_map).fillna(df_all["employee_id"])

    if selected_employee_id:
        df_all = df_all[df_all["employee_id"] == selected_employee_id]

    fc1, fc2, fc3, fc4 = st.columns(4)
    with fc1:
        emp_opts = ["All"] + sorted(df_all["employee"].unique().tolist())
        sel_emp = st.selectbox("Employee", emp_opts, key="table_emp")
    with fc2:
        cat_opts = ["All"] + sorted(df_all["work_category"].dropna().unique().tolist())
        sel_cat = st.selectbox("Category", cat_opts, key="table_cat")
    with fc3:
        status_opts = ["All"] + sorted(df_all["status"].dropna().unique().tolist())
        sel_status = st.selectbox("Status", status_opts, key="table_status")
    with fc4:
        show_nr = st.checkbox("Needs review only", value=False, key="table_nr")

    df_filtered = df_all.copy()
    if sel_emp != "All":
        df_filtered = df_filtered[df_filtered["employee"] == sel_emp]
    if sel_cat != "All":
        df_filtered = df_filtered[df_filtered["work_category"] == sel_cat]
    if sel_status != "All":
        df_filtered = df_filtered[df_filtered["status"] == sel_status]
    if show_nr and "needs_review" in df_filtered.columns:
        df_filtered = df_filtered[df_filtered["needs_review"] == True]  # noqa: E712

    display_cols = [
        "work_date", "employee", "task_description", "work_category",
        "hours_spent", "status", "priority", "ticket_id", "project_name",
    ]
    display_cols = [c for c in display_cols if c in df_filtered.columns]

    st.dataframe(
        df_filtered[display_cols].rename(columns={
            "work_date": "Date",
            "employee": "Employee",
            "task_description": "Task",
            "work_category": "Category",
            "hours_spent": "Hours",
            "status": "Status",
            "priority": "Priority",
            "ticket_id": "Ticket",
            "project_name": "Project",
        }),
        use_container_width=True,
        height=400,
    )
    st.caption(f"Showing {len(df_filtered)} of {len(df_all)} items")
else:
    st.info("No team work items found for the selected period.")
