"""Chat Assistant page — implemented in Phase 4."""

import streamlit as st

st.set_page_config(page_title="Chat Assistant", page_icon="💬")

if not st.session_state.get("token"):
    st.switch_page("app.py")
st.title("💬 Chat Assistant")
st.info("Chat assistant will be available after Phase 4 is complete.")
