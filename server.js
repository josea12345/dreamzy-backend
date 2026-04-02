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
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// FIX: bump version so we can confirm Railway deployed this
app.get("/", (req, res) => res.json({ status: "Dreamzy running", version: "trial-v1" }));

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
  manga: "STYLE: manga children's illustration. Bold clean black outlines. Expressive large eyes. Dynamic action poses. Speed lines for movement. Black and white with selective color accents. Panel-like composition. Like a Japanese children's manga. NO photorealism. NO western cartoon style.",
};

// Map age group ID (e.g. "3-4") to a numeric age for logic checks
function resolveAge(age) {
  const map = { "0-1":0, "1-2":1, "3-4":3, "4-5":4, "5-6":5, "6-8":6, "8-10":8 };
  const n = parseInt(age);
  if (!isNaN(n)) return n; // legacy numeric ages still work
  return map[age] ?? 5;
}

function getAgeStyle(age, pageCountOverride) {
  const ageNum = resolveAge(age);

  if (ageNum <= 0) return {
    range: "0-1", pages: pageCountOverride || 5,
    style: `STYLE: Ages 0-1 (Infants). Draw from: Eric Carle (Very Hungry Caterpillar), Mem Fox, Sandra Boynton.

INFANT BOOK RULES — every rule is non-negotiable:
- MAXIMUM 2 WORDS PER PAGE — often just 1. "Big dog." "Red ball." "Night night." That's it.
- ONE CONCEPT PER PAGE: one object, one color, one animal, one sound. Never two concepts on the same page.
- SENSORY LANGUAGE: describe textures, sounds, and sensations. "Soft bunny." "Boom boom drum." "Splish splash."
- HIGH CONTRAST FOCUS: write prompts that suggest bold, simple images with high contrast (bright colors on dark backgrounds or vice versa).
- STANDALONE PAGES: each page works independently. There is no plot. This is object/concept recognition only.
- REPETITION: use the same sentence structure every page. "I see a ___." "Touch the ___." "Big ___."
- SOUNDS: include animal sounds, action sounds. "Moo!" "Woof!" "Splash!"
- WARM SIMPLE ENDING: end with something cozy — "Night night." "All done." "Hug."`,
  };

  if (ageNum <= 1) return {
    range: "1-2", pages: pageCountOverride || 5,
    style: `STYLE: Ages 1-2 (Toddlers). Draw from: Eric Carle, Sandra Boynton, Karen Katz, Leslie Patricelli.

TODDLER BOOK RULES:
- 1-3 WORDS PER PAGE. Short phrases only. "Dog runs!" "Big splash!" "Night night, bear."
- ONE CONCEPT PER PAGE: one action, one object, one routine step. Never more.
- REPETITION IS EVERYTHING: repeat the same phrase or structure every page with small variations. "Bear eats. Bear plays. Bear sleeps."
- FAMILIAR ROUTINES: bath time, meal time, bedtime, getting dressed. Toddlers love what they know.
- INTERACTIVE FEEL: write as if the child can respond. "Where's the duck?" "Can you clap?" "Your turn!"
- SIMPLE SOUNDS: animal sounds, action sounds, silly words. "Moo! Cluck! Splash! Boom!"
- WARM ENDING: return to something safe and familiar. A hug, a bed, a parent.
- NO PLOT: this is not a story with conflict. It's a sequence of familiar moments.`,
  };

  if (ageNum <= 3) return {
    range: "3-4", pages: pageCountOverride || 5,
    style: `STYLE: Ages 3-4 (Preschool). Draw from: Dr. Seuss, Julia Donaldson (The Gruffalo), Mo Willems (Elephant & Piggie), Karma Wilson (Bear Snores On), Mem Fox.

WHAT MAKES GREAT PRESCHOOL BOOKS — use ALL of these:
- RHYME & RHYTHM: AABB or ABAB schemes. Every page flows musically when read aloud. Clap-able beats.
- REPETITION WITH VARIATION: a repeated phrase that changes slightly for comic or dramatic effect each time.
- HUMOR: silly logic, unexpected turns, characters who get things hilariously wrong.
- SIMPLE EMOTIONS made BIG: fear → courage. Alone → friendship. One clear emotional journey per story.
- DIALOGUE: characters talk to each other. Give them distinct voices. Speech makes it come alive.
- CLEAR ARC: problem → 2 funny attempts → clever solution → warm triumphant ending.
- 1-3 SHORT LINES per page. Max 8 words per line.
- CHILD AS HERO: the child-character solves the problem themselves — not adults.
- MODEL LINES: "Bear snores on." / "I do not like them, Sam-I-Am!" / "He wasn't scared. Not even a little bit. (He was very scared.)"`,
  };

  if (ageNum <= 4) return {
    range: "4-5", pages: pageCountOverride || 6,
    style: `STYLE: Ages 4-5 (Pre-K). Draw from: Mo Willems (Don't Let the Pigeon!), Julia Donaldson, Dav Pilkey, Oliver Jeffers, Adam Rubin (Dragons Love Tacos), Robert Munsch.

WHAT MAKES GREAT PRE-K BOOKS — use ALL of these:
- ACTUAL PLOT: beginning → clear problem → escalating attempts → surprising resolution. Kids this age can follow a full story arc. Every page must move the plot forward.
- HUMOR & CHAOS: big silly energy. Characters who overreact. Absurd situations. Things going hilariously wrong.
- INTERACTIVE VOICE: speak directly to the reader. "Don't turn the page!" / "Can you help?" Break the fourth wall once for maximum impact.
- STRONG CHARACTER PERSONALITY: one defining trait (greedy, dramatic, brave, clumsy) drives every decision.
- DIALOGUE-DRIVEN: most storytelling through speech. Short punchy exchanges. Funny misunderstandings.
- 2-3 lines per page. Up to 10 words per line.
- CAUSE AND EFFECT: each page action directly causes the next.
- SATISFYING CALLBACK: the ending echoes something from page 1.
- MODEL LINES: "The pigeon REALLY wants to drive the bus." / "Oh no. Oh no no no." / "And that's when things got very, very weird."`,
  };

  if (ageNum <= 5) return {
    range: "5-6", pages: pageCountOverride || 6,
    style: `STYLE: Ages 5-6 (Kindergarten). Draw from: Mo Willems, Arnold Lobel (Frog & Toad), Cynthia Rylant (Henry & Mudge), Kevin Henkes, Tomie dePaola.

WHAT MAKES GREAT KINDERGARTEN BOOKS — use ALL of these:
- FULLER NARRATIVE: a real story with beginning, middle, and end. Kids this age can track a complete arc across many pages.
- 3-5 SENTENCES PER PAGE: longer than pre-k but still clear and direct. Each sentence earns its place.
- EARLY CHAPTER FEEL: can include 1-2 mini-scenes or a B-plot that resolves alongside the main story.
- EMOTIONAL DEPTH: characters can feel conflicted, embarrassed, proud. Go beyond simple happy/sad.
- FRIENDSHIP AS THE HEART: the relationship between two characters drives most great books at this age.
- SHOW DON'T TELL: "Her hands shook" not "She was scared." "He looked at his feet" not "He felt bad."
- MODEL LINES: "Frog and Toad were friends." / "Henry was a big dog." / "It was going to be a very good day." / "Sheila Rae was never afraid."`,
  };

  if (ageNum <= 6) return {
    range: "6-8", pages: pageCountOverride || 8,
    style: `STYLE: Ages 6-8 (Early Reader). Draw from: Arnold Lobel, Beverly Cleary, Cynthia Rylant, Kate DiCamillo (Mercy Watson), Jeff Kinney (tone), Mary Pope Osborne.

WHAT MAKES GREAT EARLY READER BOOKS — use ALL of these:
- STRONG NARRATIVE ARC: clear setup → rising tension → climax → satisfying resolution. Every page moves the plot or character forward.
- CHARACTER GROWTH: the hero must change by the end. The change must be EARNED — shown through actions, not stated.
- REAL CONFLICT with genuine stakes: something the child cares about could be lost.
- WIT & HUMOR: jokes kids feel smart for understanding. Irony, wordplay, characters funny because they're flawed.
- 3-5 sentences per page, up to 12 words each. Varied rhythm — short punchy lines mixed with longer descriptions.
- VIVID SPECIFIC details: not "a big tree" but "a tree so old its roots had swallowed the garden wall."
- DIALOGUE reveals character — how people talk tells us who they are. Each character sounds distinct.
- MODEL LINES: "Frog and Toad were friends." / "The Magic Tree House began to spin." / "Mercy Watson was not an ordinary pig."`,
  };

  return {
    range: "8-10", pages: pageCountOverride || 8,
    style: `STYLE: Ages 8-10 (Reader). Draw from: Roald Dahl, Mary Pope Osborne (Magic Tree House), Judy Blume, Jeff Kinney, Kate DiCamillo, Rick Riordan (tone).

WHAT MAKES GREAT CHAPTER-STYLE BOOKS — use ALL of these:
- COMPLEX PLOT: setup → rising stakes → midpoint complication → darkest moment → earned resolution. Every page earns its place.
- DEEP CHARACTER: the hero has flaws, contradictions, and real growth. By the last page they are visibly different.
- REAL STAKES: something the child deeply cares about — a friendship, a home, a dream — is genuinely at risk.
- VOICE & HUMOR: a distinct narrative voice the reader can hear. Jokes that reward intelligence. Characters funny because they're human.
- 4-6 sentences per page, varied length. Rich sensory details that put you in the scene.
- SUBPLOTS: a secondary character or relationship that mirrors or contrasts the main arc.
- THE INTERESTS drive the plot — they're not decoration, they're the solution to the central problem.
- MODEL LINES: "James had never seen such a thing in all his life." / "It's a funny thing about mothers and fathers." / "Something amazing was about to happen."`,
  };
}


