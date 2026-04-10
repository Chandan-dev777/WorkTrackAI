"""
WorkTrack AI — Streamlit entry point.

This page handles Login / Register.
On success the JWT and user profile are stored in st.session_state
and the user is redirected to the appropriate dashboard page.
"""

import streamlit as st
import httpx
import os

API_BASE = os.getenv("API_BASE_URL", "http://localhost:8000")

st.set_page_config(
    page_title="WorkTrack AI — Login",
    page_icon="📋",
    layout="centered",
)


def _api(method: str, path: str, **kwargs):
    """Simple API helper with error passthrough."""
    url = f"{API_BASE}{path}"
    resp = httpx.request(method, url, **kwargs)
    return resp


def _store_session(token: str, profile: dict):
    st.session_state["token"] = token
    st.session_state["user"] = profile


def _auth_headers():
    return {"Authorization": f"Bearer {st.session_state.get('token', '')}"}


# ── Already logged in → redirect ──────────────────────────────────────────────
if st.session_state.get("token"):
    role = st.session_state.get("user", {}).get("role", "employee")
    if role in ("manager", "admin"):
        st.switch_page("pages/3_Team_Dashboard.py")
    else:
        st.switch_page("pages/2_My_Dashboard.py")

# ── Login / Register tabs ─────────────────────────────────────────────────────
st.title("📋 WorkTrack AI")
st.caption("AI-powered work progress tracker")

tab_login, tab_register = st.tabs(["Login", "Register"])

# ── Login ─────────────────────────────────────────────────────────────────────
with tab_login:
    with st.form("login_form"):
        email = st.text_input("Email")
        password = st.text_input("Password", type="password")
        submitted = st.form_submit_button("Login", use_container_width=True)

    if submitted:
        if not email or not password:
            st.error("Please enter your email and password.")
        else:
            with st.spinner("Logging in..."):
                resp = _api("POST", "/auth/login", json={"email": email, "password": password})
            if resp.status_code == 200:
                token = resp.json()["access_token"]
                me_resp = _api("GET", "/auth/me", headers={"Authorization": f"Bearer {token}"})
                if me_resp.status_code == 200:
                    _store_session(token, me_resp.json())
                    st.success(f"Welcome back, {me_resp.json()['full_name']}!")
                    st.rerun()
            elif resp.status_code == 401:
                st.error("Incorrect email or password.")
            else:
                st.error(f"Login failed: {resp.text}")

# ── Register ──────────────────────────────────────────────────────────────────
with tab_register:
    with st.form("register_form"):
        reg_name = st.text_input("Full Name")
        reg_emp_id = st.text_input("Employee ID (e.g. EMP-001)")
        reg_email = st.text_input("Email", key="reg_email")
        reg_password = st.text_input("Password (min 8 chars)", type="password", key="reg_pw")
        reg_role = st.selectbox("Role", ["employee", "manager"])
        reg_team = st.text_input("Team Name (optional)")
        reg_dept = st.text_input("Department (optional)")
        reg_submitted = st.form_submit_button("Create Account", use_container_width=True)

    if reg_submitted:
        if not all([reg_name, reg_emp_id, reg_email, reg_password]):
            st.error("Please fill in all required fields.")
        else:
            with st.spinner("Creating account..."):
                resp = _api("POST", "/auth/register", json={
                    "employee_id": reg_emp_id,
                    "full_name": reg_name,
                    "email": reg_email,
                    "password": reg_password,
                    "role": reg_role,
                    "team_name": reg_team or None,
                    "department": reg_dept or None,
                })
            if resp.status_code == 201:
                token = resp.json()["access_token"]
                me_resp = _api("GET", "/auth/me", headers={"Authorization": f"Bearer {token}"})
                if me_resp.status_code == 200:
                    _store_session(token, me_resp.json())
                    st.success(f"Account created! Welcome, {reg_name}.")
                    st.rerun()
            elif resp.status_code == 409:
                st.error("That email is already registered. Please log in instead.")
            elif resp.status_code == 422:
                errors = resp.json().get("detail", [])
                for e in errors:
                    st.error(f"{' → '.join(str(x) for x in e.get('loc', []))}: {e.get('msg')}")
            else:
                st.error(f"Registration failed: {resp.text}")
