import fs from "node:fs";
import path from "node:path";

import { ImageResponse } from "next/og";

/**
 * The app icon, drawn at build time from the holy card in `public/`.
 *
 * It exists for a practical reason as much as a devotional one: a manifest
 * with no icon is not installable, so Chrome never fires the event that opens
 * the real install dialog. Without this file the install button has nothing
 * native to call.
 */
export const size = { width: 512, height: 512 };
export const contentType = "image/png";
export const runtime = "nodejs";

export default function Icon() {
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
        {/* Taller than it is wide, so it is sized by height and the sides
            fall away rather than squashing the figure. */}
        <img src={source} height={512} alt="" />
      </div>
    ),
    size,
  );
}
