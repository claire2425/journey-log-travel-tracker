import { ImageResponse } from "next/og";

export const contentType = "image/png";

const iconSizes = {
  "192": { width: 192, height: 192 },
  "512": { width: 512, height: 512 },
} as const;

export function generateImageMetadata() {
  return Object.entries(iconSizes).map(([id, size]) => ({
    id,
    size,
    contentType,
  }));
}

export default async function Icon({ id }: { id: Promise<string> }) {
  const iconId = await id;
  const size = iconSizes[iconId as keyof typeof iconSizes] ?? iconSizes["512"];
  const scale = size.width / 512;

  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#26241f",
          display: "flex",
          height: "100%",
          justifyContent: "center",
          position: "relative",
          width: "100%",
        }}
      >
        <div
          style={{
            alignItems: "center",
            background: "#46603c",
            border: `${24 * scale}px solid #c7d3bc`,
            borderRadius: "50%",
            display: "flex",
            height: 352 * scale,
            justifyContent: "center",
            width: 352 * scale,
          }}
        >
          <div
            style={{
              color: "#ffffff",
              display: "flex",
              fontFamily: "Arial",
              fontSize: 116 * scale,
              fontWeight: 800,
              letterSpacing: -12 * scale,
              marginLeft: -8 * scale,
            }}
          >
            JL
          </div>
        </div>
        <div
          style={{
            background: "#c9a25a",
            border: `${12 * scale}px solid #ffffff`,
            borderRadius: "50%",
            bottom: 86 * scale,
            display: "flex",
            height: 58 * scale,
            position: "absolute",
            right: 86 * scale,
            width: 58 * scale,
          }}
        />
      </div>
    ),
    size,
  );
}