const LANGUAGE_CONFIG = {
  en:    { name: "English",                  coverPhrase: "A story for",         instruction: "",                                                                                                                         sleepWords: /\b(sleep|sleeping|slept|slumber|yawn|yawning|dream|dreaming|dreamed|dreamt|drift|drifting|drifted|doze|dozing|dozed|snooze|snoozing|snoozed|fell asleep|fast asleep|closed (their|her|his) eyes|night-night|nighty|bedtime|tucked in|tuck(ed)? in|rest(ed)?|nap|napping)\b/i },
  es_es: { name: "Spanish (Spain)",          coverPhrase: "Un cuento para",      instruction: "Write the ENTIRE story in Spanish from Spain (Castilian). Use vocabulary, expressions and grammar natural to Spain. Do NOT use Latin American Spanish variants.",  sleepWords: /\b(dormir|sueño|bostez|soñó|soñar|durmió|siesta|dormirse|cerraron los ojos|buenas noches)\b/i },
  es_la: { name: "Spanish (Latin America)",  coverPhrase: "Un cuento para",      instruction: "Write the ENTIRE story in Latin American Spanish. Use vocabulary, expressions and grammar natural to Latin America (not Spain). Avoid Castilian-specific terms.", sleepWords: /\b(dormir|sueño|bostez|soñó|soñar|durmió|siesta|dormirse|cerraron los ojos|buenas noches)\b/i },
  fr:    { name: "French",                   coverPhrase: "Une histoire pour",   instruction: "Write the ENTIRE story in French. Use vocabulary and expressions natural to France.",                                      sleepWords: /\b(dormir|sommeil|bâiller|rêvé|s'endormir|fermé les yeux|bonne nuit)\b/i },
  pt:    { name: "Portuguese (Brazil)",      coverPhrase: "Uma história para",   instruction: "Write the ENTIRE story in Brazilian Portuguese. Use vocabulary and expressions natural to Brazil.",                        sleepWords: /\b(dormir|sono|bocejou|sonhou|adormecer|fechou os olhos|boa noite)\b/i },
  de:    { name: "German",                   coverPhrase: "Eine Geschichte für", instruction: "Write the ENTIRE story in German. Use vocabulary and expressions natural and appropriate for children in Germany.",        sleepWords: /\b(schlafen|schlief|gähnte|träumte|einschlafen|geschlossen die Augen|gute Nacht)\b/i },
};

async function generateStoryWithRetry(childName, age, interests, theme, mood, previousStory, options, lesson, appearance, customHero, language, isFamilyPlus, storyMode, justWatching, isClassroom, attempt) {
  if (attempt === undefined) attempt = 0;
  try {
    return await generateStory(childName, age, interests, theme, mood, previousStory, options, lesson, appearance, customHero, language, isFamilyPlus, storyMode, justWatching, isClassroom);
  } catch (e) {
    if ((e.status === 529 || (e.message && e.message.includes("overloaded"))) && attempt < 3) {
      console.log("Anthropic overloaded, retrying in " + (10 + attempt * 10) + "s (attempt " + (attempt+1) + ")...");
      await sleep((10 + attempt * 10) * 1000);
      return generateStoryWithRetry(childName, age, interests, theme, mood, previousStory, options, lesson, appearance, customHero, language, isFamilyPlus, storyMode, justWatching, isClassroom, attempt + 1);
    }
    throw e;
  }
}

// Build a page-by-page blueprint so the AI knows exactly what each page must accomplish.
// This is the core fix for truncated arcs — without this, the AI invents its own pacing
// and consistently runs out of pages before resolving the conflict.
function getPageBlueprint(pageCount, childName) {
  if (pageCount <= 5) return `
PAGE-BY-PAGE STRUCTURE — you have exactly ${pageCount} pages. Follow this blueprint precisely:
  Page 1: WORLD & CHARACTER — introduce ${childName||"the hero"} in ONE specific place. Show them doing something they love. The final line introduces or hints at the story's problem.
  Page 2: THE PROBLEM APPEARS — the specific challenge is clear and urgent. ${childName||"The hero"} decides to act. The reader knows exactly what needs to happen for the story to be resolved.
  Page 3: THE ATTEMPT — ${childName||"the hero"} takes ONE specific action toward solving the problem. Something unexpected happens. The stakes are now higher or the situation more interesting.
  Page 4: THE RESOLUTION — ${childName||"the hero"} physically completes the solution. SHOW the exact action: they bring back the object, fix the thing, deliver the item, reunite with the friend. The problem is visibly, concretely solved on this page. DO NOT summarize — show every beat. Example: if the problem was a missing ingredient, page 4 shows the hero returning with it AND using it.
  Page 5: THE WARM ENDING — back to where the story started (full circle). The result of page 4 is now visible: the shop is saved, the cake is made, the friend is happy. ${childName||"The hero"} feels the joy. One specific warm detail closes the story.

CRITICAL: Page 4 MUST show the physical act of solving — not the celebration after. The resolution is an ACTION, not a reaction.
CRITICAL: Page 5 is the RESULT of page 4 being visible in the world. Not a new scene — the same world, changed by what happened on page 4.
CRITICAL: Every page must directly cause the next. No isolated moments. No teleporting to new locations without connection.`;

  if (pageCount <= 6) return `
PAGE-BY-PAGE STRUCTURE — you have exactly ${pageCount} pages. Follow this blueprint precisely:
  Page 1: WORLD & CHARACTER — introduce ${childName||"the hero"} in a vivid specific setting. Establish their personality in one action. Plant the seed of the story's problem or desire clearly.
  Page 2: THE PROBLEM APPEARS — the specific challenge becomes undeniable. ${childName||"The hero"} makes a clear decision to act. The reader knows exactly what ${childName||"the hero"} wants and why.
  Page 3: FIRST ATTEMPT — ${childName||"the hero"} tries something bold and specific. A small success that creates a new complication, OR a funny/surprising failure that raises the stakes.
  Page 4: THE REAL CHALLENGE — the hardest moment. Something meaningful is at stake. ${childName||"The hero"} must dig deeper or think differently. The outcome feels genuinely uncertain.
  Page 5: THE RESOLUTION — ${childName||"the hero"} solves it with cleverness, courage, or kindness. Show this moment in full — the triumph must be seen and felt, not summarized.
  Page 6: THE WARM ENDING — emotional aftermath. ${childName||"The hero"} reflects or celebrates. A specific sensory detail closes the story warmly. Echoes something from page 1.

CRITICAL: Every page causes the next. Page 3 happens BECAUSE of page 2. Page 4 BECAUSE of 3. No isolated vignettes.
CRITICAL: Resolution on page 5. Page 6 is landing only — never the climax.
CRITICAL: ${childName||"The hero"} must appear on every page actively doing something — never just observing.`;

  if (pageCount <= 8) return `
PAGE-BY-PAGE STRUCTURE — you have exactly ${pageCount} pages. Follow this blueprint precisely:
  Page 1: OPENING IMAGE — ${childName||"the hero"} in their world. One vivid sensory detail. Their personality shown through action, not description. A hint of the story ahead.
  Page 2: THE INCITING INCIDENT — something specific happens that disrupts the normal world. ${childName||"The hero"} can't ignore it.
  Page 3: THE GOAL IS SET — ${childName||"the hero"} commits to solving the problem or pursuing the quest. First concrete steps taken. The reader knows exactly what success looks like.
  Page 4: FIRST OBSTACLE — something goes wrong in a specific, surprising way. ${childName||"The hero"} adapts but the problem isn't solved.
  Page 5: DEEPENING STAKES — the challenge grows more serious or personal. A friend helps, or a discovery changes what ${childName||"the hero"} thought they knew.
  Page 6: THE DARKEST MOMENT — it genuinely seems like ${childName||"the hero"} might fail. Something important is at stake. The reader worries.
  Page 7: THE RESOLUTION — ${childName||"the hero"} uses everything they've learned or a clever insight to solve the problem. Show every beat of this moment — don't summarize it.
  Page 8: THE WARM ENDING — quiet specific joy. A callback to page 1. Something has changed in ${childName||"the hero"} or their world. Emotionally satisfying close.

CRITICAL: Climax on page 7. Page 8 is warm aftermath only — never the resolution.
CRITICAL: Every page must directly cause the next. Trace the chain: page 2 causes page 3 causes page 4... If any page could be removed without affecting the next, rewrite it.
CRITICAL: ${childName||"The hero"} must be active on every page — making decisions, taking actions, reacting specifically. Never passive.`;

  // 9–16 pages: proportional thirds with named hero
  const setupEnd = Math.floor(pageCount * 0.25);
  const midpointPage = Math.floor(pageCount * 0.5);
  const climaxPage = pageCount - 1;
  return `
PAGE-BY-PAGE STRUCTURE — you have exactly ${pageCount} pages. Follow this blueprint:
  Pages 1–${setupEnd}: SETUP — introduce ${childName||"the hero"}, their world, their want, and the problem. End with a clear inciting incident that launches the story.
  Pages ${setupEnd+1}–${midpointPage}: RISING ACTION — ${childName||"the hero"} pursues the goal. Each attempt creates a new complication. Allies are introduced. Stakes escalate.
  Page ${midpointPage}: MIDPOINT TURN — something changes the story's direction. A discovery, betrayal, or revelation that raises stakes significantly.
  Pages ${midpointPage+1}–${climaxPage-1}: COMPLICATIONS — the hardest stretch. ${childName||"the hero"} faces their biggest doubts. A dark moment where failure seems possible.
  Page ${climaxPage}: THE RESOLUTION — ${childName||"the hero"} solves the main problem using something earned through the story. Show it fully. This is the climax.
  Page ${pageCount}: WARM ENDING — specific quiet joy. A changed world or changed ${childName||"hero"}. Echoes the opening. Leaves the reader satisfied.

CRITICAL: The conflict must be fully resolved by page ${climaxPage}. Page ${pageCount} is the warm emotional close only.
CRITICAL: Every page must earn its place. Ask for each page: "what does this reveal, raise, or change?" If nothing — rewrite it.
CRITICAL: ${childName||"The hero"}'s internal growth must mirror the external plot. By page ${pageCount} they are different from page 1.`;
}

// Concept lessons need structural integration, not just "weaving in"
const CONCEPT_LESSONS = {
  letters: `- CONCEPT LESSON — LETTERS/ABC: This story must be built around the alphabet. Each page introduces a new letter through the story. The character encounters something that starts with that letter. E.g. page 1: "A is for Apple — the hero finds a big red apple." page 2: "B is for Bear — a friendly bear waves hello." Use the letter prominently on each page. The story's journey IS the alphabet journey. Make it playful and visual.`,
  numbers: `- CONCEPT LESSON — NUMBERS: This story must teach counting. Each page introduces a new number through the story. The character counts objects they find or collect. E.g. "One shiny star." "Two fluffy clouds." "Three little frogs." Each page = one number, one clear countable thing. The story's journey IS the counting journey. Numbers 1-5 for very young, 1-10 for older.`,
  colors: `- CONCEPT LESSON — COLORS: Each page introduces a new color through the story. The character encounters something vivid in that color. E.g. "A big RED apple fell from the tree." "A BLUE butterfly landed on their nose." Make the color the star of each page. The illustrationPrompt must emphasize that color strongly.`,
  shapes: `- CONCEPT LESSON — SHAPES: Each page introduces a new shape through the story. The character finds or uses an object in that shape. E.g. "A CIRCLE moon lit up the sky." "A SQUARE window showed the stars." Make the shape obvious in both text and illustration prompt.`,
  routines: `- CONCEPT LESSON — ROUTINES: This story follows a daily routine step by step. Each page = one step in the routine (wake up, brush teeth, get dressed, eat breakfast, etc.). The character does each step with joy. The story IS the routine — predictable, warm, reassuring. Perfect for children learning their daily schedule.`,
  body: `- CONCEPT LESSON — BODY PARTS: Each page introduces a new body part through the story. The character uses that body part to do something. E.g. "With her HANDS she clapped along." "With his FEET he stomped in puddles." Make each body part the clear focus of the page.`,
  food: `- CONCEPT LESSON — FOOD: Each page introduces a different food through the story. The character tries, finds, or cooks each food. Name the food clearly, describe its color and texture. Make food joyful and adventurous, not preachy.`,
  animals: `- CONCEPT LESSON — ANIMALS: Each page features a different animal. The character meets the animal and learns one simple fact (sound it makes, where it lives, what it eats). E.g. "The COW said MOO and lived on the farm." Keep it simple, playful, and factual.`,
};

function buildLessonInstruction(lesson, ageNum) {
  // Concept lessons — need structural integration
  if (CONCEPT_LESSONS[lesson]) return CONCEPT_LESSONS[lesson];
  // Value lessons — must drive the PLOT, not just appear in the background
  return `- LESSON — THIS IS THE STORY'S CORE: "${lesson}" is not decoration — it IS the plot. Structure the story so the lesson is unavoidable:
  * Page 1-2: The character faces a situation that REQUIRES them to choose whether to demonstrate "${lesson}" — they haven't learned it yet or are being tested.
  * Middle pages: The character struggles, fails once, or faces resistance. Show the cost of NOT having "${lesson}". Make it feel real.
  * Page near end: The character chooses to embrace "${lesson}" — a clear, specific ACTION they take (not a thought or feeling — they DO something).
  * Final page: The result of that action is shown — another character's reaction, a problem solved, a relationship strengthened. The payoff must be visible and concrete.
  * NEVER have a character explain the lesson out loud ("I learned that sharing is important"). SHOW it through action and consequence.
  * The lesson must be the reason the story exists — if you removed "${lesson}" from the plot, the whole story would fall apart.`;
}

async function generateStory(childName, age, interests, theme, mood, previousStory, options, lesson, appearance, customHero, language, isFamilyPlus, storyMode, justWatching, isClassroom) {
  const interestList = interests.join(", ");
  const ageNum = resolveAge(age);
  const ageStyle = getAgeStyle(age, options?.pageCount);
  const pageBlueprint = getPageBlueprint(ageStyle.pages, justWatching && customHero ? customHero : childName);
  const lang = LANGUAGE_CONFIG[language] || LANGUAGE_CONFIG.en;
  const languageInstruction = lang.instruction
    ? `\nLANGUAGE: ${lang.instruction}\nCRITICAL: The "illustrationPrompt" field must ALWAYS be written in English — it is used for image generation only and must never be translated.`
    : "";

  const storyModeInstructions = storyMode === "bedtime"
    ? `STORY VIBE — BEDTIME: This is a cozy, calming story for winding down. Use slow gentle pacing. Sentences should feel like a warm hug. Avoid high-energy action or chaos. The ending should leave the child feeling safe, warm, and content. Think Goodnight Moon energy — peaceful, repetitive, soothing.`
    : storyMode === "silly"
    ? `STORY VIBE — SILLY: This story should be laugh-out-loud funny. Embrace chaos, absurdity, and unexpected twists. Characters overreact dramatically. Things go hilariously wrong. Use onomatopoeia, silly sounds, exaggerated reactions. Think Dav Pilkey / Mo Willems energy — pure comedic mayhem with a funny resolution.`
    : `STORY VIBE — DAYTIME: This is an energetic, adventurous story full of curiosity and excitement. Fast-paced, active, fun. Characters are bold and enthusiastic. Things happen quickly and dynamically. The ending feels like a triumphant high-five moment.`;


  const continuationContext = previousStory ? `
IMPORTANT — THIS IS A CONTINUATION (Episode ${(previousStory.episode || 1) + 1}):
Previous story title: "${previousStory.title}"
What happened before: ${previousStory.story_summary || "An adventure with " + childName}
Characters established: ${JSON.stringify(previousStory.characters || {})}${lesson ? `
Ongoing lesson/theme: This series is teaching "${lesson}" — continue exploring this theme through NEW challenges and situations that reinforce the same lesson. Don't repeat the exact same scenario from episode 1, but the lesson must still be clearly felt and experienced by the character.` : ""}

Rules for continuation:
- The TITLE must follow this pattern: "[Original Title] — Episode ${(previousStory.episode || 1) + 1}: [New Subtitle]"
- Reference what happened in the previous episode naturally in the first 1-2 pages
- Bring back the same supporting characters (friends, creatures, magical objects) with consistent descriptions
- The world and setting should feel familiar — same visual language, same tone
- Start with a callback ("The next morning..." / "One week later..." / "Back in [place from ep 1]...")
- End with a hint that another adventure is coming
- This is episode ${(previousStory.episode || 1) + 1} in ${childName}'s ongoing adventures
` : "";

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    system: `You are a master children's book author. Write a personalized story for a ${ageNum}-year-old child to enjoy.${isClassroom ? ` This is a CLASSROOM story to be read to a group of students. Write for a GROUP AUDIENCE — use "everyone", "the whole class", collective moments of wonder. Include 2-3 interactive participation moments where students can call out, make sounds, or act along ("Can you roar like a dinosaur?", "Everyone freeze!"). Make it engaging for a room full of children, not just one. Avoid any personal references to a single child's life.` : ""}${justWatching && customHero ? ` The story is about ${customHero} ONLY. Do NOT include ${childName} anywhere in the story — not as a character, not mentioned, not referenced. ${childName} is purely the reader/audience.` : customHero ? ` The MAIN HERO of this story is NOT the child — it is: ${customHero}. ${childName} appears as a supporting character or friend, but ${customHero} drives the plot. Make ${customHero} the protagonist with a clear personality, name if appropriate, and their own arc.` : ""} This is a story that should NOT end with the child sleeping — it ends with a warm, happy, satisfied feeling like the end of a great adventure.
${ageStyle.style}
${pageBlueprint}
${languageInstruction}
${continuationContext}
Return ONLY valid JSON with no markdown, no code blocks, no explanation before or after:
{
  "title": "${previousStory ? `${previousStory.title.replace(/: Episode \\d+.*$/,'')} — Episode ${(previousStory.episode||1)+1}: [catchy subtitle]` : `Catchy title featuring ${childName}`}",
  "ageRange": "${ageStyle.range}",
  "characterDescription": "${customHero ? `The main character is ${customHero}. Describe their EXACT appearance for illustration consistency: species/type if non-human, body size, fur/skin/scale color and pattern, eye color and shape, any clothing (color, style), distinctive features, accessories. Be extremely specific — e.g. 'A small purple dragon with bright orange eyes, tiny golden wings, wearing a red scarf, round chubby body'.` : appearance ? `${childName}: ${appearance}` : `Locked character description for ${childName} — be VERY SPECIFIC for illustration consistency: exact hair color (e.g. 'dark brown wavy hair in two pigtails'), eye color, skin tone, clothing colors and style (e.g. 'yellow sundress with white polka dots'), any accessories. Every detail must be specific enough that an illustrator could draw the same character 10 times identically.`}",
  "storySummary": "2-3 sentence summary of what happened in this story — used for future episode context",
  "characters": {
    "protagonist": "${childName} description",
    "supporting": ["character name and brief description", "another character"]
  },
  "pages": [{"pageNumber":1,"lines":["line 1","line 2"],"illustrationPrompt":"Detailed scene description","soundNote":"reading tone"${isFamilyPlus && ageNum <= 4 ? `,"tappable":{"emoji":"🐄","soundDescription":"a friendly cow mooing softly, short 1 second"}` : ''}}]
}
RULES:
- Generate exactly ${ageStyle.pages} pages — no more, no less
- Follow the PAGE-BY-PAGE STRUCTURE above exactly. Each page must do what its blueprint says.
- Use ${childName}'s name naturally — not on every single line, just when it feels right
${lesson ? `${buildLessonInstruction(lesson, ageNum)}
- INTERESTS (${interestList}): use ${interests.length === 1 ? "this interest as the SETTING and backdrop only — it flavors the world but the lesson above is the story's core plot driver" : "these interests as the setting and backdrop — they flavor the world but the lesson above is the story's core plot driver. DO NOT let interests override the lesson."}`
: `- INTERESTS (${interestList}): use ${interests.length === 1 ? "this interest as the HEART of the story — build the entire world around it" : "these interests — pick 1-2 as the main focus and let others appear naturally if they fit. DO NOT force all of them in."}`}
- Theme: ${theme || "adventure"}. Mood: ${mood || "magical"}
- ${storyModeInstructions}
- NATURAL LANGUAGE ONLY: Write like a real children's book author, not an AI. Avoid: "suddenly", "magical adventure", "filled with wonder", "with a smile", "exclaimed", "incredible", "joyfully", "beautifully", "amazing". Use simple direct language. Show don't tell.
- EVERY sentence must sound natural when read aloud to a child. Test each line: would a parent read it naturally to a sleepy child? If not, rewrite it.
- CAUSE & EFFECT: before writing each page, ask "what happened on the previous page that makes THIS page happen?" If the answer is "nothing" — rewrite the page. Every page must be caused by the previous one.
- PAGE VALUE TEST: for every page ask "does this page move the plot OR deepen the character?" If neither — cut it and redistribute that content.
- PACING CHECK: Before writing page N, ask yourself — "have I already shown the resolution?" If yes and this is the last page, write the warm landing. If no and this is the second-to-last page, this page MUST contain the resolution.${ageNum <= 4 ? `
- TODDLER STORY CONSISTENCY — this is critical for ages ${ageNum} and under:
  * ONE CLEAR PLOT THREAD: Decide the single story in one sentence before writing page 1. Every page must advance THAT story. Example: "${childName} loses their toy giraffe and searches for it." Each page = one step in that search. Never introduce unrelated events.
  * SAME LOCATION FAMILY: the story should stay in 1-2 connected locations (home + garden, bedroom + living room). No teleporting to new worlds each page.
  * REPEAT THE HERO: ${childName} must appear on EVERY page doing something related to the plot. Never disappear for a page.
  * EMOTIONAL THROUGHLINE: establish one feeling on page 1 (excited, worried, curious) and resolve it by the last page. Every page moves toward that resolution.
  * CAUSE AND EFFECT: each page's action must directly cause what happens on the next page. Page 2 happens BECAUSE of page 1.
  * SHOW THE RESOLUTION: the moment the problem is solved must be written out fully — the hero physically does the thing. Never skip to the celebration without showing the action that caused it. Wrong: "Everyone cheered!" Right: "${childName} placed the cheese on the pizza. It melted perfectly. Tony smiled wide."` : ""}
- ILLUSTRATION PROMPTS — this is critical for visual consistency:
  * Every illustrationPrompt MUST follow this exact format: "[EXACT CHARACTER DESCRIPTION from characterDescription field] is [DOING WHAT — specific action with emotion] in/at [SPECIFIC LOCATION with details]. [SUPPORTING CHARACTERS with their appearance]. [LIGHTING AND ATMOSPHERE]. [KEY VISUAL DETAILS that make this page unique]."
  * Example: "A girl with dark brown wavy hair in two pigtails, green eyes, light skin, yellow sundress with white polka dots is climbing a giant red mushroom with delight on her face in an enchanted forest with glowing blue trees. A small white rabbit with pink eyes watches from below. Warm golden morning light filters through the trees. Sparkling magical particles float in the air."
  * COPY the characterDescription EXACTLY into every illustrationPrompt — same hair, same eyes, same skin, same clothes, every time. Do not abbreviate or paraphrase.
  * Be SPECIFIC about the action — not "standing in a forest" but "running through tall purple mushrooms, arms outstretched, laughing"
  * Describe the EXACT EMOTION on the character's face — wide grin, eyes wide with surprise, furrowed brow of determination
  * Always include lighting/atmosphere: warm sunset glow, cozy candlelight, bright sunny meadow, cool misty morning
  * LOCK THE VISUAL WORLD: establish the color palette on page 1 (e.g. "warm amber and green palette"). Reference it on every subsequent page.
  * Each page should show a DIFFERENT action/moment but in the SAME visual world${isFamilyPlus && ageNum <= 4 ? `
- TAPPABLE ELEMENTS — for each page include ONE tappable element that fits the scene naturally:
  * emoji: a single emoji representing the tappable object (animal, vehicle, instrument, nature element)
  * soundDescription: a short vivid description for sound generation, e.g. "a duck quacking twice, cheerful and soft" or "a tiny bell ringing once, bright and clear" or "rain drops falling on leaves, gentle pitter patter"
  * Pick something that actually APPEARS in the illustration — not random
  * Keep sounds short (1-2 seconds), child-friendly, and joyful` : ""}
- ENDING RULE: The story must NEVER end with the child sleeping, drifting off, closing their eyes, being tucked in, or any form of rest. It ends with joy, triumph, warmth, or satisfaction — awake and happy.`,
    messages: [{ role: "user", content: `Story for ${childName}, age ${ageNum}. Interests: ${interestList}. Theme: ${theme}. Mood: ${mood}.` }],
  });

  const text = response.content.map(b => b.text || "").join("");
  // Strip markdown code blocks if Claude wrapped the JSON
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON found in response");
  try {
    return JSON.parse(match[0]);
  } catch(e) {
    // Try to extract just the valid JSON portion
    const lastBrace = match[0].lastIndexOf("}");
    const trimmed = match[0].slice(0, lastBrace + 1);
    return JSON.parse(trimmed);
  }
}

