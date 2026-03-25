import Anthropic from "@anthropic-ai/sdk";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

dotenv.config();
const app = express();
app.use(cors({ origin: ["https://dreamzy-cr4hzozu3-josea12345s-projects.vercel.app", "https://dreamzy.xyz", "https://www.dreamzy.xyz", "http://localhost:5173"] }));

// Raw body for webhook signature verification
app.use("/webhook/lemonsqueezy", express.raw({ type: "application/json" }));
app.use(express.json({ limit: "50mb" }));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const sleep = ms => new Promise(r => setTimeout(r, ms));

app.get("/", (req, res) => res.json({ status: "Dreamzy running" }));

// ── Age-based style guides ────────────────────────────────────────────────────
function getAgeStyle(age) {
  if (age <= 3) return {
    range: "1-3", pages: 5,
    style: `STYLE: Ages 1-3 (Sandra Boynton / Margaret Wise Brown / Eric Carle style)
- Lines: 1-2 SHORT lines per page. Max 6 words each.
- LOTS of repetition — repeat phrases across pages like a refrain
- Sound play: rhymes, silly words, animal sounds, onomatopoeia
- Familiar routines: bedtime, food, bath, animals, sleep
- Every line should have a musical beat you can clap to
- End calm and sleepy — the child IS going to sleep now
- NEVER use complex words or multi-clause sentences`,
  };
  if (age <= 5) return {
    range: "3-5", pages: 6,
    style: `STYLE: Ages 3-5 (Dr. Seuss / Julia Donaldson / Mo Willems style)
- Lines: 2-3 lines per page. Max 8 words each. Playful and rhythmic.
- Use rhyme where natural — AABB or ABAB patterns
- Humor: funny twists, surprising turns, silly dialogue
- Simple emotions: fear → courage, alone → friendship
- Clear arc: problem → funny attempts → solution → happy ending
- Characters have distinct voices — use dialogue`,
  };
  return {
    range: "5-10", pages: 7,
    style: `STYLE: Ages 5-10 (Roald Dahl / Magic Tree House / Frog and Toad style)
- Lines: 3-4 lines per page. Up to 12 words. Varied sentence length.
- Strong narrative arc: setup → rising action → climax → resolution
- Character growth: the hero learns something or changes by the end
- Light conflict: a real problem the child must solve using cleverness
- Humor with wit — jokes kids feel smart for understanding
- The child's INTERESTS are central to solving the problem`,
  };
}

// ── Generate story ────────────────────────────────────────────────────────────
app.post("/generate-story", async (req, res) => {
  const { childName, age, interests, theme, mood } = req.body;
  if (!childName || !interests?.length) return res.status(400).json({ error: "Need child name and interests" });
  const interestList = interests.join(", ");
  const ageNum = parseInt(age) || 5;
  const ageStyle = getAgeStyle(ageNum);
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      system: `You are a master children's book author. Write a personalized bedtime story for a ${ageNum}-year-old child.

${ageStyle.style}

Return ONLY valid JSON:
{
  "title": "Catchy story title featuring ${childName}",
  "ageRange": "${ageStyle.range}",
  "characterDescription": "Brief consistent physical description of ${childName} for illustration consistency",
  "pages": [
    {
      "pageNumber": 1,
      "lines": ["line 1", "line 2"],
      "illustrationPrompt": "Detailed scene description for this page",
      "soundNote": "reading tone"
    }
  ]
}

RULES:
- Generate exactly ${ageStyle.pages} pages
- Use ${childName}'s name at least once per page
- Weave in these interests as CENTRAL to the plot: ${interestList}
- Theme: ${theme || "adventure"}. Mood: ${mood || "magical"}
- Include characterDescription in every illustrationPrompt for visual consistency
- Final page ALWAYS ends with ${childName} falling asleep`,
      messages: [{ role: "user", content: `Story for ${childName}, age ${ageNum}. Interests: ${interestList}. Theme: ${theme}. Mood: ${mood}.` }],
    });
    const text = response.content.map(b => b.text || "").join("");
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON found");
    res.json({ story: JSON.parse(match[0]) });
  } } catch (e) {
    console.error("Full error:", e);
    res.status(500).json({ error: e.message, stack: e.stack });
}
});

// ── Generate image ────────────────────────────────────────────────────────────
async function generateImage(prompt, characterDescription, attempt) {
  if (attempt === undefined) attempt = 0;
  try {
    const response = await axios.post(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=" + process.env.GEMINI_KEY,
      {
        contents: [{ parts: [{ text: prompt + ". Character: " + characterDescription + ". Style: modern cartoon illustration, Pixar and Bluey inspired, bold outlines, bright flat colors, expressive cute characters, warm pastel colors, child-friendly storybook art, no text in image." }] }],
        generationConfig: { responseModalities: ["IMAGE", "TEXT"] }
      },
      { headers: { "Content-Type": "application/json" } }
    );
    const parts = response.data?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find(p => p.inlineData?.mimeType?.startsWith("image/"));
    if (!imagePart) throw new Error("No image in response");
    console.log("    Image ready! size: " + imagePart.inlineData.data.length);
    return "data:" + imagePart.inlineData.mimeType + ";base64," + imagePart.inlineData.data;
  } catch (e) {
    if (e.response?.status === 429 && attempt < 3) {
      console.log("    Rate limited, waiting 10s...");
      await sleep(10000);
      return generateImage(prompt, characterDescription, attempt + 1);
    }
    throw e;
  }
}

