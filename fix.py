content = open('server.js').read()
content = content.replace(
    'if (!childName || !interests?.length) return res.status(400).json({ error: "Need child name and interests" });',
    'if (!childName && !customHero) return res.status(400).json({ error: "Need child name or custom hero" });\n  if (!interests?.length) return res.status(400).json({ error: "Need at least one interest" });'
)
open('server.js', 'w').write(content)
print('fixed:', 'Need child name or custom hero' in content)
