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
  $('confirmation').textContent=`주문 ${order.number}번 · ${order.province} 허브로 전달했습니다.`;
}
function catalog() {
  $('catalog-view').hidden=false;
  $('products').innerHTML=Object.entries(options.products).map(([key,name])=>{
    const item=options.catalog[key];
    return `<a class="product-card" href="?product=${key}"><img src="${photo(key)}" alt="${esc(name)}"><div><small>${esc(item.label)}</small><h3>${esc(name)}</h3><strong>${money.format(item.price)}</strong></div></a>`;
  }).join('');
}
function suggest(){
  const province=$('province').value;
  const stops=options.stops.filter(stop=>stop.province===province);
  const cities=[...new Set(stops.map(stop=>stop.city))];
  $('cities').replaceChildren(...cities.map(city=>new Option(city)));
  $('stops').replaceChildren(...stops.filter(stop=>stop.city===$('city').value.trim()).map(stop=>new Option(stop.label)));
  $('hint').textContent=province==='경상남도'
    ?'경남 시연은 창원시 · 중앙도서관처럼 등록 배송지를 입력하면 자동 분류됩니다.'
    :'선택한 시·도 허브로 전달됩니다. 시연용 주소만 입력해 주세요.';
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
  $('date').replaceChildren(...options.dates.map((date,index)=>new Option(`${['오늘','내일','모레'][index]} · ${date}`,date)));
  $('province').addEventListener('change',suggest);
  $('city').addEventListener('input',suggest);
  $('quantity').addEventListener('input',total);
  suggest();
  total();
  $('submit').disabled=false;
}
$('checkout').addEventListener('submit',async event=>{
  event.preventDefault();
  $('submit').disabled=true;
  try{
    const fields=Object.fromEntries(['date','province','city','address','recipient','instructions'].map(id=>[id,$(id).value]));
    const response=await fetch('/api/shop/orders',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({...fields,quantity:$('quantity').valueAsNumber,product})});
    const result=await response.json();
    if(!response.ok)throw Error(result.error);
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
    if(product && Object.hasOwn(options.products,product))detail();
    else catalog();
  }catch{$('shop-error').textContent='상품 정보를 불러오지 못했습니다. 잠시 뒤 새로고침해 주세요.'}
}
