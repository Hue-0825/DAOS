const $=id=>document.getElementById(id);
const query=new URLSearchParams(location.search);
const product=query.get('product');
const money=new Intl.NumberFormat('ko-KR',{style:'currency',currency:'KRW'});
const photo=key=>`product-${key}.jpg`;
const esc=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);
let options;

function complete(order) {
  $('catalog-view').hidden=true;
  $('product-view').hidden=true;
  $('complete-view').hidden=false;
  $('confirmation').textContent=`주문 ${order.number}번 · 배송 배정일 ${order.date??'확인 중'} · ${order.province}`;
}
function catalog() {
  $('catalog-view').hidden=false;
  $('products').innerHTML=Object.entries(options.products).map(([key,name])=>{
    const item=options.catalog[key];
    return `<a class="product-card" href="?product=${key}"><img src="${photo(key)}" alt="${esc(name)}"><div><small>${esc(item.label)}</small><h3>${esc(name)}</h3><strong>${money.format(item.price)}</strong></div></a>`;
  }).join('');
}
function choose(id,choices,placeholder){
  const select=$(id);
  const previous=select.value;
  select.replaceChildren(new Option(placeholder,''),...choices.map(({label,value})=>new Option(label,value)));
  if(choices.some(item=>item.value===previous))select.value=previous;
  select.disabled=!choices.length;
}
function chooseStops(){
  const stops=options.stops.filter(stop=>stop.province===$('province').value);
  const cities=[...new Set(stops.map(stop=>stop.city))];
  choose('city',cities.map(city=>({label:city,value:city})),'시·군·구 선택');
  if(cities.length===1)$('city').value=cities[0];
  const choices=stops.filter(stop=>stop.city===$('city').value).map(stop=>({label:stop.label,value:stop.id}));
  choose('destination',choices,'배송지 선택');
  $('hint').textContent=choices.length?'선택한 시설이 기사 지도에 표시됩니다.':'시·도와 시·군·구를 선택하세요.';
  $('submit').disabled=!choices.length;
}
function showClock(clock){
  if(clock)$('shared-clock').textContent=`시연 ${clock.date} ${clock.time}`;
}
async function refreshClock(){
  try{
    const response=await fetch('/api/shop/clock',{cache:'no-store',signal:AbortSignal.timeout(3500)});
    if(response.ok)showClock(await response.json());
  }catch{}
}
function total(){
  $('total').textContent=money.format(options.catalog[product].price*($('quantity').valueAsNumber||0));
}
function detail(){
  const item=options.catalog[product];
  const name=options.products[product];
  $('product-view').hidden=false;
  $('product-image').src=photo(product);
  $('product-image').alt=name;
  $('product-tag').textContent=item.label;
  $('product-name').textContent=name;
  $('product-description').textContent=item.description;
  $('product-price').textContent=money.format(item.price);
  $('province').replaceChildren(...options.provinces.map(name=>new Option(name,name)));
  $('province').value='경상남도';
  for(const id of ['province','city'])$(id).addEventListener('change',chooseStops);
  $('quantity').addEventListener('input',total);
  chooseStops();
  total();
}
let submission;
$('checkout').addEventListener('submit',async event=>{
  event.preventDefault();
  $('submit').disabled=true;
  try{
    const fields=Object.fromEntries(['province','destination','recipient','instructions'].map(id=>[id,$(id).value]));
    const payload={...fields,quantity:$('quantity').valueAsNumber,product};
    const signature=JSON.stringify(payload);
    if(submission?.signature!==signature)submission={signature,requestId:crypto.randomUUID?.()};
    const response=await fetch('/api/shop/orders',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({...payload,requestId:submission.requestId})});
    const result=await response.json();
    if(!response.ok)throw Error(result.error);
    submission=null;
    try{
      sessionStorage.setItem('daos-recent-order',JSON.stringify(result));
      location.assign(`?complete=${encodeURIComponent(result.number)}`);
    }catch{complete(result)}
  }catch(error){$('result').textContent=error.message;$('submit').disabled=false}
});
let saved;
try{saved=JSON.parse(sessionStorage.getItem('daos-recent-order')??'null')}catch{}
if(saved && query.get('complete')===String(saved.number))complete(saved);
else{
  try{
    const response=await fetch('/api/shop/options');
    if(!response.ok)throw Error();
    options=await response.json();
    showClock(options.clock);
    if(product && Object.hasOwn(options.products,product))detail();
    else catalog();
  }catch{$('shop-error').textContent='상품 정보를 불러오지 못했습니다. 잠시 뒤 새로고침해 주세요.'}
}

void refreshClock();
setInterval(refreshClock,5000);
