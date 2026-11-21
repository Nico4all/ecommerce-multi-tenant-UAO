"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Building2, Plus, ExternalLink, Loader2, ShieldCheck, LogOut, RefreshCw } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import type { PlatformStore } from "@/lib/server/platform-stores";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Stores = { stores: PlatformStore[]; total: number };
const message = (error: unknown) => error instanceof ApiClientError ? error.message : "No se pudo completar la operación";
const control = "h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function PlatformStoresManager({ initial }: { initial: Stores }) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [ownerMode, setOwnerMode] = useState("new");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmations, setConfirmations] = useState<Record<string, boolean>>({});

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget, values = new FormData(form);
    setPending("create"); setError(null); setNotice(null);
    try {
      const store = await api.post<PlatformStore>("/api/platform/stores", {
        name: values.get("name"), slug: values.get("slug"), origin: values.get("origin"),
        tagline: values.get("tagline"), city: values.get("city"), contactEmail: values.get("contactEmail"),
        ownerMode, ownerEmail: values.get("ownerEmail"),
        ...(ownerMode === "new" ? { ownerName: values.get("ownerName"), ownerPassword: values.get("ownerPassword") } : {}),
        domainVerified: values.has("domainVerified"), active: values.has("active"),
      });
      setData(current => ({ stores: [store, ...current.stores].slice(0, 100), total: current.total + 1 }));
      form.reset(); setOwnerMode("new");
      setNotice(store.active ? `${store.name} ya está activo.` : `${store.name} fue creado. Confirma su dominio para activarlo.`);
    } catch (error) { setError(message(error)); }
    finally { setPending(null); }
  }

  async function activate(store: PlatformStore) {
    setPending(store.id); setError(null); setNotice(null);
    try {
      const updated = await api.post<PlatformStore>(`/api/platform/stores/${store.id}/activate`, { domainId: store.domains[0].id, confirmDomain: true });
      setData(current => ({ ...current, stores: current.stores.map(item => item.id === store.id ? updated : item) }));
      setNotice(`${store.name} está activo y su dominio fue confirmado.`);
    } catch (error) { setError(message(error)); }
    finally { setPending(null); }
  }

  async function refresh() {
    setPending("refresh"); setError(null);
    try { setData(await api.get<Stores>("/api/platform/stores")); }
    catch (error) { setError(message(error)); }
    finally { setPending(null); }
  }

  async function logout() {
    setPending("logout"); setError(null);
    try { await api.post("/api/auth/logout"); router.push("/login"); router.refresh(); }
    catch (error) { setError(message(error)); setPending(null); }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="mb-1 text-xs font-bold uppercase tracking-widest text-primary">Administrador global</p><h1 className="font-heading text-3xl font-bold tracking-tight">Comercios</h1><p className="mt-2 text-sm text-muted-foreground">Registra comercios, asigna sus propietarios y abre sus paneles.</p></div>
        <Button variant="outline" className="h-11 gap-2" disabled={!!pending} onClick={logout}><LogOut aria-hidden className="size-4" />Cerrar sesión</Button>
      </div>
      {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">{notice}</p>}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
        <section aria-labelledby="new-store" className="min-w-0 rounded-xl border border-border bg-card p-5 sm:p-6">
          <h2 id="new-store" className="mb-5 flex items-center gap-2 font-heading text-xl font-bold"><Plus aria-hidden className="size-5 text-primary" />Nuevo comercio</h2>
          <form onSubmit={create} className="space-y-4">
            <div className="space-y-1.5"><Label htmlFor="store-name">Nombre del comercio</Label><Input id="store-name" name="name" required minLength={2} maxLength={160} className="h-11" /></div>
            <div className="space-y-1.5"><Label htmlFor="store-slug">Identificador</Label><Input id="store-slug" name="slug" required minLength={2} maxLength={120} pattern="[a-z0-9]+(-[a-z0-9]+)*" className="h-11" aria-describedby="slug-help" /><p id="slug-help" className="text-xs text-muted-foreground">Usa letras minúsculas, números y guiones.</p></div>
            <div className="space-y-1.5"><Label htmlFor="store-origin">URL de la tienda</Label><Input id="store-origin" name="origin" type="url" required maxLength={2048} className="h-11" aria-describedby="origin-help" /><p id="origin-help" className="text-xs text-muted-foreground">Indica la URL completa del dominio autorizado para este comercio.</p></div>
            <div className="space-y-1.5"><Label htmlFor="store-tagline">Lema <span className="text-muted-foreground">(opcional)</span></Label><Input id="store-tagline" name="tagline" maxLength={160} className="h-11" /></div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="store-city">Ciudad</Label><Input id="store-city" name="city" maxLength={120} className="h-11" /></div>
              <div className="space-y-1.5"><Label htmlFor="store-contact">Correo de contacto</Label><Input id="store-contact" name="contactEmail" type="email" className="h-11" /></div>
            </div>
            <fieldset className="space-y-4 rounded-lg border border-border p-4">
              <legend className="px-1 text-sm font-semibold">Propietario del comercio</legend>
              <div className="space-y-1.5"><Label htmlFor="owner-mode">Cuenta del propietario</Label><select id="owner-mode" value={ownerMode} onChange={event => setOwnerMode(event.target.value)} className={control}><option value="new">Crear una cuenta nueva</option><option value="existing">Vincular una cuenta existente</option></select></div>
              <div className="space-y-1.5"><Label htmlFor="owner-email">Correo del propietario</Label><Input id="owner-email" name="ownerEmail" type="email" required autoComplete="off" className="h-11" /></div>
              {ownerMode === "new" ? <>
                <div className="space-y-1.5"><Label htmlFor="owner-name">Nombre del propietario</Label><Input id="owner-name" name="ownerName" required minLength={2} maxLength={160} autoComplete="off" className="h-11" /></div>
                <div className="space-y-1.5"><Label htmlFor="owner-password">Contraseña inicial</Label><Input id="owner-password" name="ownerPassword" type="password" required minLength={8} maxLength={128} autoComplete="new-password" className="h-11" /></div>
              </> : <p className="text-xs text-muted-foreground">La cuenta conservará su perfil y contraseña. Obtendrá permisos de propietario solo en este comercio.</p>}
            </fieldset>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 text-sm"><input type="checkbox" name="domainVerified" className="mt-0.5 size-4 shrink-0 accent-primary" /><span>Confirmo que tengo autorización y ya verifiqué el dominio de este comercio.</span></label>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 text-sm"><input type="checkbox" name="active" className="mt-0.5 size-4 shrink-0 accent-primary" /><span>Activar el comercio ahora. Requiere dominio verificado.</span></label>
            <Button type="submit" className="h-11 w-full gap-2" disabled={!!pending}>{pending === "create" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Plus aria-hidden className="size-4" />}Crear comercio</Button>
          </form>
        </section>
        <section aria-labelledby="stores-list" className="min-w-0 space-y-4">
          <div className="flex items-center justify-between gap-3"><h2 id="stores-list" className="font-heading text-xl font-bold">Comercios registrados <span className="text-muted-foreground">({data.total})</span></h2><Button variant="ghost" size="icon" aria-label="Actualizar comercios" disabled={!!pending} onClick={refresh}><RefreshCw aria-hidden className={cn("size-4", pending === "refresh" && "animate-spin")} /></Button></div>
          {data.total > data.stores.length && <p className="text-sm text-muted-foreground">Se muestran los {data.stores.length} comercios más recientes.</p>}
          {!data.stores.length && <p className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">Todavía no hay comercios registrados.</p>}
          {data.stores.map(store => <article key={store.id} className="min-w-0 rounded-xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Building2 aria-hidden className="size-5" /></span><div className="min-w-0"><h3 className="break-words font-heading text-lg font-bold">{store.name}</h3><p className="break-all text-xs text-muted-foreground">{store.slug}</p></div></div><span className={cn("shrink-0 rounded-full px-2 py-1 text-xs font-semibold", store.active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>{store.active ? "Activo" : "Pendiente"}</span></div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div className="min-w-0"><dt className="text-xs text-muted-foreground">Dominio</dt><dd className="break-all">{store.domains[0]?.hostname ?? "Sin dominio"}</dd></div><div className="min-w-0"><dt className="text-xs text-muted-foreground">Propietario / administrador</dt><dd className="break-all">{store.owner?.email ?? "Sin asignar"}</dd></div></dl>
            <p className="mt-3 text-xs text-muted-foreground">{store.products} productos · {store.orders} pedidos</p>
            {store.active && store.origin && <a href={`${store.origin}/admin`} className={cn(buttonVariants({ variant: "outline" }), "mt-4 h-11 gap-2")}><ExternalLink aria-hidden className="size-4" />Abrir panel del comercio</a>}
            {!store.active && !!store.domains.length && store.owner && <div className="mt-4 space-y-3 border-t border-border pt-4"><label className="flex cursor-pointer items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-primary" checked={!!confirmations[store.id]} onChange={event => setConfirmations(current => ({ ...current, [store.id]: event.target.checked }))} /><span>Confirmo que verifiqué el dominio y autorizo la activación.</span></label><Button className="h-11 gap-2" disabled={!!pending || !confirmations[store.id]} onClick={() => activate(store)}>{pending === store.id ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <ShieldCheck aria-hidden className="size-4" />}Verificar y activar</Button></div>}
          </article>)}
        </section>
      </div>
    </div>
  );
}
