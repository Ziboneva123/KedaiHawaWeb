import {
  db, auth, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp,
  signInAnonymously, updateDoc, doc, where
} from "../shared/firebase.js";

const $ = id => document.getElementById(id);
const rupiah = n => new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(n||0);

const KEDAI_HAWA_PICKUP_ADDRESS = "Jl. Adipati Karna / Jl. Kp. Pasir Limus, Wangunharja, Cikarang Utara, Kabupaten Bekasi, Jawa Barat 17530";
const KEDAI_HAWA_MAP_URL = "https://maps.app.goo.gl/z2CWgq9P42W7hzZa9";
const LALAMOVE_WEB_URL = "https://web.lalamove.com/";

let storeOpen=true;

function applyStoreStatus(){
  const banner=$("storeClosedBanner");
  const checkoutBtn=$("checkoutBtn");
  const placeOrderBtn=$("placeOrderBtn");

  if(banner) banner.classList.toggle("hidden",storeOpen);

  if(checkoutBtn){
    checkoutBtn.disabled=!storeOpen;
    checkoutBtn.style.opacity=storeOpen?"1":"0.55";
    checkoutBtn.title=storeOpen?"":"Toko sedang tutup";
  }

  if(placeOrderBtn){
    placeOrderBtn.disabled=!storeOpen;
    placeOrderBtn.style.opacity=storeOpen?"1":"0.55";
  }
}

onSnapshot(doc(db,"settings","store"),snap=>{
  storeOpen=snap.exists()?snap.data().isOpen !== false:true;
  applyStoreStatus();
},e=>{
  console.error("Gagal membaca status toko:",e);
});

function totalQty(){ return cart.reduce((s,x)=>s+(Number(x.qty)||0),0); }
function calcShippingFee(method){
  if(method === "direct") return totalQty() < 5 ? 5000 : 0;
  return 0;
}
function updateDeliveryInfo(){
  const method=$("deliveryMethod").value, qty=totalQty();
  $("addressBox").classList.toggle("hidden",method==="pickup");
  $("lalamoveBox").classList.toggle("hidden",method!=="courier");
  if(method==="pickup") $("deliveryInfo").innerHTML="🏪 <b>Ambil Sendiri</b> — tidak ada ongkir.";
  else if(method==="direct"){
    const fee=qty<5?5000:0;
    $("deliveryInfo").innerHTML=fee
      ? `🚚 <b>Antar Langsung:</b> total qty ${qty}. Karena kurang dari 5, ongkir <b>${rupiah(fee)}</b> ditambahkan.`
      : `🚚 <b>Antar Langsung:</b> total qty ${qty}. Minimal 5 tercapai, ongkir <b>Rp0</b>.`;
  } else $("deliveryInfo").innerHTML="🛵 <b>Ojek Online / Lalamove:</b> ongkir mengikuti tarif Lalamove.";
  renderCheckout();
}
function updatePaymentInfo(){
  const method=$("paymentMethod").value, box=$("paymentInfo");
  if(method==="transfer"){
    box.className="card";
    box.innerHTML=`<b>🏦 Pembayaran Transfer Bank</b><div style="margin-top:8px"><div>Bank: <b>BRI</b></div><div>No. Rekening: <b>090801035174531</b></div><div>A/N: <b>Eva Nurafiani</b></div></div>`;
  } else if(method==="qris"){
    box.className="card";
    box.innerHTML=`<b>📱 Pembayaran QRIS</b><div class="muted" style="margin:6px 0 10px">Scan QRIS Kedai Hawa.</div><div style="text-align:center"><img src="./assets/qris-kedai-hawa.png" alt="QRIS Kedai Hawa" style="width:min(100%,360px);border:1px solid #e5e7eb;border-radius:12px;background:#fff;padding:8px"></div><div style="text-align:center;font-weight:800;margin-top:8px">KEDAI HAWA</div>`;
  } else {
    box.className="card hidden"; box.innerHTML="";
  }
}

let menu = [], cart = [], activeCat = "Semua", currentUid = null, currentOrderId = null, customerOrders = [];

