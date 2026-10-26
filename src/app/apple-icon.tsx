import fs from "node:fs";
import path from "node:path";

import { ImageResponse } from "next/og";

/**
 * iOS ignores the manifest icons and reads this one. It also draws no
 * background of its own, so the padding and the dark field are part of the
 * image rather than something the system adds.
 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";
export const runtime = "nodejs";

export default function AppleIcon() {
  const file = path.join(process.cwd(), "public", "saint-tarcisius.png");
  const source = `data:image/png;base64,${fs.readFileSync(file).toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
        }}
      >
        <img src={source} height={160} alt="" />
      </div>
    ),
    size,
  );
}
