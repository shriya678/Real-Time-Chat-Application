import * as messageService from '../services/messageService.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const messageController = {
  create: asyncHandler(async (req, res) => {
    const { username, content } = req.body;
    const message = await messageService.createMessage({ username, content });
    res.status(201).json({ success: true, data: message });
  }),

  list: asyncHandler(async (req, res) => {
    const { limit, before } = req.query;
    const result = await messageService.listMessages({ limit, before });
    res.status(200).json({ success: true, data: result });
  }),
};