async function initAuth(){
  const cred = await signInAnonymously(auth);
  currentUid = cred.user.uid;
  const savedOrderId = localStorage.getItem("kedaiHawaActiveOrderId");
  if(savedOrderId) currentOrderId = savedOrderId;
  listenCustomerOrders();
}
initAuth().catch(e=>showNotice("Firebase belum dikonfigurasi. Isi shared/firebase.js terlebih dahulu.","error"));

function showNotice(text, cls="notice"){ $("notice").className=cls; $("notice").textContent=text; $("notice").classList.remove("hidden"); }


function statusMeta(status){
  const labels={
    pending:"Menunggu Konfirmasi",
    confirmed:"Dikonfirmasi",
    processing:"Sedang Diproses",
    ready:"Siap / Diantar",
    delivered:"Diserahkan ke Pelanggan",
    received:"Diterima Pelanggan",
    cancelled:"Dibatalkan"
  };
  const steps=["pending","confirmed","processing","ready","received"];
  const names=["Menunggu","Dikonfirmasi","Diproses","Siap / Diantar","Selesai"];
  let current = status==="delivered" ? 3 : (status==="received" ? 4 : steps.indexOf(status));
  if(current<0) current=0;
  return {label:labels[status]||status, current, names, cancelled:status==="cancelled"};
}

function renderCustomerOrders(){
  const box=$("ordersBox");
  if(!box)return;
  if(!customerOrders.length){
    box.innerHTML=`<div class="muted">Belum ada pesanan. Pesanan yang Anda buat akan muncul di sini.</div>`;
    return;
  }
  box.innerHTML=customerOrders.slice(0,10).map(o=>{
    const m=statusMeta(o.status);
    const number=(o.orderNo||"").split("-").at(-1)||"?";
    const items=(o.items||[]).map(i=>`${i.name}${i.variant?` (${i.variant})`:""} × ${i.qty}`).join("<br>");
    const steps=m.names.map((name,i)=>{
      const cls=i<m.current?"done":i===m.current?"current":"";
      return `<div class="order-step ${cls}"><span class="step-dot">${i<m.current?"✓":i+1}</span><span>${name}</span></div>`;
    }).join("");
    return `<div class="card customer-order-card" style="margin:10px 0">
      <div class="row"><div><b>ORDER #${number}</b><div class="muted">${o.customerName||"Pelanggan"} • ${o.deliveryMethod||"-"}</div></div>
      <span class="order-status ${o.status==="received"?"status-ok":o.status==="processing"?"status-blue":o.status==="cancelled"?"status-error":""}">${m.label}</span></div>
      <div style="margin-top:9px">${items}</div>
      <div class="muted" style="margin-top:8px">Total <b>${rupiah(o.total)}</b></div>
      ${m.cancelled
        ? `<div class="notice error" style="margin-top:12px">Pesanan ini dibatalkan.</div>`
        : `<div class="order-progress" style="margin-top:14px">${steps}</div>`}
      <button class="btn secondary" data-view-order="${o.id}" style="width:100%;margin-top:10px">Lihat Detail Pesanan</button>
    </div>`;
  }).join("");
  document.querySelectorAll("[data-view-order]").forEach(b=>b.onclick=()=>{
    const o=customerOrders.find(x=>x.id===b.dataset.viewOrder);
    if(o){currentOrderId=o.id; showSuccess(o); listenOrder(o.id);}
  });
}

function listenCustomerOrders(){
  const q=query(collection(db,"orders"),where("customerUid","==",currentUid));
  onSnapshot(q,snap=>{
    customerOrders=snap.docs.map(d=>({id:d.id,...d.data()}));
    customerOrders.sort((a,b)=>{
      const ta=a.createdAt?.seconds||0, tb=b.createdAt?.seconds||0;
      return tb-ta;
    });
    renderCustomerOrders();
    if(currentOrderId){
      const o=customerOrders.find(x=>x.id===currentOrderId);
      if(o) updateSuccessFromOrder(o);
    }
  },e=>showNotice("Gagal membaca status pesanan: "+e.message,"error"));
}

