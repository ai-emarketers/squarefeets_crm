// Small helpers for the on-disk upload folder.
import { promises as fs } from 'fs';
import * as path from 'path';

// Absolute path of the folder uploads are stored in (UPLOAD_DIR env var, default ./uploads).
export const uploadRoot = () => path.resolve(process.env.UPLOAD_DIR || './uploads');
// Delete a stored file given its path relative to the upload folder (used when a document is removed).
export async function removeFile(rel: string) {
  if (!rel) return;
  const abs = path.resolve(uploadRoot(), rel);
  if (!abs.startsWith(uploadRoot())) return; // never touch anything outside the upload dir
  try { await fs.unlink(abs); } catch { /* already gone */ }
}
