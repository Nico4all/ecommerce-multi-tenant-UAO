/** Datos mock para el panel de administración (solo diseño). */

export type OrderStatus =
  | "pendiente"
  | "pagado"
  | "empacando"
  | "enviado"
  | "en_camino"
  | "entregado"
  | "cancelado";

/** Pasos del flujo de preparación/envío (para el stepper del admin). */
export const fulfillmentSteps: { key: OrderStatus; label: string }[] = [
  { key: "pagado", label: "Pagado" },
  { key: "empacando", label: "Empacando" },
  { key: "enviado", label: "Enviado" },
  { key: "en_camino", label: "En camino" },
  { key: "entregado", label: "Entregado" },
];

export type PaymentStatus =
  | "completado"
  | "pendiente"
  | "reembolsado"
  | "fallido";

export interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: Address;
  orders: number;
  totalSpent: number;
  joinedAt: string; // ISO
  status: "activo" | "inactivo";
}

export interface OrderLine {
  slug: string;
  qty: number;
}

export interface Order {
  id: string;
  code: string;
  userId: string;
  userName: string;
  date: string; // ISO
  status: OrderStatus;
  items: number;
  total: number;
  method: string;
  lines: OrderLine[];
  /** Rastreo del envío (lo fija el admin). */
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
}

export interface Payment {
  id: string;
  orderCode: string;
  userName: string;
  method: "Tarjeta" | "PayPal" | "Transferencia" | "Efecty" | "PSE";
  amount: number;
  status: PaymentStatus;
  date: string; // ISO
}

export const adminUsers: AdminUser[] = [
  {
    id: "u1",
    name: "María González",
    email: "maria.gonzalez@email.com",
    phone: "+57 301 234 5678",
    address: { street: "Carrera 15 #93-47, Apto 402", city: "Bogotá", state: "Bogotá D.C.", zip: "110221", country: "Colombia" },
    orders: 12,
    totalSpent: 10369557.5,
    joinedAt: "2024-03-14",
    status: "activo",
  },
  {
    id: "u2",
    name: "Carlos Ramírez",
    email: "carlos.ramirez@email.com",
    phone: "+57 310 876 5432",
    address: { street: "Calle 10 #43-12", city: "Medellín", state: "Antioquia", zip: "050021", country: "Colombia" },
    orders: 5,
    totalSpent: 3437850,
    joinedAt: "2024-07-02",
    status: "activo",
  },
  {
    id: "u3",
    name: "Ana Torres",
    email: "ana.torres@email.com",
    phone: "+57 315 223 3445",
    address: { street: "Avenida 6N #23-50", city: "Cali", state: "Valle del Cauca", zip: "760045", country: "Colombia" },
    orders: 23,
    totalSpent: 22026911.25,
    joinedAt: "2023-11-20",
    status: "activo",
  },
  {
    id: "u4",
    name: "Jorge Méndez",
    email: "jorge.mendez@email.com",
    phone: "+57 300 998 7766",
    address: { street: "Calle 72 #41-30", city: "Barranquilla", state: "Atlántico", zip: "080020", country: "Colombia" },
    orders: 2,
    totalSpent: 670800,
    joinedAt: "2025-01-08",
    status: "inactivo",
  },
  {
    id: "u5",
    name: "Lucía Fernández",
    email: "lucia.fernandez@email.com",
    phone: "+57 320 445 6677",
    address: { street: "Carrera 4 #38-15, Getsemaní", city: "Cartagena", state: "Bolívar", zip: "130001", country: "Colombia" },
    orders: 8,
    totalSpent: 5996414.5,
    joinedAt: "2024-09-19",
    status: "activo",
  },
  {
    id: "u6",
    name: "Diego Herrera",
    email: "diego.herrera@email.com",
    phone: "+57 317 112 3344",
    address: { street: "Calle 36 #27-15", city: "Bucaramanga", state: "Santander", zip: "680003", country: "Colombia" },
    orders: 1,
    totalSpent: 193285,
    joinedAt: "2025-05-30",
    status: "activo",
  },
];

