"""My Dashboard page — Phase 3."""

import os
from datetime import date, timedelta

import httpx
import pandas as pd
import plotly.express as px
import streamlit as st

st.set_page_config(page_title="My Dashboard", page_icon="📊", layout="wide")

if not st.session_state.get("token"):
    st.switch_page("app.py")

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
user = st.session_state.get("user", {})
st.title("📊 My Dashboard")
st.caption(f"Logged in as **{user.get('full_name')}** ({user.get('employee_id')})")

# ── Sidebar ───────────────────────────────────────────────────────────────────
with st.sidebar:
    if st.button("📝 Submit Update"):
        st.switch_page("pages/1_Submit_Update.py")
    if user.get("role") in ("manager", "admin"):
        if st.button("👥 Team Dashboard"):
            st.switch_page("pages/3_Team_Dashboard.py")
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
        index=0,
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

# ── Fetch dashboard data ──────────────────────────────────────────────────────
params = {"start_date": start_date.isoformat(), "end_date": end_date.isoformat()}

with st.spinner("Loading dashboard..."):
    r_summary = _api("GET", "/dashboard/summary", params=params)
    r_cats = _api("GET", "/dashboard/categories", params=params)
    r_status = _api("GET", "/dashboard/status", params=params)
    r_trend = _api("GET", "/dashboard/trend", params=params)
    r_items = _api("GET", "/worklogs/my", params={**params, "limit": 200})

if any(r.status_code != 200 for r in [r_summary, r_cats, r_status, r_trend, r_items]):
    st.error("Failed to load dashboard data. Is the backend running?")
    st.stop()

summary = r_summary.json()
cats_data = r_cats.json()
status_data = r_status.json()
trend_data = r_trend.json()
items_data = r_items.json()

# ── KPI Cards ─────────────────────────────────────────────────────────────────
st.subheader(f"📅 {start_date.strftime('%d %b')} — {end_date.strftime('%d %b %Y')}")

col1, col2, col3, col4, col5 = st.columns(5)
col1.metric("⏱ Total Hours", f"{summary['total_hours']:.1f}h")
col2.metric("✅ Done", summary["done_count"])
col3.metric("🔄 In Progress", summary["in_progress_count"])
col4.metric("🚫 Blocked", summary["blocked_count"])
col5.metric("📋 Total Tasks", summary["total_items"])

st.divider()

# ── Charts row ────────────────────────────────────────────────────────────────
chart_col1, chart_col2 = st.columns([2, 1])

with chart_col1:
    st.subheader("Hours by Category")
    if cats_data:
        df_cats = pd.DataFrame(cats_data)
        fig = px.bar(
            df_cats,
            x="category",
            y="hours",
            color="category",
            text="hours",
            labels={"hours": "Hours", "category": "Category"},
        )
        fig.update_traces(texttemplate="%{text:.1f}h", textposition="outside")
        fig.update_layout(showlegend=False, margin=dict(t=20, b=20))
        st.plotly_chart(fig, use_container_width=True)
    else:
        st.info("No data for selected period.")

with chart_col2:
    st.subheader("Status Distribution")
    if status_data:
        df_status = pd.DataFrame(status_data)
        fig_pie = px.pie(
            df_status,
            names="status",
            values="count",
            hole=0.4,
            color="status",
            color_discrete_map={
                "done": "#00CC96",
                "in_progress": "#636EFA",
                "blocked": "#EF553B",
                "planned": "#FFA15A",
            },
        )
        fig_pie.update_layout(margin=dict(t=20, b=20))
        st.plotly_chart(fig_pie, use_container_width=True)
    else:
        st.info("No status data.")

# ── Daily trend ───────────────────────────────────────────────────────────────
st.subheader("Daily Hours Trend")
if trend_data:
    df_trend = pd.DataFrame(trend_data)
    df_trend["date"] = pd.to_datetime(df_trend["date"])
    fig_line = px.line(
        df_trend,
        x="date",
        y="hours",
        markers=True,
        labels={"hours": "Hours Logged", "date": "Date"},
    )
    fig_line.update_layout(margin=dict(t=20, b=20))
    st.plotly_chart(fig_line, use_container_width=True)
else:
    st.info("No trend data for selected period.")

st.divider()

# ── Work Items Table ──────────────────────────────────────────────────────────
st.subheader("Work Items")

if not items_data:
    st.info("No work items found for the selected period.")
else:
    df = pd.DataFrame(items_data)

    # ── Filters ───────────────────────────────────────────────────────────────
    filter_col1, filter_col2, filter_col3 = st.columns(3)
    with filter_col1:
        cat_options = ["All"] + sorted(df["work_category"].unique().tolist())
        selected_cat = st.selectbox("Category", cat_options)
    with filter_col2:
        status_options = ["All"] + sorted(df["status"].dropna().unique().tolist())
        selected_status = st.selectbox("Status", status_options)
    with filter_col3:
        show_needs_review = st.checkbox("Needs review only", value=False)

    filtered = df.copy()
    if selected_cat != "All":
        filtered = filtered[filtered["work_category"] == selected_cat]
    if selected_status != "All":
        filtered = filtered[filtered["status"] == selected_status]
    if show_needs_review:
        filtered = filtered[filtered["needs_review"] == True]

    display_cols = ["work_date", "task_description", "work_category", "hours_spent", "status", "priority", "ticket_id", "project_name", "needs_review"]
    display_cols = [c for c in display_cols if c in filtered.columns]

    edited = st.data_editor(
        filtered[display_cols].rename(columns={
            "work_date": "Date",
            "task_description": "Task",
            "work_category": "Category",
            "hours_spent": "Hours",
            "status": "Status",
            "priority": "Priority",
            "ticket_id": "Ticket",
            "project_name": "Project",
            "needs_review": "Needs Review",
        }),
        use_container_width=True,
        num_rows="fixed",
        column_config={
            "Category": st.column_config.SelectboxColumn(
                options=["project", "ticket", "polaris_classification", "admin",
                         "meeting", "learning", "support", "documentation", "review", "other"]
            ),
            "Status": st.column_config.SelectboxColumn(
                options=["planned", "in_progress", "blocked", "done"]
            ),
            "Priority": st.column_config.SelectboxColumn(
                options=["low", "medium", "high"]
            ),
            "Hours": st.column_config.NumberColumn(min_value=0.0, step=0.5),
            "Needs Review": st.column_config.CheckboxColumn(disabled=True),
        },
        key="items_editor",
    )

    # ── Inline save ───────────────────────────────────────────────────────────
    if st.button("💾 Save Changes", type="primary"):
        edited_renamed = edited.rename(columns={
            "Date": "work_date", "Task": "task_description",
            "Category": "work_category", "Hours": "hours_spent",
            "Status": "status", "Priority": "priority",
            "Ticket": "ticket_id", "Project": "project_name",
        })
        # Match edited rows back to original items by index
        original_indexed = filtered.reset_index(drop=True)
        errors = []
        saved = 0
        for i, row in edited_renamed.iterrows():
            orig_row = original_indexed.iloc[i]
            item_id = orig_row["id"]
            update_payload = {
                k: (None if pd.isna(v) else v)
                for k, v in row.items()
                if k in ("work_category", "hours_spent", "status", "priority", "ticket_id", "project_name", "task_description")
            }
            resp = _api("PUT", f"/worklogs/{item_id}", json=update_payload)
            if resp.status_code == 200:
                saved += 1
            else:
                errors.append(f"Item {item_id[:8]}…: {resp.text}")

        if errors:
            for e in errors:
                st.error(e)
        else:
            st.success(f"Saved {saved} item(s) successfully.")
            st.rerun()
