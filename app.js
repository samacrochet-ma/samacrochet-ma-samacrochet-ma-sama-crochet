// ══════════════════════════════
//  CANVAS WOOL ANIMATION
// ══════════════════════════════
(function(){
  const canvas=document.getElementById('bgCanvas');
  const ctx=canvas.getContext('2d');
  let W,H,threads=[];
  function resize(){W=canvas.width=window.innerWidth;H=canvas.height=window.innerHeight;}
  resize();window.addEventListener('resize',resize);
  function Thread(){
    this.x=Math.random()*W;this.y=Math.random()*H;
    this.vx=(Math.random()-0.5)*0.6;this.vy=(Math.random()-0.5)*0.6;
    this.len=Math.random()*80+40;this.angle=Math.random()*Math.PI*2;
    this.va=(Math.random()-0.5)*0.015;
    this.color=['#0077cc','#38bdf8','#005fa3','#60a5fa'][Math.floor(Math.random()*4)];
    this.alpha=Math.random()*0.3+0.1;this.width=Math.random()*1.5+0.5;
  }
  Thread.prototype.draw=function(){
    ctx.save();ctx.translate(this.x,this.y);ctx.rotate(this.angle);
    ctx.beginPath();ctx.moveTo(-this.len/2,0);
    ctx.bezierCurveTo(-this.len/4,-12,this.len/4,12,this.len/2,0);
    ctx.strokeStyle=this.color;ctx.globalAlpha=this.alpha;
    ctx.lineWidth=this.width;ctx.lineCap='round';ctx.stroke();ctx.restore();
    this.x+=this.vx;this.y+=this.vy;this.angle+=this.va;
    if(this.x<-100)this.x=W+100;if(this.x>W+100)this.x=-100;
    if(this.y<-100)this.y=H+100;if(this.y>H+100)this.y=-100;
  };
  for(let i=0;i<35;i++)threads.push(new Thread());
  function loop(){ctx.clearRect(0,0,W,H);threads.forEach(t=>t.draw());requestAnimationFrame(loop);}
  loop();
})();

// ══════════════════════════════
//  BACKEND CONFIG
// ══════════════════════════════
const SHEET_API = "https://script.google.com/macros/s/AKfycbw29vMBsvGs21Eistfe6tx3PUCt1l_huTmTHvXb8Djd5mB0iv40YKeap-tQgYEy2GbSYg/exec";
const WHATSAPP_NUMBER = "212621091399";

let useCloud = false;
let adminPassword = '';

const VALID_CATEGORIES = ['keychains','dolls','flowers','accessories'];

function normalizeCategory(rawCat, productName){
  let cat = String(rawCat || '').toLowerCase().trim().replace(/\s+/g,'');
  if (!VALID_CATEGORIES.includes(cat)) {
    console.warn('⚠️ تصنيف غير معروف للمنتج:', productName, '→ القيمة فالشيت:', JSON.stringify(rawCat));
    return 'accessories';
  }
  return cat;
}

// ══ تحميل المنتجات من Google Sheets ══
async function loadProductsFromCloud() {
  showSkeletons();
  try {
    const res = await fetch(SHEET_API + '?action=getProducts');
    const data = await res.json();
    if (data.status === 'ok' && data.products && data.products.length > 0) {
      products = data.products.map(p => ({
        ...p,
        id:       Number(p.id),
        cat:      normalizeCategory(p.cat, p.name),
        price:    Number(p.price)    || 0,
        oldPrice: Number(p.oldPrice) || 0,
        stock:    Number(p.stock)    || 0,
        onSale:   (p.onsale === true || String(p.onsale).toLowerCase() === 'true'),
      }));
      useCloud = true;
      saveProducts();
    }
  } catch(e) { console.log('Cloud unavailable, using local data'); }
  renderFeatured();
  renderProducts();
}

// ══ حفظ طلب جديد ══
async function saveOrderToSheet(order) {
  orders.unshift(order);
  saveOrders();
  try {
    const itemsText = order.items.map(i => i.name + ' x' + i.qty + ' = ' + (i.price*i.qty) + 'dh').join(' | ');
    const url = SHEET_API +
      '?action=addOrder' +
      '&name='    + encodeURIComponent(order.name) +
      '&phone='   + encodeURIComponent(order.phone) +
      '&city='    + encodeURIComponent(order.city) +
      '&address=' + encodeURIComponent(order.address || '') +
      '&notes='   + encodeURIComponent(order.notes || '') +
      '&items='   + encodeURIComponent(itemsText) +
      '&total='   + order.total +
      '&date='    + encodeURIComponent(order.date);
    await fetch(url, {method:'GET', mode:'no-cors'});
  } catch(e) { console.log('Orders sheet error', e); }
}

async function loadOrdersFromSheet() {
  try {
    const emptyEl = document.getElementById('ordersEmpty');
    emptyEl.style.display = 'block';
    emptyEl.innerHTML = '<i class="fas fa-spinner fa-spin" style="font-size:2rem;margin-bottom:12px;display:block;opacity:0.6;color:var(--blue-main);"></i>جاري تحميل الطلبات...';
    document.getElementById('ordersCards').style.display = 'none';

    const res = await fetch(SHEET_API + '?action=getOrders');
    const data = await res.json();
    if (data.status === 'ok' && data.orders && data.orders.length > 0) {
      renderOrdersTable(data.orders);
    } else {
      emptyEl.innerHTML = '<i class="fas fa-inbox" style="font-size:3rem;opacity:0.3;margin-bottom:12px;display:block;"></i>لا توجد طلبات بعد';
    }
  } catch(e) {
    if (orders.length) renderOrdersTable(orders);
    else document.getElementById('ordersEmpty').innerHTML =
      '<i class="fas fa-inbox" style="font-size:3rem;opacity:0.3;margin-bottom:12px;display:block;"></i>لا توجد طلبات بعد';
  }
}

const ORDER_STATUS_OPTIONS = ['قيد المعالجة','قيد التحضير','تم الشحن','تم التسليم','ملغى'];

function statusBadgeClass(status){
  if(status==='تم التسليم') return 'done';
  if(status==='ملغى') return 'cancelled';
  return '';
}

function renderOrdersTable(list) {
  if (!list.length) {
    document.getElementById('ordersEmpty').style.display = 'block';
    document.getElementById('ordersCards').style.display = 'none';
    return;
  }
  document.getElementById('ordersEmpty').style.display = 'none';
  const wrap = document.getElementById('ordersCards');
  wrap.style.display = 'block';

  wrap.innerHTML = list.map((o, i) => {
    let itemsHTML = '';
    if (typeof o.items === 'string') {
      itemsHTML = o.items.split('|').map(part => {
        const clean = part.trim();
        return clean ? `<li><span class="item-name">${clean}</span></li>` : '';
      }).join('');
    } else if (Array.isArray(o.items)) {
      itemsHTML = o.items.map(it =>
        `<li><span class="item-name">${it.name}</span><span class="item-sub">${it.qty} × ${it.price} DH = ${it.qty*it.price} DH</span></li>`
      ).join('');
    }

    const phoneClean = (o.phone||'').replace(/[^0-9+]/g,'');
    const dateDisplay = o.date || '—';
    const status = o.status || 'قيد المعالجة';
    const rowId = `orderStatus_${i}`;

    return `
    <div class="order-card">
      <div class="order-card-header">
        <span class="order-num">طلب #${list.length - i}</span>
        <span class="order-date"><i class="fas fa-calendar-alt" style="margin-left:5px;"></i>${dateDisplay}</span>
        <span class="order-total-badge">${o.total || 0} درهم</span>
      </div>
      <div class="order-status-row">
        <span class="track-status-pill ${statusBadgeClass(status)}" id="${rowId}_pill">${status}</span>
        <div class="order-status-edit">
          <select id="${rowId}_select">
            ${ORDER_STATUS_OPTIONS.map(s=>`<option value="${s}" ${s===status?'selected':''}>${s}</option>`).join('')}
          </select>
          <button class="status-save-btn" onclick="updateOrderStatusAdmin(${o._row},'${rowId}',this)">
            <i class="fas fa-check"></i> حفظ
          </button>
        </div>
      </div>
      <div class="order-card-body">
        <div class="order-info-block">
          <h5>معلومات الزبون</h5>
          <p><i class="fas fa-user" style="width:16px;color:var(--blue-main);"></i> ${o.name || '—'}</p>
          <p><i class="fas fa-phone" style="width:16px;color:var(--blue-main);"></i> <a href="tel:${phoneClean}">${o.phone || '—'}</a>
             &nbsp;•&nbsp; <a href="https://wa.me/${phoneClean.replace(/^0/,'212')}" target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i> واتساب</a></p>
          <p><i class="fas fa-map-marker-alt" style="width:16px;color:var(--blue-main);"></i> ${o.city || '—'}</p>
          <p style="color:var(--text-light);font-size:0.85rem;">${o.address || ''}</p>
        </div>
        <div class="order-info-block">
          <h5>المنتجات المطلوبة</h5>
          <ul class="order-items-list">${itemsHTML || '<li>—</li>'}</ul>
        </div>
        ${o.notes ? `<div class="order-notes"><i class="fas fa-sticky-note" style="margin-left:6px;"></i><strong>ملاحظات:</strong> ${o.notes}</div>` : ''}
      </div>
    </div>`;
  }).join('');
}

