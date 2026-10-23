p = 'frontend/index.html'
s = open(p).read()
if 'class="act vdl"' in s: raise SystemExit('already patched')
a = """${v.srv&&v.mine===false?'<button class="act vrp">Report</button>':''}"""
assert a in s, 'STOP: video card not found'
s = s.replace(a, a + """${v.srv&&v.mine===true?'<button class="act vdl" style="color:#ff6b6b">Delete</button>':''}""", 1)
c = """'<span>'+(sv.has(v.id)?'Saved':'Save')+'</span></button></div><div class="rlb">"""
assert c in s, 'STOP: reel buttons not found'
s = s.replace(c, """'<span>'+(sv.has(v.id)?'Saved':'Save')+'</span></button>'+(v.mine?'<button data-a="del" aria-label="Delete this video"><span>Delete</span></button>':'')+'</div><div class="rlb">""", 1)
d = "else if(a==='cmt'){cur=v.id;"
assert d in s, 'STOP: reel handler not found'
s = s.replace(d, "else if(a==='del'){if(window.ccDeleteClip)window.ccDeleteClip(v.id);return}\n" + d, 1)
s = s.replace('cc-core.js?v=rc8b', 'cc-core.js?v=rc8c', 1)
open(p, 'w').write(s)
p = 'frontend/cc-core.js'
s = open(p).read()
e = "/* the old screens like locally;"
assert e in s, 'STOP: cc-core marker not found'
fn = '''/* delete one of my videos (the server checks it is mine) */
window.ccDeleteClip = async function (id) {
  if (!confirm('Delete this video? This cannot be undone.')) return;
  try {
    await call('/api/clips/' + id + '/delete', { body: {} });
    const i = VIDS.findIndex((x) => x.id === id); if (i >= 0) VIDS.splice(i, 1);
    redrawClips(); toast('Video deleted');
  } catch (e) { toast(e.message); }
};
'''
s = s.replace(e, fn + e, 1)
f = "    const rp = e.target.closest('.vrp');"
assert f in s, 'STOP: click handler not found'
s = s.replace(f, "    const dl = e.target.closest('.vdl');\n    if (dl) { e.stopPropagation(); return window.ccDeleteClip(dl.closest('.vcard').dataset.id); }\n" + f, 1)
open(p, 'w').write(s)
print('site patched')
