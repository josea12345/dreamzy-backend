import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";
const resend = new Resend(process.env.RESEND_API_KEY);
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

app.get("/", (req, res) => res.json({ status: "Dreamzy running", version: "endings-v3" }));

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

function getAgeStyle(age, pageCountOverride) {
  if (age <= 3) return {
    range: "1-3", pages: pageCountOverride || 5,
    style: `STYLE: Ages 1-3. Draw from these masters: Eric Carle, Sandra Boynton, Margaret Wise Brown, Rod Campbell, Julia Donaldson, Bill Martin Jr., Mo Willems (simple toddler style), Mem Fox.

WHAT MAKES GREAT TODDLER BOOKS — use ALL of these:
- REPETITION is everything: repeat key phrases across pages like a musical refrain ("Brown bear, brown bear, what do you see?"). Toddlers love hearing the same thing again.
- RHYTHM & SOUND: every line should have a beat you can clap to. Use rhyme, alliteration, animal sounds, silly words, onomatopoeia (moo, splat, whoosh, boom).
- ULTRA SHORT lines: 1-2 lines per page MAXIMUM. 4-6 words each. No complex sentences. No clauses.
- SIMPLE vocabulary: only words a 2-year-old knows. No metaphors. Concrete, tangible things.
- FAMILIAR worlds: animals, food, bath time, bedtime routine, family, toys, colors, counting.
- INTERACTIVE feel: write as if the child can respond — ask simple questions ("Can you moo like a cow?"), invite participation.
- BRIGHT clear moments: each page = one clear image. One animal. One action. One color.
- WARM ending: a hug, a laugh, a satisfying return home. Simple joy. Not sleep — accomplishment.
- EMOTIONAL simplicity: happy, surprised, silly, cozy. No complex feelings.
- MODEL LINES to inspire you: "Moo maa la la la!" / "Goodnight moon, goodnight cow jumping over the moon" / "I see a red bird! Do you?" / "The caterpillar ate ONE apple. But he was still hungry." / "Barnyard dance! Stomp your feet!"`,
  };
  if (age <= 4) return {
    range: "3-4", pages: pageCountOverride || 5,
    style: `STYLE: Ages 3-4. Draw from these masters: Dr. Seuss, Julia Donaldson (Gruffalo), Mo Willems (Elephant & Piggie), Karma Wilson (Bear Snores On), Mem Fox.

WHAT MAKES GREAT BOOKS FOR 3-4 YEAR OLDS — use ALL of these:
- RHYME & RHYTHM: AABB or ABAB schemes. Every page flows musically when read aloud. Clap-able beats.
- REPETITION WITH VARIATION: a repeated phrase that changes slightly for comic or dramatic effect each time.
- HUMOR: silly logic, unexpected turns, characters who get things hilariously wrong.
- SIMPLE EMOTIONS made BIG: fear → courage. Alone → friendship. One clear emotional journey per story.
- DIALOGUE: characters talk to each other. Give them distinct voices. Speech makes it come alive.
- CLEAR ARC: problem → 2 funny attempts → clever solution → warm triumphant ending.
- SHORT lines: 2-3 lines per page. Max 8 words per line.
- CHILD AS HERO: the child-character solves the problem themselves — not adults.
- COZY TONE: warm, safe, rhythmic. Like Karma Wilson — the world is gentle and funny.
- MODEL LINES: "Bear snores on." / "I do not like them, Sam-I-Am!" / "He wasn't scared. Not even a little bit. (He was very scared.)"`,
  };
  if (age <= 5) return {
    range: "4-5", pages: pageCountOverride || 6,
    style: `STYLE: Ages 4-5. Draw from these masters: Mo Willems (Don't Let the Pigeon!), Julia Donaldson, Dav Pilkey, Oliver Jeffers, Adam Rubin (Dragons Love Tacos), Robert Munsch.

WHAT MAKES GREAT BOOKS FOR 4-5 YEAR OLDS — use ALL of these:
- ACTUAL PLOT: beginning → clear problem → escalating attempts → surprising resolution. Kids this age can follow a full story arc.
- HUMOR & CHAOS: big silly energy. Characters who overreact. Absurd situations. Dav Pilkey chaos. Things going hilariously wrong.
- INTERACTIVE VOICE: speak directly to the reader. "Don't turn the page!" / "You won't believe what happened next." / "Can you help?" Break the fourth wall.
- RECOGNIZABLE CHARACTERS: give the character a strong personality — greedy, dramatic, brave, clumsy. Characters matter as much as plot now.
- DIALOGUE-DRIVEN: most of the storytelling happens through speech. Short punchy exchanges. Funny misunderstandings.
- PARTICIPATION: write moments where kids want to shout back at the story, warn the character, or join in.
- 2-3 lines per page. Up to 10 words per line. Varied rhythm — some short punchy, some longer.
- SERIES FEEL: hint that this character will have MORE adventures. Leave them wanting more.
- MODEL LINES: "The pigeon REALLY wants to drive the bus." / "Oh no. Oh no no no." / "That is the funniest thing I have EVER seen." / "To be continued... (just kidding. Or am I?)"`,
  };
  return {
    range: "5-10", pages: pageCountOverride || 7,
    style: `STYLE: Ages 5-10. Draw from these masters: Roald Dahl, Mary Pope Osborne (Magic Tree House), Arnold Lobel (Frog & Toad), Beverly Cleary, Jeff Kinney (tone), Kate DiCamillo.

WHAT MAKES GREAT EARLY READER BOOKS — use ALL of these:
- STRONG NARRATIVE ARC: clear setup → rising tension → climax → satisfying resolution. Every page moves the plot forward.
- CHARACTER GROWTH: the hero must change, learn, or overcome something real by the end. Growth feels EARNED.
- REAL CONFLICT: a genuine problem the child must solve using cleverness, courage, or kindness — not luck.
- WIT & HUMOR: jokes kids feel SMART for understanding. Irony, wordplay, characters who are funny because they're flawed.
- VARIED sentences: short punchy lines mixed with longer descriptive ones. 3-5 lines per page, up to 14 words.
- VIVID details: specific sensory details that paint a picture. Not "a big tree" — "a tree so tall its top was hidden in clouds."
- FRIENDSHIP & STAKES: the hero should care about someone else. What they risk losing matters.
- THE CHILD'S INTERESTS drive the plot — interests are not decoration, they ARE the adventure.
- DIALOGUE that reveals character — how people talk tells us who they are.
- MODEL LINES: "James had never seen such a thing in all his life." / "Frog and Toad were friends." / "The Magic Tree House began to spin." / "Something amazing was about to happen."`,
  };
}