// Only replace the final page if it contains sleep words — never replace a good resolution
function improveEnding(finalPage, childName, theme, ageNum, language) {
  const lang = LANGUAGE_CONFIG[language] || LANGUAGE_CONFIG.en;
  const lastLines = (finalPage.lines || []).join(" ");
  if (!lang.sleepWords.test(lastLines)) return finalPage;
  // Only fires when the ending literally has the child falling asleep
  const endings = [
    [`${childName} laughs and cheers. What an adventure!`, `"Let's do it again!" ${childName} says with a grin.`],
    [`The sun paints the sky gold and pink.`, `${childName} smiles. Today was absolutely perfect.`],
    [`${childName} hugs their new friend so tight.`, `Some days are pure magic. This was one.`],
    [`"Best adventure EVER!" ${childName} grins wide.`, `Tomorrow holds even more wonders to find.`],
    [`${childName} looks up at the first twinkling star.`, `Heart full and happy, the world feels wonderful.`],
    [`Hand in hand, they skip toward home.`, `${childName} cannot wait to come back.`],
    [`"We did it!" ${childName} shouts with joy.`, `The whole world heard and cheered along.`],
    [`${childName} takes a deep breath of evening air.`, `Everything feels just right in the whole wide world.`],
  ];
  const picked = endings[Math.floor(Math.random() * endings.length)];
  console.log("Sleep ending detected — replaced with:", picked[0]);
  return { ...finalPage, lines: picked };
}

