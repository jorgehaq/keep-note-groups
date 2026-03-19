"""
tiktok_worker.py — Antigravity TikTok Worker (Whisper Edition)
Corre via GitHub Actions cada 8 minutos.

Flujo por video:
  1. Lee tiktok_queue donde status = 'pending'
  2. Descarga metadata con yt-dlp (--dump-json)
  3. Descarga audio mp3 con yt-dlp
  4. Transcribe con Whisper local (modelo 'base', ~140MB, sin API key)
  5. Inserta en tiktok_videos
  6. Actualiza tiktok_queue a 'completed'

Requiere: pip install openai-whisper yt-dlp supabase
ffmpeg ya viene instalado en ubuntu-latest de GitHub Actions.
Usa SUPABASE_SERVICE_KEY para bypassear RLS.
"""

import os
import re
import json
import glob
import subprocess
import tempfile
import traceback
from datetime import datetime, timezone
from typing import Any
from dotenv import load_dotenv

load_dotenv()  # Lee el .env local

import whisper
from supabase import create_client, Client

# ── Config ────────────────────────────────────────────────────────────────────
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")
MAX_ITEMS    = 3   # Whisper tarda más que solo metadata, procesar menos por ciclo

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Cargar modelo Whisper una sola vez al arrancar
# 'base' = ~140MB, buena precisión para voz, rápido en CPU (~5-15s por video corto)
print("Cargando modelo Whisper 'base'...")
whisper_model = whisper.load_model("base", device="cpu")
print("Modelo cargado.")


# ── Helpers ───────────────────────────────────────────────────────────────────

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def mark_queue(queue_id: str, status: str, video_id: str | None = None, error: str | None = None):
    payload = {"status": status, "updated_at": now_iso()}
    if video_id:
        payload["video_id"] = video_id
    if error:
        payload["error_msg"] = (error or "")[:500]
    supabase.table("tiktok_queue").update(payload).eq("id", queue_id).execute()


def get_metadata(url: str, tmp: str) -> dict:
    """Extrae metadata del video sin descargar el archivo multimedia."""
    cmd = [
        "yt-dlp",
        "--no-playlist",
        "--dump-json",
        "--no-warnings",
        "--quiet",
        "-o", os.path.join(tmp, "%(id)s.%(ext)s"),
        url,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)

    meta = {}
    if result.stdout.strip():
        try:
            meta = json.loads(result.stdout.strip().splitlines()[-1])
        except json.JSONDecodeError:
            pass

    return meta


def download_audio(url: str, tmp: str) -> str | None:
    """
    Descarga solo el audio del video en formato mp3.
    Retorna la ruta al archivo, o None si falla.
    """
    cmd = [
        "yt-dlp",
        "--no-playlist",
        "--format", "bestaudio/best",
        "--extract-audio",
        "--audio-format", "mp3",
        "--audio-quality", "5",     # calidad media, suficiente para reconocimiento de voz
        "--no-warnings",
        "--quiet",
        "-o", os.path.join(tmp, "%(id)s.%(ext)s"),
        url,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)

    if result.returncode != 0:
        print(f"    yt-dlp error: {(result.stderr or '')[:200]}")
        return None

    # Buscar audio descargado (mp3 o m4a si ffmpeg no convirtió)
    for ext in ["mp3", "m4a", "webm", "ogg"]:
        files = glob.glob(os.path.join(tmp, f"*.{ext}"))
        if files:
            return files[0]

    return None


def transcribe_audio(audio_path: str, language_hint: str | None = None) -> tuple[str, str]:
    """
    Transcribe el audio con Whisper local.
    Retorna (transcript, idioma_detectado).
    language_hint: 'es', 'en', etc. None = Whisper detecta automáticamente.
    """
    print(f"    Transcribiendo: {os.path.basename(audio_path)}...")

    options: dict[str, Any] = {
        "fp16"   : False,    # CPU no soporta fp16
        "verbose": False,
    }
    if language_hint:
        options["language"] = language_hint

    result = whisper_model.transcribe(audio_path, **options)

    transcript      = result.get("text", "").strip()
    detected_lang   = result.get("language", "")

    print(f"    Idioma detectado: {detected_lang} | Chars transcritos: {len(transcript)}")
    return transcript, detected_lang


# ── Main ──────────────────────────────────────────────────────────────────────

def process_queue():
    print(f"\n[{now_iso()}] Worker iniciado.")

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

        print(f"\n  Procesando: {url[:70]}...")
        mark_queue(queue_id, "processing")

        try:
            with tempfile.TemporaryDirectory() as tmp:

                # 1. Metadata (sin descargar video)
                print("    Obteniendo metadata...")
                meta = get_metadata(url, tmp)

                title       = meta.get("title") or meta.get("fulltitle") or ""
                author      = meta.get("uploader") or meta.get("creator") or meta.get("channel") or ""
                duration    = int(meta.get("duration") or 0)
                thumbnail   = meta.get("thumbnail") or ""
                view_count  = int(meta.get("view_count") or 0)
                like_count  = int(meta.get("like_count") or 0)
                description = (meta.get("description") or "")[:2000]
                lang_hint   = meta.get("language") or None

                print(f"    Título: {title[:60]}")
                print(f"    Duración: {duration}s | Autor: @{author}")

                # 2. Descargar audio
                print("    Descargando audio...")
                audio_path = download_audio(url, tmp)

                # 3. Transcribir con Whisper
                transcript        = ""
                detected_language = lang_hint or ""

                if audio_path:
                    transcript, detected_language = transcribe_audio(audio_path, lang_hint)
                else:
                    print("    No se pudo descargar audio — transcript quedará vacío.")

            # 4. Insertar en tiktok_videos (fuera del tempdir, ya no necesitamos archivos)
            video_payload = {
                "user_id"          : user_id,
                "url"              : url,
                "title"            : title,
                "author"           : author,
                "duration"         : duration,
                "thumbnail"        : thumbnail,
                "view_count"       : view_count,
                "like_count"       : like_count,
                "transcript"       : transcript,
                "language"         : detected_language,
                "content"          : description,
                "description"      : description,
                "status"           : "inbox",
                "ai_summary_status": "idle",
                "created_at"       : now_iso(),
                "updated_at"       : now_iso(),
            }

            video_res = (
                supabase.table("tiktok_videos")
                .insert(video_payload)
                .execute()
            )
            video_id = video_res.data[0]["id"]

            mark_queue(queue_id, "completed", video_id=video_id)
            print(f"  ✓ Completado. video_id={video_id}")
            print(f"    Transcript: {len(transcript)} chars")

        except Exception as e:
            print(f"  ✗ Error: {e}")
            print(traceback.format_exc())
            mark_queue(queue_id, "error", error=str(e))

    print(f"\n[{now_iso()}] Worker finalizado.")


if __name__ == "__main__":
    process_queue()