async function generateStoryWithRetry(childName, age, interests, theme, mood, previousStory, options, attempt) {
  if (attempt === undefined) attempt = 0;
  try {
    return await generateStory(childName, age, interests, theme, mood, previousStory, options);
  } catch (e) {
    if ((e.status === 529 || e.status === 529 || (e.message && e.message.includes("overloaded"))) && attempt < 3) {
      console.log("Anthropic overloaded, retrying in " + (10 + attempt * 10) + "s (attempt " + (attempt+1) + ")...");
      await sleep((10 + attempt * 10) * 1000);
      return generateStoryWithRetry(childName, age, interests, theme, mood, previousStory, options, attempt + 1);
    }
    throw e;
  }
}

async function generateStory(childName, age, interests, theme, mood, previousStory, options) {
  const interestList = interests.join(", ");
  const ageNum = parseInt(age) || 5;
  const ageStyle = getAgeStyle(ageNum, options?.pageCount);

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
Return ONLY valid JSON:
{
  "title": "Catchy episode title featuring ${childName}",
  "ageRange": "${ageStyle.range}",
  "characterDescription": "Detailed locked character description for ${childName}: hair color and style, eye color, skin tone, clothing colors, any distinctive features. Be VERY specific so every illustration looks like the same child. Example: young girl with curly red hair, green eyes, light brown skin, wearing a yellow raincoat and purple boots",
  "storySummary": "2-3 sentence summary of what happened in this story — used for future episode context",
  "characters": {
    "protagonist": "${childName} description",
    "supporting": ["character name and brief description", "another character"]
  },
  "pages": [{"pageNumber":1,"lines":["line 1","line 2"],"illustrationPrompt":"Detailed scene description","soundNote":"reading tone"}]
}
RULES:
- Generate exactly ${ageStyle.pages} pages
- Use ${childName}'s name naturally — not on every single line, just when it feels right
- INTERESTS (${interestList}): use ${interests.length === 1 ? "this interest as the HEART of the story — build the entire world around it" : "these interests — pick 1-2 as the main focus and let others appear naturally if they fit. DO NOT force all of them in. A story about dogs and space is fine. A story that mentions dogs, space, pizza, and robots on every page is not."}
- Theme: ${theme || "adventure"}. Mood: ${mood || "magical"}${lesson ? `\n- LESSON: Weave "${lesson}" into the story organically — through what happens, not through characters saying it out loud.` : ""}
- NATURAL LANGUAGE ONLY: Write like a real children's book author, not an AI. Avoid: "suddenly", "magical adventure", "filled with wonder", "with a smile", "exclaimed", "incredible". Use simple direct language. Show don't tell.
- EVERY sentence must sound natural when read aloud to a child. If it sounds like a school essay, rewrite it.
- CRITICAL: Every illustrationPrompt MUST start with the exact characterDescription verbatim, then describe the scene.
- Use the SAME character appearance in EVERY page — same hair, clothes, features.
- storySummary MUST capture key events and characters for future episodes.
- FINAL PAGE: End with a warm, earned emotional moment. Vary the style — a hug, a laugh, heading home satisfied, quiet wonder, a promise of tomorrow. NOT sleep unless it feels completely natural.`,
    messages: [{ role: "user", content: `Story for ${childName}, age ${ageNum}. Interests: ${interestList}. Theme: ${theme}. Mood: ${mood}.` }],
  });

  const text = response.content.map(b => b.text || "").join("");
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON found");
  return JSON.parse(match[0]);
}



// Regenerate final page with a better ending
function improveEnding(finalPage, childName) {
  const endings = [
    [`${childName} laughs and cheers — what an adventure!`, `"Let's do it again!" ${childName} says with a grin.`],
    [`The sun paints the sky gold and pink.`, `${childName} smiles — today was absolutely perfect.`],
    [`${childName} hugs their new friend so tight.`, `Some days are pure magic. This was one.`],
    [`"Best adventure EVER!" ${childName} grins wide.`, `Tomorrow holds even more wonders to find.`],
    [`${childName} looks up at the first twinkling star.`, `Heart full and happy, the world feels wonderful.`],
    [`Hand in hand, they skip toward home.`, `${childName} cannot wait to come back.`],
    [`A big warm hug ends the perfect day.`, `${childName} smiles from ear to ear.`],
    [`"We did it!" ${childName} shouts with joy.`, `The whole world heard — and cheered along.`],
    [`${childName} takes a deep breath of evening air.`, `Everything feels just right in the whole wide world.`],
    [`The adventure is done, the story complete.`, `${childName} knows: the best is yet to come.`],
    [`Stars begin to appear, one by one.`, `${childName} whispers: "What a day. What a day."`],
    [`${childName} turns and waves one last goodbye.`, `Until next time, brave adventurer. Until next time.`],
  ];
  const picked = endings[Math.floor(Math.random() * endings.length)];
  console.log("Ending applied:", picked[0]);
  return { ...finalPage, lines: picked };
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

// ── Email ────────────────────────────────────────────────────────────────────
async function sendStoryEmail(email, childName, storyTitle, shareUrl) {
  try {
    await resend.emails.send({
      from: "Dreamzy <stories@dreamzy.xyz>",
      to: email,
      subject: `${childName}'s story is ready! 📖`,
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
        <body style="margin:0;padding:0;background:#0d0a1e;font-family:'Helvetica Neue',Arial,sans-serif;">
          <div style="max-width:520px;margin:0 auto;padding:40px 24px;">
            
            <!-- Logo -->
            <div style="text-align:center;margin-bottom:32px;">
              <span style="font-size:48px;">📖</span>
              <div style="font-size:28px;font-weight:700;color:white;margin-top:8px;">
                Dream<span style="color:#f4a87a">zy</span>
              </div>
            </div>

            <!-- Card -->
            <div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:32px;text-align:center;">
              <div style="font-size:40px;margin-bottom:16px;">✨</div>
              <h1 style="color:white;font-size:22px;margin:0 0 8px;font-weight:700;">
                ${childName}'s story is ready!
              </h1>
              <p style="color:rgba(255,255,255,0.5);font-size:15px;margin:0 0 24px;line-height:1.6;">
                <em style="color:rgba(255,255,255,0.8)">"${storyTitle}"</em><br/>
                A personalized bedtime story, just for ${childName}.
              </p>
              <a href="${shareUrl || 'https://dreamzy.xyz'}" 
                style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#D4845A,#C878C0,#8B5CF6);border-radius:16px;color:white;text-decoration:none;font-weight:700;font-size:16px;box-shadow:0 4px 20px rgba(212,132,90,0.4);">
                ▶ Read the Story
              </a>
            </div>

            <!-- Footer -->
            <div style="text-align:center;margin-top:24px;">
              <p style="color:rgba(255,255,255,0.2);font-size:12px;margin:0;">
                Made with ✨ by Dreamzy &nbsp;·&nbsp; 
                <a href="https://dreamzy.xyz" style="color:rgba(255,255,255,0.3);">dreamzy.xyz</a>
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    });
    console.log("Story email sent to:", email);
  } catch(e) {
    console.error("Email failed:", e.message);
  }
}