async function updateOrderStatusAdmin(row, rowId, btnEl){
  const select = document.getElementById(rowId+'_select');
  const newStatus = select.value;
  const originalHTML = btnEl.innerHTML;
  btnEl.disabled = true;
  btnEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

  try {
    const res = await apiCall('updateOrderStatus', {row, status:newStatus});
    if (res && res.status !== 'error') {
      const pill = document.getElementById(rowId+'_pill');
      pill.textContent = newStatus;
      pill.className = 'track-status-pill ' + statusBadgeClass(newStatus);
      toast('تم تحديث حالة الطلب ✅','success');
    } else {
      toast('ماقدرناش نبدلو الحالة: ' + (res && res.message ? res.message : 'خطأ غير معروف') + ' ❌','danger');
    }
  } catch(e){
    toast('مشكل فالاتصال ❌','danger');
  } finally {
    btnEl.disabled = false;
    btnEl.innerHTML = originalHTML;
  }
}

async function apiCall(action, payload = {}) {
  const protectedActions = ['addProduct', 'updateProduct', 'deleteProduct', 'updateOrderStatus'];
  const body = protectedActions.includes(action)
    ? { action, password: adminPassword, ...payload }
    : { action, ...payload };
  try {
    const res = await fetch(SHEET_API, { method: 'POST', body: JSON.stringify(body) });
    const data = await res.json();
    if (data.status === 'error' && data.message === 'Unauthorized') {
      toast('غير مسموح، دخلي من جديد ❌', 'danger');
      adminLogout();
    }
    return data;
  } catch (e) {
    console.log('API error', e);
    return { status: 'error', message: 'network' };
  }
}

