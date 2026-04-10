"""Team Dashboard page — implemented in Phase 5 (manager/admin only)."""

import streamlit as st

st.set_page_config(page_title="Team Dashboard", page_icon="👥")

if not st.session_state.get("token"):
    st.switch_page("app.py")

user = st.session_state.get("user", {})
if user.get("role") not in ("manager", "admin"):
    st.error("Access denied — managers and admins only.")
    st.stop()
st.title("👥 Team Dashboard")
st.success(f"Logged in as **{user.get('full_name', '')}** ({user.get('role', '')})")
st.info("Full team dashboard will be available after Phase 5 is complete.")

if st.button("Logout"):
    st.session_state.clear()
    st.switch_page("app.py")
