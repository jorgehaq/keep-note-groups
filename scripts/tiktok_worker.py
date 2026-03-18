"""
TikTok Worker - Antigravity
Procesa la cola tiktok_queue: descarga audio, analiza con Gemini 2.0 Flash, guarda en Supabase.

Dependencias:
    pip install yt-dlp google-generativeai supabase python-dotenv
"""

import os
import time
import json
import tempfile
import logging
from pathlib import Path

import yt_dlp
import google.generativeai as genai
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("tiktok-worker")

# ── Clientes ──────────────────────────────────────────────────────────────────
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
GEMINI_KEY = os.getenv("GEMINI_API_KEY")

if not all([SUPABASE_URL, SUPABASE_KEY, GEMINI_KEY]):
    log.error("Faltan variables de entorno (SUPABASE_URL, SUPABASE_SERVICE_KEY, GEMINI_API_KEY)")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
genai.configure(api_key=GEMINI_KEY)
model = genai.GenerativeModel("gemini-2.0-flash")


# ── Descarga ──────────────────────────────────────────────────────────────────
def download_audio(url: str, output_dir: str) -> tuple[str, dict]:
    """Descarga audio de TikTok. Retorna (ruta_mp3, info_del_video)."""
    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": f"{output_dir}/%(id)s.%(ext)s",
        "postprocessors": [{"key": "FFmpegExtractAudio", "preferredcodec": "mp3"}],
        "quiet": True,
        "no_warnings": True,
        "cookiefile": os.getenv("TIKTOK_COOKIES") if os.getenv("TIKTOK_COOKIES") else None,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        audio_path = f"{output_dir}/{info['id']}.mp3"
        return audio_path, info


# ── Análisis Gemini ───────────────────────────────────────────────────────────
PROMPT = """Analiza este audio de TikTok.

Devuelve SOLO un JSON válido (sin markdown, sin backticks) con esta estructura:
{
  "titulo": "título descriptivo y limpio del contenido",
  "transcripcion": "transcripción completa y fiel del audio",
  "resumen": "resumen conciso en 2-4 oraciones",
  "puntos_clave": ["punto 1", "punto 2", "punto 3"],
  "categoria": "categoría del contenido (ej: tecnología, humor, cocina, etc.)",
  "idioma": "idioma detectado (ej: español, inglés)"
}"""


def analyze_audio(audio_path: str) -> dict:
    """Sube audio a Gemini Files API y obtiene análisis estructurado."""
    log.info("Subiendo audio a Gemini Files API...")
    uploaded = genai.upload_file(audio_path, mime_type="audio/mp3")

    # Esperar a que el archivo sea procesado por la Files API si es necesario
    # (Generalmente para audio corto es inmediato, pero por seguridad...)
    
    log.info("Generando análisis con Gemini 2.0 Flash...")
    response = model.generate_content([uploaded, PROMPT])

    # Limpieza del JSON
    text = response.text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    
    try:
        return json.loads(text.strip())
    except Exception as e:
        log.error(f"Error parseando JSON de Gemini: {text}")
        raise e


# ── Worker loop ───────────────────────────────────────────────────────────────
def process_one(item: dict) -> None:
    queue_id = item["id"]
    url = item["url"]
    user_id = item["user_id"]

    log.info(f"Procesando [{queue_id[:8]}]: {url}")

    # Marcar como procesando
    supabase.table("tiktok_queue").update({"status": "processing"}).eq("id", queue_id).execute()

    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            # 1. Descargar audio
            audio_path, info = download_audio(url, tmpdir)
            title_raw = info.get("title", "Sin título")
            log.info(f"Audio descargado: {title_raw}")

            # 2. Analizar con Gemini
            analysis = analyze_audio(audio_path)

        # 3. Guardar video procesado
        video_data = {
            "user_id": user_id,
            "url": url,
            "title": analysis.get("titulo") or title_raw,
            "author": info.get("uploader", ""),
            "duration": info.get("duration", 0),
            "thumbnail": info.get("thumbnail", ""),
            "view_count": info.get("view_count", 0),
            "like_count": info.get("like_count", 0),
            "transcript": analysis.get("transcripcion", ""),
            "summary": analysis.get("resumen", ""),
            "key_points": analysis.get("puntos_clave", []),
            "category": analysis.get("categoria", ""),
            "language": analysis.get("idioma", ""),
        }
        video_result = supabase.table("tiktok_videos").insert(video_data).execute()
        video_id = video_result.data[0]["id"]

        # 4. Completar en queue
        supabase.table("tiktok_queue").update({
            "status": "completed",
            "video_id": video_id,
        }).eq("id", queue_id).execute()

        log.info(f"✅ Completado satisfactoriamente: {video_data['title']}")

    except Exception as e:
        log.error(f"❌ Error procesando {url}: {e}")
        supabase.table("tiktok_queue").update({
            "status": "error",
            "error_msg": str(e)[:500],
        }).eq("id", queue_id).execute()


def run():
    log.info("🎵 Antigravity TikTok Worker arrancando...")
    poll_interval = int(os.getenv("POLL_INTERVAL_SECONDS", "5"))

    while True:
        try:
            result = (
                supabase.table("tiktok_queue")
                .select("*")
                .eq("status", "pending")
                .order("created_at")
                .limit(1)
                .execute()
            )

            if result.data:
                process_one(result.data[0])
            else:
                time.sleep(poll_interval)
        except Exception as e:
            log.error(f"Error en loop principal: {e}")
            time.sleep(10)


if __name__ == "__main__":
    run()