function listenMenu(){
  const q = query(collection(db,"menu"), orderBy("sort","asc"));
  onSnapshot(q, snap=>{
    menu = snap.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.active!==false && (x.stock===null || x.stock===undefined || x.stock>0));
    renderTabs(); renderMenu();
  }, e=>showNotice("Gagal membaca menu: "+e.message,"error"));
}

function renderTabs(){
  const cats=["Semua",...new Set(menu.map(x=>x.category).filter(Boolean))];
  $("tabs").innerHTML=cats.map(c=>`<button class="tab ${c===activeCat?"active":""}" data-cat="${c}">${c}</button>`).join("");
  document.querySelectorAll("[data-cat]").forEach(b=>b.onclick=()=>{activeCat=b.dataset.cat;renderTabs();renderMenu()});
}

function renderMenu(){
  const term=$("search").value.trim().toLowerCase();
  const list=menu.filter(x=>(activeCat==="Semua"||x.category===activeCat)&&(`${x.name} ${x.description||""}`).toLowerCase().includes(term));
  $("menuGrid").innerHTML=list.map(x=>{
    const variants=x.variants?.length ? `<select id="v-${x.id}">${x.variants.map((v,i)=>`<option value="${i}">${v.name} — ${rupiah(v.price)}</option>`).join("")}</select>` : "";
    const price=x.variants?.length ? `Mulai ${rupiah(Math.min(...x.variants.map(v=>v.price)))}` : rupiah(x.price);
    return `<article class="card menu-card"><div class="menu-photo">${x.image?`<img src="${x.image}" alt="" style="width:100%;height:100%;object-fit:cover">`:"🍽️"}</div><div class="menu-body"><div class="row"><b>${x.name}</b><span class="price">${price}</span></div><div class="muted">${x.description||""}</div>${variants}<button class="btn primary" style="width:100%;margin-top:9px" data-add="${x.id}">+ Tambah</button></div></article>`;
  }).join("") || `<div class="card" style="grid-column:1/-1;text-align:center">Menu belum tersedia.</div>`;
  document.querySelectorAll("[data-add]").forEach(b=>b.onclick=()=>addToCart(b.dataset.add));
}

function addToCart(id){
  const p=menu.find(x=>x.id===id); if(!p)return;
  let variant=null;
  if(p.variants?.length){const idx=Number($(`v-${id}`).value);variant=p.variants[idx];}
  const key=id+"|"+(variant?.name||"");
  const existing=cart.find(x=>x.key===key);
  if(existing) existing.qty++; else cart.push({key,id,name:p.name,variant:variant?.name||"",price:variant?.price??p.price,qty:1});
  renderCart();
}
function renderCart(){
  const count=cart.reduce((s,x)=>s+x.qty,0), total=cart.reduce((s,x)=>s+x.qty*x.price,0);
  $("cartCount").textContent=`${count} item`; $("cartTotal").textContent=rupiah(total); $("cartSubtotal").textContent=rupiah(total);
  $("cartBar").classList.toggle("hidden",count===0);
  $("cartList").innerHTML=cart.map((x,i)=>`<div class="card" style="margin-bottom:8px"><div class="row"><div><b>${x.name}</b><div class="muted">${x.variant||""}</div><div>${rupiah(x.price)}</div></div><div class="qty"><button data-dec="${i}">−</button><b>${x.qty}</b><button data-inc="${i}">+</button></div></div></div>`).join("") || `<div class="muted">Keranjang kosong.</div>`;
  document.querySelectorAll("[data-inc]").forEach(b=>b.onclick=()=>{cart[+b.dataset.inc].qty++;renderCart()});
  document.querySelectorAll("[data-dec]").forEach(b=>b.onclick=()=>{const i=+b.dataset.dec;cart[i].qty--;if(cart[i].qty<=0)cart.splice(i,1);renderCart()});
}
function open(id){$(id).classList.add("show")} function close(id){$(id).classList.remove("show")}
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>b.closest(".modal").classList.remove("show"));
$("openCart").onclick=()=>{renderCart();open("cartModal")}; $("cartBarBtn").onclick=()=>{renderCart();open("cartModal")};
$("checkoutBtn").onclick=()=>{
  if(!storeOpen){
    alert("🔴 TOKO SEDANG TUTUP\\n\\nPesanan sementara tidak dapat dibuat.");
    return;
  }
  if(!cart.length)return;
  renderCheckout();
  close("cartModal");
  open("checkoutModal");
};
$("deliveryMethod").onchange=updateDeliveryInfo;
$("paymentMethod").onchange=updatePaymentInfo;
$("openLalamoveBtn").onclick=()=>window.open(LALAMOVE_WEB_URL,"_blank");
$("copyPickupBtn").onclick=async()=>{
  try{await navigator.clipboard.writeText(KEDAI_HAWA_PICKUP_ADDRESS);$("copyPickupBtn").textContent="✅ Sudah Disalin";setTimeout(()=>$("copyPickupBtn").textContent="📋 Salin Titik Pickup",1800);}
  catch(e){alert("Alamat pickup: "+KEDAI_HAWA_PICKUP_ADDRESS);}
};
$("search").oninput=renderMenu;

