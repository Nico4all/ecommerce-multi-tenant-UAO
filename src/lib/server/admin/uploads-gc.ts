import "server-only";
import { prisma, getStoreContext } from "@/lib/prisma";
import { requireAdmin } from "../auth";
import {
  listUploads,
  deleteUpload,
  keyFromPublicUrl,
  uploadKeyBelongsToStore,
} from "../storage";

/**
 * Limpieza de imágenes huérfanas.
 *
 * Las imágenes viven en `uploads/`, pero al reemplazar la foto de un producto,
 * borrar un banner, etc., el archivo viejo se queda en disco (ver storage.ts).
 * En vez de intentar borrar en cada mutación —donde una misma ruta podría estar
 * usada en dos sitios y provocar carreras— hacemos un barrido por conteo de
 * referencias: se juntan TODAS las URLs que la BD referencia, y todo archivo en
 * disco que ninguna referencia es un huérfano seguro de borrar.
 *
 * Las URLs referenciadas viven en cuatro columnas:
 *   ProductImage.url · Category.imageUrl · Banner.imageUrl · HomeSection.bgImageUrl
 */

export interface SweepReport {
  /** `true` = solo se reportó, no se borró nada. */
  dryRun: boolean;
  /** Archivos totales en uploads/. */
  scanned: number;
  /** Archivos en disco que sí referencia la BD. */
  referenced: number;
  /** Archivos huérfanos encontrados. */
  orphans: number;
  /** Huérfanos efectivamente borrados (0 en dry-run). */
  deleted: number;
  /** Bytes liberados (o que se liberarían en dry-run). */
  bytes: number;
  /** Keys de los huérfanos (hasta 100, para inspección). */
  sample: string[];
}

/** Junta las keys de todas las imágenes que la BD referencia hoy. */
async function referencedKeys(): Promise<Set<string>> {
  const { id: storeId } = await getStoreContext();
  const [images, categories, banners, sections] = await Promise.all([
    prisma.productImage.findMany({ where: { storeId }, select: { url: true } }),
    prisma.category.findMany({
      where: { storeId, imageUrl: { not: null } },
      select: { imageUrl: true },
    }),
    prisma.banner.findMany({
      where: { storeId, imageUrl: { not: null } },
      select: { imageUrl: true },
    }),
    prisma.homeSection.findMany({
      where: { storeId, bgImageUrl: { not: null } },
      select: { bgImageUrl: true },
    }),
  ]);

  const keys = new Set<string>();
  const add = (url: string | null) => {
    if (!url) return;
    const key = keyFromPublicUrl(url);
    if (key && uploadKeyBelongsToStore(key, storeId)) keys.add(key);
  };

  for (const i of images) add(i.url);
  for (const c of categories) add(c.imageUrl);
  for (const b of banners) add(b.imageUrl);
  for (const s of sections) add(s.bgImageUrl);
  return keys;
}

/**
 * Recorre uploads/, detecta huérfanos y (salvo dry-run) los borra.
 * Solo admin: es una operación destructiva sobre archivos.
 */
export async function sweepUploads(
  { dryRun = false }: { dryRun?: boolean } = {},
): Promise<SweepReport> {
  await requireAdmin();

  const [files, referenced] = await Promise.all([
    listUploads(),
    referencedKeys(),
  ]);

  const orphans = files.filter((f) => !referenced.has(f.key));

  let deleted = 0;
  let bytes = 0;
  for (const o of orphans) {
    if (dryRun) {
      bytes += o.size;
      continue;
    }
    if (await deleteUpload(o.key)) {
      deleted += 1;
      bytes += o.size;
    }
  }

  return {
    dryRun,
    scanned: files.length,
    referenced: files.length - orphans.length,
    orphans: orphans.length,
    deleted,
    bytes,
    sample: orphans.slice(0, 100).map((o) => o.key),
  };
}