// ── FIX: Always upload to Supabase Storage — regardless of userId ────────────
// Returns public URL on success, null on failure (caller falls back to nothing)
async function uploadImageToStorage(base64Data, storyId, pageIndex) {
  try {
    // Strip data URI prefix if present — we only want the raw base64
    const raw = base64Data.includes(",") ? base64Data.split(",")[1] : base64Data;
    const buffer = Buffer.from(raw, "base64");
    const fileName = `${storyId}/page-${pageIndex}.jpg`;
    const { error } = await supabaseAdmin.storage
      .from("story-images")
      .upload(fileName, buffer, { contentType: "image/jpeg", upsert: true });
    if (error) {
      console.error("Storage upload error:", JSON.stringify(error));
      return null;
    }
    const { data } = supabaseAdmin.storage.from("story-images").getPublicUrl(fileName);
    console.log("Image uploaded to storage:", fileName, "→", data.publicUrl);
    return data.publicUrl;
  } catch (e) {
    console.error("Storage upload failed:", e.message);
    return null;
  }
}

async function generateImage(prompt, characterDescription, style, attempt, worldDescription) {
  if (attempt === undefined) attempt = 0;
  const stylePrompt = STYLE_PROMPTS[style] || STYLE_PROMPTS.cartoon;

  // Build a rigid character lock block — repeat the exact description every time
  const characterLock = characterDescription
    ? `CHARACTER DESCRIPTION (copy EXACTLY every page — same hair color, same eye color, same skin tone, same clothing, same size): ${characterDescription}.`
    : "";

  // Visual world anchor — inject from page 1 onwards to maintain palette/setting consistency
  const worldLock = worldDescription
    ? `VISUAL WORLD (maintain these exact visual elements throughout): ${worldDescription}.`
    : "";

  const fullPrompt = [
    stylePrompt,
    "CHILDREN'S BOOK ILLUSTRATION — FULL PAGE.",
    characterLock,
    worldLock,
    `SCENE: ${prompt}`,
    "CRITICAL CONSISTENCY RULES:",
    "- The main character must look IDENTICAL to the CHARACTER DESCRIPTION above — same face, same hair, same clothes, same proportions",
    "- Same art style, same color palette, same line weight as described in the style",
    "- Show the character ACTIVELY doing the described action with a clear expressive emotion",
    "- NO text, letters, words, numbers, or signs anywhere in the image",
    "- Full color illustration. Strong focal point. Child-friendly. Expressive faces.",
    "- Same lighting style and color temperature throughout the story",
  ].filter(Boolean).join(" ");

  try {
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
      return generateImage(prompt, characterDescription, style, attempt + 1, worldDescription);
    }
    throw e;
  }
}

