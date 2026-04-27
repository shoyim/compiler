import os
import threading
import logging
import requests

logger = logging.getLogger(__name__)

COMPILER_URL = os.getenv("COMPILER_URL", "http://localhost:2000/api/v2/execute")
COMPILER_TOKEN = os.getenv("COMPILER_TOKEN", "")

# Thread-local HTTP session — avoids creating a new connection per request
_local = threading.local()


def _session() -> requests.Session:
    if not hasattr(_local, "session"):
        _local.session = requests.Session()
        _local.session.headers.update({
            "Authorization": f"Bearer {COMPILER_TOKEN}",
            "Content-Type": "application/json",
        })
    return _local.session


def run_checker(
    language: str,
    version: str,
    code: str,
    time_limit: int,
    memory_limit: int,
    in_file: str,
    box_id=None,  # worker tomonidan yuboriladi, compiler o'zi boshqaradi
) -> dict:
    """
    Bitta test case ni compiler API orqali ishlatib natija qaytaradi.

    Returns:
        {
            "stdout":  str,
            "stderr":  str,
            "status":  None | "TO" | "OL" | "EL" | "SG" | "XX" | "RE",
            "time":    int  (ms),
            "memory":  int  (KB),
            "message": str,
        }
    """
    # ── 1. Input faylni o'qish ──────────────────────────────────────────────
    try:
        with open(in_file, "r", encoding="utf-8") as f:
            stdin_data = f.read()
    except OSError as e:
        logger.error(f"Input fayl o'qilmadi: {in_file} — {e}")
        return _error("XX", f"Input fayl o'qilmadi: {e}")

    # ── 2. Compiler API ga so'rov ───────────────────────────────────────────
    payload = {
        "language": language,
        "version": version,
        "files": [{"content": code}],   # name yo'q → API "file0.code" ishlatadi
        "stdin": stdin_data,
        "compile_timeout": 10_000,      # 10 soniya
        "run_timeout": time_limit,
        "compile_cpu_time": 10_000,
        "run_cpu_time": time_limit,
        "compile_memory_limit": -1,     # cheksiz
        "run_memory_limit": memory_limit,
    }

    # connect timeout = 10s, read timeout = time_limit + 20s (buffer)
    read_timeout = max(30, time_limit // 1000 + 20)

    try:
        resp = _session().post(COMPILER_URL, json=payload, timeout=(10, read_timeout))
        resp.raise_for_status()
        body = resp.json()
    except requests.Timeout:
        logger.error(f"Compiler API timeout ({read_timeout}s) | {in_file}")
        return _error("TO", "Compiler API javob bermadi")
    except requests.RequestException as e:
        logger.error(f"Compiler API xatosi | {in_file} | {e}")
        return _error("XX", str(e))

    # ── 3. Compile xatosi tekshiruvi ────────────────────────────────────────
    compile_data = body.get("compile")
    if compile_data is not None and compile_data.get("code", 0) != 0:
        stderr = compile_data.get("stderr", "")
        logger.warning(f"Compile xatosi | {in_file} | {stderr[:200]!r}")
        return {
            "stdout":  "",
            "stderr":  stderr,
            "status":  "RE",        # Compile Error → Runtime Error sifatida
            "time":    0,
            "memory":  0,
            "message": "Compilation failed",
        }

    # ── 4. Run natijasi ─────────────────────────────────────────────────────
    run = body.get("run", {})
    status  = run.get("status")   # None | "TO" | "OL" | "EL" | "SG" | "XX"
    stdout  = run.get("stdout", "")
    stderr  = run.get("stderr", "")
    message = run.get("message", "")
    exit_code = run.get("code")

    # status=None lekin exit code nol emas → runtime xatosi (segfault, exception)
    if status is None and exit_code not in (None, 0):
        status = "SG"

    try:
        time_ms = int(float(run.get("time") or 0))
        memory_kb = int(float(run.get("memory") or 0))
    except (ValueError, TypeError):
        time_ms, memory_kb = 0, 0

    logger.info(
        f"[tid={threading.get_ident()}] {in_file} | "
        f"status={status!r} exit={exit_code} "
        f"time={time_ms}ms mem={memory_kb}KB "
        f"stdout={stdout[:60]!r}"
    )

    return {
        "stdout":  stdout,
        "stderr":  stderr,
        "status":  status,
        "time":    time_ms,
        "memory":  memory_kb,
        "message": message,
    }


def _error(status: str, message: str) -> dict:
    return {
        "stdout": "", "stderr": message,
        "status": status, "time": 0, "memory": 0, "message": message,
    }
