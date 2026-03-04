import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { ClientSession, Connection } from 'mongoose';

@Injectable()
export class MongooseService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  async execTransaction<T>(callback: (session: ClientSession) => T) {
    const session = await this.connection.startSession();

    try {
      session.startTransaction();
      const result = await callback(session);
      await session.commitTransaction();
      return result;
    } catch (err) {
      await session.abortTransaction();
      // Пробрасываем ошибку дальше
      throw err;
    } finally {
      await session.endSession();
    }
  }

  readyState() {
    return this.connection.readyState;
  }
}
