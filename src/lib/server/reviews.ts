import "server-only";
import { prisma } from "@/lib/prisma";
import { ApiError } from "./api-helpers";
import { getSession, requireUser } from "./auth";
import { notifyReviewCreated } from "./notifications";

/**
 * Reseñas: solo pueden calificar quienes COMPRARON el producto (existe un
 * OrderItem suyo en una orden no cancelada). Una reseña por usuario y
 * producto; volver a enviar la actualiza. El rating del producto es una
 * cache derivada que se recalcula en cada envío.
 */

export interface ReviewEligibility {
  canReview: boolean;
  reason: "not-logged" | "not-purchased" | null;
  myReview: { rating: number; body: string } | null;
}

async function hasPurchased(userId: string, productId: string) {
  const item = await prisma.orderItem.findFirst({
    where: {
      productId,
      order: { userId, status: { not: "CANCELLED" } },
    },
    select: { id: true },
  });
  return item !== null;
}

export async function getReviewEligibility(
  productId: string,
): Promise<ReviewEligibility> {
  const session = await getSession();
  if (!session) {
    return { canReview: false, reason: "not-logged", myReview: null };
  }

  const [purchased, existing] = await Promise.all([
    hasPurchased(session.id, productId),
    prisma.review.findUnique({
      where: { productId_userId: { productId, userId: session.id } },
      select: { rating: true, body: true },
    }),
  ]);

  if (!purchased) {
    return { canReview: false, reason: "not-purchased", myReview: null };
  }
  return { canReview: true, reason: null, myReview: existing };
}

export async function submitReview(
  slug: string,
  input: { rating: number; body: string },
): Promise<{ rating: number; body: string }> {
  const user = await requireUser();

  const product = await prisma.product.findUnique({
    where: { slug },
    select: { id: true, name: true },
  });
  if (!product) throw new ApiError(404, "Producto no encontrado");

  if (!(await hasPurchased(user.id, product.id))) {
    throw new ApiError(
      403,
      "Solo quienes compraron este producto pueden reseñarlo",
    );
  }

  // Se consulta antes del upsert para saber si es una reseña nueva o una
  // edición de la propia: editar no es noticia para el panel.
  const existing = await prisma.review.findUnique({
    where: { productId_userId: { productId: product.id, userId: user.id } },
    select: { id: true },
  });

  const review = await prisma.review.upsert({
    where: {
      productId_userId: { productId: product.id, userId: user.id },
    },
    update: { rating: input.rating, body: input.body },
    create: {
      productId: product.id,
      userId: user.id,
      rating: input.rating,
      body: input.body,
    },
  });

  // Recalcular la cache de rating del producto.
  const agg = await prisma.review.aggregate({
    where: { productId: product.id },
    _avg: { rating: true },
    _count: true,
  });
  await prisma.product.update({
    where: { id: product.id },
    data: {
      ratingAvg: Math.round((agg._avg.rating ?? 0) * 10) / 10,
      reviewCount: agg._count,
    },
  });

  if (!existing) {
    await notifyReviewCreated({
      productId: product.id,
      productName: product.name,
      rating: review.rating,
      userName: user.name,
    });
  }

  return { rating: review.rating, body: review.body };
}
