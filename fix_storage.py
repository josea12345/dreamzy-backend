content = open('server.js').read()
old = "    if (error) { console.error('Storage upload error:', error.message); return null; }"
new = "    if (error) { console.error('Storage upload error:', JSON.stringify(error)); return null; }\n    console.log('Image uploaded to storage:', fileName);"
content = content.replace(old, new)
open('server.js', 'w').write(content)
print('done')
