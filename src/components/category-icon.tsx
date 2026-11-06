import {
  Smartphone,
  Shirt,
  Gem,
  Sofa,
  Sparkles,
  ShoppingBasket,
  Dumbbell,
  ToyBrick,
  Laptop,
  Headphones,
  Watch,
  Camera,
  Tv,
  Gamepad2,
  BookOpen,
  Baby,
  Car,
  Bike,
  Utensils,
  Coffee,
  Apple,
  Pill,
  HeartPulse,
  PawPrint,
  Flower2,
  Hammer,
  Palette,
  Gift,
  Music,
  Footprints,
  Package,
  type LucideProps,
} from "lucide-react";

const map: Record<string, React.ComponentType<LucideProps>> = {
  smartphone: Smartphone,
  shirt: Shirt,
  gem: Gem,
  sofa: Sofa,
  sparkles: Sparkles,
  "shopping-basket": ShoppingBasket,
  dumbbell: Dumbbell,
  "toy-brick": ToyBrick,
  laptop: Laptop,
  headphones: Headphones,
  watch: Watch,
  camera: Camera,
  tv: Tv,
  "gamepad-2": Gamepad2,
  "book-open": BookOpen,
  baby: Baby,
  car: Car,
  bike: Bike,
  utensils: Utensils,
  coffee: Coffee,
  apple: Apple,
  pill: Pill,
  "heart-pulse": HeartPulse,
  "paw-print": PawPrint,
  "flower-2": Flower2,
  hammer: Hammer,
  palette: Palette,
  gift: Gift,
  music: Music,
  footprints: Footprints,
  package: Package,
};

/** Iconos disponibles en el selector del admin (en este orden). */
export const CATEGORY_ICON_OPTIONS = Object.keys(map);

export function CategoryIcon({
  name,
  ...props
}: { name: string } & LucideProps) {
  const Icon = map[name] ?? Package;
  return <Icon {...props} />;
}