export const orders: Order[] = [
  {
    id: "o1", code: "VLP-10241", userId: "u3", userName: "Ana Torres", date: "2026-07-11",
    status: "enviado", items: 2, total: 1808096.25, method: "Tarjeta",
    lines: [
      { slug: "samsung-smart-tv-crystal-uhd", qty: 1 },
      { slug: "sandisk-ssd-2tb-extreme", qty: 1 },
    ],
    carrier: "Servientrega", trackingNumber: "SER2938471CO",
    trackingUrl: "https://www.servientrega.com/wps/portal/rastreo-envio?guia=SER2938471CO",
  },
  {
    id: "o2", code: "VLP-10240", userId: "u1", userName: "María González", date: "2026-07-11",
    status: "empacando", items: 1, total: 5912285, method: "PayPal",
    lines: [{ slug: "apple-iphone-16-pro-max", qty: 1 }],
  },
  {
    id: "o3", code: "VLP-10239", userId: "u5", userName: "Lucía Fernández", date: "2026-07-10",
    status: "entregado", items: 2, total: 290250, method: "Tarjeta",
    lines: [
      { slug: "anua-heartleaf-cleansing-oil", qty: 2 },
      { slug: "dual-set-foundation-polvo", qty: 1 },
    ],
    carrier: "Coordinadora", trackingNumber: "COO774120CO",
    trackingUrl: "https://www.coordinadora.com/rastreo-de-envios/?guia=COO774120CO",
  },
  {
    id: "o4", code: "VLP-10238", userId: "u2", userName: "Carlos Ramírez", date: "2026-07-10",
    status: "pendiente", items: 3, total: 748307.5, method: "Efecty",
    lines: [
      { slug: "himalaya-purehands-gel-2x1", qty: 4 },
      { slug: "cafe-organico-molido-1kg", qty: 2 },
    ],
  },
  {
    id: "o5", code: "VLP-10237", userId: "u4", userName: "Jorge Méndez", date: "2026-07-09",
    status: "cancelado", items: 1, total: 408500, method: "Transferencia",
    lines: [{ slug: "nike-invincible-3-premium", qty: 1 }],
  },
  {
    id: "o6", code: "VLP-10236", userId: "u3", userName: "Ana Torres", date: "2026-07-09",
    status: "entregado", items: 1, total: 2726200, method: "Tarjeta",
    lines: [{ slug: "samsung-smart-tv-crystal-uhd", qty: 1 }],
    carrier: "Interrapidísimo", trackingNumber: "INT551204CO",
    trackingUrl: "https://www.interrapidisimo.com/sigue-tu-envio/?guia=INT551204CO",
  },
  {
    id: "o7", code: "VLP-10235", userId: "u6", userName: "Diego Herrera", date: "2026-07-08",
    status: "en_camino", items: 1, total: 193285, method: "PSE",
    lines: [{ slug: "bloques-construccion-1000pz", qty: 1 }],
    carrier: "Servientrega", trackingNumber: "SER1180022CO",
    trackingUrl: "https://www.servientrega.com/wps/portal/rastreo-envio?guia=SER1180022CO",
  },
];

export const payments: Payment[] = [
  { id: "pay1", orderCode: "VLP-10241", userName: "Ana Torres", method: "Tarjeta", amount: 1808096.25, status: "completado", date: "2026-07-11" },
  { id: "pay2", orderCode: "VLP-10240", userName: "María González", method: "PayPal", amount: 5912285, status: "completado", date: "2026-07-11" },
  { id: "pay3", orderCode: "VLP-10239", userName: "Lucía Fernández", method: "Tarjeta", amount: 290250, status: "completado", date: "2026-07-10" },
  { id: "pay4", orderCode: "VLP-10238", userName: "Carlos Ramírez", method: "Efecty", amount: 748307.5, status: "pendiente", date: "2026-07-10" },
  { id: "pay5", orderCode: "VLP-10237", userName: "Jorge Méndez", method: "Transferencia", amount: 408500, status: "reembolsado", date: "2026-07-09" },
  { id: "pay6", orderCode: "VLP-10234", userName: "María González", method: "Tarjeta", amount: 137600, status: "fallido", date: "2026-07-08" },
  { id: "pay7", orderCode: "VLP-10236", userName: "Ana Torres", method: "Tarjeta", amount: 2726200, status: "completado", date: "2026-07-09" },
];

export const kpis = {
  revenue: 104539611.25,
  revenueDelta: 12.4,
  orders: 1284,
  ordersDelta: 8.1,
  customers: 3492,
  customersDelta: 5.3,
  avgOrder: 406436,
  avgOrderDelta: -2.2,
};

/** Serie de ventas por día (últimos 12 puntos) para el mini-gráfico. */
export const salesSeries = [
  32, 41, 38, 52, 49, 64, 58, 71, 66, 79, 74, 88,
];

export type DiscountType = "porcentaje" | "fijo" | "envio" | "tarjeta";
export type DiscountStatus = "activo" | "programado" | "expirado";

export interface DiscountCode {
  id: string;
  code: string;
  type: DiscountType;
  value: number; // % o monto según type
  used: number;
  limit: number | null; // null = ilimitado
  status: DiscountStatus;
  expires: string; // ISO o "—"
}

export const discountCodes: DiscountCode[] = [
  { id: "d1", code: "BIENVENIDO10", type: "porcentaje", value: 10, used: 342, limit: 1000, status: "activo", expires: "2026-12-31" },
  { id: "d2", code: "ENVIOGRATIS", type: "envio", value: 0, used: 1280, limit: null, status: "activo", expires: "—" },
  { id: "d3", code: "VERANO200", type: "fijo", value: 43000, used: 89, limit: 500, status: "activo", expires: "2026-08-31" },
  { id: "d4", code: "TARJETA500", type: "tarjeta", value: 108000, used: 12, limit: 50, status: "activo", expires: "2027-01-15" },
  { id: "d5", code: "DIASINIVA25", type: "porcentaje", value: 25, used: 0, limit: 2000, status: "programado", expires: "2026-11-13" },
  { id: "d6", code: "REGRESO15", type: "porcentaje", value: 15, used: 640, limit: 640, status: "expirado", expires: "2026-03-01" },
];