app.post("/generate-full-story", async (req, res) => {
  const { childName, age, interests, theme, mood, previousStory, illustrationStyle, pageCount, lesson } = req.body;
  const imgStyle = illustrationStyle || "cartoon";
  console.log("Using illustration style:", imgStyle);
  if (!childName || !interests?.length) return res.status(400).json({ error: "Need child name and interests" });
  const ageNum = parseInt(age) || 5;
  try {
    const isContinuation = !!previousStory;
    console.log("Generating story for " + childName + " (age " + ageNum + ")" + (isContinuation ? " — Episode " + ((previousStory.episode || 1) + 1) : "") + "...");

    const storyData = await generateStoryWithRetry(childName, age, interests, theme, mood, previousStory || null, { pageCount });
    // Improve the final page ending
    storyData.pages[storyData.pages.length - 1] = improveEnding(storyData.pages[storyData.pages.length - 1], childName, theme, ageNum);
    console.log("Got: \"" + storyData.title + "\" (" + storyData.ageRange + ") — " + storyData.pages.length + " pages");

    console.log("Generating illustrations...");
    // Generate cover image first
    const coverPrompt = `A beautiful storybook cover illustration for a children's book titled "${storyData.title}". The main character is ${storyData.characterDescription || childName}. Magical, warm, inviting cover art with the feeling of a classic picture book. Centered composition, rich colors, whimsical atmosphere.`;
    console.log("  Cover image...");
    let coverImageUrl = null;
    try { coverImageUrl = await generateImage(coverPrompt, storyData.characterDescription, imgStyle); }
    catch(e) { console.error("  Cover image failed:", e.message); }

    // Generate cover narration
    let coverAudioUrl = null;
    try {
      const coverText = `${storyData.title}. A story for ${childName}.`;
      const coverAudio = await generateVoice(coverText, ageNum);
      coverAudioUrl = coverAudio?.audioUrl || coverAudio || null;
    } catch(e) { console.error("  Cover audio failed:", e.message); }

    // Sequential image generation — more reliable for long stories
    const imageUrls = [];
    for (let i = 0; i < storyData.pages.length; i++) {
      console.log("  Image " + (i+1) + "/" + storyData.pages.length + "...");
      let url = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          url = await generateImage(storyData.pages[i].illustrationPrompt, storyData.characterDescription, imgStyle);
          break;
        } catch(e) {
          console.error("  Image " + (i+1) + " attempt " + (attempt+1) + " failed:", e.message);
          if (attempt < 2) await sleep(2000);
        }
      }
      imageUrls.push(url);
    }

    console.log("Generating narration...");
    const audioUrls = [];
    for (let i = 0; i < storyData.pages.length; i++) {
      let result = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          result = await generateVoice(storyData.pages[i].lines.join(" "), ageNum);
          console.log("  Voice " + (i+1) + "/" + storyData.pages.length + " done");
          break;
        } catch(e) {
          console.error("  Voice " + (i+1) + " attempt " + (attempt+1) + " failed:", e.message);
          if (attempt < 2) await sleep(2000);
        }
      }
      audioUrls.push(result);
    }

    const seriesId = previousStory?.series_id || (childName.toLowerCase().replace(/\s+/g, "-") + "-" + Date.now());
    const episode = previousStory ? (previousStory.episode || 1) + 1 : 1;

    console.log("Story complete! Series: " + seriesId + " Episode: " + episode);
    if (req.body.userEmail) {
      sendStoryEmail(req.body.userEmail, childName, storyData.title, process.env.FRONTEND_URL);
    }
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
        pages: [
          { isCover: true, title: storyData.title, childName, imageUrl: coverImageUrl, lines: [], audioUrl: coverAudioUrl },
          ...storyData.pages.map((p, i) => ({ ...p, imageUrl: imageUrls[i], audioUrl: audioUrls[i] }))
        ]
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
      const productName = payload.data?.attributes?.product_name || "";
      const plan = productName.toLowerCase().includes("plus") ? "family_plus" : "family";
      await supabase.from("profiles").update({ 
        subscription_status: "paid", 
        plan: plan,
        lemon_squeezy_customer_id: payload.data?.attributes?.customer_id?.toString() 
      }).eq("email", customerEmail);
      console.log("Activated subscription for:", customerEmail, "plan:", plan);
    }
    if (eventName === "subscription_cancelled" || (eventName === "subscription_updated" && status === "cancelled")) {
      await supabase.from("profiles").update({ subscription_status: "free", plan: "free" }).eq("email", customerEmail);
      console.log("Cancelled subscription for:", customerEmail);
    }
  } catch (e) { console.error("Webhook error:", e.message); }
  res.status(200).json({ received: true });
});