// ══════════════════════════════
//  منتجاتك الأصلية (72 منتج) — نسخة احتياطية محلية
// ══════════════════════════════
let products = JSON.parse(localStorage.getItem('sama_products')) || [
  {id:1,cat:'keychains',name:'Chicken with Flowers',desc:'كتكوت لطيف مع ورود كروشيه ♡',price:46,oldPrice:0,stock:10,img:'images/1.jpg'},
  {id:2,cat:'keychains',name:'Strawberry Keychain',desc:'سلسلة مفاتيح فراولة لطيفة ♡',price:48,oldPrice:60,stock:8,img:'images/2.jpg'},
  {id:3,cat:'keychains',name:'Romantic Fllouss',desc:'كتكوت ضريف يحمل قلب أحمر',price:62,oldPrice:0,stock:5,img:'images/3.jpg'},
  {id:4,cat:'keychains',name:'Tomato Keychain',desc:'سلسلة مفاتيح طماطم مضحكة ♡',price:56,oldPrice:0,stock:12,img:'images/4.jpg'},
  {id:5,cat:'keychains',name:'Nishinoya Volleyball',desc:'نيشينويا مع الكرة الطائرة - Haikyuu ♡',price:57,oldPrice:0,stock:3,img:'images/5.jpg'},
  {id:6,cat:'keychains',name:'Hinata Volleyball',desc:'هيناتا مع الكرة الطائرة - Haikyuu ♡',price:57,oldPrice:0,stock:4,img:'images/6.jpg'},
  {id:7,cat:'keychains',name:'Kaito Kid Keychain',desc:'كايتو كيد - شخصية لطيفة ♡',price:44,oldPrice:0,stock:7,img:'images/7.jpg'},
  {id:8,cat:'accessories',name:'Mikasa Scarf & Gloves',desc:'طقم وشاح وقفازات ميكاسا',price:289,oldPrice:350,stock:2,img:'images/8.jpg'},
  {id:9,cat:'accessories',name:'Crochet Gloves',desc:'قفازات كروشيه دافئة ♡',price:78,oldPrice:0,stock:6,img:'images/9.jpg'},
  {id:10,cat:'flowers',name:'White Tulip Bouquet',desc:'باقة توليب أبيض أنيقة ملفوفة بشريط ♡',price:25,oldPrice:0,stock:15,img:'images/10.jpg'},
  {id:11,cat:'keychains',name:'Graduation Girl Keychain',desc:'فتاة تخرج بقبعة وثوب التخرج، سلسلة مفاتيح ♡',price:63,oldPrice:0,stock:4,img:'images/11.jpg'},
  {id:12,cat:'keychains',name:'Mini Scarf Keychain',desc:'سلسلة مفاتيح وشاح صغير ♡',price:28,oldPrice:0,stock:20,img:'images/12.jpg'},
  {id:13,cat:'dolls',name:'Sunflower Girl Doll',desc:'فتاة مع دوار الشمس ♡',price:70,oldPrice:0,stock:3,img:'images/13.jpg'},
  {id:14,cat:'flowers',name:'Single Carnation',desc:'زهرة قرنفل واحدة أنيقة ♡',price:60,oldPrice:0,stock:9,img:'images/14.jpg'},
  {id:15,cat:'flowers',name:'Bouquet of Carnations',desc:'باقة ورود قرنفل متعددة الألوان ♡',price:230,oldPrice:280,stock:2,img:'images/15.jpg'},
  {id:16,cat:'flowers',name:'Sunflower',desc:'دوار شمس كبير مشرق ♡',price:70,oldPrice:0,stock:5,img:''},
  {id:17,cat:'accessories',name:'Mirror Flower Crochet',desc:'مرآة الزهور كروشيه ♡',price:119,oldPrice:0,stock:3,img:'images/38.jpg'},
  {id:18,cat:'keychains',name:'Mushroom Keychain',desc:'سلسلة مفاتيح فطر لطيف ♡',price:44,oldPrice:0,stock:11,img:''},
  {id:19,cat:'keychains',name:'Octopus Keychain',desc:'سلسلة مفاتيح أخطبوط لطيف ♡',price:50,oldPrice:0,stock:8,img:''},
  {id:20,cat:'flowers',name:'Bouquet of Lily Flowers',desc:'باقة زنابق حمراء فاخرة ملفوفة بورق كرافت ♡',price:146,oldPrice:180,stock:2,img:'images/20.jpg'},
  {id:21,cat:'flowers',name:'Rose Flower',desc:'وردة كروشيه رومانسية ♡',price:62,oldPrice:0,stock:7,img:'images/21.jpg'},
  {id:22,cat:'dolls',name:'Large Handmade Doll',desc:'دمية كروشيه كبيرة وجميلة ♡',price:370,oldPrice:420,stock:1,img:'images/22.jpg'},
  {id:23,cat:'dolls',name:'Folk Character Doll',desc:'دمية شخصية تراثية بلباس تقليدي ملون ♡',price:325,oldPrice:0,stock:2,img:'images/23.jpg'},
  {id:24,cat:'dolls',name:'Mini Pig Doll',desc:'خنزير صغير كروشيه لطيف ♡',price:85,oldPrice:0,stock:5,img:'images/24.jpg'},
  {id:25,cat:'keychains',name:'Teddy Bear Keychain',desc:'دبدوب صغير سلسلة مفاتيح ♡',price:45,oldPrice:0,stock:14,img:'images/25.jpg'},
  {id:26,cat:'keychains',name:'Romantic Fllouss 2',desc:'سلسلة مفاتيح كتكوت يحمل وردة ♡',price:65,oldPrice:0,stock:6,img:''},
  {id:27,cat:'keychains',name:'Little Fllouss',desc:'سلسلة مفاتيح ورود صغيرة لطيفة ♡',price:40,oldPrice:0,stock:10,img:''},
  {id:28,cat:'dolls',name:'Batman Doll',desc:'دمية باتمان كروشيه مميزة',price:129,oldPrice:0,stock:3,img:'images/28.jpg'},
  {id:29,cat:'keychains',name:'Mini Flowers',desc:'سلسلة مفاتيح ورود صغيرة جداً ♡',price:25,oldPrice:0,stock:18,img:'images/29.jpg'},
  {id:30,cat:'keychains',name:'Chicken Bo3o',desc:'دجاجة بوعو لطيفة سلسلة مفاتيح ♡',price:59,oldPrice:0,stock:7,img:'images/30.jpg'},
  {id:31,cat:'flowers',name:'Flowers Box',desc:'صندوق ورود كروشيه جميل ♡',price:79,oldPrice:0,stock:4,img:'images/31.jpg'},
  {id:32,cat:'keychains',name:'Little Bear',desc:'دب صغير سلسلة مفاتيح لطيف ♡',price:45,oldPrice:0,stock:9,img:'images/32.jpg'},
  {id:33,cat:'accessories',name:'Book Marker',desc:'علامة كتاب كروشيه مميزة ♡',price:25,oldPrice:0,stock:20,img:'images/33.jpg'},
  {id:34,cat:'accessories',name:'Gold Earrings',desc:'أقراط ذهبية كروشيه ♡',price:43,oldPrice:0,stock:6,img:''},
  {id:35,cat:'accessories',name:'Flower Earrings',desc:'أقراط الورود كروشيه ♡',price:45,oldPrice:0,stock:8,img:''},
  {id:36,cat:'keychains',name:'Naruto Keychain',desc:'ناروتو من انمي ناروتو ♡',price:40,oldPrice:0,stock:10,img:'images/36.jpg'},
  {id:37,cat:'keychains',name:'Gojo Satoru Keychain',desc:'جوجو من انمي جوجتسو كايسن ♡',price:45,oldPrice:0,stock:7,img:'images/37.jpg'},
  {id:38,cat:'accessories',name:'Strawberry Earrings',desc:'أقراط فراولة كروشيه ♡',price:43,oldPrice:0,stock:5,img:'images/17.jpg'},
  {id:39,cat:'keychains',name:'Panda',desc:'باندا كروشيه لطيف ♡',price:40,oldPrice:0,stock:11,img:'images/39.jpg'},
  {id:40,cat:'keychains',name:'Spider-Man',desc:'سلسلة مفاتيح للرجل العنكبوت ♡',price:50,oldPrice:0,stock:8,img:'images/45.jpg'},
  {id:41,cat:'flowers',name:'Bouquet Flowers',desc:'ورود كروشيه جميلة ♡',price:279,oldPrice:320,stock:2,img:''},
  {id:42,cat:'keychains',name:'Kout-kout Twin',desc:'توأم كتاكيت لطيف بقبعة وردية ♡',price:42,oldPrice:0,stock:6,img:''},
  {id:43,cat:'accessories',name:'Rose Flower Earrings',desc:'أقراط ورود حمراء كروشيه ♡',price:45,oldPrice:0,stock:5,img:''},
  {id:44,cat:'keychains',name:'Daisy Chick Bag Charm',desc:'كتكوت أصفر ظريف بزهرة بيضاء، تعليقة شنطة أنيقة ♡',price:58,oldPrice:0,stock:8,img:''},
  {id:45,cat:'keychains',name:'Strawberry Bouquet Charm',desc:'قنينة فراولة صغيرة بزهرة بيضاء، تعليقة شنطة أو مفاتيح ♡',price:65,oldPrice:0,stock:7,img:''},
  {id:46,cat:'keychains',name:'Chick with Heart Keychain',desc:'كتكوت أصفر ظريف حامل قلب أحمر كروشيه ♡',price:48,oldPrice:0,stock:12,img:'images/46.jpg'},
  {id:47,cat:'keychains',name:'Cherry Tomato Keychain',desc:'طماطم حمراء ظريفة بوجه مبتسم، سلسلة مفاتيح ♡',price:42,oldPrice:0,stock:14,img:'images/47.jpg'},
  {id:48,cat:'keychains',name:'Volleyball Player Keychain',desc:'لاعب كرة طائرة مع الكرة، تعليقة مزدوجة ظريفة ♡',price:62,oldPrice:0,stock:6,img:'images/48.jpg'},
  {id:49,cat:'keychains',name:'Curly Hair Player Keychain',desc:'شخصية بشعر مجعد أحمر مع كرة طائرة، تعليقة مزدوجة ♡',price:62,oldPrice:0,stock:6,img:'images/49.jpg'},
  {id:50,cat:'keychains',name:'Gentleman Keychain',desc:'شخصية أنيقة بقبعة ونظارة وربطة عنق حمراء ♡',price:55,oldPrice:0,stock:8,img:'images/50.jpg'},
  {id:51,cat:'accessories',name:'Rose Scarf & Gloves Set',desc:'طقم وشاح وقفازات بدون أصابع، مطرز بورود حمراء، دافئ وأنيق ♡',price:195,oldPrice:230,stock:3,img:'images/51.jpg'},
  {id:52,cat:'accessories',name:'Olive Wrist Warmers',desc:'قفازات كروشيه بدون أصابع، لون زيتوني هادئ ♡',price:85,oldPrice:0,stock:7,img:'images/52.jpg'},
  {id:53,cat:'flowers',name:'Single Purple Tulip Bouquet',desc:'توليب بنفسجي واحد ملفوف بورق أنيق، هدية بسيطة ♡',price:38,oldPrice:0,stock:10,img:'images/53.jpg'},
  {id:54,cat:'keychains',name:'Beret Girl Keychain',desc:'فتاة أنيقة ببيريه أسود وشعر مجعد، سلسلة مفاتيح ♡',price:55,oldPrice:0,stock:6,img:'images/54.jpg'},
  {id:55,cat:'keychains',name:'Mini Scarf Bag Charm',desc:'وشاح صغير عنابي، تعليقة شنطة لطيفة ♡',price:35,oldPrice:0,stock:12,img:'images/55.jpg'},
  {id:56,cat:'dolls',name:'Sunflower Crown Doll',desc:'دمية بفستان أصفر وتاج ورود، تفاصيل دقيقة جداً ♡',price:105,oldPrice:0,stock:3,img:'images/56.jpg'},
  {id:57,cat:'flowers',name:'Fluffy Pink Peony',desc:'زهرة بيوني وردية منفوشة بساق وأوراق خضراء ♡',price:68,oldPrice:0,stock:6,img:'images/57.jpg'},
  {id:58,cat:'flowers',name:'Roses Bouquet in Vase',desc:'باقة ورود متعددة الألوان (أحمر، وردي، عنابي)، هدية فاخرة ♡',price:265,oldPrice:310,stock:3,img:'images/58.jpg'},
  {id:59,cat:'flowers',name:'Sunflower & Daisy Bouquet',desc:'باقة دوار الشمس مع أقحوان أبيض، مغلفة بشكل أنيق ♡',price:195,oldPrice:0,stock:3,img:'images/16.jpg'},
  {id:60,cat:'accessories',name:'Strawberry Blossom Earrings',desc:'أقراط فراولة معلقة بزهرة بيضاء، خفيفة وأنيقة ♡',price:48,oldPrice:0,stock:9,img:'images/60.jpg'},
  {id:61,cat:'keychains',name:'Ghost Friends Keychain',desc:'شبح ظريف بقبعة ملونة، سلسلة مفاتيح ♡',price:45,oldPrice:0,stock:10,img:'images/61.jpg'},
  {id:62,cat:'keychains',name:'Curly Jellyfish Keychain',desc:'قنديل بحر بأذرع متعرجة، تفاصيل دقيقة، تعليقة مميزة ♡',price:68,oldPrice:0,stock:6,img:'images/19.jpg'},
  {id:63,cat:'flowers',name:'Blue Lily Bouquet',desc:'باقة زنابق زرقاء وكحلية فاخرة مع بطاقة تهنئة ♡',price:275,oldPrice:320,stock:2,img:'images/63.jpg'},
  {id:64,cat:'keychains',name:'Bear Couple Keychain',desc:'دبدوبين متحابين يدا بيد مع قلب، طقم سلسلتين مفاتيح ♡',price:75,oldPrice:0,stock:5,img:'images/18.jpg'},
  {id:65,cat:'accessories',name:'Granny Square Flower Bag',desc:'شنطة كروشيه مربعات مزينة بورود بيضاء، متوفرة بالوردي والبنفسجي ♡',price:220,oldPrice:0,stock:2,img:'images/26.jpg'},
  {id:66,cat:'keychains',name:'Froggy Chick Keychain',desc:'كتكوت أصفر بقبعة ضفدع خضراء لطيفة ♡',price:48,oldPrice:0,stock:8,img:'images/27.jpg'},
  {id:67,cat:'accessories',name:'Frog Bookmark',desc:'علامة كتاب ضفدع بعيون كبيرة ولسان أحمر ظريف ♡',price:35,oldPrice:0,stock:10,img:'images/34.jpg'},
  {id:68,cat:'accessories',name:'Mouse Bookmark',desc:'علامة كتاب فأر بذيل طويل وأذنين ورديتين ♡',price:35,oldPrice:0,stock:10,img:'images/35.jpg'},
  {id:69,cat:'keychains',name:'Chick Friends Keychain Set',desc:'مجموعة كتاكيت بقبعات متنوعة (ضفدع، أرنب، فراولة، عادي) ♡',price:120,oldPrice:0,stock:4,img:'images/41.jpg'},
  {id:70,cat:'flowers',name:'Mixed Flowers in Vase',desc:'باقة ورود متنوعة (زنبق أبيض، ورد أحمر ووردي) داخل مزهرية زجاجية أنيقة ♡',price:320,oldPrice:0,stock:2,img:'images/42.jpg'},
  {id:71,cat:'keychains',name:'Bear & Panda Face Keychain',desc:'سلسلة مفاتيح وجه دب/باندا/قطة، متوفرة بعدة ألوان ♡',price:40,oldPrice:0,stock:12,img:'images/43.jpg'},
  {id:72,cat:'accessories',name:'Beaded Hair Cap',desc:'طاقية شعر كروشيه وردية بخرزات معلقة، إكسسوار أنيق للشعر ♡',price:85,oldPrice:0,stock:4,img:'images/44.jpg'}
];

