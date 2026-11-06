"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { api, ApiClientError } from "@/lib/api-client";

/** Botón de favoritos (toggle real contra /api/wishlist). */
export function WishlistHeart({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [active, setActive] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { added } = await api.post<{ added: boolean }>("/api/wishlist", {
        productId,
      });
      setActive(added);
      toast.success(added ? "Agregado a favoritos" : "Quitado de favoritos");
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 401) {
        toast.info("Inicia sesión para guardar favoritos");
        router.push(`/login?next=${encodeURIComponent(pathname)}`);
      } else {
        toast.error("No se pudo actualizar favoritos");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`${active ? "Quitar" : "Agregar"} ${productName} ${active ? "de" : "a"} favoritos`}
      className="absolute right-4 top-4 z-10 grid size-8 place-items-center rounded-full bg-background/80 text-muted-foreground backdrop-blur transition-colors hover:text-deal focus-visible:outline-2 focus-visible:outline-ring"
    >
      <Heart className={cn("size-4", active && "fill-deal text-deal")} />
    </button>
  );
}
