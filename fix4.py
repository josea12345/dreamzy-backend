content = open('server.js').read()
old = '''      await supabase.from("generations").insert({
        id: genId, user_id: req.body.userId,
        title: customHero ? "A story with " + customHero : childName + "'s story",
        child_name: childName || customHero || "story",
        age: ageNum, created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24*60*60*1000).toISOString(),
        status: "generating", progress: 0, pages: []
      });
      // ignore insert errors'''
new = '''      const { error: genError } = await supabase.from("generations").insert({
        id: genId, user_id: req.body.userId,
        title: customHero ? "A story with " + customHero : (childName || "story") + "'s story",
        child_name: childName || customHero || "story",
        age: ageNum, created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24*60*60*1000).toISOString(),
        status: "generating", progress: 0, pages: []
      });
      if (genError) console.error("Gen insert error:", JSON.stringify(genError));
      else console.log("Generation record created:", genId);'''
content = content.replace(old, new)
open('server.js', 'w').write(content)
print('fixed:', 'genError' in content)