let cart = JSON.parse(localStorage.getItem('sama_cart')) || [];
let orders = JSON.parse(localStorage.getItem('sama_orders')) || [];
let currentFilter = 'all';
let currentProductId = null;

const CAT_LABELS = {keychains:'سلاسل مفاتيح',dolls:'دمى',flowers:'ورود',accessories:'إكسسوارات'};
const CAT_ICONS  = {keychains:'🔑',dolls:'🪆',flowers:'🌸',accessories:'✨'};

function saveProducts(){localStorage.setItem('sama_products',JSON.stringify(products));}
function saveCart(){localStorage.setItem('sama_cart',JSON.stringify(cart));}
function saveOrders(){localStorage.setItem('sama_orders',JSON.stringify(orders));}

// ══════════════════════════════
//  PAGES
// ══════════════════════════════
function showPage(id){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('page-'+id).classList.add('active');
  setActivebnav(id);
  window.scrollTo({top:0,behavior:'smooth'});
  if(id==='products') renderProducts();
  if(id==='home') renderFeatured();
}

function goToPage(id){
  closeSideMenu();
  showPage(id);
}

function goToProducts(cat){
  closeSideMenu();
  showPage('products');
  currentFilter = cat;
  document.querySelectorAll('.filter-btn').forEach(b=>{
    b.classList.toggle('active', b.dataset.cat===cat);
  });
  renderProducts();
}

function goToCustomOrder(){
  closeSideMenu();
  showPage('contact');
  const msgEl = document.getElementById('ctMsg');
  if(msgEl && !msgEl.value) msgEl.value = 'مرحبا، عندي فكرة لطلب مخصص (لون/حجم/تصميم خاص)، بغيت نتواصل معاكم بخصوصها.';
}

function openMyAccount(){
  closeSideMenu();
  toast('ميزة "حسابي" غادي تكون متوفرة قريبا ✨','');
}

function openSideMenu(){
  document.getElementById('sideMenu').classList.add('open');
  document.getElementById('sideMenuOverlay').classList.add('show');
  document.getElementById('hamburgerBtn').classList.add('active');
  document.body.style.overflow='hidden';
}
function closeSideMenu(){
  document.getElementById('sideMenu').classList.remove('open');
  document.getElementById('sideMenuOverlay').classList.remove('show');
  document.getElementById('hamburgerBtn').classList.remove('active');
  document.body.style.overflow='';
}

function openSearchBar(){
  document.getElementById('quickSearchBar').classList.add('open');
  setTimeout(()=>document.getElementById('quickSearchInput').focus(),150);
}
function closeSearchBar(){
  document.getElementById('quickSearchBar').classList.remove('open');
}

const INFO_CONTENT = {
  terms: {
    title: 'شروط الاستخدام',
    body: `<p>باستخدامك لموقع SAMA CROCHET فأنت توافقين على الشروط التالية:</p>
    <p>• جميع المنتجات مصنوعة يدويا 100%، قد تختلف تفاصيل بسيطة بين القطعة والصورة المعروضة.</p>
    <p>• الأسعار المعروضة بالدرهم المغربي وقابلة للتغيير دون إشعار مسبق.</p>
    <p>• يُمنع نسخ أو إعادة استخدام محتوى الموقع (صور، نصوص) دون إذن مسبق.</p>`
  },
  saleTerms: {
    title: 'شروط البيع',
    body: `<p>• الدفع يتم عند استلام الطلب (Cash on Delivery) في جميع المدن المغربية.</p>
    <p>• بعض المنتجات تُصنع حسب الطلب وقد تحتاج 2-3 أيام قبل الشحن.</p>
    <p>• رسوم التوصيل تُحدد حسب المدينة ويُخبر بها الزبون عند تأكيد الطلب عبر واتساب.</p>
    <p>• الطلبات المخصصة (لون/حجم خاص) غير قابلة للإرجاع أو الاستبدال.</p>`
  },
  privacy: {
    title: 'سياسة الخصوصية',
    body: `<p>نحترم خصوصيتك. المعلومات التي نجمعها (الاسم، الهاتف، العنوان) تُستخدم فقط لمعالجة طلبك والتواصل معك بخصوصه.</p>
    <p>لا نشارك بياناتك مع أي طرف ثالث لأغراض تسويقية.</p>
    <p>لأي استفسار حول بياناتك، تواصلي معنا مباشرة عبر واتساب.</p>`
  },
  faq: {
    title: 'الأسئلة الشائعة',
    body: `<p><strong>كم تستغرق مدة التوصيل؟</strong><br>عادة من 2 إلى 5 أيام عمل حسب المدينة.</p>
    <p><strong>هل يمكن تخصيص لون المنتج؟</strong><br>نعم، تواصلي معنا عبر واتساب أو "الطلبات الخاصة" فالقائمة.</p>
    <p><strong>ما هي طريقة الدفع؟</strong><br>الدفع نقدا عند استلام الطلب فقط.</p>
    <p><strong>هل يمكن إرجاع المنتج؟</strong><br>نعم خلال 7 أيام، ما عدا الطلبات المخصصة.</p>`
  },
  returns: {
    title: 'سياسة الإرجاع والاستبدال',
    body: `<p>• يمكن إرجاع أو استبدال المنتج خلال 7 أيام من الاستلام بشرط أن يكون بحالته الأصلية.</p>
    <p>• المنتجات المخصصة (حسب الطلب) غير قابلة للإرجاع أو الاستبدال.</p>
    <p>• للبدء بعملية إرجاع، تواصلي معنا عبر واتساب مع رقم الطلب.</p>`
  }
};

function openInfoModal(key){
  const info = INFO_CONTENT[key];
  if(!info) return;
  document.getElementById('infoModalBody').innerHTML = `<h3>${info.title}</h3>${info.body}`;
  document.getElementById('infoModal').classList.add('show');
}

