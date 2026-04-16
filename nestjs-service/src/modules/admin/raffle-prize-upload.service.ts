import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { mkdirSync } from 'fs';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { getRafflePrizeUploadDir } from '../../shared/raffle-upload-path';

/** Файл из memoryStorage (multer). */
export type MemoryUploadedFile = {
  mimetype: string;
  buffer: Buffer;
};

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

@Injectable()
export class RafflePrizeUploadService implements OnModuleInit {
  private readonly logger = new Logger(RafflePrizeUploadService.name);

  onModuleInit(): void {
    const dir = getRafflePrizeUploadDir();
    mkdirSync(dir, { recursive: true });
    this.logger.log(`Raffle prize image uploads: ${dir}`);
  }

  async saveUploadedFile(file: MemoryUploadedFile | undefined): Promise<{ url: string }> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('file required');
    }
    const ext = MIME_TO_EXT[file.mimetype];
    if (!ext) {
      throw new BadRequestException('Only JPEG, PNG, GIF or WebP images are allowed');
    }
    const name = `${randomBytes(16).toString('hex')}${ext}`;
    const dir = getRafflePrizeUploadDir();
    await writeFile(join(dir, name), file.buffer);
    return { url: `/v1/uploads/raffle-prizes/${name}` };
  }
}
