ALTER TABLE "raffles" ADD COLUMN IF NOT EXISTS "winner_selection_mode" varchar(16) NOT NULL DEFAULT 'random';
