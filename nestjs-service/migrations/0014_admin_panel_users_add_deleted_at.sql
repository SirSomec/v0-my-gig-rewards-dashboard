-- Добавить deleted_at в admin_panel_users, если таблица уже была создана без этой колонки.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_panel_users')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'admin_panel_users' AND column_name = 'deleted_at') THEN
    ALTER TABLE "admin_panel_users" ADD COLUMN "deleted_at" timestamp with time zone;
  END IF;
END $$;
