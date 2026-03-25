import Anthropic from "@anthropic-ai/sdk";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors({ origin: ["https://dreamzy-cr4hzozu3-josea12345s-projects.vercel.app", "https://dreamzy.xyz", "https://www.dreamzy.xyz", "http://localhost:5173"] }));
app.use("/webhook/lemonsqueezy", express.raw({ type: "application/json" }));
app.use(express.json({ limit: "50mb" }));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const sleep = ms => new Promise(r => setTimeout(r, ms));

app.get("/", (req, res) => res.json({ status: "Dreamzy running" }));

const STYLE_PROMPTS = {
  cartoon: "STYLE: bold cartoon illustration. Thick black outlines. Bright saturated flat colors. Pixar and Bluey inspired. Large expressive eyes. Simplified shapes. NO photorealism. NO watercolor. NO sketchy lines.",
  watercolor: "STYLE: traditional watercolor painting. Soft wet washes of color. Visible brushstrokes and paper texture. Colors bleed into each other. Gentle pastel palette. Dreamy soft edges. NO sharp outlines. NO digital look. NO cartoon style.",
  whimsical: "STYLE: whimsical storybook illustration. Magical glowing light. Soft dreamy colors. Fairytale aesthetic. Sparkles and magical elements. Soft rounded shapes. Like a modern fairy tale book. NO realistic lighting. NO harsh lines.",
  vintage: "STYLE: vintage 1950s children's book illustration. Aged paper texture. Muted warm earth tones. Classic retro printing style. Slightly faded colors. Hatching and cross-hatching. Like old Golden Books. NO bright saturated colors. NO modern digital style.",
  line: "STYLE: clean line art illustration. Bold crisp black outlines on white. Minimal flat color fills. Graphic and simple. Like a high-quality coloring book. Strong negative space. NO gradients. NO shading. NO watercolor. NO textures.",
  realistic: "STYLE: detailed realistic illustration. Painterly realistic style. Accurate proportions. Rich textures and lighting. Like a professional picture book with realistic art. Detailed backgrounds. NO cartoon exaggeration. NO flat colors.",
  abstract: "STYLE: abstract Dr. Seuss inspired illustration. Wild exaggerated shapes. Impossible colors and forms. Surreal and imaginative. Wobbly lines. Unconventional compositions. NO realistic proportions. NO normal perspective. Very stylized.",
  moody: "STYLE: moody cinematic illustration. Dramatic chiaroscuro lighting. Deep shadows. Rich jewel tone colors. Dark atmospheric backgrounds with bright focal points. Painterly. Emotional. Like a dark fairy tale. NO bright cheerful colors. NO flat style.",
  wimmelbuch: "STYLE: wimmelbuch busy scene illustration. Packed with tiny detailed characters and objects everywhere. Top-down or isometric view. Every corner filled with activity. Like Where's Waldo. Bright colors. Lots of humor and hidden details. NO simple compositions.",
};

function getAgeStyle(age) {
  if (age <= 3) return {
    range: "1-3", pages: 5,
    style: `STYLE: Ages 1-3 (Sandra Boynton / Margaret Wise Brown / Eric Carle style)
- Lines: 1-2 SHORT lines per page. Max 6 words each.
- LOTS of repetition — repeat phrases across pages like a refrain
- Sound play: rhymes, silly words, animal sounds, onomatopoeia
- Familiar routines: bedtime, food, bath, animals, sleep
- Every line should have a musical beat you can clap to
- End with a warm cozy feeling — a hug, a smile, the adventure complete
- NEVER use complex words or multi-clause sentences
- NEVER end with sleeping, yawning, or bedtime words`,
  };
  if (age <= 5) return {
    range: "3-5", pages: 6,
    style: `STYLE: Ages 3-5 (Dr. Seuss / Julia Donaldson / Mo Willems style)
- Lines: 2-3 lines per page. Max 8 words each. Playful and rhythmic.
- Use rhyme where natural — AABB or ABAB patterns
- Humor: funny twists, surprising turns, silly dialogue
- Simple emotions: fear becomes courage, alone becomes friendship
- Clear arc: problem → funny attempts → solution → happy ending
- Characters have distinct voices — use dialogue
- NEVER end with sleeping, yawning, or bedtime words`,
  };
  return {
    range: "5-10", pages: 7,
    style: `STYLE: Ages 5-10 (Roald Dahl / Magic Tree House / Frog and Toad style)
- Lines: 3-4 lines per page. Up to 12 words. Varied sentence length.
- Strong narrative arc: setup → rising action → climax → resolution
- Character growth: the hero learns something or changes by the end
- Light conflict: a real problem the child must solve using cleverness
- Humor with wit — jokes kids feel smart for understanding
- The child's INTERESTS are central to solving the problem
- NEVER end with sleeping, yawning, or bedtime words — end with triumph or warmth`,
  };
}

