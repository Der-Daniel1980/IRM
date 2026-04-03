import { Injectable, Logger } from '@nestjs/common';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private readonly basePath: string;

  constructor() {
    this.basePath = process.env.UPLOAD_STORAGE_PATH ?? './uploads/photos';
    this.ensureDirectory(this.basePath);
  }

  ensureWorkOrderDirectory(workOrderId: string): string {
    const dir = join(this.basePath, workOrderId);
    this.ensureDirectory(dir);
    return dir;
  }

  getFilePath(workOrderId: string, fileName: string): string {
    return join(this.basePath, workOrderId, fileName);
  }

  getStoragePath(workOrderId: string, fileName: string): string {
    return join(workOrderId, fileName);
  }

  deleteFile(storagePath: string): boolean {
    const fullPath = join(this.basePath, storagePath);
    try {
      if (existsSync(fullPath)) {
        unlinkSync(fullPath);
        return true;
      }
    } catch (error) {
      this.logger.error(`Fehler beim Löschen: ${fullPath}`, error);
    }
    return false;
  }

  getAbsolutePath(storagePath: string): string {
    return join(this.basePath, storagePath);
  }

  private ensureDirectory(dir: string): void {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}