// ══════════════════════════════
//  🔧 مشكل 1: تتبع الطلب — تنظيف رقم الهاتف بطريقة أقوى
// ══════════════════════════════
function cleanPhoneNumber(phone){
  let p = String(phone||'').replace(/[^0-9]/g,''); // نشيلو كل شي غير الأرقام
  if(p.startsWith('00212')) p = p.slice(5);
  else if(p.startsWith('212')) p = p.slice(3);
  if(!p.startsWith('0')) p = '0'+p;
  return p;
}

const TRACK_STEPS = [
  {label:'قيد المعالجة', icon:'fa-receipt',      match:['قيد المعالجة','معالجة','جديد','pending','processing']},
  {label:'قيد التحضير',  icon:'fa-heart',        match:['قيد التحضير','تحضير','preparing']},
  {label:'تم الشحن',     icon:'fa-truck',        match:['تم الشحن','شحن','shipped','في الطريق']},
  {label:'تم التسليم',   icon:'fa-check-circle', match:['تم التسليم','تسليم','delivered','مكتمل']}
];
const TRACK_CANCELLED_KEYWORDS = ['ملغى','ملغي','إلغاء','cancelled','canceled'];

function getTrackStepIndex(status){
  const s = String(status||'').trim();
  if(TRACK_CANCELLED_KEYWORDS.some(k=>s.includes(k))) return -1;
  for(let i=TRACK_STEPS.length-1;i>=0;i--){
    if(TRACK_STEPS[i].match.some(k=>s.includes(k))) return i;
  }
  return 0;
}

function renderTrackOrderCard(o){
  const status = o.status || 'قيد المعالجة';
  const stepIdx = getTrackStepIndex(status);
  const isCancelled = stepIdx === -1;
  const items = typeof o.items === 'string' ? o.items : (o.items||[]).map(it=>it.name+' x'+it.qty).join('، ');

  const timelineHtml = isCancelled ? '' : `<div class="track-timeline">${
    TRACK_STEPS.map((st,i)=>`
      <div class="track-step ${i<=stepIdx?'done':''} ${i===stepIdx?'current':''}">
        <div class="line"></div>
        <div class="dot"><i class="fas ${st.icon}"></i></div>
        <div class="lbl">${st.label}</div>
      </div>`).join('')
  }</div>`;

  const cancelledHtml = isCancelled ? `<div class="track-cancelled-banner">
      <i class="fas fa-times-circle" style="margin-left:6px;"></i>
      تم إلغاء هاد الطلب. تواصلي معنا عبر واتساب إلا كان عندك سؤال.
    </div>` : '';

  const pillClass = isCancelled ? 'cancelled' : (stepIdx===3 ? 'done' : '');
  const pillLabel = isCancelled ? 'ملغى' : status;

  return `<div class="track-order-card">
    <div class="track-order-head">
      <span class="track-order-date"><i class="fas fa-calendar"></i>${o.date||''}</span>
      <span class="track-status-pill ${pillClass}">${pillLabel}</span>
    </div>
    ${cancelledHtml}
    ${timelineHtml}
    <div class="track-order-body">
      <div class="track-items-txt">${items}</div>
      <div class="track-order-total">${o.total||0} درهم</div>
    </div>
  </div>`;
}

function openTrackModal(){
  document.getElementById('trackResults').innerHTML='';
  document.getElementById('trackPhoneInput').value='';
  document.getElementById('trackModal').classList.add('show');
  setTimeout(()=>document.getElementById('trackPhoneInput').focus(),150);
}

async function trackOrderByPhone(){
  const phone = document.getElementById('trackPhoneInput').value.trim();
  const box = document.getElementById('trackResults');
  if(!phone){ toast('أدخل رقم الهاتف أولا ❌','danger'); return; }

  box.innerHTML = '<div class="track-loading"><i class="fas fa-spinner fa-spin"></i>كنبحثو على الطلب ديالك...</div>';

  try {
    const res = await fetch(SHEET_API + '?action=getOrders');
    const data = await res.json();
    if(data.status !== 'ok'){
      box.innerHTML = '<p style="color:var(--danger);text-align:center;">مشكل فالسيرفر، حاولي مرة أخرى.</p>';
      return;
    }
    const allOrders = data.orders || [];
    const cleanInput = cleanPhoneNumber(phone);
    const matches = allOrders.filter(o => cleanPhoneNumber(o.phone) === cleanInput);

    if(!matches.length){
      box.innerHTML = `<div class="track-empty">
        <i class="fas fa-box-open"></i>
        ما لقيناش طلب بهاد الرقم. تأكدي من الرقم، أو تواصلي معنا مباشرة عبر واتساب.
        <div class="track-empty-cta">
          <a href="https://wa.me/212621091399" target="_blank" rel="noopener" class="send-btn" style="display:inline-flex;text-decoration:none;background:linear-gradient(135deg,#25d366,#128c7e);width:auto;padding:10px 24px;">
            <i class="fab fa-whatsapp"></i>&nbsp;تواصلي معنا
          </a>
        </div>
      </div>`;
      return;
    }

    const countHtml = `<div class="track-count">لقينا ${matches.length} طلب${matches.length>1?'ات':''} بهاد الرقم</div>`;
    box.innerHTML = countHtml + matches.map(renderTrackOrderCard).join('');
  } catch(e){
    box.innerHTML = '<p style="color:var(--danger);text-align:center;">مشكل فالاتصال، حاولي مرة أخرى.</p>';
  }
}

// ══════════════════════════════
//  Ripple Effect
// ══════════════════════════════
function initRippleEffect(){
  document.addEventListener('click', function(e){
    const btn = e.target.closest('button, .btn, .hero-btn, .send-btn, .checkout-btn, .save-product-btn, .login-btn');
    if(!btn) return;
    btn.classList.add('ripple-wrap');
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const circle = document.createElement('span');
    circle.className = 'ripple-circle';
    circle.style.width = circle.style.height = size + 'px';
    circle.style.left = (e.clientX - rect.left - size/2) + 'px';
    circle.style.top = (e.clientY - rect.top - size/2) + 'px';
    btn.appendChild(circle);
    setTimeout(()=>circle.remove(), 650);
  });
}

function debounce(fn, delay){
  let t;
  return function(...args){
    clearTimeout(t);
    t = setTimeout(()=>fn.apply(this,args), delay);
  };
}

function skeletonHTML(count){
  let html='';
  for(let i=0;i<count;i++){
    html += `<div class="product-card skeleton-card">
      <div class="skeleton-box" style="height:240px;"></div>
      <div class="card-body">
        <div class="skeleton-box" style="height:12px;width:40%;margin-bottom:8px;"></div>
        <div class="skeleton-box" style="height:16px;width:80%;margin-bottom:8px;"></div>
        <div class="skeleton-box" style="height:12px;width:60%;margin-bottom:14px;"></div>
        <div class="skeleton-box" style="height:38px;width:100%;border-radius:12px;"></div>
      </div>
    </div>`;
  }
  return html;
}
function showSkeletons(){
  const pg=document.getElementById('productsGrid');
  const fg=document.getElementById('featuredGrid');
  if(pg && !pg.children.length) pg.innerHTML = skeletonHTML(8);
  if(fg && !fg.children.length) fg.innerHTML = skeletonHTML(4);
}

function productImg(p,h){
  if(p.img){
    return `<img src="${p.img}" alt="${p.name}" loading="lazy" style="width:100%;height:${h}px;object-fit:cover;" onload="this.classList.add('loaded')" onerror="this.parentElement.innerHTML=phHTML('${p.cat}','${h}')">`;
  }
  return phHTML(p.cat,h);
}
function phHTML(cat,h){
  const icon = CAT_ICONS[cat]||'🧶';
  return `<div class="img-ph" style="height:${h}px;"><div style="font-size:3rem;">${icon}</div><span>${CAT_LABELS[cat]||cat}</span></div>`;
}

function stockLabel(s){
  if(s===0) return '<span class="stock-badge out">نفد المخزون</span>';
  if(s<5)   return `<span class="stock-badge low urgent-pulse">باقي ${s} فقط!</span>`;
  return '<span class="stock-badge">متوفر ✓</span>';
}

function getProductImages(p){
  return [p.img, p.img2, p.img3].filter(Boolean);
}

