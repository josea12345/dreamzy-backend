content = open('server.js').read()

old = '''    const isContinuation = !!previousStory;
    console.log("Generating story for " + childName + " (age " + ageNum + ")" + (isContinuation ? " — Episode " + ((previousStory.episode || 1) + 1) : "") + "...");

    const storyData = await generateStoryWithRetry'''

new = '''    const isContinuation = !!previousStory;
    console.log("Generating story for " + (childName||customHero||"unknown") + " (age " + ageNum + ")" + (isContinuation ? " — Episode " + ((previousStory.episode || 1) + 1) : "") + "...");

    const genId = (childName||customHero||"story").toLowerCase().replace(/[^a-z0-9]/g, "-") + "-" + Date.now();
    if (req.body.userId) {
      await supabase.from("generations").insert({
        id: genId, user_id: req.body.userId,
        title: customHero ? "A story with " + customHero : childName + "'s story",
        child_name: childName || customHero || "story",
        age: ageNum, created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24*60*60*1000).toISOString(),
        status: "generating", progress: 0, pages: []
      }).catch(e => console.error("Gen insert failed:", e.message));
    }
    const updateProgress = async (progress, status) => {
      if (req.body.userId) await supabase.from("generations").update({ progress, status }).eq("id", genId).catch(()=>{});
    };

    const storyData = await generateStoryWithRetry'''

content = content.replace(old, new)
open('server.js', 'w').write(content)
print('fixed:', 'updateProgress' in content and 'genId' in content)
