import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IUserDocument extends Document {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUserDocument>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, any>) => {
        delete ret.passwordHash;
        delete ret.__v;
        ret.id = ret._id ? ret._id.toString() : ret.id;
        delete ret._id;
        return ret;
      },
    },
  }
);

export const UserModel = mongoose.model<IUserDocument>('User', UserSchema);