// ══════════════════════════════
//  🔧 مشكل 2: فتح صفحة كاملة ديال المنتج بدل Modal صغير
// ══════════════════════════════
function createCard(p){
  const hasSale = p.onSale || (p.oldPrice && p.oldPrice > p.price);
  const outOfStock = p.stock===0;
  const div=document.createElement('div');
  div.className='product-card';
  div.innerHTML=`
    <div class="card-img-wrap" onclick="openProductPage(${p.id})">
      ${productImg(p,240)}
      ${hasSale?'<div class="card-badge sale">تخفيض</div>':''}
      <div class="quick-view-btn"><span><i class="fas fa-eye" style="margin-left:6px;"></i>عرض المنتج</span></div>
    </div>
    <div class="card-body">
      <div class="card-cat">${CAT_ICONS[p.cat]||'🧶'} ${CAT_LABELS[p.cat]||p.cat}</div>
      <h3>${p.name}</h3>
      <p>${p.desc}</p>
      <div class="card-price-row">
        <span class="price-now">${p.price} درهم</span>
        ${p.oldPrice&&p.oldPrice>p.price?`<span class="price-old">${p.oldPrice} درهم</span>`:''}
        ${stockLabel(p.stock)}
      </div>
      <button class="add-btn" onclick="event.stopPropagation();addToCart(${p.id})" ${outOfStock?'disabled':''}>
        ${outOfStock?'نفد المخزون':'أضف إلى السلة ♡'}
      </button>
    </div>
  `;
  return div;
}

const REAL_CATEGORIES = ['keychains','dolls','flowers','accessories'];

function renderProducts(){
  const grid=document.getElementById('productsGrid');
  const q=(document.getElementById('searchInput')||{}).value||(document.getElementById('quickSearchInput')||{}).value||'';

  let list=products.filter(p=>{
    let catOk;
    if(currentFilter==='all')       catOk=true;
    else if(currentFilter==='new')  catOk=true;
    else if(currentFilter==='sale') catOk = p.onSale || (p.oldPrice && p.oldPrice > p.price);
    else catOk = String(p.cat).toLowerCase()===currentFilter;
    const qOk=!q||p.name.toLowerCase().includes(q.toLowerCase())||p.desc.includes(q);
    return catOk&&qOk;
  });

  if(currentFilter==='new') list = list.slice().reverse();

  grid.innerHTML='';
  list.forEach((p,i)=>{
    const card=createCard(p);
    card.style.animationDelay=(i*0.05)+'s';
    grid.appendChild(card);
  });
  if(!list.length){
    grid.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--text-light);"><i class="fas fa-search" style="font-size:3rem;margin-bottom:12px;display:block;opacity:0.3;"></i>لا توجد منتجات مطابقة</div>';
  }
}

function renderFeatured(){
  const grid=document.getElementById('featuredGrid');
  const featured=products.slice(-8).reverse();
  grid.innerHTML='';
  featured.forEach((p,i)=>{
    const card=createCard(p);
    card.style.animationDelay=(i*0.06)+'s';
    grid.appendChild(card);
  });
}

function setFilter(btn){
  document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  currentFilter=btn.dataset.cat;
  renderProducts();
}
function applyFilters(){renderProducts();}
const debouncedApplyFilters = debounce(applyFilters, 300);

// ══ صفحة المنتج الكاملة (جديد) ══
function openProductPage(id){
  const p=products.find(x=>x.id===id);
  if(!p)return;
  currentProductId=id;
  renderProductDetail(p);
  showPage('detail');
}

function renderProductDetail(p){
  const imgs = getProductImages(p);
  const mainWrap = document.getElementById('detailMainImgWrap');
  if(imgs.length){
    mainWrap.innerHTML = `<img id="detailMainImg" src="${imgs[0]}" alt="${p.name}" onclick="openZoom(document.getElementById('detailMainImg').src)" onerror="this.parentElement.innerHTML=phHTML('${p.cat}',380)">`;
  } else {
    mainWrap.innerHTML = phHTML(p.cat,380);
  }
  const thumbsWrap = document.getElementById('detailThumbs');
  if(imgs.length>1){
    thumbsWrap.innerHTML = imgs.map((src,i)=>`<img src="${src}" class="modal-thumb${i===0?' active':''}" onclick="switchDetailImg('${src}',this)">`).join('');
  } else {
    thumbsWrap.innerHTML = '';
  }
  document.getElementById('detailCat').textContent=(CAT_ICONS[p.cat]||'🧶')+' '+(CAT_LABELS[p.cat]||p.cat);
  document.getElementById('detailName').textContent=p.name;
  document.getElementById('detailDesc').textContent=p.desc;
  document.getElementById('detailPrice').textContent=p.price;
  const oldEl=document.getElementById('detailOld');
  oldEl.textContent=p.oldPrice&&p.oldPrice>p.price?p.oldPrice+' درهم':'';
  document.getElementById('detailStock').innerHTML=stockLabel(p.stock);
  const addBtn=document.getElementById('detailAddBtn');
  addBtn.disabled=p.stock===0;
  addBtn.textContent=p.stock===0?'نفد المخزون':'أضف إلى السلة ♡';
}

function switchDetailImg(src,el){
  document.getElementById('detailMainImg').src=src;
  document.querySelectorAll('#detailThumbs .modal-thumb').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
}

function detailAddToCart(){ addToCart(currentProductId); }

function shareProductDetail(){ shareProduct(); }

// ══ تكبير الصورة (Zoom) ══
function openZoom(src){
  document.getElementById('zoomImg').src=src;
  document.getElementById('zoomOverlay').classList.add('show');
}
function closeZoom(){
  document.getElementById('zoomOverlay').classList.remove('show');
}

// دالة قديمة محتفظ بيها للتوافق (ماعادش كتستعمل من الكارد لكن مازالة شغالة)
function openModal(id){
  const p=products.find(x=>x.id===id);
  if(!p)return;
  currentProductId=id;
  const imgWrap=document.getElementById('modalImgWrap');
  const imgs = getProductImages(p);
  if(imgs.length>1){
    imgWrap.innerHTML = `
      <img id="modalMainImg" src="${imgs[0]}" alt="${p.name}" style="width:100%;height:280px;object-fit:cover;" onerror="this.parentElement.innerHTML=phHTML('${p.cat}',280)">
      <div class="modal-thumbs">
        ${imgs.map((src,i)=>`<img src="${src}" class="modal-thumb${i===0?' active':''}" onclick="switchModalImg('${src}',this)">`).join('')}
      </div>`;
  } else {
    imgWrap.innerHTML=productImg(p,280);
  }
  document.getElementById('modalCat').textContent=(CAT_ICONS[p.cat]||'🧶')+' '+(CAT_LABELS[p.cat]||p.cat);
  document.getElementById('modalName').textContent=p.name;
  document.getElementById('modalDesc').textContent=p.desc;
  document.getElementById('modalPrice').textContent=p.price;
  const oldEl=document.getElementById('modalOld');
  oldEl.textContent=p.oldPrice&&p.oldPrice>p.price?p.oldPrice+' درهم':'';
  document.getElementById('modalStock').innerHTML=stockLabel(p.stock);
  const addBtn=document.getElementById('modalAddBtn');
  addBtn.disabled=p.stock===0;
  addBtn.textContent=p.stock===0?'نفد المخزون':'أضف إلى السلة ♡';
  document.getElementById('productModal').classList.add('show');
}
function switchModalImg(src,el){
  document.getElementById('modalMainImg').src=src;
  document.querySelectorAll('.modal-thumb').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
}
function modalAddToCart(){ addToCart(currentProductId); closeModal('productModal'); }
function closeModal(id){document.getElementById(id).classList.remove('show');}

function shareProduct(){
  const p=products.find(x=>x.id===currentProductId);
  if(!p)return;
  const text = `شوفي هاد المنتج الزوين من SAMA CROCHET ♡\n${p.name} - ${p.price} درهم`;
  const url = location.href.split('#')[0];
  if(navigator.share){
    navigator.share({title:p.name, text, url}).catch(()=>{});
  } else {
    window.open(`https://wa.me/?text=${encodeURIComponent(text+'\n'+url)}`,'_blank');
  }
}