// ── Share story ──────────────────────────────────────────────────────────────
app.post("/share-story", async (req, res) => {
  const { story, userId } = req.body;
  if (!story || !userId) return res.status(400).json({ error: "Missing story or userId" });
  try {
    const shareId = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
    // Strip audio (large) but keep images as base64
    const pages = story.pages.map(p => ({ ...p, audioUrl: null }));
    const { error } = await supabase.from("shared_stories").insert({
      id: shareId,
      user_id: userId,
      title: story.title,
      child_name: story.childName || story.child_name,
      age: story.age || 5,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      pages,
    });
    if (error) throw error;
    console.log("Story shared:", shareId);
    res.json({ shareId, url: `${process.env.FRONTEND_URL || "https://dreamzy.xyz"}/share/${shareId}` });
  } catch (e) {
    console.error("Share error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get("/share/:shareId", async (req, res) => {
  const { shareId } = req.params;
  try {
    const { data, error } = await supabase.from("shared_stories").select("*").eq("id", shareId).single();
    if (error || !data) return res.status(404).json({ error: "Story not found or expired" });
    // Check expiry
    if (new Date(data.expires_at) < new Date()) return res.status(410).json({ error: "This story has expired" });
    // Increment views
    await supabase.from("shared_stories").update({ views: (data.views || 0) + 1 }).eq("id", shareId);
    res.json({ story: data });
  } catch (e) {
    console.error("Share fetch error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── PDF Export ───────────────────────────────────────────────────────────────
app.post("/generate-pdf", async (req, res) => {
  const { story } = req.body;
  if (!story) return res.status(400).json({ error: "Missing story" });
  try {
    const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");
    const fetch = (await import("node-fetch")).default;

    const pdfDoc = await PDFDocument.create();
    const titleFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic);
    const bodyFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const pageWidth = 612, pageHeight = 792;
    const margin = 48;
    const purple = rgb(0.49, 0.23, 0.93);
    const dark = rgb(0.1, 0.05, 0.2);

    // Cover page
    const cover = pdfDoc.addPage([pageWidth, pageHeight]);
    cover.drawRectangle({ x:0, y:0, width:pageWidth, height:pageHeight, color: rgb(0.05, 0.04, 0.12) });
    cover.drawRectangle({ x:0, y:0, width:pageWidth, height:8, color: purple });
    cover.drawRectangle({ x:0, y:pageHeight-8, width:pageWidth, height:8, color: purple });
    const titleSize = 42;
    const titleText = story.title || "A Dreamzy Story";
    cover.drawText(titleText, { x: margin, y: pageHeight/2 + 60, size: titleSize, font: titleFont, color: rgb(1,1,1), maxWidth: pageWidth - margin*2 });
    cover.drawText(`A story for ${story.childName}`, { x: margin, y: pageHeight/2 - 10, size: 22, font: bodyFont, color: rgb(0.68, 0.55, 1) });
    cover.drawText(`Made with Dreamzy *`, { x: margin, y: margin, size: 12, font: bodyFont, color: rgb(0.4, 0.35, 0.55) });

    // Story pages
    for (let i = 0; i < story.pages.length; i++) {
      const page = story.pages[i];
      const p = pdfDoc.addPage([pageWidth, pageHeight]);

      // Background
      p.drawRectangle({ x:0, y:0, width:pageWidth, height:pageHeight, color: rgb(0.99, 0.97, 1) });

      // Purple top bar
      p.drawRectangle({ x:0, y:pageHeight-6, width:pageWidth, height:6, color: purple });

      // Image — top half
      const imgHeight = 340;
      if (page.imageUrl) {
        try {
          let imgData;
          if (page.imageUrl.startsWith("data:image")) {
            const base64 = page.imageUrl.split(",")[1];
            imgData = Buffer.from(base64, "base64");
          } else {
            const r = await fetch(page.imageUrl);
            imgData = Buffer.from(await r.arrayBuffer());
          }
          const embedded = page.imageUrl.includes("png") || page.imageUrl.includes("data:image/png")
            ? await pdfDoc.embedPng(imgData).catch(() => pdfDoc.embedJpg(imgData))
            : await pdfDoc.embedJpg(imgData).catch(() => pdfDoc.embedPng(imgData));
          const imgY = pageHeight - imgHeight - 24;
          p.drawImage(embedded, { x: margin, y: imgY, width: pageWidth - margin*2, height: imgHeight - 24 });
        } catch(e) { console.log("Image embed failed:", e.message); }
      }

      // Divider
      const divY = pageHeight - imgHeight - 32;
      p.drawLine({ start: {x: margin, y: divY}, end: {x: pageWidth - margin, y: divY}, thickness: 1, color: rgb(0.8, 0.75, 0.95) });

      // Story text
      const lines = page.lines || [];
      const text = lines.join(" ");
      const fontSize = 16;
      const lineHeight = fontSize * 1.6;
      const maxWidth = pageWidth - margin * 2;
      // Word wrap
      const words = text.split(" ");
      const wrappedLines = [];
      let currentLine = "";
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const w = bodyFont.widthOfTextAtSize(testLine, fontSize);
        if (w > maxWidth && currentLine) { wrappedLines.push(currentLine); currentLine = word; }
        else currentLine = testLine;
      }
      if (currentLine) wrappedLines.push(currentLine);

      let textY = divY - 28;
      for (const line of wrappedLines) {
        if (textY < margin + 40) break;
        p.drawText(line, { x: margin, y: textY, size: fontSize, font: bodyFont, color: dark });
        textY -= lineHeight;
      }

      // Page number
      p.drawText(`${i + 1}`, { x: pageWidth/2 - 6, y: margin - 10, size: 11, font: bodyFont, color: rgb(0.6, 0.55, 0.75) });
      // Purple bottom bar
      p.drawRectangle({ x:0, y:0, width:pageWidth, height:6, color: purple });
    }

    const pdfBytes = await pdfDoc.save();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="dreamzy-${(story.title||"story").replace(/[^a-z0-9]/gi,"-").toLowerCase()}.pdf"`);
    res.send(Buffer.from(pdfBytes));
    console.log("PDF generated:", story.title);
  } catch(e) {
    console.error("PDF error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get("/checkout-urls", (req, res) => {
  res.json({
    familyMonthly: process.env.LEMONSQUEEZY_FAMILY_MONTHLY_URL,
    familyYearly: process.env.LEMONSQUEEZY_FAMILY_YEARLY_URL,
    familyPlusMonthly: process.env.LEMONSQUEEZY_FAMILYPLUS_MONTHLY_URL,
    familyPlusYearly: process.env.LEMONSQUEEZY_FAMILYPLUS_YEARLY_URL,
  });
});

app.listen(PORT, "0.0.0.0", () => console.log("Dreamzy backend running on http://localhost:" + PORT));