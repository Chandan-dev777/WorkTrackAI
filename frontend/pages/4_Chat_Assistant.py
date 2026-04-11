"""Chat Assistant page — Phase 4."""

import os

import httpx
import streamlit as st

st.set_page_config(page_title="Chat Assistant", page_icon="💬", layout="wide")

if not st.session_state.get("token"):
    st.switch_page("app.py")

API_BASE = os.getenv("API_BASE_URL", "http://localhost:8000")

SOURCE_ICONS = {"sql": "🗄️ SQL", "vector": "🔍 Vector", "hybrid": "⚡ Hybrid"}
STATUS_COLORS = {"done": "🟢", "in_progress": "🔵", "blocked": "🔴", "planned": "⚪"}


def _auth_headers():
    return {"Authorization": f"Bearer {st.session_state['token']}"}


def _api(method, path, timeout: float = 120.0, **kwargs):
    return httpx.request(
        method, f"{API_BASE}{path}",
        headers=_auth_headers(),
        timeout=timeout,
        **kwargs,
    )


# ── Session state ─────────────────────────────────────────────────────────────
if "chat_messages" not in st.session_state:
    st.session_state.chat_messages = []
if "chat_session_id" not in st.session_state:
    st.session_state.chat_session_id = None

# ── Header ────────────────────────────────────────────────────────────────────
user = st.session_state.get("user", {})
st.title("💬 Chat Assistant")
st.caption(
    f"Ask questions about your work history • Logged in as **{user.get('full_name')}** "
    f"({'Manager view' if user.get('role') in ('manager', 'admin') else 'My data only'})"
)

# ── Sidebar — renders once; example buttons inject into session_state ─────────
with st.sidebar:
    if st.button("📊 My Dashboard"):
        st.switch_page("pages/2_My_Dashboard.py")
    if st.button("📝 Submit Update"):
        st.switch_page("pages/1_Submit_Update.py")
    if st.button("🚪 Logout"):
        st.session_state.clear()
        st.switch_page("app.py")

    st.divider()

    if st.button("🗑️ New Conversation", use_container_width=True):
        st.session_state.chat_messages = []
        st.session_state.chat_session_id = None
        st.rerun()

    st.divider()
    st.subheader("Example questions")
    examples = [
        "How many hours did I log this week?",
        "What was I working on last month?",
        "Show me all blocked tasks from last week.",
        "Which category did I spend the most time on?",
        "What did I do yesterday?",
    ]
    if user.get("role") in ("manager", "admin"):
        examples += [
            "Show me team activity this week.",
            "Which employee has the most blocked tasks?",
        ]
    for ex in examples:
        if st.button(ex, use_container_width=True, key=f"ex_{ex[:20]}"):
            st.session_state["_pending_question"] = ex


# ── Chat area — wrapped in @st.fragment so only this section reruns on submit ──
# Without the fragment, the whole page (including sidebar) reruns on every
# chat_input submit, causing a visible "refresh" flash.

@st.fragment
def chat_area():
    # Reserve a container for all messages BEFORE the chat_input so that the
    # input box always renders at the bottom, never between old and new messages.
    messages_container = st.container()

    # Pick up example-button injection or typed input
    pending = st.session_state.pop("_pending_question", None)
    question = st.chat_input("Ask about your work history…") or pending

    with messages_container:
        # Render full history
        for msg in st.session_state.chat_messages:
            with st.chat_message(msg["role"]):
                st.markdown(msg["content"])
                if msg["role"] == "assistant":
                    source_label = SOURCE_ICONS.get(msg.get("source", "sql"), "🗄️ SQL")
                    st.caption(f"Retrieved via {source_label}")
                    if msg.get("sources"):
                        with st.expander(f"📎 Sources ({len(msg['sources'])} items)"):
                            for src in msg["sources"]:
                                icon = STATUS_COLORS.get(src.get("status", ""), "⚫")
                                st.markdown(
                                    f"**{src['work_date']}** {icon} "
                                    f"`{src['work_category']}` — {src['task_description']}"
                                )

        if not question:
            return

        # Render user bubble
        with st.chat_message("user"):
            st.markdown(question)

        # Call API and render assistant bubble with live spinner
        with st.chat_message("assistant"):
            with st.spinner("Thinking…"):
                try:
                    resp = _api(
                        "POST",
                        "/chat/query",
                        json={
                            "question": question,
                            "session_id": st.session_state.chat_session_id,
                        },
                    )
                    if resp.status_code == 200:
                        body = resp.json()
                        answer = body["answer"]
                        source = body.get("query_source", "sql")
                        sources = body.get("sources", [])
                        st.session_state.chat_session_id = body.get("session_id")
                    else:
                        answer = f"Error {resp.status_code}: {resp.text}"
                        source, sources = "sql", []
                except httpx.ReadTimeout:
                    answer = "The request timed out. The AI is processing a complex query — please try again."
                    source, sources = "sql", []
                except Exception as exc:
                    answer = f"Connection error: {exc}"
                    source, sources = "sql", []

            st.markdown(answer)
            st.caption(f"Retrieved via {SOURCE_ICONS.get(source, '🗄️ SQL')}")
            if sources:
                with st.expander(f"📎 Sources ({len(sources)} items)"):
                    for src in sources:
                        icon = STATUS_COLORS.get(src.get("status", ""), "⚫")
                        st.markdown(
                            f"**{src['work_date']}** {icon} "
                            f"`{src['work_category']}` — {src['task_description']}"
                        )

    # Persist both turns to session_state so history survives full page reruns
    if question:
        st.session_state.chat_messages.append({"role": "user", "content": question})
        st.session_state.chat_messages.append({
            "role": "assistant",
            "content": answer,
            "source": source,
            "sources": sources,
        })


chat_area()