// ElevenLabs language codes for eleven_turbo_v2_5
const ELEVENLABS_LANG_CODES = {
  en: "en", es_es: "es", es_la: "es", fr: "fr", pt: "pt", de: "de"
};

// Premade ElevenLabs voices — available to all users by default
const NARRATORS = {
  rachel:   { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel",   desc: "Warm & calm",      gender: "female" },
  matilda:  { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda",  desc: "Gentle & friendly", gender: "female" },
  bill:     { id: "pqHfZKP75CvOlQylNhV4", name: "Bill",     desc: "Warm & deep",        gender: "male"   },
  callum:   { id: "N2lVS1w4EtoT3dr4eOWO", name: "Callum",   desc: "Fun & energetic",    gender: "male"   },
};
const DEFAULT_NARRATOR = "rachel";

// eleven_multilingual_v2 handles non-English much better than turbo
// Use multilingual for any non-English language, turbo for English
function getModelForLanguage(language) {
  return language === "en" ? "eleven_turbo_v2_5" : "eleven_multilingual_v2";
}

// Format page lines for narration with natural pauses between them
// Keep break count low — too many causes ElevenLabs to speed up or artifact
function formatNarration(lines, ageNum) {
  if (!lines || lines.length === 0) return "";
  if (lines.length === 1) return lines[0];
  // Toddlers (≤3): longer pauses, slow and warm
  // Ages 4-5: medium pauses
  // Ages 6+: shorter pauses, more natural flow
  const pauseTime = ageNum <= 3 ? "1.2s" : ageNum <= 5 ? "0.9s" : "0.7s";
  // Join lines with break tags — max 2 breaks to avoid instability
  const safeLine = lines.slice(0, 3); // cap at 3 lines for safety
  return safeLine.join(` <break time="${pauseTime}" /> `);
}

async function generateVoice(text, ageNum, language, narratorKey, attempt, storyMode) {
  if (attempt === undefined) attempt = 0;
  const narrator = NARRATORS[narratorKey] || NARRATORS[DEFAULT_NARRATOR];
  const model = getModelForLanguage(language);

  // Voice settings vary by story mode and age
  let voiceSettings;
  if (storyMode === "bedtime") {
    // Slower, more stable, very calm — designed for winding down
    voiceSettings = ageNum <= 3
      ? { stability: 0.90, similarity_boost: 0.75, style: 0.02, use_speaker_boost: true }
      : ageNum <= 5
      ? { stability: 0.80, similarity_boost: 0.80, style: 0.08, use_speaker_boost: true }
      : { stability: 0.75, similarity_boost: 0.80, style: 0.12, use_speaker_boost: true };
  } else if (storyMode === "silly") {
    // More expressive, playful, higher style score
    voiceSettings = ageNum <= 3
      ? { stability: 0.65, similarity_boost: 0.75, style: 0.20, use_speaker_boost: true }
      : ageNum <= 5
      ? { stability: 0.55, similarity_boost: 0.80, style: 0.45, use_speaker_boost: true }
      : { stability: 0.45, similarity_boost: 0.80, style: 0.55, use_speaker_boost: true };
  } else {
    // Daytime — energetic but clear
    voiceSettings = ageNum <= 3
      ? { stability: 0.80, similarity_boost: 0.75, style: 0.05, use_speaker_boost: true }
      : ageNum <= 5
      ? { stability: 0.65, similarity_boost: 0.80, style: 0.25, use_speaker_boost: true }
      : { stability: 0.55, similarity_boost: 0.80, style: 0.35, use_speaker_boost: true };
  }
  const languageCode = ELEVENLABS_LANG_CODES[language] || "en";
  // multilingual_v2 doesn't need language_code — it auto-detects from text
  const body = { text, model_id: model, voice_settings: voiceSettings, enable_ssml_parsing: true };
  if (model === "eleven_turbo_v2_5") body.language_code = languageCode;
  try {
    const r = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${narrator.id}`,
      body,
      { headers: { "xi-api-key": process.env.ELEVENLABS_KEY, "Content-Type": "application/json", Accept: "audio/mpeg" }, responseType: "arraybuffer" }
    );
    return "data:audio/mpeg;base64," + Buffer.from(r.data).toString("base64");
  } catch (e) {
    const status = e.response?.status;
    if (status === 429 && attempt < 3) {
      const waitSec = [15, 30, 60][attempt];
      console.log("  ElevenLabs rate limited, waiting " + waitSec + "s (attempt " + (attempt+1) + ")...");
      await sleep(waitSec * 1000);
      return generateVoice(text, ageNum, language, narratorKey, attempt + 1, storyMode);
    }
    throw e;
  }
}

async function generateSoundEffect(description, attempt) {
  if (attempt === undefined) attempt = 0;
  try {
    const r = await axios.post(
      "https://api.elevenlabs.io/v1/sound-generation",
      { text: description, duration_seconds: 1.5, prompt_influence: 0.4 },
      { headers: { "xi-api-key": process.env.ELEVENLABS_KEY, "Content-Type": "application/json", Accept: "audio/mpeg" }, responseType: "arraybuffer" }
    );
    return "data:audio/mpeg;base64," + Buffer.from(r.data).toString("base64");
  } catch (e) {
    const status = e.response?.status;
    if (status === 429 && attempt < 2) {
      await sleep(15000);
      return generateSoundEffect(description, attempt + 1);
    }
    console.error("  Sound effect failed:", e.message);
    return null;
  }
}
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
            <div style="text-align:center;margin-bottom:32px;">
              <span style="font-size:48px;">📖</span>
              <div style="font-size:28px;font-weight:700;color:white;margin-top:8px;">
                Dream<span style="color:#f4a87a">zy</span>
              </div>
            </div>
            <div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:32px;text-align:center;">
              <div style="font-size:40px;margin-bottom:16px;">✨</div>
              <h1 style="color:white;font-size:22px;margin:0 0 8px;font-weight:700;">
                ${childName}'s story is ready!
              </h1>
              <p style="color:rgba(255,255,255,0.5);font-size:15px;margin:0 0 24px;line-height:1.6;">
                <em style="color:rgba(255,255,255,0.8)">"${storyTitle}"</em><br/>
                A personalized bedtime story, just for ${childName}.
              </p>
              <a href="${shareUrl || "https://dreamzy.xyz"}"
                style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#D4845A,#C878C0,#8B5CF6);border-radius:16px;color:white;text-decoration:none;font-weight:700;font-size:16px;box-shadow:0 4px 20px rgba(212,132,90,0.4);">
                ▶ Read the Story
              </a>
            </div>
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
  } catch (e) {
    console.error("Email failed:", e.message);
  }
}

app.post("/preview-story", async (req, res) => {
  const { childName, age, interests, theme, mood, lesson, customHero, language } = req.body;
  const ageNum = resolveAge(age);
  const interestList = (interests || []).join(", ");
  const lang = LANGUAGE_CONFIG[language] || LANGUAGE_CONFIG.en;
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      system: `You are a children's book author. Given a child's details, generate a short story preview.
${lang.instruction ? `LANGUAGE: ${lang.instruction} Write the preview in that language.` : ""}
Return ONLY valid JSON with no markdown:
{
  "title": "An engaging story title featuring ${customHero || childName}",
  "synopsis": "2-3 sentences describing what this story will be about. Make it sound magical and exciting. Mention the child's name and key interests.",
  "hook": "A single teaser line that ends with intrigue — like a book back cover."
}`,
      messages: [{ role: "user", content: `Child: ${childName}, age ${ageNum}. Interests: ${interestList}. Theme: ${theme || "adventure"}. Mood: ${mood || "magical"}.${lesson ? ` Lesson: ${lesson}.` : ""}${customHero ? ` Hero: ${customHero}.` : ""}` }],
    });
    const text = response.content.map(b => b.text || "").join("");
    const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ error: "No preview generated" });
    const preview = JSON.parse(match[0]);
    res.json(preview);
  } catch (e) {
    console.error("Preview error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post("/generate-full-story", async (req, res) => {
  const { childName, age, interests, theme, mood, previousStory, illustrationStyle, pageCount, lesson, appearance, customHero, justWatching, isClassroom, language, narrator, plan, storyMode } = req.body;
  const imgStyle = illustrationStyle || "cartoon";
  const lang = language || "en";
  const narratorKey = narrator || DEFAULT_NARRATOR;
  const isFamilyPlus = plan === "family_plus";
  const activeStoryMode = storyMode || "daytime";
  console.log("Using illustration style:", imgStyle, "| Language:", lang, "| Narrator:", narratorKey, "| Plan:", plan, "| Mode:", activeStoryMode);
  if (!childName && !customHero) return res.status(400).json({ error: "Need child name or custom hero" });
  if (!interests?.length) return res.status(400).json({ error: "Need at least one interest" });
  const ageNum = resolveAge(age);

  try {
    const isContinuation = !!previousStory;
    console.log("Generating story for " + childName + " (age " + ageNum + ")" + (isContinuation ? " — Episode " + ((previousStory.episode || 1) + 1) : "") + "...");

    // genId is ALWAYS created — used as the storage path even for anonymous users
    const genId = (childName || customHero || "story").toLowerCase().replace(/[^a-z0-9]/g, "-") + "-" + Date.now();

    if (req.body.userId) {
      const { error: genError } = await supabaseAdmin.from("generations").insert({
        id: genId, user_id: req.body.userId,
        title: customHero ? "A story with " + customHero : (childName || "story") + "'s story",
        child_name: childName || customHero || "story",
        age: ageNum, created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        status: "generating", progress: 0, pages: [], language: lang
      });
      if (genError) console.error("Gen insert error:", JSON.stringify(genError));
      else console.log("Generation record created:", genId);
    }

    const updateProgress = async (progress, status) => {
      if (req.body.userId) {
        try { await supabaseAdmin.from("generations").update({ progress, status }).eq("id", genId); } catch (e) {}
      }
    };

    const storyData = await generateStoryWithRetry(childName, age, interests, theme, mood, previousStory || null, { pageCount }, lesson, appearance, customHero, lang, isFamilyPlus, activeStoryMode, justWatching, isClassroom);
    await updateProgress(15, "generating");

    if (appearance && appearance.trim()) {
      storyData.characterDescription = `${childName}: ${appearance.trim()}`;
      storyData.pages = storyData.pages.map(p => ({
        ...p,
        illustrationPrompt: `${storyData.characterDescription} — ${p.illustrationPrompt}`
      }));
      console.log("Using parent appearance:", storyData.characterDescription);
    }

    storyData.pages[storyData.pages.length - 1] = improveEnding(storyData.pages[storyData.pages.length - 1], childName, theme, ageNum, lang);
    console.log("Got: \"" + storyData.title + "\" (" + storyData.ageRange + ") — " + storyData.pages.length + " pages");

    console.log("Generating illustrations...");
    await updateProgress(20, "illustrating");

    // ── Cover image ──────────────────────────────────────────────────────────
    const coverPrompt = `A beautiful storybook cover illustration for a children's book titled "${storyData.title}". CHARACTER (copy exactly): ${storyData.characterDescription || childName}. Magical, warm, inviting cover art. Centered composition, rich colors, whimsical atmosphere. The character is featured prominently in the center, looking adventurous and welcoming. NO text or letters anywhere.`;
    console.log("  Cover image...");
    let coverImageUrl = null;
    try {
      const coverBase64 = await generateImage(coverPrompt, storyData.characterDescription, imgStyle);
      // FIX: always upload to storage — do NOT fall back to storing base64 in DB
      const uploaded = await uploadImageToStorage(coverBase64, genId, 0);
      coverImageUrl = uploaded; // null if upload failed — frontend shows placeholder
      if (!uploaded) console.warn("  Cover storage upload failed, imageUrl will be null");
    } catch (e) {
      console.error("  Cover image failed:", e.message);
    }

    // ── Cover narration ──────────────────────────────────────────────────────
    let coverAudioUrl = null;
    try {
      const langConfig = LANGUAGE_CONFIG[lang] || LANGUAGE_CONFIG.en;
      const coverText = `${storyData.title}. ${langConfig.coverPhrase} ${childName}.`;
      coverAudioUrl = await generateVoice(coverText, ageNum, lang, narratorKey, undefined, activeStoryMode);
    } catch (e) {
      console.error("  Cover audio failed:", e.message);
    }

    // ── Page images — sequential ─────────────────────────────────────────────
    const imageUrls = [];
    let worldDescription = null; // Built from page 1, injected into all subsequent pages

    for (let i = 0; i < storyData.pages.length; i++) {
      console.log("  Image " + (i + 1) + "/" + storyData.pages.length + "...");
      await updateProgress(20 + Math.round((i / storyData.pages.length) * 45), "illustrating");

      // Build world description from page 1's illustration prompt
      // Extract palette/setting/mood to anchor all subsequent images
      if (i === 0) {
        const p1 = storyData.pages[0].illustrationPrompt || "";
        // Pull out lighting, palette, and location cues from page 1
        const lightingMatch = p1.match(/(warm|soft|bright|golden|cozy|misty|sunny|dark|dreamy|glowing)[^.]*light[^.]*/i);
        const settingMatch = p1.match(/(?:in|at|inside|outside)\s+(?:a|an|the)\s+[^,.]+/i);
        worldDescription = [
          lightingMatch ? `Lighting: ${lightingMatch[0].trim()}` : null,
          settingMatch ? `Main setting: ${settingMatch[0].trim()}` : null,
          `Art style consistency: same color palette, same line style, same overall visual tone as established on page 1`,
        ].filter(Boolean).join(". ");
      }

      let url = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const base64 = await generateImage(storyData.pages[i].illustrationPrompt, storyData.characterDescription, imgStyle, undefined, worldDescription);
          url = await uploadImageToStorage(base64, genId, i + 1);
          if (!url) console.warn(`  Page ${i+1} storage upload failed, imageUrl will be null`);
          break;
        } catch (e) {
          console.error("  Image " + (i + 1) + " attempt " + (attempt + 1) + " failed:", e.message);
          if (attempt < 2) await sleep(2000);
        }
      }
      imageUrls.push(url); // null entries are handled gracefully by frontend
    }

    // ── Narration ────────────────────────────────────────────────────────────
    console.log("Generating narration...");
    await updateProgress(70, "narrating");
    const audioUrls = [];
    const skipNarration = narratorKey === "none";
    for (let i = 0; i < storyData.pages.length; i++) {
      if(skipNarration){audioUrls.push(null);continue;}
      await updateProgress(70 + Math.round((i / storyData.pages.length) * 25), "narrating");
      // Small gap between calls to avoid bursting ElevenLabs
      if (i > 0) await sleep(300);
      let result = null;
      try {
        result = await generateVoice(formatNarration(storyData.pages[i].lines, ageNum), ageNum, lang, narratorKey, undefined, activeStoryMode);
        console.log("  Voice " + (i + 1) + "/" + storyData.pages.length + " done");
      } catch (e) {
        console.error("  Voice " + (i + 1) + " failed after retries:", e.message);
        // null — frontend will skip narration for this page gracefully
      }
      audioUrls.push(result);
    }

    const seriesId = previousStory?.series_id || previousStory?.seriesId || (childName.toLowerCase().replace(/\s+/g, "-") + "-" + Date.now());
    const episode = previousStory ? (previousStory.episode || 1) + 1 : 1;
    console.log("Story complete! Series: " + seriesId + " Episode: " + episode);

    // ── Sound effects (ages 2-4 only) ────────────────────────────────────────
    const soundEffectUrls = [];
    if (ageNum <= 4 && isFamilyPlus) {
      console.log("Generating sound effects for toddler story...");
      for (let i = 0; i < storyData.pages.length; i++) {
        const tappable = storyData.pages[i].tappable;
        if (tappable?.soundDescription) {
          await sleep(300);
          const sfx = await generateSoundEffect(tappable.soundDescription);
          soundEffectUrls.push(sfx);
          console.log("  SFX " + (i + 1) + " done: " + tappable.emoji);
        } else {
          soundEffectUrls.push(null);
        }
      }
    }

    // ── Build final pages array ──────────────────────────────────────────────
    // imageUrl is a storage URL (https://...) or null — NEVER base64
    // audioUrl is a base64 data URI (not stored in DB, only sent to client)
    const finalPages = [
      { isCover: true, title: storyData.title, childName, imageUrl: coverImageUrl, lines: [], audioUrl: null, language: lang },
      ...storyData.pages.map((p, i) => ({ ...p, imageUrl: imageUrls[i] || null, audioUrl: null }))
    ];

    // ── Update generations record (no base64 anywhere) ───────────────────────
    if (req.body.userId) {
      try {
        await supabaseAdmin.from("generations").update({
          title: storyData.title,
          child_name: childName || customHero || "story",
          status: "complete",
          progress: 100,
          // Store storage URLs only — audio is regenerated on read
          pages: finalPages
        }).eq("id", genId);
        console.log("Generation complete:", genId);
      } catch (e) {
        console.error("Generation update failed:", e.message);
      }
    }

    if (req.body.userEmail) {
      sendStoryEmail(req.body.userEmail, childName, storyData.title, process.env.FRONTEND_URL);
    }

    // ── Response: storage URLs + audio (audio only lives in memory/client) ───
    res.json({
      story: {
        title: storyData.title,
        childName,
        age: ageNum,
        ageRange: storyData.ageRange,
        createdAt: new Date().toISOString(),
        seriesId,
        episode,
        language: lang,
        storySummary: storyData.storySummary,
        characters: storyData.characters,
        pages: [
          { isCover: true, title: storyData.title, childName, imageUrl: coverImageUrl, lines: [], audioUrl: coverAudioUrl, language: lang },
          ...storyData.pages.map((p, i) => ({
            ...p,
            imageUrl: imageUrls[i] || null,
            audioUrl: audioUrls[i] || null,
            tappable: p.tappable ? { ...p.tappable, soundUrl: soundEffectUrls[i] || null } : null,
          }))
        ]
      }
    });
  } catch (e) {
    console.error("Error:", e.message, e.stack);
    res.status(500).json({ error: e.message || "Unknown error" });
  }
});

