import { Router } from 'express';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import { validateBody } from '../middleware/validate.js';
import {
  CreateAssignmentSchema,
  createAssignment,
  getAssignment,
  getByJobId,
  listAssignments,
  regenerate,
} from '../controllers/assignments.controller.js';

const router = Router();

// File upload (PDF / TXT). We extract text on the server so the AI gets
// real source material rather than a raw file blob.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (['application/pdf', 'text/plain'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only PDF and TXT files are allowed'));
  },
});

router.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    let text = '';
    if (req.file.mimetype === 'application/pdf') {
      const parsed = await pdfParse(req.file.buffer);
      text = parsed.text;
    } else {
      text = req.file.buffer.toString('utf8');
    }
    res.json({
      filename: req.file.originalname,
      size: req.file.size,
      chars: text.length,
      text: text.slice(0, 50_000),
    });
  } catch (e) { next(e); }
});

router.post('/', validateBody(CreateAssignmentSchema), createAssignment);
router.get('/', listAssignments);
router.get('/by-job/:jobId', getByJobId);
router.get('/:id', getAssignment);
router.post('/:id/regenerate', regenerate);

export default router;
