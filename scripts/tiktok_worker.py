"""
tiktok_worker.py — Antigravity TikTok Worker
Corre via GitHub Actions cada 8 minutos.
- Lee tiktok_queue donde status = 'pending'
- Descarga metadata + captions con yt-dlp (sin audio, sin AI)
- Inserta en tiktok_videos
- Actualiza tiktok_queue con el resultado

Usa SUPABASE_SERVICE_KEY para bypassear RLS (el worker no es un usuario autenticado).
"""

import os
import json
import subprocess
import tempfile
import traceback
from datetime import datetime, timezone

from supabase import create_client, Client

# ── Config ──────────────────────────────────────────────────────────────────
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]   # service key, NO anon key
MAX_ITEMS    = 5                                     # procesar máximo 5 por ciclo

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


# ── Helpers ──────────────────────────────────────────────────────────────────

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def mark_queue(queue_id: str, status: str, video_id: str = None, error: str = None):
    """Actualiza el estado de un item en la cola."""
    payload = {"status": status, "updated_at": now_iso()}
    if video_id:
        payload["video_id"] = video_id
    if error:
        payload["error_msg"] = error[:500]   # limitar longitud
    supabase.table("tiktok_queue").update(payload).eq("id", queue_id).execute()


def extract_captions(vtt_path: str) -> str:
    """
    Convierte un archivo .vtt a texto plano limpio.
    Elimina timestamps, etiquetas y líneas duplicadas.
    """
    if not os.path.exists(vtt_path):
        return ""

    lines = []
    seen  = set()

    with open(vtt_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            # Saltar encabezado WEBVTT, timestamps y líneas vacías
            if (not line
                    or line.startswith("WEBVTT")
                    or line.startswith("NOTE")
                    or "-->" in line
                    or line.isdigit()):
                continue
            # Eliminar etiquetas HTML residuales como <c>, </c>, <00:00>
            import re
            line = re.sub(r"<[^>]+>", "", line).strip()
            if line and line not in seen:
                seen.add(line)
                lines.append(line)

    return " ".join(lines)


def download_video_info(url: str) -> dict:
    with tempfile.TemporaryDirectory() as tmp:
        cmd = [
            "yt-dlp",
            "--no-playlist",
            "--write-auto-sub",
            "--write-sub",
            "--sub-lang", "es,en,es-419,en-orig",
            "--sub-format", "vtt/best",
            "--skip-download",
            "--dump-json",
            "--extractor-args", "tiktok:api_hostname=api16-normal-c-useast1a.tiktokv.com",
            "--no-warnings",
            "-o", os.path.join(tmp, "%(id)s.%(ext)s"),
            url,
        ]

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=90)

        meta = {}
        if result.stdout.strip():
            try:
                meta = json.loads(result.stdout.strip().splitlines()[-1])
            except json.JSONDecodeError:
                pass

        # Intentar extraer captions del JSON embebido en metadata
        transcript = ""
        
        # Opción 1: subtítulos automáticos embebidos en el JSON
        automatic_captions = meta.get("automatic_captions", {})
        subtitles = meta.get("subtitles", {})
        
        for lang_dict in [subtitles, automatic_captions]:
            for lang in ["es", "es-419", "en", "en-orig"]:
                if lang in lang_dict:
                    for fmt in lang_dict[lang]:
                        if fmt.get("ext") in ["vtt", "srv3", "json3"]:
                            # Descargar el caption directamente desde la URL
                            cap_url = fmt.get("url", "")
                            if cap_url:
                                try:
                                    import urllib.request
                                    with urllib.request.urlopen(cap_url, timeout=15) as r:
                                        raw = r.read().decode("utf-8")
                                        transcript = extract_captions_from_text(raw)
                                        if transcript:
                                            break
                                except:
                                    pass
                    if transcript:
                        break
            if transcript:
                break

        # Opción 2: buscar archivos .vtt descargados en disco
        if not transcript:
            import glob
            vtts = glob.glob(os.path.join(tmp, "*.vtt"))
            if vtts:
                transcript = extract_captions(vtts[0])

        # Opción 3: descripción como fallback de contenido
        description = meta.get("description") or meta.get("title") or ""

        return {
            "title"      : meta.get("title") or meta.get("fulltitle") or "",
            "author"     : meta.get("uploader") or meta.get("creator") or meta.get("channel") or "",
            "duration"   : int(meta.get("duration") or 0),
            "thumbnail"  : meta.get("thumbnail") or "",
            "view_count" : int(meta.get("view_count") or 0),
            "like_count" : int(meta.get("like_count") or 0),
            "description": description[:2000],
            "language"   : meta.get("language") or "",
            "transcript" : transcript,
        }


def extract_captions_from_text(raw: str) -> str:
    """Limpia captions en formato VTT o SRV3 desde texto crudo."""
    import re
    lines = []
    seen = set()
    for line in raw.splitlines():
        line = line.strip()
        if (not line or line.startswith("WEBVTT") or line.startswith("NOTE")
                or "-->" in line or line.isdigit()):
            continue
        line = re.sub(r"<[^>]+>", "", line).strip()
        if line and line not in seen:
            seen.add(line)
            lines.append(line)
    return " ".join(lines)


# ── Main ──────────────────────────────────────────────────────────────────────

def process_queue():
    print(f"[{now_iso()}] Worker iniciado.")

    # 1. Leer items pendientes (máximo MAX_ITEMS)
    response = (
        supabase.table("tiktok_queue")
        .select("id, url, user_id")
        .eq("status", "pending")
        .order("created_at", desc=False)
        .limit(MAX_ITEMS)
        .execute()
    )

    items = response.data or []
    print(f"  → {len(items)} item(s) en cola.")

    if not items:
        print("  Cola vacía. Fin.")
        return

    for item in items:
        queue_id = item["id"]
        url      = item["url"]
        user_id  = item["user_id"]

        print(f"  Procesando: {url[:60]}...")

        # 2. Marcar como 'processing' para evitar doble procesamiento
        mark_queue(queue_id, "processing")

        try:
            # 3. Descargar metadata y captions
            info = download_video_info(url)

            # 4. Insertar en tiktok_videos
            video_payload = {
                "user_id"    : user_id,
                "url"        : url,
                "title"      : info["title"],
                "author"     : info["author"],
                "duration"   : info["duration"],
                "thumbnail"  : info["thumbnail"],
                "view_count" : info["view_count"],
                "like_count" : info["like_count"],
                "transcript" : info["transcript"],
                "language"   : info["language"],
                # content y scratchpad los rellena el usuario desde la app
                "content"    : info["description"],
                "description": info["description"],   # descripción duplicada para retrocompatibilidad
                "status"     : "inbox",
                "ai_summary_status": "idle",
                "created_at" : now_iso(),
                "updated_at" : now_iso(),
            }

            video_res = (
                supabase.table("tiktok_videos")
                .insert(video_payload)
                .execute()
            )

            video_id = video_res.data[0]["id"]

            # 5. Marcar cola como completada con referencia al video
            mark_queue(queue_id, "completed", video_id=video_id)
            print(f"  ✓ Completado. video_id={video_id}")

        except Exception as e:
            error_detail = traceback.format_exc()
            print(f"  ✗ Error: {e}")
            mark_queue(queue_id, "error", error=str(e))

    print(f"[{now_iso()}] Worker finalizado.")


if __name__ == "__main__":
    process_queue()