app.post("/regenerate-audio", async (req, res) => {
  const { pages, age, language, narrator, storyMode } = req.body;
  if (!pages?.length) return res.status(400).json({ error: "No pages" });
  const ageNum = resolveAge(age);
  const lang = language || "en";
  const narratorKey = narrator || DEFAULT_NARRATOR;
  const activeMode = storyMode || "daytime";
  try {
    console.log("Regenerating audio for " + pages.length + " pages (lang: " + lang + ", narrator: " + narratorKey + ", mode: " + activeMode + ")...");
    const audioUrls = await Promise.all(
      pages.map(async (page, i) => {
        try {
          const url = await generateVoice(formatNarration(page.lines, ageNum), ageNum, lang, narratorKey, undefined, activeMode);
          console.log("  Voice " + (i + 1) + " done");
          return url;
        } catch (e) { console.error("  Voice " + (i + 1) + " failed:", e.message); return null; }
      })
    );
    res.json({ audioUrls });
  } catch (e) {
    console.error("Regenerate audio error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post("/regenerate-sfx", async (req, res) => {
  const { pages, age } = req.body;
  const ageNum = resolveAge(age);
  if (ageNum > 4) return res.json({ sfxUrls: [] });
  if (!pages?.length) return res.status(400).json({ error: "No pages" });
  try {
    console.log("Regenerating sound effects for " + pages.length + " pages...");
    const sfxUrls = [];
    for (let i = 0; i < pages.length; i++) {
      const tappable = pages[i].tappable;
      if (tappable?.soundDescription) {
        await sleep(300);
        const sfx = await generateSoundEffect(tappable.soundDescription);
        sfxUrls.push(sfx);
        console.log("  SFX " + (i + 1) + " done: " + tappable.emoji);
      } else {
        sfxUrls.push(null);
      }
    }
    res.json({ sfxUrls });
  } catch (e) {
    console.error("Regenerate sfx error:", e.message);
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
  const productName = (payload.data?.attributes?.product_name || "").toLowerCase();
  const trialEndsAt = payload.data?.attributes?.trial_ends_at || null;
  console.log("Webhook received:", eventName, customerEmail, "status:", status, "product:", productName);
  if (!customerEmail) return res.status(200).json({ received: true });

  // Detect plan from product name
  function detectPlan(name) {
    if (name.includes("classroom pro")) return "classroom_pro";
    if (name.includes("classroom basic") || name.includes("classroom")) return "classroom_basic";
    if (name.includes("family+") || name.includes("family plus")) return "family_plus";
    return "family";
  }

  try {
    if (["subscription_created", "subscription_updated"].includes(eventName)) {
      const isTrial = status === "on_trial";
      const isActive = status === "active";
      const isCancelled = status === "cancelled" || status === "expired";

      if (isTrial || isActive) {
        const plan = detectPlan(productName);
        await supabase.from("profiles").update({
          subscription_status: "paid",
          plan,
          trial_ends_at: isTrial ? trialEndsAt : null,
          lemon_squeezy_customer_id: payload.data?.attributes?.customer_id?.toString()
        }).eq("email", customerEmail);
        console.log(`${isTrial ? "Trial" : "Subscription"} activated for:`, customerEmail, "plan:", plan, isTrial ? `trial ends: ${trialEndsAt}` : "");
      }

      if (isCancelled) {
        await supabase.from("profiles").update({
          subscription_status: "free",
          plan: "free",
          trial_ends_at: null,
        }).eq("email", customerEmail);
        console.log("Subscription cancelled for:", customerEmail);
      }
    }

    if (eventName === "subscription_trial_will_end") {
      // Trial ending soon — could send a reminder email here
      console.log("Trial ending soon for:", customerEmail);
    }
  } catch (e) { console.error("Webhook error:", e.message); }
  res.status(200).json({ received: true });
});

app.post("/share-story", async (req, res) => {
  const { story, userId } = req.body;
  if (!story || !userId) return res.status(400).json({ error: "Missing story or userId" });
  try {
    const shareId = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
    // FIX: pages already have storage URLs — strip audio only (large), keep imageUrl as-is
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
    if (new Date(data.expires_at) < new Date()) return res.status(410).json({ error: "This story has expired" });
    await supabase.from("shared_stories").update({ views: (data.views || 0) + 1 }).eq("id", shareId);
    res.json({ story: data });
  } catch (e) {
    console.error("Share fetch error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post("/generate-pdf", async (req, res) => {
  const { story } = req.body;
  if (!story) return res.status(400).json({ error: "Missing story" });
  try {
    const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");
    const fetch = (await import("node-fetch")).default;
    const pdfDoc = await PDFDocument.create();
    const titleFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic);
    const bodyFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const pageWidth = 612, pageHeight = 792, margin = 48;
    const purple = rgb(0.49, 0.23, 0.93);
    const dark = rgb(0.1, 0.05, 0.2);

    const cover = pdfDoc.addPage([pageWidth, pageHeight]);
    cover.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: rgb(0.05, 0.04, 0.12) });
    cover.drawRectangle({ x: 0, y: 0, width: pageWidth, height: 8, color: purple });
    cover.drawRectangle({ x: 0, y: pageHeight - 8, width: pageWidth, height: 8, color: purple });
    const titleText = story.title || "A Dreamzy Story";
    cover.drawText(titleText, { x: margin, y: pageHeight / 2 + 60, size: 42, font: titleFont, color: rgb(1, 1, 1), maxWidth: pageWidth - margin * 2 });
    cover.drawText(`A story for ${story.childName}`, { x: margin, y: pageHeight / 2 - 10, size: 22, font: bodyFont, color: rgb(0.68, 0.55, 1) });
    cover.drawText(`Made with Dreamzy *`, { x: margin, y: margin, size: 12, font: bodyFont, color: rgb(0.4, 0.35, 0.55) });

    for (let i = 0; i < story.pages.length; i++) {
      const page = story.pages[i];
      const p = pdfDoc.addPage([pageWidth, pageHeight]);
      p.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: rgb(0.99, 0.97, 1) });
      p.drawRectangle({ x: 0, y: pageHeight - 6, width: pageWidth, height: 6, color: purple });
      const imgHeight = 340;
      if (page.imageUrl) {
        try {
          let imgData;
          if (page.imageUrl.startsWith("data:image")) {
            imgData = Buffer.from(page.imageUrl.split(",")[1], "base64");
          } else {
            const r = await fetch(page.imageUrl);
            imgData = Buffer.from(await r.arrayBuffer());
          }
          const embedded = page.imageUrl.includes("png") || page.imageUrl.includes("data:image/png")
            ? await pdfDoc.embedPng(imgData).catch(() => pdfDoc.embedJpg(imgData))
            : await pdfDoc.embedJpg(imgData).catch(() => pdfDoc.embedPng(imgData));
          const imgY = pageHeight - imgHeight - 24;
          p.drawImage(embedded, { x: margin, y: imgY, width: pageWidth - margin * 2, height: imgHeight - 24 });
        } catch (e) { console.log("Image embed failed:", e.message); }
      }
      const divY = pageHeight - imgHeight - 32;
      p.drawLine({ start: { x: margin, y: divY }, end: { x: pageWidth - margin, y: divY }, thickness: 1, color: rgb(0.8, 0.75, 0.95) });
      const lines = page.lines || [];
      const text = lines.join(" ");
      const fontSize = 16;
      const lineHeight = fontSize * 1.6;
      const maxWidth = pageWidth - margin * 2;
      const words = text.split(" ");
      const wrappedLines = [];
      let currentLine = "";
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (bodyFont.widthOfTextAtSize(testLine, fontSize) > maxWidth && currentLine) {
          wrappedLines.push(currentLine); currentLine = word;
        } else currentLine = testLine;
      }
      if (currentLine) wrappedLines.push(currentLine);
      let textY = divY - 28;
      for (const line of wrappedLines) {
        if (textY < margin + 40) break;
        p.drawText(line, { x: margin, y: textY, size: fontSize, font: bodyFont, color: dark });
        textY -= lineHeight;
      }
      p.drawText(`${i + 1}`, { x: pageWidth / 2 - 6, y: margin - 10, size: 11, font: bodyFont, color: rgb(0.6, 0.55, 0.75) });
      p.drawRectangle({ x: 0, y: 0, width: pageWidth, height: 6, color: purple });
    }

    const pdfBytes = await pdfDoc.save();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="dreamzy-${(story.title || "story").replace(/[^a-z0-9]/gi, "-").toLowerCase()}.pdf"`);
    res.send(Buffer.from(pdfBytes));
    console.log("PDF generated:", story.title);
  } catch (e) {
    console.error("PDF error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Bedtime reminder emails ───────────────────────────────────────────────────
app.post("/send-weekly-recap", async (req, res) => {
  const secret = req.headers["x-cron-secret"];
  if (secret !== process.env.CRON_SECRET) return res.status(401).json({ error: "Unauthorized" });

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Get all users who generated a story in the last 7 days
    const { data: activeUsers, error } = await supabaseAdmin
      .from("stories")
      .select("user_id, title, child_name, created_at, pages")
      .gte("created_at", sevenDaysAgo)
      .order("created_at", { ascending: false });

    if (error) throw error;
    if (!activeUsers?.length) return res.json({ sent: 0, total: 0 });

    // Group stories by user
    const byUser = {};
    for (const s of activeUsers) {
      if (!byUser[s.user_id]) byUser[s.user_id] = [];
      byUser[s.user_id].push(s);
    }

    // Get profile info (email + streak) for these users
    const userIds = Object.keys(byUser);
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, email, streak_count, last_story_date")
      .in("id", userIds)
      .not("email", "is", null);

    if (!profiles?.length) return res.json({ sent: 0, total: 0 });

    let sent = 0;
    for (const profile of profiles) {
      try {
        const stories = byUser[profile.id] || [];
        if (!stories.length) continue;

        const streak = profile.streak_count || 0;
        const childName = stories[0].child_name || "your child";
        const storyCount = stories.length;
        const frontendUrl = process.env.FRONTEND_URL || "https://dreamzy.xyz";

        // Build story cards HTML — up to 4, with cover image
        const storyCards = stories.slice(0, 4).map(s => {
          const coverPage = (s.pages || []).find(p => p.isCover);
          const coverImg = coverPage?.imageUrl;
          return `
            <div style="display:inline-block;width:110px;vertical-align:top;margin:0 8px 16px;text-align:center;">
              ${coverImg
                ? `<img src="${coverImg}" width="110" height="110" style="border-radius:12px;object-fit:cover;display:block;margin-bottom:8px;" alt="${s.title}"/>`
                : `<div style="width:110px;height:110px;background:rgba(255,255,255,0.06);border-radius:12px;margin-bottom:8px;display:flex;align-items:center;justify-content:center;font-size:32px;">✨</div>`
              }
              <div style="font-size:11px;color:rgba(255,255,255,0.5);line-height:1.4;">${s.title}</div>
            </div>
          `;
        }).join("");

        const streakBlock = streak >= 2 ? `
          <div style="display:inline-flex;align-items:center;gap:8px;background:rgba(255,150,50,0.15);border:1px solid rgba(255,150,50,0.3);border-radius:20px;padding:8px 20px;margin-bottom:24px;">
            <span style="font-size:20px;">🔥</span>
            <span style="color:#FF9632;font-weight:700;font-size:14px;">${streak} day streak — keep it going!</span>
          </div>
        ` : "";

        await resend.emails.send({
          from: "Dreamzy <stories@dreamzy.xyz>",
          to: profile.email,
          subject: `✨ ${childName}'s week in stories — ${storyCount} ${storyCount === 1 ? "adventure" : "adventures"}!`,
          html: `
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
            <body style="margin:0;padding:0;background:#0d0a1e;font-family:'Helvetica Neue',Arial,sans-serif;">
              <div style="max-width:520px;margin:0 auto;padding:40px 24px;">

                <div style="text-align:center;margin-bottom:32px;">
                  <img src="https://dreamzy.xyz/logo.png" width="72" height="72" style="display:block;margin:0 auto 8px;" alt="Dreamzy"/>
                  <div style="font-size:26px;font-weight:700;color:white;">Dream<span style="color:#f4a87a">zy</span></div>
                </div>

                <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:32px;text-align:center;">
                  <h1 style="color:white;font-size:22px;margin:0 0 8px;font-weight:700;font-style:italic;">
                    ${childName}'s week in stories ✨
                  </h1>
                  <p style="color:rgba(255,255,255,0.4);font-size:14px;margin:0 0 24px;">
                    ${storyCount} ${storyCount === 1 ? "story" : "stories"} created this week
                  </p>

                  ${streakBlock}

                  <div style="margin-bottom:28px;">
                    ${storyCards}
                  </div>

                  <a href="${frontendUrl}"
                    style="display:inline-block;padding:16px 40px;background:linear-gradient(135deg,#D4845A,#C878C0,#8B5CF6);border-radius:20px;color:white;text-decoration:none;font-weight:700;font-size:16px;box-shadow:0 4px 20px rgba(212,132,90,0.4);">
                    ✨ Create this week's next story
                  </a>
                </div>

                <div style="text-align:center;margin-top:20px;">
                  <p style="color:rgba(255,255,255,0.15);font-size:12px;margin:0;">
                    Made with ✨ by Dreamzy &nbsp;·&nbsp;
                    <a href="https://dreamzy.xyz" style="color:rgba(255,255,255,0.2);">dreamzy.xyz</a>
                  </p>
                </div>
              </div>
            </body>
            </html>
          `,
        });
        sent++;
        console.log("Weekly recap sent to:", profile.email);
        await sleep(200);
      } catch (e) {
        console.error("Weekly recap failed for:", profile.email, e.message);
      }
    }

    res.json({ sent, total: profiles.length });
  } catch (e) {
    console.error("Weekly recap error:", e.message);
    res.status(500).json({ error: e.message });
  }
});


