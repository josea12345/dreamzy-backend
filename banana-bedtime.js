// banana-bedtime.js — generate 5 character-consistent bedtime-fear illustrations
// for the Script 4 TikTok. Uses Gemini 2.5 Flash Image (Nano Banana).
//
// Usage:
//   cd /home/user/dreamzy-backend
//   GEMINI_KEY=your_key_here node banana-bedtime.js
//
// Outputs 5 PNGs to ./banana-out/ — ready to upload into Kling.

import fs from "node:fs";
import path from "node:path";
import { setGlobalDispatcher, ProxyAgent } from "undici";

// Route fetch through the sandbox proxy (curl uses it automatically; node fetch does not).
// Harmless no-op on local machines where https_proxy isn't set.
const proxy = process.env.https_proxy || process.env.HTTPS_PROXY;
if (proxy) setGlobalDispatcher(new ProxyAgent(proxy));

// Nano Banana 2 — gemini-3.1-flash-image-preview (current model as of 2026)
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent";

// ── Locked character — same kid across all 5 images ───────────────────────
const CHARACTER =
  "A small 4-year-old girl named Mia with shoulder-length wavy brown hair, " +
  "big hazel eyes, light skin with rosy cheeks, wearing soft pink pajamas with " +
  "tiny white star print. Cute, expressive, round-faced. Same exact character " +
  "on every page — copy face, hair, skin, pajamas exactly.";

const STYLE =
  "2D children's storybook illustration, thick clean black outlines, saturated " +
  "colors, soft cel-shading, Pixar-meets-Bluey aesthetic, warm color palette, " +
  "gentle brushwork. Same art style on every page.";

const OUTPUT_DIR = path.resolve("./banana-out");

// ── 5 scenes (match the Kling prompts in order) ──────────────────────────
const SCENES = [
  {
    id: 1,
    name: "hook-scared",
    prompt:
      "Mia tucked in bed in a dim bedroom at night, covers pulled up to her chin, " +
      "wide frightened eyes looking at the corner of the room. A scary shadow " +
      "stretches across the wall. Eerie blue-purple moonlight through the window. " +
      "Her face shows worry and fear. Full scene, clear focus on Mia. No text.",
  },
  {
    id: 2,
    name: "parent-doorway",
    prompt:
      "Mia's bedroom at night. In the background, a parent silhouette stands " +
      "in the doorway with soft warm hall light spilling in. Mia sits up in " +
      "bed hugging her knees, still looking unconvinced toward the dark corner. " +
      "Mia's face shows doubt, not comfort. No text, no signs.",
  },
  {
    id: 3,
    name: "discovery-sparkle",
    prompt:
      "Close-up on Mia's face in the same dim bedroom. Her expression is shifting " +
      "from fear to curiosity — mouth slightly open, eyes widening. A small " +
      "glowing golden sparkle floats in the air near her, casting a warm light " +
      "on her cheek. Her eyes reflect the sparkle. No text.",
  },
  {
    id: 4,
    name: "transformation-magic",
    prompt:
      "Mia's bedroom full of magic. The scary shadows on the walls have dissolved " +
      "into shimmering golden and silver sparkles drifting through the air like " +
      "fireflies. Mia sits up in bed, mouth open in wonder, hands reaching " +
      "upward toward the sparkles. Warm magical golden light fills the room. " +
      "Expression: pure delight and awe. No text.",
  },
  {
    id: 5,
    name: "payoff-peaceful",
    prompt:
      "Mia in bed with a peaceful contented smile, reaching her hand toward a " +
      "small glowing nightlight on her bedside table — she is about to turn it " +
      "off herself. Room is softly lit by lingering drifting sparkles. Her " +
      "pillow is fluffy, blanket tucked. Expression: calm, brave, happy. No text.",
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────
function fail(msg) {
  console.error("❌", msg);
  process.exit(1);
}

if (!process.env.GEMINI_KEY) fail("GEMINI_KEY env var missing");

async function gemini(parts) {
  const res = await fetch(`${GEMINI_URL}?key=${process.env.GEMINI_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
    }),
  });
  if (!res.ok) {
    const bodyText = await res.text();
    throw new Error(`HTTP ${res.status}: ${bodyText.slice(0, 500)}`);
  }
  const data = await res.json();
  const responseParts = data?.candidates?.[0]?.content?.parts || [];
  const imagePart = responseParts.find((p) =>
    p.inlineData?.mimeType?.startsWith("image/")
  );
  if (!imagePart) throw new Error("no image in Gemini response");
  return {
    mimeType: imagePart.inlineData.mimeType,
    base64: imagePart.inlineData.data,
  };
}

function savePng(imgData, filePath) {
  fs.writeFileSync(filePath, Buffer.from(imgData.base64, "base64"));
  console.log(`✓ ${filePath}`);
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Generate scene 1 fresh (anchors the character + style for all the rest)
  const scene1 = SCENES[0];
  console.log(`\n[1/5] ${scene1.name} — anchor generation`);
  const anchor = await gemini([
    {
      text: [
        STYLE,
        "CHILDREN'S BOOK ILLUSTRATION — full scene.",
        `CHARACTER LOCK: ${CHARACTER}`,
        `SCENE: ${scene1.prompt}`,
      ].join("\n\n"),
    },
  ]);
  savePng(anchor, path.join(OUTPUT_DIR, `p${scene1.id}-${scene1.name}.png`));

  // Generate scenes 2-5 using scene 1 as a reference image for character
  // consistency (this is the same technique we shipped in PR #1 for Dreamzy's
  // backend character-lock feature).
  for (let i = 1; i < SCENES.length; i++) {
    const scene = SCENES[i];
    console.log(`\n[${i + 1}/5] ${scene.name}`);
    const img = await gemini([
      {
        inline_data: { mime_type: anchor.mimeType, data: anchor.base64 },
      },
      {
        text: [
          "REFERENCE IMAGE ATTACHED: same character (Mia) as the attached image.",
          "Copy her face, hair, skin, pajamas EXACTLY from the attached image.",
          "Same art style, same color palette, same line weight.",
          "NEW SCENE — fresh composition, different pose, different angle, " +
            "different background. Do NOT copy the pose or composition of the " +
            "reference.",
          STYLE,
          `SCENE: ${scene.prompt}`,
        ].join("\n\n"),
      },
    ]);
    savePng(img, path.join(OUTPUT_DIR, `p${scene.id}-${scene.name}.png`));
  }

  console.log("\n✓ All 5 images saved to", OUTPUT_DIR);
  console.log(
    "  Upload each to Kling image-to-video with the matching prompt from chat."
  );
}

main().catch((err) => {
  console.error("fatal:", err.message);
  if (err.response?.data) console.error(err.response.data);
  process.exit(1);
});
