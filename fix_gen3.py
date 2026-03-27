content = open('server.js').read()

old = '''    // Update generation record with completed story
    if (req.body.userId) {
      try {
        await supabaseAdmin.from("generations").update({
          title: storyData.title,
          child_name: childName || customHero || "story",
          status: "complete",
          progress: 100,
          pages: [
            { isCover: true, title: storyData.title, childName, imageUrl: coverImageUrl, lines: [], audioUrl: null },
            ...storyData.pages.map((p, i) => ({ ...p, imageUrl: imageUrls[i], audioUrl: null }))
          ]
        }).eq("id", genId);
        console.log("Generation complete:", genId);
      } catch(e) { console.error("Generation update failed:", e.message); }'''

new = '''    // Update generation record with completed story
    if (req.body.userId) {
      try {
        // Update status first (lightweight)
        await supabaseAdmin.from("generations").update({
          title: storyData.title,
          child_name: childName || customHero || "story",
          status: "complete",
          progress: 100
        }).eq("id", genId);
        console.log("Generation status updated to complete:", genId);
        
        // Then try to update pages (may fail if too large - that's ok)
        const pagesData = [
          { isCover: true, title: storyData.title, childName, imageUrl: coverImageUrl, lines: [], audioUrl: null },
          ...storyData.pages.map((p, i) => ({ ...p, imageUrl: imageUrls[i], audioUrl: null }))
        ];
        await supabaseAdmin.from("generations").update({ pages: pagesData }).eq("id", genId);
        console.log("Generation pages saved:", genId);
      } catch(e) { console.error("Generation update failed:", e.message); }'''

content = content.replace(old, new)
open('server.js', 'w').write(content)
print('fixed:', 'Generation status updated to complete' in content)
