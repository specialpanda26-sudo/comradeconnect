/* cc-market-cart.js v1: Market cart, top-bar cart icon, M-Pesa-only pay sheet */
(function(){'use strict';
if(window.__ccCart)return;window.__ccCart=1;
var KEY='cc_mcart',MAX=10,cart=[],stack=[],busy=false;
try{cart=JSON.parse(localStorage.getItem(KEY)||'[]')||[]}catch(e){cart=[]}
var $=function(s,r){return(r||document).querySelector(s)};
var kes=function(n){return 'KSh '+Number(n).toLocaleString('en-KE')};
var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
var sleep=function(ms){return new Promise(function(r){setTimeout(r,ms)})};
function toast(m){try{window.ccTools.toast(m)}catch(e){}}
function find(id){var S=window.ccMk&&ccMk.S;if(!S)return null;return S.list.find(function(x){return x.id===id})||S.mine.find(function(x){return x.id===id})||null}
function total(){return cart.reduce(function(a,c){return a+Number(c.p||0)},0)}
function save(){try{localStorage.setItem(KEY,JSON.stringify(cart))}catch(e){}badge()}
function has(id){return cart.some(function(c){return c.id===id})}
function add(id,quiet){
 if(has(id)){if(!quiet)toast('Already in your cart');return true}
 var l=find(id);if(!l)return false;
 if(l.mine){toast('This is your own item');return false}
 if(cart.length>=MAX){toast('Your cart holds up to '+MAX+' items');return false}
 cart.push({id:id,t:l.title,p:l.price,z:l.zone||'',i:(l.photos||[])[0]||''});save();if(!quiet)toast('Added to cart');return true}
var ICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M3 4h2.4l2.2 11h10.6l2-8H6.4"/></svg>';
function bar(){var g=$('body>nav.g:not(#tb) .crd-gear');if(!g)return null;var b=$('.ccc-cart',g.parentNode);
 if(!b){b=document.createElement('button');b.type='button';b.className='ib ccc-cart';b.setAttribute('aria-label','Cart');b.innerHTML=ICON+'<span class="ccc-n"></span>';b.onclick=openCart;g.parentNode.insertBefore(b,g)}return b}
function badge(){var b=bar();if(!b)return;var n=cart.length,m=document.body.dataset.view==='market';b.classList.toggle('on',m||n>0);var c=$('.ccc-n',b);c.textContent=n;c.hidden=!n}
function sheet(){
 var ov=document.createElement('div'),o={el:ov,closed:false,lock:false};
 ov.className='ccc-ov';ov.innerHTML='<div class="ccc-sh" role="dialog" aria-modal="true"><i class="ccc-grab"></i><div class="ccc-bd"></div></div>';
 document.body.appendChild(ov);o.body=$('.ccc-bd',ov);
 o.close=function(how){if(o.closed)return;o.closed=true;ov.remove();stack=stack.filter(function(x){return x!==o});if(!how&&history.state&&history.state.ccc){try{history.back()}catch(e){}}};
 ov.addEventListener('click',function(e){if(o.lock)return;if(e.target===ov||e.target.closest('[data-x]'))o.close()});
 stack.push(o);try{history.pushState({ccc:1},'')}catch(e){}
 return o}
window.addEventListener('popstate',function(){var t=stack[stack.length-1];if(!t)return;if(t.lock){try{history.pushState({ccc:1},'')}catch(e){}return}t.close('pop')});
document.addEventListener('click',function(e){
 var a=e.target.closest&&e.target.closest('.mu-add');
 if(a){e.stopPropagation();e.preventDefault();var c=a.closest('.mc');if(c&&add(c.dataset.id)){a.textContent='\u2713';a.classList.add('done');setTimeout(function(){a.textContent='+';a.classList.remove('done')},1200)}return}
 var b=e.target.closest&&e.target.closest('#mvbuy');
 if(b){e.stopPropagation();e.preventDefault();var id=b.dataset.id;if(add(id,true)||has(id))openCart()}
},true);
new MutationObserver(badge).observe(document.body,{attributes:true,attributeFilter:['data-view']});
setInterval(badge,1500);badge();
function xbtn(){return '<button type="button" class="ccc-x" data-x aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="18" height="18"><path d="M6 6l12 12M18 6L6 18"/></svg></button>'}
function toOrders(){['dx5','dx6','dx7'].forEach(function(i){var x=document.getElementById(i);if(x)x.click()});var m=$('#tb button[data-v="market"]');if(m)m.click();setTimeout(function(){var b=$('#mseg button[data-s="orders"]');if(b)b.click()},150)}
function draw(o){
 if(!cart.length){o.body.innerHTML='<div class="ccc-hd"><h3>Your cart</h3>'+xbtn()+'</div><p class="ccc-em">Your cart is empty</p><button type="button" class="ccc-b dark" data-x>Browse the market</button>';return}
 o.body.innerHTML='<div class="ccc-hd"><h3>Your cart</h3>'+xbtn()+'</div><div>'+cart.map(function(c){return '<div class="ccc-row">'+(c.i?'<img class="ccc-th" src="'+esc(c.i)+'" alt="">':'<span class="ccc-th"></span>')+'<div class="ccc-mid"><b>'+esc(c.t)+'</b><small>@'+esc(c.z||'Campus')+'</small></div><b class="ccc-pr">'+kes(c.p)+'</b><button type="button" class="ccc-rm" data-rm="'+esc(c.id)+'" aria-label="Remove">&times;</button></div>'}).join('')+'</div><div class="ccc-box"><div class="ccc-sub"><span>Subtotal</span><b>'+kes(total())+'</b></div><p>Held in escrow. The platform fee is taken from the seller\'s share, not added to yours.</p></div><button type="button" class="ccc-b dark" data-pay>Pay with escrow &middot; '+kes(total())+'</button><button type="button" class="ccc-b" data-x>Keep shopping</button>'}
function openCart(){if(stack.length)return;var o=sheet();draw(o);
 o.el.addEventListener('click',function(e){var t=e.target.closest('button');if(!t||o.lock)return;
  if(t.dataset.rm){cart=cart.filter(function(c){return c.id!==t.dataset.rm});save();draw(o)}
  else if(t.hasAttribute('data-pay')){o.close('quiet');openPay()}})}
function openPay(){
 if(!cart.length)return;var o=sheet(),n=cart.length,tot=total(),saved='';try{saved=localStorage.getItem('cc_mcart_ph')||''}catch(e){}
 o.body.innerHTML='<div class="ccc-hd"><h3>Pay</h3>'+xbtn()+'</div><div id="ccc-f"><div class="ccc-box"><small class="ccc-cap">CART &middot; '+n+(n>1?' ITEMS':' ITEM')+'</small><b class="ccc-big">'+kes(tot)+'</b><p>Held in escrow. The seller is paid after you confirm.</p></div><label class="ccc-lb" for="ccc-ph">M-PESA NUMBER</label><input class="ccc-in" id="ccc-ph" type="tel" inputmode="numeric" maxlength="13" placeholder="0712 345 678" autocomplete="tel" value="'+esc(saved)+'"><div class="ccc-pt" id="ccc-pt" hidden><div><b>Use points</b><small id="ccc-ps"></small></div><label class="ccc-sw"><input type="checkbox" id="ccc-up"><i></i></label></div><p class="ccc-er" id="ccc-er" role="alert"></p><button type="button" class="ccc-b grad" id="ccc-go">Pay '+kes(tot)+'</button><p class="ccc-nt">Never share your M-Pesa PIN with anyone.</p></div><div id="ccc-st" hidden></div>';
 var go=$('#ccc-go',o.el),ph=$('#ccc-ph',o.el),er=$('#ccc-er',o.el),up=$('#ccc-up',o.el),fee=(window.ccMk&&ccMk.fee&&ccMk.fee())||7,cut=0,per=10;
 function label(){go.textContent='Pay '+kes(tot-(up.checked?cut:0))}
 try{ccCall('/api/points').then(function(p){per=p.per_ksh||10;cut=Math.min(Math.floor(tot*fee/100+1e-9),Math.floor((p.points||0)/per));if(cut<1)return;$('#ccc-ps',o.el).textContent=(cut*per)+' points saves '+kes(cut)+' on our fee. You have '+p.points+'.';$('#ccc-pt',o.el).hidden=false}).catch(function(){})}catch(e){}
 up.onchange=label;
 go.onclick=async function(){
  if(busy)return;var v=ph.value.replace(/[\s+-]/g,'').replace(/^254(?=[17]\d{8}$)/,'0');
  if(!/^(07|01)(?!(\d)\1{7}$)\d{8}$/.test(v)){er.textContent='Enter a Safaricom or Airtel number like 0712345678.';return}
  er.textContent='';busy=true;o.lock=true;try{localStorage.setItem('cc_mcart_ph',v)}catch(e){}
  var f=$('#ccc-f',o.el),st=$('#ccc-st',o.el);f.hidden=true;st.hidden=false;
  var ids=cart.map(function(c){return c.id}),ps=ccSteps.paySteps(st,v,tot-(up.checked?cut:0),'escrow');
  try{
   var body=ids.length>1?{listing_ids:ids,phone:v,use_points:up.checked}:{listing_id:ids[0],phone:v,use_points:up.checked};
   var d=await ccCall('/api/market/buy',{body:body});
   try{localStorage.setItem('cc_pending',JSON.stringify({id:d.id,amount:d.amount,t:Date.now()}))}catch(e){}
   ps.go('prompt');
   await ccMk.waitPaid(d.id,function(s){ps.go(s)});
   try{localStorage.removeItem('cc_pending')}catch(e){}
   ps.go('done');await sleep(1100);ps.stop();
   var title=cart.map(function(c){return c.t}).join(', ');
   cart=[];save();ccMk.S.list=ccMk.S.list.filter(function(x){return ids.indexOf(x.id)<0});
   st.innerHTML='<p class="ccc-ok">Payment received. '+kes(d.amount)+' is held safely in escrow. Find it under Orders.</p><button type="button" class="ccc-b dark" id="ccc-od">See my orders</button>';
   try{ccTick($('.ccc-ok',st))}catch(e){}
   $('#ccc-od',st).onclick=function(){o.close();toOrders()};
   o.lock=false;ccMk.loadOrders(true);
   try{window.ccReceipt&&ccReceipt.show({item:title,amount:d.amount,credit:d.credit,ref:d.id,via:'M-Pesa',onDone:function(){o.close();toOrders()}})}catch(e){}
  }catch(e){
   if(e&&e.pending){ps.stop();toast(e.message);o.lock=false;o.close();toOrders()}
   else{ps.fail(e&&e.message);await sleep(1800);ps.stop();st.hidden=true;f.hidden=false;er.textContent=(e&&e.message)||'Payment failed.';o.lock=false}
  }
  busy=false}
}
})();
