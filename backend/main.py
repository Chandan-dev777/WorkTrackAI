"""FastAPI application entry point."""

import argparse
import logging
from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.database import create_tables
from backend.routers import admin, auth, chat, dashboard, updates, worklogs

# Path to the built React frontend (worktrack-ai/frontend-react/dist/)
_FRONTEND_DIST = Path(__file__).parent.parent / "frontend-react" / "dist"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Creating database tables...")
    create_tables()
    logger.info("WorkTrack AI backend started.")
    yield


app = FastAPI(
    title="WorkTrack AI",
    description="AI-powered employee work progress tracker",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(updates.router)
app.include_router(worklogs.router)
app.include_router(dashboard.router)
app.include_router(chat.router)
app.include_router(admin.router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


# ── React SPA static file serving ────────────────────────────────────────────
# Only activated when the frontend has been built (frontend-react/dist/ exists).
# Mount /assets (JS/CSS bundles) then serve index.html for all other GET paths.
if _FRONTEND_DIST.exists():
    app.mount(
        "/assets",
        StaticFiles(directory=_FRONTEND_DIST / "assets"),
        name="frontend-assets",
    )

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa(_full_path: str = "") -> FileResponse:
        return FileResponse(_FRONTEND_DIST / "index.html")
else:
    logger.info(
        "React build not found at %s — run 'npm run build' inside frontend-react/ "
        "to enable integrated serving.",
        _FRONTEND_DIST,
    )


# ── CLI entry point ───────────────────────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="WorkTrack AI Backend")
    parser.add_argument(
        "--reindex",
        action="store_true",
        help="Rebuild ChromaDB index from SQLite and exit",
    )
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()

    if args.reindex:
        from backend.database import SessionLocal
        from backend.services.chroma_service import reindex_from_sqlite  # noqa: F401 (Phase 2)

        logger.info("Reindexing ChromaDB from SQLite...")
        with SessionLocal() as db:
            reindex_from_sqlite(db)
        logger.info("Reindex complete.")
    else:
        uvicorn.run("backend.main:app", host=args.host, port=args.port, reload=True)
