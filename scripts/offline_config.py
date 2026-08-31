#!/usr/bin/env python3
"""Configuracao compartilhada e segura do pipeline offline de atribuicao."""

from __future__ import annotations

import json
import os
import re
import tempfile
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_ENV_FILE = ROOT / ".env.attribution"
SECRET_ENV_NAMES = (
    "EVO_API_KEY",
    "WA_LOG_TOKEN",
    "META_ACCESS_TOKEN",
    "CRM_DATABASE_URL",
    "PG_CONNECTION_STRING",
    "GOOGLE_ADS_CLIENT_SECRET",
    "GOOGLE_ADS_REFRESH_TOKEN",
    "GOOGLE_ADS_DEVELOPER_TOKEN",
)


class ConfigError(RuntimeError):
    """Erro de configuracao que pode ser exibido sem revelar credenciais."""


def _unquote(value: str) -> str:
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
        return value[1:-1]
    return value


def load_env_file(path: str | Path | None = None) -> Path | None:
    """
    Carrega um arquivo KEY=VALUE sem executar shell.

    Variaveis ja presentes no ambiente sempre vencem o arquivo. O parser e
    propositalmente simples: nao expande comandos, `$VAR` nem escapes.
    """
    configured = path or os.environ.get("NETCAR_ATTRIBUTION_ENV_FILE")
    env_path = Path(configured).expanduser() if configured else DEFAULT_ENV_FILE
    if not env_path.exists():
        return None
    if not env_path.is_file():
        raise ConfigError(f"arquivo de ambiente invalido: {env_path}")

    for line_number, raw_line in enumerate(
        env_path.read_text(encoding="utf-8").splitlines(), start=1
    ):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].lstrip()
        if "=" not in line:
            raise ConfigError(
                f"linha {line_number} invalida em {env_path.name}; use CHAVE=valor"
            )
        key, value = line.split("=", 1)
        key = key.strip()
        if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", key):
            raise ConfigError(
                f"chave invalida na linha {line_number} de {env_path.name}"
            )
        os.environ.setdefault(key, _unquote(value))
    return env_path


def env_bool(name: str, default: bool = False) -> bool:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    normalized = raw.strip().lower()
    if normalized in {"1", "true", "yes", "on", "sim"}:
        return True
    if normalized in {"0", "false", "no", "off", "nao", "não"}:
        return False
    raise ConfigError(f"{name} deve ser true/false ou 1/0")


def env_int(name: str, default: int, minimum: int = 0) -> int:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        value = int(raw)
    except ValueError as exc:
        raise ConfigError(f"{name} deve ser inteiro") from exc
    if value < minimum:
        raise ConfigError(f"{name} deve ser >= {minimum}")
    return value


def required_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise ConfigError(f"variavel obrigatoria ausente: {name}")
    return value


def service_url(
    name: str,
    *,
    allow_insecure_flag: str,
    allow_loopback_when_env: str | None = None,
) -> str:
    value = required_env(name).rstrip("/")
    parsed = urlparse(value)
    if parsed.scheme == "https" and parsed.netloc:
        return value
    is_loopback = parsed.hostname in {"127.0.0.1", "localhost", "::1"}
    if (
        parsed.scheme == "http"
        and parsed.netloc
        and is_loopback
        and allow_loopback_when_env
        and os.environ.get(allow_loopback_when_env, "").strip()
    ):
        return value
    if (
        parsed.scheme == "http"
        and parsed.netloc
        and env_bool(allow_insecure_flag, default=False)
    ):
        return value
    if parsed.scheme == "http":
        raise ConfigError(
            f"{name} usa HTTP; habilite {allow_insecure_flag}=1 somente em desenvolvimento"
        )
    raise ConfigError(f"{name} deve ser uma URL HTTPS valida")


def data_dir() -> Path:
    configured = os.environ.get("ATTRIBUTION_DATA_DIR", "").strip()
    path = (
        Path(configured).expanduser()
        if configured
        else Path.home() / "Library" / "Application Support" / "Netcar" / "attribution"
    )
    path = path.resolve()
    path.mkdir(parents=True, exist_ok=True)
    try:
        path.chmod(0o700)
    except OSError:
        pass
    return path


def private_path(env_name: str, default_name: str) -> Path:
    configured = os.environ.get(env_name, "").strip()
    path = Path(configured).expanduser() if configured else data_dir() / default_name
    path = path.resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        path.parent.chmod(0o700)
    except OSError:
        pass
    return path


def chmod_private(path: str | Path) -> None:
    try:
        Path(path).chmod(0o600)
    except OSError:
        pass


def atomic_write_json(path: str | Path, payload: Any, *, indent: int | None = None) -> None:
    destination = Path(path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(
        prefix=f".{destination.name}.", dir=str(destination.parent)
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=indent)
            handle.write("\n")
        os.chmod(temp_name, 0o600)
        os.replace(temp_name, destination)
        chmod_private(destination)
    except Exception:
        try:
            os.unlink(temp_name)
        except OSError:
            pass
        raise


def redact_text(value: object) -> str:
    """Remove segredos conhecidos e tokens de query de mensagens de erro."""
    text = str(value)
    for name in SECRET_ENV_NAMES:
        secret = os.environ.get(name, "")
        if secret:
            text = text.replace(secret, f"[{name}_REDACTED]")
    text = re.sub(
        r"([?&](?:token|access_token|apikey|api_key)=)[^&\s]+",
        r"\1[REDACTED]",
        text,
        flags=re.IGNORECASE,
    )
    text = re.sub(
        r"(?i)(mysql(?:\+pymysql)?|postgres(?:ql)?)://[^\s]+",
        r"\1://[REDACTED]",
        text,
    )
    return text