// ══════════════════════════════
//  CART
// ══════════════════════════════
function addToCart(id){
  const p=products.find(x=>x.id===id);
  if(!p||p.stock===0){toast('نفد المخزون ❌','danger');return;}
  const ex=cart.find(x=>x.id===id);
  if(ex){ex.qty++;} else{cart.push({id:p.id,name:p.name,price:p.price,img:p.img,cat:p.cat,qty:1});}
  saveCart();updateBadge();
  toast(`تم إضافة "${p.name}" ♡`,'');
}

function cartTotal(){return cart.reduce((s,i)=>s+i.price*i.qty,0);}

function setActivebnav(page){
  document.querySelectorAll('.bnav-btn').forEach(b=>b.classList.remove('active'));
  const el=document.getElementById('bnav-'+page);
  if(el) el.classList.add('active');
}

function updateBadge(){
  const n=cart.reduce((s,i)=>s+i.qty,0);
  document.getElementById('cartBadge').textContent=n;
  document.getElementById('fabBadge').textContent=n;
  const bb=document.getElementById('bnavBadge');
  if(bb){ bb.textContent=n; bb.style.display=n>0?'flex':'none'; }
}

function openCart(){
  renderCart();
  document.getElementById('cartSidebar').classList.add('open');
  document.getElementById('overlay').classList.add('show');
}
function closeCart(){
  document.getElementById('cartSidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('show');
}

function renderCart(){
  const el=document.getElementById('cartItems');
  document.getElementById('cartTotal').textContent=cartTotal();
  if(!cart.length){
    el.innerHTML='<div class="cart-empty"><i class="fas fa-shopping-cart"></i>السلة فارغة حالياً ♡</div>';
    return;
  }
  el.innerHTML='';
  cart.forEach((item,i)=>{
    const div=document.createElement('div');
    div.className='cart-item';
    div.innerHTML=`
      ${item.img?`<img src="${item.img}" alt="${item.name}">`:`<div style="width:72px;height:72px;border-radius:12px;background:var(--blue-light);display:flex;align-items:center;justify-content:center;font-size:1.8rem;flex-shrink:0;">${CAT_ICONS[item.cat]||'🧶'}</div>`}
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">${item.price*item.qty} درهم</div>
        <div class="qty-row">
          <button class="qty-btn" onclick="changeQty(${i},-1)">−</button>
          <span class="qty-num">${item.qty}</span>
          <button class="qty-btn" onclick="changeQty(${i},1)">+</button>
          <button class="del-btn" onclick="removeFromCart(${i})"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    `;
    el.appendChild(div);
  });
}

function changeQty(i,d){
  cart[i].qty+=d;
  if(cart[i].qty<=0)cart.splice(i,1);
  saveCart();updateBadge();renderCart();
}
function removeFromCart(i){ cart.splice(i,1);saveCart();updateBadge();renderCart(); }

// ══════════════════════════════
//  CHECKOUT
// ══════════════════════════════
function openCheckout(){
  if(!cart.length){toast('السلة فارغة ♡','danger');return;}
  closeCart();
  document.getElementById('checkoutModal').classList.add('show');
}

function sendOrder(){
  const name=document.getElementById('ordName').value.trim();
  const phone=document.getElementById('ordPhone').value.trim();
  const city=document.getElementById('ordCity').value.trim();
  const addr=document.getElementById('ordAddr').value.trim();
  const coupon=document.getElementById('ordCoupon').value.trim().toUpperCase();
  const notes=document.getElementById('ordNotes').value.trim();
  if(!name||!phone||!city||!addr){toast('يرجى ملء جميع الحقول المطلوبة ♡','danger');return;}

  let msg=`🌸 *طلب جديد - SAMA CROCHET* 🌸\n\n`;
  msg+=`👤 *الاسم:* ${name}\n📞 *الهاتف:* ${phone}\n🏙️ *المدينة:* ${city}\n📍 *العنوان:*\n${addr}\n`;
  if(coupon) msg+=`🎟️ *كود الخصم:* ${coupon}\n`;
  if(notes) msg+=`📝 *ملاحظات:* ${notes}\n`;
  msg+=`\n🛍️ *المنتجات:*\n`;
  cart.forEach(it=>{ msg+=`• ${it.name} × ${it.qty} = ${it.price*it.qty} درهم\n`; });
  msg+=`\n💰 *الإجمالي: ${cartTotal()} درهم*`;
  if(coupon) msg+=` (قبل تطبيق كود الخصم — سيتم تأكيد السعر النهائي معك)`;
  msg+=`\n\nشكراً لثقتك بـ SAMA CROCHET ♡`;

  const order={
    id:Date.now(), name, phone, city,
    address: addr, notes: coupon ? `[كود: ${coupon}] ${notes}` : notes,
    items:[...cart], total:cartTotal(),
    date:new Date().toLocaleDateString('ar-MA'),
    status:'قيد المعالجة'
  };
  saveOrderToSheet(order);

  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`,'_blank');
  cart=[];saveCart();updateBadge();
  closeModal('checkoutModal');
  toast('تم إرسال طلبك ✓','success');
}

function sendContactMsg(){
  const name=document.getElementById('ctName').value.trim();
  const phone=document.getElementById('ctPhone').value.trim();
  const msg=document.getElementById('ctMsg').value.trim();
  if(!name||!msg){toast('يرجى كتابة اسمك ورسالتك','danger');return;}
  let txt=`مرحبا، أنا *${name}*`;
  if(phone)txt+=` (${phone})`;
  txt+=`\n\n${msg}\n\n— من موقع SAMA CROCHET ♡`;
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(txt)}`,'_blank');
  toast('تم فتح واتساب ♡','success');
}

// ══════════════════════════════
//  🔧 مشكل 3: الوضع الليلي (Dark Mode)
// ══════════════════════════════
function initDarkMode(){
  const saved = localStorage.getItem('sama_theme');
  if(saved==='dark'){
    document.documentElement.setAttribute('data-theme','dark');
  }
  updateDarkModeBtn();
}
function toggleDarkMode(){
  const isDark = document.documentElement.getAttribute('data-theme')==='dark';
  if(isDark){
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('sama_theme','light');
  } else {
    document.documentElement.setAttribute('data-theme','dark');
    localStorage.setItem('sama_theme','dark');
  }
  updateDarkModeBtn();
}
function updateDarkModeBtn(){
  const btn = document.getElementById('darkModeBtn');
  if(!btn) return;
  const isDark = document.documentElement.getAttribute('data-theme')==='dark';
  btn.innerHTML = isDark
    ? '<i class="fas fa-sun"></i> الوضع النهاري'
    : '<i class="fas fa-moon"></i> الوضع الليلي';
}

// ══════════════════════════════
//  ADMIN
// ══════════════════════════════
async function adminLogin(){
  const pass=document.getElementById('adminPass').value;
  try {
    const res = await fetch(SHEET_API + '?action=checkLogin&password=' + encodeURIComponent(pass));
    const data = await res.json();
    if(data.status === 'ok'){
      adminPassword = pass;
      document.getElementById('adminLogin').style.display='none';
      document.getElementById('adminPanel').classList.add('show');
      loadAdminData();
    } else {
      toast('كلمة السر خاطئة ❌','danger');
      document.getElementById('adminPass').value='';
    }
  } catch(e) {
    toast('مشكل فالاتصال، حاولي مرة أخرى ❌','danger');
  }
}

function adminLogout(){
  adminPassword = '';
  document.getElementById('adminPanel').classList.remove('show');
  document.getElementById('adminLogin').style.display='flex';
  document.getElementById('adminPass').value='';
  showPage('home');
}

