import { notFound } from "next/navigation";
import { getCategories } from "@/lib/queries";
import { getHomeSection } from "@/lib/server/admin/home-sections";
import { HomeSectionForm } from "@/components/admin/home-section-form";

export default async function EditHomeSectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [section, categories] = await Promise.all([
    getHomeSection(id),
    getCategories(),
  ]);
  if (!section) notFound();

  return <HomeSectionForm section={section} categories={categories} />;
}
