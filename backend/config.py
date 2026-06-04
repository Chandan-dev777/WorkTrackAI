"""
Application settings and LLM factory.

LLM pattern mirrors the reference chatbot:
  - get_api_key(): reads from APP_SERVICE_CONFIG JSON blob or direct env var
  - get_llm():     factory returning AzureChatOpenAI configured per model
  - CERT_PATH:     local cacert.pem → ~/.ssh/cacert.pem fallback
"""

import json
import logging
import os
from codecs import decode as _decode
from pathlib import Path

import httpx
from dotenv import load_dotenv
from langchain_openai.chat_models.azure import AzureChatOpenAI
from pydantic_settings import BaseSettings

logger = logging.getLogger(__name__)

# Load .env into os.environ so get_api_key() can read from it via os.getenv()
_env_path = Path(__file__).parent.parent / ".env"
load_dotenv(_env_path, override=False)  # override=False: OS env takes priority

# ── SSL cert ──────────────────────────────────────────────────────────────────
# Lookup order: local cacert.pem → ~/.ssh/cacert.pem → SSL_CERT_FILE env var → True (default)
def _resolve_cert() -> str | bool:
    local = os.path.join(os.path.dirname(__file__), "cacert.pem")
    if os.path.exists(local):
        return local
    ssh = os.path.expanduser("~/.ssh/cacert.pem")
    if os.path.exists(ssh):
        return ssh
    system = os.getenv("SSL_CERT_FILE") or os.getenv("REQUESTS_CA_BUNDLE")
    if system and os.path.exists(system):
        return system
    return True  # use system default cert store

CERT_PATH = _resolve_cert()


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "sqlite:///./data/dailyops.db"

    # JWT
    SECRET_KEY: str = "change-me-to-a-long-random-string"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 hours

    # LLM
    LLM_PROVIDER: str = "azure"
    LLM_MODEL: str = "Claude Sonnet 4.6"          # legacy fallback default

    # Per-task model selection
    # Extraction: needs structured JSON output + good instruction following
    LLM_MODEL_EXTRACTION: str = "Claude Sonnet 4.6"
    # Fixing parser: only repairs malformed JSON — fast model is sufficient
    LLM_MODEL_FIXING: str = "Claude Haiku 4.5"
    # Chat agent: needs multi-step reasoning + tool-use planning
    LLM_MODEL_CHAT: str = "Claude Sonnet 4.6"
    # Help widget: FAQ-style app help — Haiku is fast enough and cheaper
    LLM_MODEL_ASSISTANT: str = "Claude Haiku 4.5"

    # Azure endpoints
    NLP_ENDPOINT: str = "https://api.nlp.p.uptimize.merckgroup.com"
    NLP_API_VERSION: str = "2024-02-01"
    BEDROCK_ENDPOINT: str = "https://api.nlp.p.uptimize.merckgroup.com/model"
    BEDROCK_API_VERSION: str = "2024-02-01"

    # ChromaDB
    CHROMA_PATH: str = "./data/chroma"

    # Embeddings
    EMBEDDING_MODEL: str = "text-embedding-3-small"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()

# Set env defaults so AzureChatOpenAI can pick them up (mirrors reference chatbot)
os.environ.setdefault("AZURE_OPENAI_ENDPOINT", settings.NLP_ENDPOINT)
os.environ.setdefault("OPENAI_API_VERSION", settings.NLP_API_VERSION)


# ── API key helper (identical pattern to reference chatbot) ───────────────────

def get_api_key(key_name: str) -> str:
    """
    Reads API keys from APP_SERVICE_CONFIG JSON blob first,
    then falls back to a direct environment variable of the same name.
    """
    if config := os.getenv("APP_SERVICE_CONFIG"):
        try:
            return json.loads(_decode(config, "unicode_escape")).get(key_name, "")
        except json.JSONDecodeError:
            raise ValueError("APP_SERVICE_CONFIG is not valid JSON")
    if value := os.getenv(key_name):
        return value
    raise ValueError(f"{key_name} not found in environment")


# ── LLM factory (mirrors reference chatbot get_llm) ───────────────────────────

SUPPORTED_MODELS = [
    "Claude Sonnet 4.6",
    "Claude Opus 4.6",
    "Claude Haiku 4.5",
    "Claude 4.5",
    "GPT-4o",
    "GPT 5",
    "GPT 5.1",
    "GPT 5.2",
    "o1-mini",
    "o4-mini-gs",
]


def get_llm(model: str | None = None) -> AzureChatOpenAI:
    """
    Returns an AzureChatOpenAI instance configured for the requested model.
    Falls back to settings.LLM_MODEL if model is None.
    """
    model = model or settings.LLM_MODEL

    _bedrock_headers = {"openai-standard": "True"}
    bedrock_kwargs = dict(
        azure_endpoint=settings.BEDROCK_ENDPOINT,
        api_key=get_api_key("AWS_BEDROCK_KEY"),
        api_version=settings.BEDROCK_API_VERSION,
        temperature=0,
        max_retries=0,
        # Sync client — used by .invoke() / create_react_agent
        http_client=httpx.Client(verify=CERT_PATH, headers=_bedrock_headers),
        # Async client — used by .ainvoke() / .astream()
        # Without this, LangChain creates its own AsyncClient that omits the
        # required "openai-standard" header and the custom cert, causing 400s.
        http_async_client=httpx.AsyncClient(verify=CERT_PATH, headers=_bedrock_headers),
    )
    nlp_kwargs = dict(
        azure_endpoint=settings.NLP_ENDPOINT,
        api_key=get_api_key("APP_SERVICE_NLP_API_KEY"),
        api_version=settings.NLP_API_VERSION,
        temperature=0,
        max_retries=0,
    )

    model_map = {
        "Claude Sonnet 4.6": {**bedrock_kwargs, "model": "eu.anthropic.claude-sonnet-4-6"},
        "Claude Opus 4.6":   {**bedrock_kwargs, "model": "eu.anthropic.claude-opus-4-6-v1"},
        "Claude Haiku 4.5":  {**bedrock_kwargs, "model": "eu.anthropic.claude-haiku-4-5-20251001-v1:0"},
        "Claude 4.5":        {**bedrock_kwargs, "model": "eu.anthropic.claude-sonnet-4-5-20250929-v1:0"},
        "GPT-4o":            {**nlp_kwargs, "model": "gpt-4o"},
        "GPT 5":             {**nlp_kwargs, "model": "gpt-5"},
        "GPT 5.1":           {**nlp_kwargs, "model": "gpt-51"},
        "GPT 5.2":           {**nlp_kwargs, "model": "gpt-52"},
        "o1-mini":           {**nlp_kwargs, "model": "o1-mini"},
        "o4-mini-gs":        {
            **nlp_kwargs,
            "model": "o4-mini-gs",
            "api_version": "2024-09-12",
            "reasoning_effort": "medium",
        },
    }

    kwargs = model_map.get(model, {**bedrock_kwargs, "model": "eu.anthropic.claude-sonnet-4-6"})
    logger.info(
        "[%s] endpoint=%s model_id=%s api_version=%s",
        model,
        kwargs.get("azure_endpoint"),
        kwargs.get("model"),
        kwargs.get("api_version"),
    )
    return AzureChatOpenAI(**kwargs)
