import fs from 'node:fs';
import path from 'node:path';
import { Types } from 'mongoose';
import { UserModel, type IUserDocument } from '../models/user.model.js';
import { isDbConnected } from '../config/db.js';
import { logger } from '../utils/logger.js';

const STORAGE_FILE = path.resolve(process.cwd(), 'scratch', 'dev-users.json');

export class UserRepository {
  private fallbackStore = new Map<string, any>();

  constructor() {
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(STORAGE_FILE)) {
        const raw = fs.readFileSync(STORAGE_FILE, 'utf-8');
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
          for (const item of data) {
            const doc = this.wrapUserDoc(item);
            this.fallbackStore.set(doc._id.toString(), doc);
          }
        }
      }
    } catch {
      // Non-blocking in dev
    }
  }

  private saveToDisk(): void {
    try {
      const dir = path.dirname(STORAGE_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = Array.from(this.fallbackStore.values()).map((u) => ({
        _id: u._id.toString(),
        email: u.email,
        passwordHash: u.passwordHash,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      }));
      fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch {
      // Non-blocking
    }
  }

  private wrapUserDoc(item: any): IUserDocument {
    const objectId = typeof item._id === 'string' ? new Types.ObjectId(item._id) : item._id;
    return {
      _id: objectId,
      email: item.email,
      passwordHash: item.passwordHash,
      createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
      updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
      save: async function () {
        return this;
      },
    } as unknown as IUserDocument;
  }

  async findByEmail(email: string): Promise<IUserDocument | null> {
    const normalized = email.toLowerCase().trim();
    if (isDbConnected()) {
      return UserModel.findOne({ email: normalized }).exec();
    }
    const found = Array.from(this.fallbackStore.values()).find((u) => u.email === normalized);
    return found ? this.wrapUserDoc(found) : null;
  }

  async findById(id: string): Promise<IUserDocument | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    if (isDbConnected()) {
      return UserModel.findById(id).exec();
    }
    const found = this.fallbackStore.get(id);
    return found ? this.wrapUserDoc(found) : null;
  }

  async create(userData: { email: string; passwordHash: string }): Promise<IUserDocument> {
    if (isDbConnected()) {
      const user = new UserModel({
        email: userData.email.toLowerCase().trim(),
        passwordHash: userData.passwordHash,
      });
      return user.save();
    }

    const _id = new Types.ObjectId();
    const raw = {
      _id: _id.toString(),
      email: userData.email.toLowerCase().trim(),
      passwordHash: userData.passwordHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const doc = this.wrapUserDoc(raw);
    this.fallbackStore.set(_id.toString(), doc);
    this.saveToDisk();
    logger.info(`[DevStore] Created user ${raw.email} in resilient fallback store`);
    return doc;
  }
}

export const userRepository = new UserRepository();