function adminTab(name,btn){
  document.querySelectorAll('.admin-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.admin-section').forEach(s=>s.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('sec-'+name).classList.add('active');
  if(name==='overview') loadOverview();
  if(name==='products') loadProductsTable();
  if(name==='orders') loadOrders();
  if(name==='stock') loadStock();
}

function loadAdminData(){loadOverview();}

function loadOverview(){
  document.getElementById('st-total').textContent=products.length;
  document.getElementById('st-instock').textContent=products.filter(p=>p.stock>0).length;
  document.getElementById('st-low').textContent=products.filter(p=>p.stock>0&&p.stock<5).length;
  document.getElementById('st-orders').textContent=orders.length;
  const tb=document.getElementById('overviewTable');
  tb.innerHTML=products.map(p=>`
    <tr>
      <td><strong>${p.name}</strong></td>
      <td>${CAT_LABELS[p.cat]||p.cat}</td>
      <td>${p.price} درهم</td>
      <td>${p.stock}</td>
      <td>${stockLabel(p.stock)}</td>
    </tr>
  `).join('');
}

function loadProductsTable(){
  const tb=document.getElementById('productsTable');
  tb.innerHTML=products.map(p=>`
    <tr>
      <td>${p.img?`<img src="${p.img}" style="width:50px;height:50px;border-radius:8px;object-fit:cover;" onerror="this.style.display='none'">`:`<div style="width:50px;height:50px;border-radius:8px;background:var(--blue-light);display:flex;align-items:center;justify-content:center;font-size:1.5rem;">${CAT_ICONS[p.cat]||'🧶'}</div>`}</td>
      <td><strong>${p.name}</strong></td>
      <td>${CAT_LABELS[p.cat]||p.cat}</td>
      <td>${p.price} درهم</td>
      <td>${p.stock}</td>
      <td>
        <button class="action-btn edit-btn" onclick="openEdit(${p.id})">✏️ تعديل</button>
        <button class="action-btn del-action-btn" onclick="deleteProductAdmin(${p.id})">🗑️ حذف</button>
      </td>
    </tr>
  `).join('');
}

function openEdit(id){
  const p=products.find(x=>x.id===id);if(!p)return;
  document.getElementById('editId').value=p.id;
  document.getElementById('editName').value=p.name;
  document.getElementById('editCat').value=p.cat;
  document.getElementById('editPrice').value=p.price;
  document.getElementById('editOldPrice').value=p.oldPrice||'';
  document.getElementById('editStock').value=p.stock;
  document.getElementById('editDesc').value=p.desc;
  document.getElementById('editImgUrl').value=p.img||'';
  document.getElementById('editImg2').value=p.img2||'';
  document.getElementById('editImg3').value=p.img3||'';
  const onSaleEl = document.getElementById('editOnSale');
  if(onSaleEl) onSaleEl.checked = !!p.onSale;
  document.getElementById('editModal').classList.add('show');
}

async function saveEdit(){
  const id=parseInt(document.getElementById('editId').value);
  const p=products.find(x=>x.id===id);if(!p)return;
  p.name=document.getElementById('editName').value.trim();
  p.cat=document.getElementById('editCat').value;
  p.price=parseFloat(document.getElementById('editPrice').value)||p.price;
  p.oldPrice=parseFloat(document.getElementById('editOldPrice').value)||0;
  p.stock=parseInt(document.getElementById('editStock').value)||0;
  p.desc=document.getElementById('editDesc').value.trim();
  p.img=document.getElementById('editImgUrl').value.trim();
  p.img2=document.getElementById('editImg2').value.trim();
  p.img3=document.getElementById('editImg3').value.trim();
  const onSaleEl = document.getElementById('editOnSale');
  p.onSale = onSaleEl ? onSaleEl.checked : p.onSale;
  saveProducts();
  const res = await apiCall('updateProduct', {...p, onsale: p.onSale});
  if (res && res.status !== 'error') {
    closeModal('editModal');loadProductsTable();
    toast('تم حفظ التعديلات ✓','success');
  }
}

async function deleteProductAdmin(id){
  if(!confirm('هل تريد حذف هذا المنتج نهائياً؟'))return;
  const res = await apiCall('deleteProduct', {id});
  if (res && res.status !== 'error') {
    products=products.filter(p=>p.id!==id);
    saveProducts();
    loadProductsTable();loadOverview();
    toast('تم الحذف ✓','danger');
  }
}

function loadOrders(){
  if (orders.length) renderOrdersTable(orders);
  loadOrdersFromSheet();
}

function loadStock(){
  const tb=document.getElementById('stockTable');
  tb.innerHTML=products.map(p=>`
    <tr>
      <td><strong>${p.name}</strong></td>
      <td>${CAT_LABELS[p.cat]||p.cat}</td>
      <td>${stockLabel(p.stock)}</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px;">
          <button class="qty-btn" onclick="updateStock(${p.id},-1)">−</button>
          <span style="min-width:30px;text-align:center;font-weight:700;">${p.stock}</span>
          <button class="qty-btn" onclick="updateStock(${p.id},1)">+</button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function updateStock(id,d){
  const p=products.find(x=>x.id===id);if(!p)return;
  p.stock=Math.max(0,p.stock+d);
  saveProducts();loadStock();loadOverview();
  await apiCall('updateProduct', {...p, onsale: p.onSale});
}

// ══════════════════════════════
//  🔧 مشكل 4: إضافة منتج مع خاصية "onSale"
// ══════════════════════════════
function changeAddQty(d){
  const el=document.getElementById('addStock');
  el.value=Math.max(0,parseInt(el.value||0)+d);
}

async function saveNewProduct(){
  const name=document.getElementById('addName').value.trim();
  const cat=document.getElementById('addCat').value;
  const price=parseFloat(document.getElementById('addPrice').value);
  const oldPrice=parseFloat(document.getElementById('addOldPrice').value)||0;
  const stock=parseInt(document.getElementById('addStock').value)||0;
  const desc=document.getElementById('addDesc').value.trim();
  const img=document.getElementById('addImgUrl').value.trim();
  const img2=document.getElementById('addImg2').value.trim();
  const img3=document.getElementById('addImg3').value.trim();
  const onSaleEl = document.getElementById('addOnSale');
  const onSale = onSaleEl ? onSaleEl.checked : false;
  if(!name||!price){toast('يرجى إدخال الاسم والسعر','danger');return;}
  const newP={ id:Date.now(), cat, name, desc, price, oldPrice, stock, img, img2, img3, onSale };
  const res = await apiCall('addProduct', {...newP, onsale: onSale});
  if (res && res.status !== 'error') {
    products.unshift(newP);saveProducts();
    toast('تم إضافة المنتج ✓','success');
    document.getElementById('addName').value='';
    document.getElementById('addPrice').value='';
    document.getElementById('addOldPrice').value='';
    document.getElementById('addStock').value='10';
    document.getElementById('addDesc').value='';
    document.getElementById('addImgUrl').value='';
    document.getElementById('addImg2').value='';
    document.getElementById('addImg3').value='';
    if(onSaleEl) onSaleEl.checked=false;
    loadProductsTable();loadOverview();
  }
}

// ══════════════════════════════
//  TOAST
// ══════════════════════════════
function toast(msg,type){
  const c=document.getElementById('toastContainer');
  const t=document.createElement('div');
  t.className='toast'+(type?' '+type:'');
  t.textContent=msg;
  c.appendChild(t);
  setTimeout(()=>t.remove(),3000);
}

// ══════════════════════════════
//  SCROLL & MISC
// ══════════════════════════════
function scrollToTop(){window.scrollTo({top:0,behavior:'smooth'});}
window.addEventListener('scroll',()=>{
  const fab=document.getElementById('fabTop');
  fab.classList.toggle('show',window.scrollY>400);
});

// ══════════════════════════════
//  SECRET LONG PRESS ON LOGO
// ══════════════════════════════
(function(){
  const logo = document.getElementById('logoArea');
  let pressTimer = null;
  const DURATION = 2000;

  function startPress(){ pressTimer = setTimeout(()=>{ showPage('admin'); }, DURATION); }
  function cancelPress(){ if(pressTimer){ clearTimeout(pressTimer); pressTimer = null; } }

  logo.addEventListener('touchstart', startPress, {passive:true});
  logo.addEventListener('touchend',   cancelPress);
  logo.addEventListener('touchmove',  cancelPress);
  logo.addEventListener('mousedown',  startPress);
  logo.addEventListener('mouseup',    cancelPress);
  logo.addEventListener('mouseleave', cancelPress);
  logo.addEventListener('contextmenu', e => e.preventDefault());
})();

// ══ Init ══
loadProductsFromCloud();
updateBadge();
initRippleEffect();
initDarkMode();

document.getElementById('quickSearchInput').addEventListener('input', debounce(function(){
  if(!document.getElementById('page-products').classList.contains('active')){
    showPage('products');
  }
  const mainSearch = document.getElementById('searchInput');
  if(mainSearch) mainSearch.value = this.value;
  renderProducts();
}, 300));
