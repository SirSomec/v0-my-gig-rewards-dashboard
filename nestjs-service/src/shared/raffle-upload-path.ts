import { resolve } from 'path';

/** Абсолютный каталог файлов картинок призов (на сервере). */
export function getRafflePrizeUploadDir(): string {
  const raw = process.env['RAFFLE_PRIZE_UPLOAD_DIR']?.trim();
  return raw ? resolve(raw) : resolve(process.cwd(), 'uploads', 'raffle-prizes');
}
