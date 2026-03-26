content = open('server.js').read()
content = content.replace(
    "}).catch(e => console.error(\"Gen insert failed:\", e.message));",
    "});\n      // ignore insert errors"
)
content = content.replace(
    "if (req.body.userId) await supabase.from(\"generations\").update({ progress, status }).eq(\"id\", genId).catch(()=>{});",
    "if (req.body.userId) { try { await supabase.from(\"generations\").update({ progress, status }).eq(\"id\", genId); } catch(e) {} }"
)
open('server.js', 'w').write(content)
print('fixed:', '.catch' not in content[content.find('genId'):content.find('genId')+500])
