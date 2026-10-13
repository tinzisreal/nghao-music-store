-- Chạy đoạn SQL này 1 lần trong mục "SQL Editor" trên Supabase Dashboard:
CREATE TABLE IF NOT EXISTS public.app_store (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tắt RLS (hoặc dùng SUPABASE_SERVICE_ROLE_KEY ở phía Backend Render)
ALTER TABLE public.app_store DISABLE ROW LEVEL SECURITY;