app.post("/send-bedtime-reminders", async (req, res) => {
  // Simple secret check so random people can't spam your users
  const secret = req.headers["x-cron-secret"];
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    // Get all users with reminders enabled
    const { data: users, error } = await supabaseAdmin
      .from("profiles")
      .select("id, email, bedtime_reminder_name")
      .eq("bedtime_reminder", true)
      .not("email", "is", null);

    if (error) throw error;
    if (!users?.length) {
      console.log("No bedtime reminder users found");
      return res.json({ sent: 0 });
    }

    console.log(`Sending bedtime reminders to ${users.length} users...`);
    let sent = 0;

    for (const user of users) {
      try {
        const childName = user.bedtime_reminder_name || "your child";
        await resend.emails.send({
          from: "Dreamzy <stories@dreamzy.xyz>",
          to: user.email,
          subject: `🌙 Time for ${childName}'s bedtime story!`,
          html: `
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
            <body style="margin:0;padding:0;background:#0d0a1e;font-family:'Helvetica Neue',Arial,sans-serif;">
              <div style="max-width:520px;margin:0 auto;padding:40px 24px;">

                <div style="text-align:center;margin-bottom:32px;">
                  <img src="https://dreamzy.xyz/logo.png" width="80" height="80" style="display:block;margin:0 auto 8px;" alt="Dreamzy"/>
                  <div style="font-size:28px;font-weight:700;color:white;">
                    Dream<span style="color:#f4a87a">zy</span>
                  </div>
                </div>

                <div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:32px;text-align:center;">
                  <div style="font-size:48px;margin-bottom:16px;">🌙</div>
                  <h1 style="color:white;font-size:24px;margin:0 0 12px;font-weight:700;font-style:italic;">
                    Bedtime is almost here ✨
                  </h1>
                  <p style="color:rgba(255,255,255,0.5);font-size:15px;margin:0 0 8px;line-height:1.7;">
                    ${childName}'s personalized story is waiting to be created.<br/>
                    It only takes a minute — Claude writes it, AI illustrates it,<br/>
                    and a warm voice narrates it.
                  </p>
                  <p style="color:rgba(255,255,255,0.3);font-size:13px;margin:0 0 28px;">
                    Tonight's adventure is just a tap away.
                  </p>
                  <a href="${process.env.FRONTEND_URL || "https://dreamzy.xyz"}"
                    style="display:inline-block;padding:16px 40px;background:linear-gradient(135deg,#D4845A,#C878C0,#8B5CF6);border-radius:20px;color:white;text-decoration:none;font-weight:700;font-size:17px;box-shadow:0 4px 20px rgba(212,132,90,0.4);">
                    ✨ Create Tonight's Story
                  </a>
                </div>

                <div style="text-align:center;margin-top:20px;">
                  <p style="color:rgba(255,255,255,0.15);font-size:12px;margin:0 0 6px;">
                    Made with ✨ by Dreamzy &nbsp;·&nbsp;
                    <a href="https://dreamzy.xyz" style="color:rgba(255,255,255,0.2);">dreamzy.xyz</a>
                  </p>
                  <p style="color:rgba(255,255,255,0.1);font-size:11px;margin:0;">
                    To turn off these reminders, open Dreamzy and toggle off "Bedtime reminder".
                  </p>
                </div>
              </div>
            </body>
            </html>
          `,
        });
        sent++;
        console.log("Bedtime reminder sent to:", user.email);
        // Small delay to avoid Resend rate limits
        await sleep(200);
      } catch (e) {
        console.error("Reminder failed for:", user.email, e.message);
      }
    }

    res.json({ sent, total: users.length });
  } catch (e) {
    console.error("Bedtime reminders error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get("/narrators", (req, res) => {
  res.json({ narrators: Object.entries(NARRATORS).map(([key, v]) => ({ key, ...v })) });
});

app.get("/checkout-urls", (req, res) => {
  res.json({
    familyMonthly: process.env.LEMONSQUEEZY_FAMILY_MONTHLY_URL,
    familyYearly: process.env.LEMONSQUEEZY_FAMILY_YEARLY_URL,
    familyPlusMonthly: process.env.LEMONSQUEEZY_FAMILYPLUS_MONTHLY_URL,
    familyPlusYearly: process.env.LEMONSQUEEZY_FAMILYPLUS_YEARLY_URL,
    classroomBasicMonthly: process.env.LEMONSQUEEZY_CLASSROOM_BASIC_MONTHLY_URL,
    classroomBasicYearly: process.env.LEMONSQUEEZY_CLASSROOM_BASIC_YEARLY_URL,
    classroomProMonthly: process.env.LEMONSQUEEZY_CLASSROOM_PRO_MONTHLY_URL,
    classroomProYearly: process.env.LEMONSQUEEZY_CLASSROOM_PRO_YEARLY_URL,
  });
});

app.listen(PORT, "0.0.0.0", () => console.log("Dreamzy backend running on http://localhost:" + PORT));