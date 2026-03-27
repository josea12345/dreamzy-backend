content = open('server.js').read()
target = '    const storyData = await generateStoryWithRetry'
if 'const genId' not in content and target in content:
    insert = '''    const genId = (childName||customHero||"story").toLowerCase().replace(/[^a-z0-9]/g, "-") + "-" + Date.now();
    if (req.body.userId) {
      const { error: genError } = await supabaseAdmin.from("generations").insert({
        id: genId, user_id: req.body.userId,
        title: customHero ? "A story with " + customHero : (childName||"story") + "'s story",
        child_name: childName || customHero || "story",
        age: ageNum, created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24*60*60*1000).toISOString(),
        status: "generating", progress: 0, pages: []
      });
      if (genError) console.error("Gen insert error:", JSON.stringify(genError));
      else console.log("Generation record created:", genId);
    }
    const updateProgress = async (progress, status) => {
      if (req.body.userId) {
        try { await supabaseAdmin.from("generations").update({ progress, status }).eq("id", genId); } catch(e) {}
      }
    };
'''
    content = content.replace(target, insert + '    ' + target.strip())
    open('server.js', 'w').write(content)
    print('Fixed!')
else:
    print('Already there or target not found')
    print('Has genId:', 'const genId' in content)
