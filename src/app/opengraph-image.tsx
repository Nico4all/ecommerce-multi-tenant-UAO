import { getStoreSeo } from "@/lib/seo";
import { ImageResponse } from "next/og";

export const alt = "Tienda online en Colombia";
export const dynamic = "force-dynamic";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const site = await getStoreSeo();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "72px 88px",
          color: "#173326",
          background: "linear-gradient(135deg, #fffdf6 0%, #e8f7ee 100%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 92,
              height: 92,
              borderRadius: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, #079447, #005d2b)",
              color: "white",
              fontSize: 54,
              fontWeight: 800,
            }}
          >
            {site.name.split(" ").filter(word => !["los", "del", "de"].includes(word.toLowerCase())).map(word => word[0]).join("").slice(0, 3)}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 72, fontWeight: 800, letterSpacing: -3 }}>
              {site.name}
            </div>
            <div style={{ marginTop: 12, fontSize: 34, color: "#3f6b56" }}>
              {site.description}
            </div>
          </div>
        </div>
        <div
          style={{
            marginTop: 74,
            display: "flex",
            alignItems: "center",
            gap: 18,
            fontSize: 28,
            color: "#fff",
            background: "#ff6b00",
            borderRadius: 999,
            padding: "16px 30px",
            alignSelf: "flex-start",
          }}
        >
          Tienda online en Colombia
        </div>
      </div>
    ),
    { ...size, headers: { "Cache-Control": "private, no-store", Vary: "Host" } },
  );
}