async function generateStoryWithRetry(childName, age, interests, theme, mood, previousStory, attempt) {
  if (attempt === undefined) attempt = 0;
  try {
    return await generateStory(childName, age, interests, theme, mood, previousStory);
  } catch (e) {
    if ((e.status === 529 || e.status === 529 || (e.message && e.message.includes("overloaded"))) && attempt < 3) {
      console.log("Anthropic overloaded, retrying in " + (10 + attempt * 10) + "s (attempt " + (attempt+1) + ")...");
      await sleep((10 + attempt * 10) * 1000);
      return generateStoryWithRetry(childName, age, interests, theme, mood, previousStory, attempt + 1);
    }
    throw e;
  }
}

async function generateStory(childName, age, interests, theme, mood, previousStory) {
  const interestList = interests.join(", ");
  const ageNum = parseInt(age) || 5;
  const ageStyle = getAgeStyle(ageNum);

  const continuationContext = previousStory ? `
IMPORTANT — THIS IS A CONTINUATION (Episode ${(previousStory.episode || 1) + 1}):
Previous story title: "${previousStory.title}"
What happened before: ${previousStory.story_summary || "An adventure with " + childName}
Characters established: ${JSON.stringify(previousStory.characters || {})}

Rules for continuation:
- Reference what happened in the previous episode naturally
- Bring back the same supporting characters (friends, creatures, magical objects)
- The world and setting should feel consistent and familiar
- Start with a callback to the previous story ("The next morning..." / "One week later...")
- End with a hint that another adventure is coming (builds anticipation for episode ${(previousStory.episode || 1) + 2})
- This is episode ${(previousStory.episode || 1) + 1} in ${childName}'s ongoing adventures
` : "";

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    system: `You are a master children's book author. Write a personalized cozy evening story for a ${ageNum}-year-old child. This is a story to be read before bed but it should NOT end with the child sleeping — it ends with a warm, happy, satisfied feeling like the end of a great adventure.
${ageStyle.style}
${continuationContext}
BANNED WORDS on final page: sleep, sleeping, bed, bedtime, tired, yawn, yawning, dream, dreaming, night-night, snooze, drowsy, eyes closed, drifted off. Use NONE of these.

Return ONLY valid JSON:
{
  "title": "Catchy episode title featuring ${childName}",
  "ageRange": "${ageStyle.range}",
  "characterDescription": "Brief consistent physical description of ${childName} for illustration consistency",
  "storySummary": "2-3 sentence summary of what happened in this story — used for future episode context",
  "characters": {
    "protagonist": "${childName} description",
    "supporting": ["character name and brief description", "another character"]
  },
  "pages": [{"pageNumber":1,"lines":["line 1","line 2"],"illustrationPrompt":"Detailed scene description","soundNote":"reading tone"}]
}
RULES:
- Generate exactly ${ageStyle.pages} pages
- Use ${childName}'s name at least once per page
- Weave in these interests as CENTRAL to the plot: ${interestList}
- Theme: ${theme || "adventure"}. Mood: ${mood || "magical"}
- Include characterDescription in every illustrationPrompt for visual consistency
- Final page: The story ends. Do not mention sleep, bed, dreams, yawning, or tiredness.
- storySummary MUST capture key events and characters for future episodes`,
    messages: [{ role: "user", content: `Story for ${childName}, age ${ageNum}. Interests: ${interestList}. Theme: ${theme}. Mood: ${mood}.` }],
  });

  const text = response.content.map(b => b.text || "").join("");
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON found");
  return JSON.parse(match[0]);
}

