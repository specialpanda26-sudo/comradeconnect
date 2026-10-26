/* Admin: Posts (see every post, hide / show / delete) and Clean up (clear finished data so the panels stay tidy).
   Loaded before admin-dash.js. Uses api, load, render, SECTIONS, LABEL, esc, when, act, toast from admin.html. */
(function () {
'use strict';
const P = { list: null, page: 1, state: 'all', q: '', more: false, busy: false };
const C = { scopes: null, pick: {}, aid: '' };
const _load = load;
load = async function () { await _load(); try { await loadPosts(); } catch (e) { P.list = null; } try { await loadClear(); } catch (e) { C.scopes = null; } render(); };
async function loadPosts() {
  const d = await api('/api/admin/posts?page=' + P.page + '&state=' + P.state + (P.q ? '&q=' + encodeURIComponent(P.q) : ''));
  P.list = d.posts || []; P.more = !!d.hasMore;
}
async function loadClear() { const d = await api('/api/admin/clear' + (C.aid ? '?aid=' + encodeURIComponent(C.aid) : '')); C.scopes = d.scopes || []; }
LABEL.cposts = 'Posts'; LABEL.cclean = 'Clean up';

SECTIONS.cposts = () => {
  const bar = '<div class="card"><h3>All posts</h3><p class="sub">Every post on the feed, newest first, hidden ones too. Hiding keeps the post but removes it from the feed. Deleting removes it for good.</p>'
    + '<input id="cp_q" placeholder="Search the words in a post" value="' + esc(P.q) + '" maxlength="60" autocomplete="off">'
    + '<div class="row"><button class="' + (P.state === 'all' ? 'p' : '') + '" data-cps="all">All</button><button class="' + (P.state === 'visible' ? 'p' : '') + '" data-cps="visible">On the feed</button><button class="' + (P.state === 'hidden' ? 'p' : '') + '" data-cps="hidden">Hidden</button><button id="cp_go">Search</button></div></div>';
  if (!P.list) return [bar, '<div class="card"><p class="sub">The posts could not load. Update the server, then tap Refresh.</p></div>'];
  if (!P.list.length) return [bar, '<div class="card"><p class="sub">No posts here.</p></div>'];
  const cards = P.list.map((x) => '<div class="card"><div class="kv"><span class="sub">' + esc(x.category) + (x.zone ? ' · @' + esc(x.zone) : '') + ' · ' + esc(when(x.createdAt)) + '</span><b>' + (x.hidden ? (x.awaitingFee ? 'Waiting for fee' : 'Hidden') : 'Live') + '</b></div>'
    + '<p>' + esc(x.content || '(voice or empty)') + '</p>'
    + '<p class="sub">' + (x.handle ? '@' + esc(x.handle) + ' · ' : '') + esc(x.aid) + ' · ' + x.likes + ' likes · ' + x.comments + ' comments · ' + x.views + ' views</p>'
    + '<div class="row">' + (x.hidden ? '<button data-cpa="unhide" data-id="' + x.id + '">Show on feed</button>' : '<button data-cpa="hide" data-id="' + x.id + '">Hide</button>') + '<button class="bad" data-cpa="delete" data-id="' + x.id + '">Delete</button></div></div>').join('');
  const nav = '<div class="card"><div class="row"><button data-cpp="-1"' + (P.page <= 1 ? ' disabled' : '') + '>Newer</button><span class="sub" style="align-self:center">Page ' + P.page + '</span><button data-cpp="1"' + (P.more ? '' : ' disabled') + '>Older</button></div></div>';
  return [bar, cards, nav];
};

SECTIONS.cclean = () => {
  const head = '<div class="card"><h3>Clean up</h3><p class="sub">Clear finished records so the panels start fresh. Open reports, live listings, orders still in escrow, unpaid post drafts, wallets, accounts and payments are never touched. Clearing cannot be undone.</p>'
    + '<input id="cc_aid" placeholder="Account ID (leave empty for every account)" value="' + esc(C.aid) + '" maxlength="64" autocomplete="off"><div class="row"><button id="cc_apply">Show counts</button></div></div>';
  if (!C.scopes) return [head, '<div class="card"><p class="sub">The counts could not load. Update the server, then tap Refresh.</p></div>'];
  const rows = C.scopes.map((s) => {
    const off = C.aid && !s.perAccount;
    return '<label class="kv" style="gap:10px;align-items:flex-start;' + (off ? 'opacity:.5' : '') + '"><input type="checkbox" data-cck="' + s.key + '"' + (C.pick[s.key] && !off ? ' checked' : '') + (off ? ' disabled' : '') + ' style="width:auto;margin-top:4px">'
      + '<span style="flex:1;text-align:left"><b>' + esc(s.label) + '</b> <span class="sub">(' + s.count + (s.capped ? '+' : '') + ')</span><br><span class="sub">' + esc(s.note) + (off ? ' Only cleared for every account.' : '') + '</span></span></label>';
  }).join('');
  const go = '<div class="card"><h3>Clear what is ticked</h3><input id="cc_conf" placeholder="Type CLEAR to confirm" autocomplete="off" maxlength="10"><div class="row"><button class="bad" id="cc_run">Clear now</button></div></div>';
  return [head, '<div class="card">' + rows + '</div>', go];
};

document.addEventListener('click', async (e) => {
  const t = e.target;
  let b = t.closest('[data-cps]');
  if (b) { P.state = b.dataset.cps; P.page = 1; P.q = ($('#cp_q') || {}).value || P.q; try { await loadPosts(); } catch (x) { toast(x.message); } return render(); }
  if (t.closest('#cp_go')) { P.q = $('#cp_q').value.trim(); P.page = 1; try { await loadPosts(); } catch (x) { toast(x.message); } return render(); }
  b = t.closest('[data-cpp]');
  if (b) { P.page = Math.max(1, P.page + Number(b.dataset.cpp)); try { await loadPosts(); } catch (x) { toast(x.message); } return render(); }
  b = t.closest('[data-cpa]');
  if (b) {
    const a = b.dataset.cpa;
    if (a === 'delete' && !confirm('Delete this post for good? This cannot be undone.')) return;
    return act(b, () => api('/api/admin/posts/' + b.dataset.id, { action: a }), a === 'delete' ? 'Post deleted' : a === 'hide' ? 'Post hidden' : 'Post shown');
  }
  if (t.closest('#cc_apply')) { C.aid = $('#cc_aid').value.trim(); try { await loadClear(); } catch (x) { toast(x.message); } return render(); }
  b = t.closest('[data-cck]');
  if (b) { C.pick[b.dataset.cck] = b.checked; return; }
  if (t.closest('#cc_run')) {
    const keys = Object.keys(C.pick).filter((k) => C.pick[k]);
    if (!keys.length) return toast('Tick what to clear');
    const conf = $('#cc_conf').value.trim();
    if (conf !== 'CLEAR') return toast('Type the word CLEAR to confirm');
    if (!confirm('Clear ' + keys.length + ' kind(s) of data for ' + (C.aid ? 'account ' + C.aid : 'EVERY account') + '? This cannot be undone.')) return;
    const btn = t.closest('#cc_run');
    return act(btn, async () => { const r = await api('/api/admin/clear', { scopes: keys, aid: C.aid, confirm: conf }); C.pick = {}; toast('Cleared ' + Object.values(r.cleared || {}).reduce((a, n) => a + n, 0) + ' records'); }, 'Done');
  }
});
})();
