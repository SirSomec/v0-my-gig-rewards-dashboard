-- Запрет отрицательного баланса пользователя (защита от перерасхода при гонках).
-- При нарушении транзакция откатится с ошибкой.
ALTER TABLE "users"
  ADD CONSTRAINT "users_balance_non_negative" CHECK (balance >= 0);

COMMENT ON CONSTRAINT "users_balance_non_negative" ON "users" IS 'Баланс не может быть отрицательным; гарантия на уровне БД при атомарных списаниях.';
