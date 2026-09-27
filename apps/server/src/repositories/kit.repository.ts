import fs from 'node:fs';
import path from 'node:path';
import { Types } from 'mongoose';
import { PrepKitModel, type IPrepKitDocument } from '../models/kit.model.js';
import { isDbConnected } from '../config/db.js';
import { serializeToAppendixA, type InternalKit } from '@prep-kit/shared';
import { logger } from '../utils/logger.js';

const STORAGE_FILE = path.resolve(process.cwd(), 'scratch', 'dev-kits.json');

export class KitRepository {
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
            const doc = this.wrapKitDoc(item);
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
      const data = Array.from(this.fallbackStore.values()).map((k) => ({
        ...k,
        _id: k._id.toString(),
        user_id: k.user_id.toString(),
      }));
      fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch {
      // Non-blocking
    }
  }

  private wrapKitDoc(item: any): IPrepKitDocument {
    const self = this;
    const objectId = typeof item._id === 'string' ? new Types.ObjectId(item._id) : item._id;
    const userObjectId = typeof item.user_id === 'string' ? new Types.ObjectId(item.user_id) : item.user_id;

    const doc: any = {
      ...item,
      _id: objectId,
      user_id: userObjectId,
      createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
      updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
      toAppendixA: function () {
        return serializeToAppendixA(this as unknown as InternalKit);
      },
      save: async function () {
        this.updatedAt = new Date();
        self.fallbackStore.set(this._id.toString(), this);
        self.saveToDisk();
        return this;
      },
    };
    return doc as IPrepKitDocument;
  }

  async findByUserId(userId: string): Promise<IPrepKitDocument[]> {
    if (!Types.ObjectId.isValid(userId)) return [];
    if (isDbConnected()) {
      return PrepKitModel.find({ user_id: new Types.ObjectId(userId) })
        .sort({ createdAt: -1 })
        .exec();
    }
    const userKits = Array.from(this.fallbackStore.values()).filter(
      (k) => k.user_id.toString() === userId
    );
    return userKits
      .sort((a, b) => (b.createdAt?.getTime?.() || 0) - (a.createdAt?.getTime?.() || 0))
      .map((k) => this.wrapKitDoc(k));
  }

  async findByIdAndUserId(id: string, userId: string): Promise<IPrepKitDocument | null> {
    if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(userId)) return null;
    if (isDbConnected()) {
      return PrepKitModel.findOne({
        _id: new Types.ObjectId(id),
        user_id: new Types.ObjectId(userId),
      }).exec();
    }
    const found = this.fallbackStore.get(id);
    if (found && found.user_id.toString() === userId) {
      return this.wrapKitDoc(found);
    }
    return null;
  }

  async findById(id: string): Promise<IPrepKitDocument | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    if (isDbConnected()) {
      return PrepKitModel.findById(new Types.ObjectId(id)).exec();
    }
    const found = this.fallbackStore.get(id);
    return found ? this.wrapKitDoc(found) : null;
  }

  async create(kitData: Partial<IPrepKitDocument>): Promise<IPrepKitDocument> {
    if (isDbConnected()) {
      const kit = new PrepKitModel(kitData);
      return kit.save();
    }

    const _id = kitData._id || new Types.ObjectId();
    const raw = {
      ...kitData,
      _id: _id.toString(),
      user_id: kitData.user_id ? kitData.user_id.toString() : new Types.ObjectId().toString(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const doc = this.wrapKitDoc(raw);
    this.fallbackStore.set(_id.toString(), doc);
    this.saveToDisk();
    logger.info(`[DevStore] Created kit ${_id.toString()} in resilient fallback store`);
    return doc;
  }

  async update(id: string, userId: string, updateData: Partial<IPrepKitDocument>): Promise<IPrepKitDocument | null> {
    if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(userId)) return null;
    if (isDbConnected()) {
      return PrepKitModel.findOneAndUpdate(
        { _id: new Types.ObjectId(id), user_id: new Types.ObjectId(userId) },
        { $set: updateData },
        { new: true, runValidators: true }
      ).exec();
    }

    const found = this.fallbackStore.get(id);
    if (!found || found.user_id.toString() !== userId) return null;
    const merged = { ...found, ...updateData, updatedAt: new Date() };
    const doc = this.wrapKitDoc(merged);
    this.fallbackStore.set(id, doc);
    this.saveToDisk();
    return doc;
  }

  async delete(id: string, userId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(userId)) return false;
    if (isDbConnected()) {
      const res = await PrepKitModel.deleteOne({
        _id: new Types.ObjectId(id),
        user_id: new Types.ObjectId(userId),
      }).exec();
      return (res.deletedCount ?? 0) > 0;
    }

    const found = this.fallbackStore.get(id);
    if (!found || found.user_id.toString() !== userId) return false;
    this.fallbackStore.delete(id);
    this.saveToDisk();
    return true;
  }
}

export const kitRepository = new KitRepository();
