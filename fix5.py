content = open('server.js').read()

# Add service role client
old = 'const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);'
new = '''const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY);'''
content = content.replace(old, new)

# Use admin client for generations
content = content.replace(
    'await supabase.from("generations").insert({',
    'await supabaseAdmin.from("generations").insert({'
)
content = content.replace(
    'await supabase.from("generations").update({ progress, status }).eq("id", genId)',
    'await supabaseAdmin.from("generations").update({ progress, status }).eq("id", genId)'
)
content = content.replace(
    'await supabase.from("generations").update({\n          title: storyData.title,',
    'await supabaseAdmin.from("generations").update({\n          title: storyData.title,'
)

open('server.js', 'w').write(content)
print('fixed:', 'supabaseAdmin' in content)
