"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Star, Loader2, PencilLine } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { api, ApiClientError } from "@/lib/api-client";
import type { ReviewEligibility } from "@/lib/server/reviews";

export function ReviewForm({
  slug,
  eligibility,
}: {
  slug: string;
  eligibility: ReviewEligibility;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [rating, setRating] = React.useState(eligibility.myReview?.rating ?? 0);
  const [hovered, setHovered] = React.useState(0);
  const [body, setBody] = React.useState(eligibility.myReview?.body ?? "");
  const [sending, setSending] = React.useState(false);
  const isEdit = eligibility.myReview !== null;

  if (eligibility.reason === "not-logged") {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        <Link
          href={`/login?next=${encodeURIComponent(pathname)}`}
          className="font-semibold text-primary hover:underline"
        >
          Inicia sesión
        </Link>{" "}
        para calificar este producto después de comprarlo.
      </div>
    );
  }

  if (eligibility.reason === "not-purchased") {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        Solo quienes compraron este producto pueden reseñarlo. ¡Anímate a
        probarlo y cuéntanos qué tal!
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      toast.error("Elige de 1 a 5 estrellas");
      return;
    }
    setSending(true);
    try {
      await api.post(`/api/products/${slug}/reviews`, { rating, body });
      toast.success(isEdit ? "Reseña actualizada" : "¡Gracias por tu reseña!");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof ApiClientError ? err.message : "No se pudo enviar la reseña",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="rounded-lg border border-border bg-card p-4"
    >
      <h3 className="flex items-center gap-2 font-heading text-sm font-semibold">
        <PencilLine className="size-4 text-primary" />
        {isEdit ? "Edita tu reseña" : "Califica este producto"}
      </h3>

      {/* Estrellas */}
      <div
        className="mt-3 flex items-center gap-1"
        role="radiogroup"
        aria-label="Calificación"
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} estrella${n > 1 ? "s" : ""}`}
            onClick={() => setRating(n)}
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(0)}
            className="rounded-sm p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Star
              aria-hidden
              className={cn(
                "size-7 transition-colors",
                n <= (hovered || rating)
                  ? "fill-deal-ink text-deal-ink"
                  : "fill-muted text-muted-foreground/60",
              )}
            />
          </button>
        ))}
        {rating > 0 && (
          <span className="ml-2 text-sm text-muted-foreground tabular-nums">
            {rating}/5
          </span>
        )}
      </div>

      <div className="mt-3 space-y-1.5">
        <Label htmlFor="review-body">Tu opinión</Label>
        <Textarea
          id="review-body"
          rows={3}
          required
          minLength={10}
          maxLength={1000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="¿Qué te pareció el producto? ¿Cumplió lo que esperabas?"
        />
      </div>

      <Button type="submit" disabled={sending} className="mt-3 gap-1.5">
        {sending && <Loader2 className="size-4 animate-spin" />}
        {isEdit ? "Actualizar reseña" : "Publicar reseña"}
      </Button>
    </form>
  );
}
