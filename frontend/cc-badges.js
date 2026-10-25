// ccBadge('class_rep' | 'student_leader') returns badge HTML to place next to a handle.
(function(){
  var s=document.createElement('style');
  s.textContent='.cc-badge{display:inline-block;margin-left:6px;padding:1px 8px;border-radius:999px;font-size:11px;font-weight:600;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.25);backdrop-filter:blur(8px);color:#fff}.cc-badge.rep{color:#A8DCE7}.cc-badge.leader{color:#ffd76a}';
  document.head.appendChild(s);
  window.ccBadge=function(role){
    if(role==='class_rep')return '<span class="cc-badge rep">Class Rep</span>';
    if(role==='student_leader')return '<span class="cc-badge leader">Student Leader</span>';
    return '';
  };
})();