async function generateImage(prompt, characterDescription, style, attempt) {
  if (attempt === undefined) attempt = 0;
  const stylePrompt = STYLE_PROMPTS[style] || STYLE_PROMPTS.cartoon;
  try {
    const fullPrompt = stylePrompt + " Scene: " + prompt + ". Character appearance: " + characterDescription + ". Child-friendly. No text or words in the image.";
    const response = await axios.post(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=" + process.env.GEMINI_KEY,
      {
        contents: [{ parts: [{ text: fullPrompt }] }],
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
      return generateImage(prompt, characterDescription, style, attempt + 1);
    }
    throw e;
  }
}

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

app.post("/generate-full-story", async (req, res) => {
  const { childName, age, interests, theme, mood, previousStory, illustrationStyle } = req.body;
  const imgStyle = illustrationStyle || "cartoon";
  console.log("Using illustration style:", imgStyle);
  if (!childName || !interests?.length) return res.status(400).json({ error: "Need child name and interests" });
  const ageNum = parseInt(age) || 5;
  try {
    const isContinuation = !!previousStory;
    console.log("Generating story for " + childName + " (age " + ageNum + ")" + (isContinuation ? " — Episode " + ((previousStory.episode || 1) + 1) : "") + "...");

    const storyData = await generateStoryWithRetry(childName, age, interests, theme, mood, previousStory || null);
    console.log("Got: \"" + storyData.title + "\" (" + storyData.ageRange + ") — " + storyData.pages.length + " pages");

    console.log("Generating illustrations...");
    const imageUrls = await Promise.all(
      storyData.pages.map(async (page, i) => {
        console.log("  Image " + (i+1) + "/" + storyData.pages.length + "...");
        try { return await generateImage(page.illustrationPrompt, storyData.characterDescription, imgStyle); }
        catch (e) { console.error("  Image " + (i+1) + " failed:", e.message); return null; }
      })
    );

    console.log("Generating narration...");
    const audioUrls = await Promise.all(
      storyData.pages.map(async (page, i) => {
        try {
          const url = await generateVoice(page.lines.join(" "), ageNum);
          console.log("  Voice " + (i+1) + " done");
          return url;
        } catch (e) { console.error("  Voice " + (i+1) + " failed:", e.message); return null; }
      })
    );

    const seriesId = previousStory?.series_id || (childName.toLowerCase().replace(/\s+/g, "-") + "-" + Date.now());
    const episode = previousStory ? (previousStory.episode || 1) + 1 : 1;

    console.log("Story complete! Series: " + seriesId + " Episode: " + episode);
    res.json({
      story: {
        title: storyData.title,
        childName,
        age: ageNum,
        ageRange: storyData.ageRange,
        createdAt: new Date().toISOString(),
        seriesId,
        episode,
        storySummary: storyData.storySummary,
        characters: storyData.characters,
        pages: storyData.pages.map((p, i) => ({ ...p, imageUrl: imageUrls[i], audioUrl: audioUrls[i] }))
      }
    });
  } catch (e) {
    console.error("Error:", e.message, e.stack);
    res.status(500).json({ error: e.message || "Unknown error" });
  }
});

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

app.post("/webhook/lemonsqueezy", async (req, res) => {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  const signature = req.headers["x-signature"];
  const hmac = crypto.createHmac("sha256", secret);
  const digest = hmac.update(req.body).digest("hex");
  if (signature !== digest) return res.status(401).json({ error: "Invalid signature" });
  const payload = JSON.parse(req.body.toString());
  const eventName = payload.meta?.event_name;
  const customerEmail = payload.data?.attributes?.user_email;
  const status = payload.data?.attributes?.status;
  console.log("Webhook received:", eventName, customerEmail);
  if (!customerEmail) return res.status(200).json({ received: true });
  try {
    if (eventName === "subscription_created" || (eventName === "subscription_updated" && status === "active")) {
      await supabase.from("profiles").update({ subscription_status: "paid", lemon_squeezy_customer_id: payload.data?.attributes?.customer_id?.toString() }).eq("email", customerEmail);
      console.log("Activated subscription for:", customerEmail);
    }
    if (eventName === "subscription_cancelled" || (eventName === "subscription_updated" && status === "cancelled")) {
      await supabase.from("profiles").update({ subscription_status: "free" }).eq("email", customerEmail);
      console.log("Cancelled subscription for:", customerEmail);
    }
  } catch (e) { console.error("Webhook error:", e.message); }
  res.status(200).json({ received: true });
});

app.get("/checkout-urls", (req, res) => {
  res.json({
    monthly: process.env.LEMONSQUEEZY_MONTHLY_URL,
    yearly: process.env.LEMONSQUEEZY_YEARLY_URL,
  });
});

app.listen(PORT, "0.0.0.0", () => console.log("Dreamzy backend running on http://localhost:" + PORT));