// ── Generate voice ────────────────────────────────────────────────────────────
async function generateVoice(text, ageNum) {
  const voiceSettings = ageNum <= 3
    ? { stability: 0.80, similarity_boost: 0.75, style: 0.05, use_speaker_boost: true }
    : ageNum <= 5
    ? { stability: 0.65, similarity_boost: 0.80, style: 0.25, use_speaker_boost: true }
    : { stability: 0.55, similarity_boost: 0.80, style: 0.35, use_speaker_boost: true };
  const r = await axios.post(
    "https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM",
    { text, model_id: "eleven_turbo_v2_5", voice_settings: voiceSettings },
    { headers: { "xi-api-key": process.env.ELEVENLABS_KEY, "Content-Type": "application/json", Accept: "audio/mpeg" }, responseType: "arraybuffer" }
  );
  return "data:audio/mpeg;base64," + Buffer.from(r.data).toString("base64");
}

// ── Generate full story ───────────────────────────────────────────────────────
app.post("/generate-full-story", async (req, res) => {
  const { childName, age, interests, theme, mood } = req.body;
  if (!childName || !interests?.length) return res.status(400).json({ error: "Need child name and interests" });
  const ageNum = parseInt(age) || 5;
  try {
    console.log("Generating story for " + childName + " (age " + ageNum + ")...");
    const scriptRes = await axios.post("http://localhost:3001/generate-story", { childName, age, interests, theme, mood });
    const story = scriptRes.data.story;
    console.log("Got: \"" + story.title + "\" (" + story.ageRange + ") — " + story.pages.length + " pages");

    console.log("Generating illustrations...");
    const imageUrls = await Promise.all(
      story.pages.map(async (page, i) => {
        console.log("  Image " + (i+1) + "/" + story.pages.length + "...");
        try { return await generateImage(page.illustrationPrompt, story.characterDescription); }
        catch (e) { console.error("  Image " + (i+1) + " failed:", e.message); return null; }
      })
    );

    console.log("Generating narration...");
    const audioUrls = await Promise.all(
      story.pages.map(async (page, i) => {
        try {
          const url = await generateVoice(page.lines.join(" "), ageNum);
          console.log("  Voice " + (i+1) + " done");
          return url;
        } catch (e) { console.error("  Voice " + (i+1) + " failed:", e.message); return null; }
      })
    );

    console.log("Story complete!");
    res.json({
      story: {
        title: story.title, childName, age: ageNum, ageRange: story.ageRange,
        createdAt: new Date().toISOString(),
        pages: story.pages.map((p, i) => ({ ...p, imageUrl: imageUrls[i], audioUrl: audioUrls[i] }))
      }
    });
  } catch (e) {
    console.error("Error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Regenerate audio ──────────────────────────────────────────────────────────
app.post("/regenerate-audio", async (req, res) => {
  const { pages, age } = req.body;
  if (!pages?.length) return res.status(400).json({ error: "No pages" });
  const ageNum = parseInt(age) || 5;
  try {
    console.log("Regenerating audio for " + pages.length + " pages...");
    const audioUrls = await Promise.all(
      pages.map(async (page, i) => {
        try {
          const url = await generateVoice(page.lines.join(" "), ageNum);
          console.log("  Voice " + (i+1) + " done");
          return url;
        } catch (e) { console.error("  Voice " + (i+1) + " failed:", e.message); return null; }
      })
    );
    res.json({ audioUrls });
  } catch (e) {
    console.error("Regenerate audio error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Lemon Squeezy webhook ─────────────────────────────────────────────────────
app.post("/webhook/lemonsqueezy", async (req, res) => {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  const signature = req.headers["x-signature"];

  // Verify webhook signature
  const hmac = crypto.createHmac("sha256", secret);
  const digest = hmac.update(req.body).digest("hex");
  if (signature !== digest) {
    console.error("Invalid webhook signature");
    return res.status(401).json({ error: "Invalid signature" });
  }

  const payload = JSON.parse(req.body.toString());
  const eventName = payload.meta?.event_name;
  const customerEmail = payload.data?.attributes?.user_email;
  const status = payload.data?.attributes?.status;

  console.log("Webhook received:", eventName, customerEmail);

  if (!customerEmail) return res.status(200).json({ received: true });

  try {
    if (eventName === "subscription_created" || (eventName === "subscription_updated" && status === "active")) {
      // Activate subscription
      const { error } = await supabase
        .from("profiles")
        .update({ subscription_status: "paid", lemon_squeezy_customer_id: payload.data?.attributes?.customer_id?.toString() })
        .eq("email", customerEmail);
      if (error) console.error("Supabase update error:", error);
      else console.log("Activated subscription for:", customerEmail);
    }

    if (eventName === "subscription_cancelled" || (eventName === "subscription_updated" && status === "cancelled")) {
      // Deactivate subscription
      const { error } = await supabase
        .from("profiles")
        .update({ subscription_status: "free" })
        .eq("email", customerEmail);
      if (error) console.error("Supabase update error:", error);
      else console.log("Cancelled subscription for:", customerEmail);
    }
  } catch (e) {
    console.error("Webhook processing error:", e.message);
  }

  res.status(200).json({ received: true });
});

// ── Get checkout URLs ─────────────────────────────────────────────────────────
app.get("/checkout-urls", (req, res) => {
  res.json({
    monthly: process.env.LEMONSQUEEZY_MONTHLY_URL,
    yearly: process.env.LEMONSQUEEZY_YEARLY_URL,
  });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => console.log("Dreamzy backend running on port " + PORT));