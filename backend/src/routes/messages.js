import { Router } from 'express';
import { messageController } from '../controllers/messageController.js';
import { validateBody } from '../middleware/validate.js';

const MESSAGE_BODY_SCHEMA = {
  username: {
    required: true,
    type: 'string',
    trim: true,
    minLength: 1,
    maxLength: 50,
  },
  content: {
    required: true,
    type: 'string',
    trim: true,
    minLength: 1,
    maxLength: 1000,
  },
};

const router = Router();

router.get('/', messageController.list);
router.post('/', validateBody(MESSAGE_BODY_SCHEMA), messageController.create);

export { router as messageRoutes };
