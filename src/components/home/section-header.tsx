import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function SectionHeader({
  title,
  href = "#",
  /** La sección tiene fondo de color: el texto va en blanco. */
  onDark = false,
}: {
  title: string;
  href?: string;
  onDark?: boolean;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <h2
        className={cn(
          "font-heading text-xl font-bold tracking-tight sm:text-2xl",
          onDark && "text-white drop-shadow-sm",
        )}
      >
        {title}
      </h2>
      <Link
        href={href}
        className={cn(
          "flex shrink-0 items-center gap-0.5 text-sm font-medium hover:underline",
          onDark ? "text-white/90" : "text-primary",
        )}
      >
        Ver todo
        <ChevronRight className="size-4" />
      </Link>
    </div>
  );
}
