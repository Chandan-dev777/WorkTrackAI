"""My Dashboard page — implemented in Phase 3."""

import streamlit as st

st.set_page_config(page_title="My Dashboard", page_icon="📊")

if not st.session_state.get("token"):
    st.switch_page("app.py")

user = st.session_state.get("user", {})
st.title("📊 My Dashboard")
st.success(f"Logged in as **{user.get('full_name', '')}** ({user.get('role', '')})")
st.info("Full dashboard will be available after Phase 3 is complete.")

if st.button("Logout"):
    st.session_state.clear()
    st.switch_page("app.py")
