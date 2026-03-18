-- ============================================================
-- TIKTOK MODULE - Antigravity
-- ============================================================

-- Cola de URLs pendientes de procesar
CREATE TABLE IF NOT EXISTS public.tiktok_queue (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     uuid DEFAULT auth.uid() NOT NULL,
    url         text NOT NULL,
    status      text DEFAULT 'pending' NOT NULL, -- pending | processing | completed | error
    error_msg   text,
    video_id    uuid,
    created_at  timestamptz DEFAULT now(),
    updated_at  timestamptz DEFAULT now()
);

-- Videos procesados con transcripción y análisis
CREATE TABLE IF NOT EXISTS public.tiktok_videos (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     uuid DEFAULT auth.uid() NOT NULL,
    url         text NOT NULL,
    title       text,
    author      text,
    duration    integer,
    thumbnail   text,
    view_count  integer DEFAULT 0,
    like_count  integer DEFAULT 0,
    transcript  text,
    summary     text,
    key_points  jsonb DEFAULT '[]',
    category    text,
    language    text,
    created_at  timestamptz DEFAULT now(),
    updated_at  timestamptz DEFAULT now()
);

-- Links: un video puede enviarse a múltiples notas/grupos
CREATE TABLE IF NOT EXISTS public.tiktok_note_links (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    video_id    uuid REFERENCES public.tiktok_videos(id) ON DELETE CASCADE NOT NULL,
    note_id     uuid REFERENCES public.notes(id) ON DELETE CASCADE,
    group_id    uuid REFERENCES public.groups(id) ON DELETE CASCADE,
    user_id     uuid DEFAULT auth.uid() NOT NULL,
    created_at  timestamptz DEFAULT now()
);

-- Foreign key de queue → video
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_tiktok_queue_video') THEN
        ALTER TABLE public.tiktok_queue
            ADD CONSTRAINT fk_tiktok_queue_video
            FOREIGN KEY (video_id) REFERENCES public.tiktok_videos(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Triggers para updated_at (asumiendo que update_modified_column ya existe)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_tiktok_queue_updated') THEN
        CREATE TRIGGER trg_tiktok_queue_updated
            BEFORE UPDATE ON public.tiktok_queue
            FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_tiktok_videos_updated') THEN
        CREATE TRIGGER trg_tiktok_videos_updated
            BEFORE UPDATE ON public.tiktok_videos
            FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
    END IF;
END $$;

-- RLS
ALTER TABLE public.tiktok_queue      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tiktok_videos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tiktok_note_links ENABLE ROW LEVEL SECURITY;

-- Políticas (limpiando previas para evitar error si ya existen)
DROP POLICY IF EXISTS "tiktok_queue_owner" ON public.tiktok_queue;
CREATE POLICY "tiktok_queue_owner" ON public.tiktok_queue FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "tiktok_videos_owner" ON public.tiktok_videos;
CREATE POLICY "tiktok_videos_owner" ON public.tiktok_videos FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "tiktok_links_owner" ON public.tiktok_note_links;
CREATE POLICY "tiktok_links_owner" ON public.tiktok_note_links FOR ALL USING (user_id = auth.uid());

-- Índices
CREATE INDEX IF NOT EXISTS idx_tiktok_queue_status  ON public.tiktok_queue(status, created_at);
CREATE INDEX IF NOT EXISTS idx_tiktok_queue_user    ON public.tiktok_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_tiktok_videos_user   ON public.tiktok_videos(user_id, created_at DESC);
