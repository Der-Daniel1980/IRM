import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { BadRequestException } from '@nestjs/common';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export const photoMulterOptions = {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, process.env.UPLOAD_STORAGE_PATH ?? './uploads/photos');
    },
    filename: (_req, file, cb) => {
      const ext = extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `${uuidv4()}${ext}`);
    },
  }),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 5,
  },
  fileFilter: (
    _req: any,
    file: Express.Multer.File,
    cb: (error: Error | null, accept: boolean) => void,
  ) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(
        new BadRequestException(
          `Dateityp ${file.mimetype} nicht erlaubt. Erlaubt: ${ALLOWED_MIME_TYPES.join(', ')}`,
        ),
        false,
      );
      return;
    }
    cb(null, true);
  },
};