function renderCheckout(){
  const subtotal=cart.reduce((s,x)=>s+x.qty*x.price,0);
  const shippingFee=calcShippingFee($("deliveryMethod").value);
  const total=subtotal+shippingFee;
  $("checkoutSummary").innerHTML=cart.map(x=>`${x.name}${x.variant?` (${x.variant})`:""} × ${x.qty} = <b>${rupiah(x.qty*x.price)}</b>`).join("<br>")
    + `<hr><div class="row"><span>Subtotal</span><b>${rupiah(subtotal)}</b></div>`
    + `<div class="row" style="margin-top:5px"><span>Ongkir</span><b>${rupiah(shippingFee)}</b></div>`
    + `<div class="muted" style="margin-top:5px">Total qty: ${totalQty()}</div>`;
  $("checkoutTotal").textContent=rupiah(total);
}

function nextOrderNo(){
  const d=new Date(); return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}-${String(Math.floor(Math.random()*900)+100)}`;
}

$("placeOrderBtn").onclick=async()=>{
  if(!storeOpen){
    $("checkoutMsg").textContent="🔴 Toko sedang tutup. Pesanan tidak dapat dibuat.";
    $("checkoutMsg").className="notice error";
    $("checkoutMsg").classList.remove("hidden");
    return;
  }

  if(!currentUid){$("checkoutMsg").textContent="Menunggu koneksi Firebase...";$("checkoutMsg").classList.remove("hidden");return;}
  const name=$("customerName").value.trim(), phone=$("customerPhone").value.trim(), method=$("deliveryMethod").value;
  if(!name||!phone){$("checkoutMsg").textContent="Nama dan nomor HP wajib diisi.";$("checkoutMsg").className="notice error";$("checkoutMsg").classList.remove("hidden");return;}
  if(method!=="pickup"&&!$("address").value.trim()){ $("checkoutMsg").textContent="Alamat wajib diisi untuk pengantaran."; $("checkoutMsg").className="notice error"; $("checkoutMsg").classList.remove("hidden");return; }
  const subtotal=cart.reduce((s,x)=>s+x.qty*x.price,0);
  const shippingFee=calcShippingFee(method);
  const total=subtotal+shippingFee;
  const paymentMethod=$("paymentMethod").value;
  const orderNo=nextOrderNo();
  const payload={
    orderNo,customerUid:currentUid,customerName:name,customerPhone:phone,deliveryMethod:method,
    address:method==="pickup"?"":$("address").value.trim(),deliveryNote:$("deliveryNote").value.trim(),
    paymentMethod,orderNote:$("orderNote").value.trim(),
    items:cart.map(x=>({name:x.name,variant:x.variant,price:x.price,qty:x.qty})),
    totalQty:totalQty(),subtotal,shippingFee,total,status:"pending",createdAt:serverTimestamp(),customerReceived:false,
    ...(method==="direct"?{shippingRule:"Qty < 5 = Rp5.000; Qty >= 5 = Rp0"}:{}),
    ...(method==="courier"?{lalamovePickupAddress:KEDAI_HAWA_PICKUP_ADDRESS,lalamovePickupMapUrl:KEDAI_HAWA_MAP_URL,lalamoveWebUrl:LALAMOVE_WEB_URL}:{}),
    ...(paymentMethod==="transfer"?{bankName:"BRI",bankAccount:"090801035174531",bankAccountName:"Eva Nurafiani"}:{}),
    ...(paymentMethod==="qris"?{qrisName:"KEDAI HAWA"}:{})
  };
  $("placeOrderBtn").disabled=true;
  try{
    const ref=await addDoc(collection(db,"orders"),payload);
    currentOrderId=ref.id; localStorage.setItem("kedaiHawaActiveOrderId",ref.id); cart=[]; renderCart(); close("checkoutModal"); showSuccess({id:ref.id,...payload});
    listenOrder(ref.id);
  }catch(e){$("checkoutMsg").textContent="Gagal membuat pesanan: "+e.message;$("checkoutMsg").className="notice error";$("checkoutMsg").classList.remove("hidden");}
  finally{$("placeOrderBtn").disabled=false;}
};

function updateSuccessFromOrder(o){
  const labels={pending:"Menunggu Konfirmasi",confirmed:"Dikonfirmasi",processing:"Sedang Diproses",ready:"Siap / Diantar",delivered:"Diserahkan ke Pelanggan",received:"Diterima Pelanggan",cancelled:"Dibatalkan"};
  $("successStatus").textContent=labels[o.status]||o.status;
  $("successStatus").className="order-status "+(o.status==="received"?"status-ok":o.status==="processing"?"status-blue":o.status==="cancelled"?"status-error":"");
  $("receivedBtn").classList.toggle("hidden",!["ready","delivered"].includes(o.status)||o.customerReceived);
}

function restoreActiveOrder(){
  const id=localStorage.getItem("kedaiHawaActiveOrderId");
  if(id){currentOrderId=id; listenOrder(id);}
}
function openCurrentOrder(){if(currentOrderId)open("successModal");}
function showSuccess(o){
  currentOrderId=o.id||currentOrderId;
  $("successOrderNo").textContent="#"+(o.orderNo||"").split("-").at(-1);
  updateSuccessFromOrder(o);
  $("successDetail").innerHTML=`<b>${o.customerName||"Pelanggan"}</b><br>${(o.items||[]).map(x=>`${x.name}${x.variant?` (${x.variant})`:""} × ${x.qty}`).join("<br>")}<hr><b>Total ${rupiah(o.total)}</b>`;
  open("successModal");
}

function listenOrder(id){
  onSnapshot(doc(db,"orders",id),snap=>{
    if(!snap.exists())return;
    const o={id:snap.id,...snap.data()};
    const labels={pending:"Menunggu Konfirmasi",confirmed:"Dikonfirmasi",processing:"Sedang Diproses",ready:"Siap / Diantar",delivered:"Diserahkan ke Pelanggan",received:"Diterima Pelanggan",cancelled:"Dibatalkan"};
    $("successOrderNo").textContent="#"+(o.orderNo||"").split("-").at(-1);
    $("successStatus").textContent=labels[o.status]||o.status;
    $("successStatus").className="order-status "+(o.status==="received"?"status-ok":o.status==="processing"?"status-blue":"");
    $("successDetail").innerHTML=`<b>${o.customerName||""}</b><br>${(o.items||[]).map(x=>`${x.name}${x.variant?` (${x.variant})`:""} × ${x.qty}`).join("<br>")}<hr><b>Total ${rupiah(o.total)}</b><br><span class="muted">Status terakhir: ${labels[o.status]||o.status}</span>`;
    $("receivedBtn").classList.toggle("hidden",!["ready","delivered"].includes(o.status)||o.customerReceived);
    const bar=$("activeOrderBar"); if(bar){bar.classList.remove("hidden");$("activeOrderStatus").textContent=`#${(o.orderNo||"").split("-").at(-1)} • ${labels[o.status]||o.status}`;}
  });
}
$("receivedBtn").onclick=async()=>{if(currentOrderId){await updateDoc(doc(db,"orders",currentOrderId),{customerReceived:true,status:"received",receivedAt:serverTimestamp()});}};
$("activeOrderBtn").onclick=openCurrentOrder;
$("closeSuccessBtn").onclick=()=>close("successModal");

updateDeliveryInfo();
updatePaymentInfo();
listenMenu();
