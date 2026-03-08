-- Дата/время бронирования смены (фиксируем на своей стороне при записи type=shift_booked)
ALTER TABLE "transactions"
  ADD COLUMN IF NOT EXISTS "booked_at" timestamptz;

COMMENT ON COLUMN "transactions"."booked_at" IS 'Дата и время бронирования (для type=shift_booked); используется для периода квеста bookings_count';
