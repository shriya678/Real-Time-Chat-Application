import mongoose from 'mongoose';

const MAX_USERNAME_LENGTH = 50;
const MAX_CONTENT_LENGTH = 1000;

const readReceiptSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true },
    readAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false },
);

const messageSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'username is required'],
      trim: true,
      minlength: 1,
      maxlength: MAX_USERNAME_LENGTH,
    },
    content: {
      type: String,
      required: [true, 'content is required'],
      trim: true,
      minlength: 1,
      maxlength: MAX_CONTENT_LENGTH,
    },
    deliveredAt: {
      type: Date,
      default: () => new Date(),
    },
    readBy: {
      type: [readReceiptSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        return ret;
      },
    },
  },
);

messageSchema.index({ createdAt: -1 });

export const Message = mongoose.model('Message', messageSchema);
