import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#0f172a",
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
            background: "#0f766e",
            border: "8px solid #99f6e4",
            borderRadius: "50%",
            display: "flex",
            height: 124,
            justifyContent: "center",
            width: 124,
          }}
        >
          <div
            style={{
              color: "#ffffff",
              display: "flex",
              fontFamily: "Arial",
              fontSize: 42,
              fontWeight: 800,
              letterSpacing: -4,
              marginLeft: -3,
            }}
          >
            JL
          </div>
        </div>
        <div
          style={{
            background: "#fbbf24",
            border: "4px solid #ffffff",
            borderRadius: "50%",
            bottom: 30,
            display: "flex",
            height: 22,
            position: "absolute",
            right: 30,
            width: 22,
          }}
        />
      </div>
    ),
    size,
  );
}
