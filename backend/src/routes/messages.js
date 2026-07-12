import { Router } from 'express';
import { messageController } from '../controllers/messageController.js';
import { validateBody } from '../middleware/validate.js';
import { MESSAGE_BODY_SCHEMA } from '../models/Message.js';

const router = Router();

router.get('/', messageController.list);
router.post('/', validateBody(MESSAGE_BODY_SCHEMA), messageController.create);

export { router as messageRoutes };
