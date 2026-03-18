# TikTok App Context

## Propósito
Módulo de análisis de contenido de TikTok que permite convertir videos en notas estructuradas mediante la extracción de metadata, transcripciones automáticas y generación de resúmenes por IA.

## Arquitectura de Procesamiento (Worker)
- **Script**: `scripts/tiktok_worker.py`.
- **Ejecución**: GitHub Actions cada 8 minutos.
- **Tecnología**: `yt-dlp` para extracción de metadata y subtítulos ASR (sin descarga de medios) + Supabase Python SDK.
- **Flujo**:
  1. Usuario agrega URL a `tiktok_queue` (status: `pending`).
  2. Worker marca como `processing`.
  3. Worker extrae info e inserta en `tiktok_videos`.
  4. Worker marca cola como `completed`.

## Estado Global (useUIStore)
- `tikTokVideos`: Lista de videos procesados.
- `tikTokQueueItems`: Lista de URLs en espera de procesamiento.
- `focusedVideoId`: ID del video actualmente en edición.
- `isVideoTrayOpen`: Estado de la barra lateral de navegación.

## Dependencias de Supabase
- **Tablas**: `tiktok_queue` (cola de tareas) y `tiktok_videos` (contenido final).
- **Realtime**: Sincronización automática para mostrar el progreso del worker en tiempo real en la UI.

## Reglas de UI Estrictas
1. **Search Parity**: El buscador debe usar el patrón ámbar (`amber-500/50`) con iluminación de texto cuando hay una búsqueda activa.
2. **Tab Navigation**: Tres pilares de contenido: ANÁLISIS, TRANSCRIPCIÓN e IA.
3. **Responsive Design**: Colapsar la bandeja de videos lateral (`PanelLeft`) para maximizar el área de edición.
4. **Visual Glow**: Los badges de duración y autor deben seguir la estética premium del sistema (fuentes mono, opacidades dinámicas).
