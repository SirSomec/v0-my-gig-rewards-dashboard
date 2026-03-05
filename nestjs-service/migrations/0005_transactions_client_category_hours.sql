-- Поля транзакций для квестов: клиент (бренд), категория (профессия), часы
ALTER TABLE "transactions"
  ADD COLUMN IF NOT EXISTS "client_id" varchar(128),
  ADD COLUMN IF NOT EXISTS "category" varchar(128),
  ADD COLUMN IF NOT EXISTS "hours" real;

COMMENT ON COLUMN "transactions"."client_id" IS 'ID/код бренда или клиента (для квестов по сменам/часам в клиенте)';
COMMENT ON COLUMN "transactions"."category" IS 'Категория/профессия смены (для квестов по категории)';
COMMENT ON COLUMN "transactions"."hours" IS 'Отработанные часы в смене (для квестов по часам)';
