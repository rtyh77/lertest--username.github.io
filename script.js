// استيراد مكتبات Firebase المباشرة
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// إعدادات Firebase الخاصة بمشروعك
const firebaseConfig = {
  apiKey: "AIzaSyD60g3bc-e6h9JMRUR3eKcD5oRO2rAb4vQ",
  authDomain: "beauty-store-4f012.firebaseapp.com",
  projectId: "beauty-store-4f012",
  storageBucket: "beauty-store-4f012.firebasestorage.app",
  messagingSenderId: "1053116874470",
  appId: "1:1053116874470:web:32a41e8ce3e089d1920527"
};

// تهيئة Firebase و Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// عناصر السلة والموقع
let cart = [];
const productsGrid = document.getElementById('productsGrid');
const cartCount = document.getElementById('cartCount');
const cartModal = document.getElementById('cartModal');
const cartItems = document.getElementById('cartItems');
const totalAmount = document.getElementById('totalAmount');
const checkoutModal = document.getElementById('checkoutModal');

// دالة فائقة الموثوقية لجلب الـ IP تتجاوز الحظر والـ VPN
async function getUserIP() {
    // المصدر الأول: Cloudflare Trace (مباشر ولا يحظر إطلاقاً)
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);
        const response = await fetch('https://1.1.1.1/cdn-cgi/trace', { signal: controller.signal });
        clearTimeout(timeoutId);
        const data = await response.text();
        const ipLine = data.split('\n').find(line => line.startsWith('ip='));
        if (ipLine) {
            const ip = ipLine.split('=')[1].trim();
            if (ip) return ip;
        }
    } catch (e1) {
        console.warn("المصدر الأول تعذر، جاري تجربة المصدر الثاني...");
    }

    // المصدر الثاني: ipify النصي المباشر
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);
        const response = await fetch('https://api.ipify.org', { signal: controller.signal });
        clearTimeout(timeoutId);
        const textIP = await response.text();
        if (textIP && textIP.trim().length <= 45) {
            return textIP.trim();
        }
    } catch (e2) {
        console.warn("المصدر الثاني تعذر، جاري تجربة المصدر الثالث...");
    }

    // المصدر الثالث: ipapi JSON
    try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        if (data && data.ip) return data.ip;
    } catch (e3) {
        console.error("تعذر جلب IP الزائر من كافة المصادر");
    }

    return "غير معروف";
}

// جلب المنتجات من قاعدة البيانات
async function loadProducts() {
    try {
        const querySnapshot = await getDocs(collection(db, "products"));
        productsGrid.innerHTML = "";
        
        if (querySnapshot.empty) {
            productsGrid.innerHTML = "<p style='grid-column: 1/-1; text-align: center; padding: 20px;'>لا توجد منتجات معروضة حالياً. أضف منتجات من لوحة التحكم!</p>";
            return;
        }

        querySnapshot.forEach((doc) => {
            const product = doc.data();
            const productCard = `
                <div class="product-card" data-category="${product.category || 'all'}">
                    <img src="${product.image || 'https://via.placeholder.com/200'}" alt="${product.name}">
                    <div class="product-info">
                        <div class="product-title">${product.name}</div>
                        <div class="product-price">${product.price} د.ج</div>
                        <button class="add-to-cart-btn" onclick="addToCart('${doc.id}', '${product.name}', ${product.price})">
                            إضافة للسلة
                        </button>
                    </div>
                </div>
            `;
            productsGrid.innerHTML += productCard;
        });
    } catch (error) {
        console.error("خطأ في جلب المنتجات:", error);
        productsGrid.innerHTML = "<p style='grid-column: 1/-1; text-align: center;'>حدث خطأ أثناء تحميل المنتجات.</p>";
    }
}

// إضافة منتج للسلة
window.addToCart = function(id, name, price) {
    const existing = cart.find(item => item.id === id);
    if (existing) {
        existing.qty += 1;
    } else {
        cart.push({ id, name, price, qty: 1 });
    }
    updateCartUI();
};

// تحديث واجهة السلة
function updateCartUI() {
    cartCount.innerText = cart.reduce((total, item) => total + item.qty, 0);
    cartItems.innerHTML = "";
    let total = 0;

    cart.forEach(item => {
        total += item.price * item.qty;
        cartItems.innerHTML += `
            <div style="display:flex; justify-content:space-between; margin-bottom:10px; border-bottom: 1px solid #eee; padding-bottom: 5px;">
                <span>${item.name} (x${item.qty})</span>
                <span>${item.price * item.qty} د.ج</span>
            </div>
        `;
    });

    totalAmount.innerText = `${total} د.ج`;
}

// التحكم بالحوارات (Modals)
document.getElementById('cartBtn').addEventListener('click', () => cartModal.style.display = 'flex');
document.getElementById('closeCart').addEventListener('click', () => cartModal.style.display = 'none');
document.getElementById('checkoutBtn').addEventListener('click', () => {
    if (cart.length === 0) return alert("السلة فارغة!");
    cartModal.style.display = 'none';
    checkoutModal.style.display = 'flex';
});
document.getElementById('cancelOrder').addEventListener('click', () => checkoutModal.style.display = 'none');

// إرسال الطلب إلى Firebase مع جلب الـ IP
document.getElementById('orderForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('custName').value;
    const phone = document.getElementById('custPhone').value;
    const address = document.getElementById('custAddress').value;

    // جلب عنوان IP الزائر بأمان قبل الحفظ
    const clientIP = await getUserIP();

    try {
        await addDoc(collection(db, "orders"), {
            customerName: name,
            phone: phone,
            address: address,
            ipAddress: clientIP, // حفظ عنوان الـ IP
            items: cart,
            total: cart.reduce((t, i) => t + (i.price * i.qty), 0),
            createdAt: serverTimestamp()
        });

        alert("تم إرسال طلبك بنجاح! سنتصل بك قريباً.");
        cart = [];
        updateCartUI();
        checkoutModal.style.display = 'none';
    } catch (error) {
        console.error("خطأ أثناء إرسال الطلب:", error);
        alert("حدث خطأ أثناء إرسال الطلب، يرجى المحاولة لاحقاً.");
    }
});

// تشغيل جلب المنتجات عند فتح الصفحة
loadProducts();
