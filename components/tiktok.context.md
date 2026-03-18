# DOMINIO TIKTOK — Contexto para el Agente

## Propósito
Procesar videos de TikTok para extraer conocimiento estructurado (trascripciones, resúmenes, puntos clave) y permitir su exportación como notas organizables dentro de Antigravity.

## Flujo de Datos
1. **Frontend (TikTokApp.tsx)**: El usuario introduce URLs → Inserción en `tiktok_queue` (Supabase).
2. **Worker (tiktok_worker.py)**: Polling de la cola → Descarga audio (`yt-dlp`) → Análisis IA (`Gemini 2.0 Flash`) → Inserción en `tiktok_videos`.
3. **Frontend**: Realtime detecta el nuevo video → Muestra Card con acciones de "Compartir a Notas/Grupos".

## Estado Local en Store (useUIStore)
- `globalView === 'tiktok'`: Activa la vista del módulo.
- `isTikTokMaximized`: Booleano para modo pantalla completa del módulo.
- `isZenModeByApp['tiktok']`: Booleano para ocultar el header global.

## Tablas de Supabase Invocadas
- `tiktok_queue`: Gestión de cola de procesamiento.
- `tiktok_videos`: Almacén de metadatos y análisis de IA.
- `tiktok_note_links`: Relación muchos-a-muchos entre videos procesados y notas creadas.
- `notes`: Para la creación de notas a partir de videos.
- `groups`: Para listar destinos posibles de exportación.

## Reglas de UI Estrictas
- **Header Standard**: Debe incluir Icono (Music), Título, Bell (Recordatorios), y Maximize.
- **Acciones Rápidas**: Cada video debe permitir "Ver Transcripción" y "Enviar a... (Picker de Grupos)".
- **Feedback Visual**: El estado de la cola (`pending`, `processing`, `completed`, `error`) debe ser claramente visible mediante badges de colores.
- **Modo Oscuro**: Fondo principal `#13131A`, Cards `#1A1A24`, bordes `#2D2D42`.

## Dependencias Críticas
- **yt-dlp**: Para la extracción de media de TikTok (requiere ffmpeg).
- **Google Generative AI**: Gemini 2.0 Flash para procesamiento multimodal de audio.
- **Supabase Realtime**: Para la actualización instantánea de la UI cuando el worker termina.
