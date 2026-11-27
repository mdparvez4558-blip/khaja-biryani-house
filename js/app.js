import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-storage.js";

import {
  getFunctions,
  httpsCallable
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-functions.js";

import { firebaseConfig } from "./firebase-config.js";


/* FIREBASE */

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app);

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

let user = null;
let isAdmin = false;
let foods = [];
let editingFoodId = null;

// OFFER SETTINGS
let offerSettings = {
  enabled: true,
  discountPercent: 20
};

const $ = id => document.getElementById(id);

const show = id => $(id)?.classList.add("show");
const hide = id => $(id)?.classList.remove("show");


/* নিরাপদ HTML */

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function validImage(file) {
  if (!file) return false;

  if (!file.type.startsWith("image/")) {
    alert("শুধু ছবি নির্বাচন করুন।");
    return false;
  }

  if (file.size > 5 * 1024 * 1024) {
    alert("ছবির সাইজ ৫ MB-এর মধ্যে রাখুন।");
    return false;
  }

  return true;
}

/* COMPRESS IMAGE WITHOUT FIREBASE STORAGE */

async function makeSmallImage(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);

    reader.readAsDataURL(file);
  });

  const img = await new Promise((resolve, reject) => {
    const picture = new Image();

    picture.onload = () => resolve(picture);
    picture.onerror = reject;

    picture.src = dataUrl;
  });

  const maxSide = 800;

  const scale = Math.min(
    1,
    maxSide / Math.max(img.width, img.height)
  );

  const canvas = document.createElement("canvas");

  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);

  const context = canvas.getContext("2d");

  context.drawImage(
    img,
    0,
    0,
    canvas.width,
    canvas.height
  );

  const result = canvas.toDataURL("image/jpeg", 0.65);

  if (result.length > 800000) {
    throw new Error("ছবিটি আরও ছোট করে নির্বাচন করুন।");
  }

  return result;
}


/* LOGIN */

async function login() {
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    alert("Login হয়নি: " + error.message);
  }
}

async function logout() {
  try {
    await signOut(auth);
  } catch (error) {
    alert("Logout হয়নি: " + error.message);
  }
}


/* ADMIN CHECK */

async function checkAdmin(currentUser) {
  if (!currentUser) return false;

  try {
    const snapshot = await getDoc(
      doc(db, "admins", currentUser.uid)
    );

    if (!snapshot.exists()) {
      alert("এই Gmail-এর UID দিয়ে Admin ডকুমেন্ট পাওয়া যায়নি।");
      return false;
    }

    const data = snapshot.data();

    if (data.active === false) {
      alert("এই Admin অ্যাকাউন্টটি নিষ্ক্রিয়।");
      return false;
    }

    return true;

  } catch (error) {
    console.error("Admin check:", error);

    alert(
      "Admin যাচাই করতে সমস্যা হয়েছে: " +
      error.code + " " + error.message
    );

    return false;
  }
}



/* PROFILE */

function renderProfile() {
  if (!$("profileBox")) return;

  if (!user) {
    $("profileBox").innerHTML = `
      <p>আপনি এখনো Login করেননি।</p>
      <button class="primary" id="profileLogin">
        Gmail দিয়ে Login
      </button>
    `;

    $("profileLogin").onclick = login;
    return;
  }

  $("profileBox").innerHTML = `
    <p><b>${escapeHtml(user.displayName || "Customer")}</b></p>
    <p>${escapeHtml(user.email || "")}</p>
    <button class="primary" id="pLogout">Logout</button>
  `;

  $("pLogout").onclick = logout;
}

function openProfile() {
  show("profileModal");
  renderProfile();
}



/* AUTH STATE */

onAuthStateChanged(auth, async currentUser => {
  user = currentUser;
  isAdmin = await checkAdmin(user);

  if (currentUser && !isAdmin) {
    try {
      const customerRef = doc(db, "customers", currentUser.uid);
      const customerSnap = await getDoc(customerRef);

      // আগে থেকে নিষ্ক্রিয় থাকলে প্রবেশ বন্ধ
      if (
        customerSnap.exists() &&
        customerSnap.data().active === false
      ) {
        alert("আপনার অ্যাকাউন্টটি বর্তমানে নিষ্ক্রিয়।");
        await signOut(auth);
        return;
      }

      // নতুন গ্রাহকের অ্যাকাউন্ট তৈরি
      if (!customerSnap.exists()) {
        await setDoc(customerRef, {
          uid: currentUser.uid,
          name: currentUser.displayName || "",
          email: currentUser.email || "",
          active: true,
          lastLoginAt: serverTimestamp()
        });
      } else {
        // শুধু নিজের তথ্য ও লগইনের সময় আপডেট
        await updateDoc(customerRef, {
          name: currentUser.displayName || "",
          email: currentUser.email || "",
          lastLoginAt: serverTimestamp()
        });
      }

    } catch (error) {
      console.error("Customer save error:", error);
      alert("অ্যাকাউন্ট যাচাই করা যায়নি। আবার চেষ্টা করুন।");
      await signOut(auth);
      return;
    }
  }

  renderProfile();

  if ($("loginHint")) {
    $("loginHint").textContent = user
      ? `লগইন: ${user.email}`
      : "অর্ডার পাঠাতে আগে Gmail দিয়ে Login করুন।";
  }
});


/* SETTINGS LOAD
   Firebase path:
   site/contact
   site/offers
*/




/* SETTINGS LOAD */

async function loadSettings() {
  try {
    const contactDoc = await getDoc(
      doc(db, "site", "contact")
    );

    const offerDoc = await getDoc(
      doc(db, "site", "offers")
    );

    const contact = contactDoc.exists()
      ? contactDoc.data()
      : {};

    const offer = offerDoc.exists()
      ? offerDoc.data()
      : {};

    // OFFER SETTINGS LOAD
    offerSettings = {
      enabled: offer.enabled !== false,
      discountPercent: Math.min(
        100,
        Math.max(0, Number(offer.discountPercent ?? 20))
      )
    };

    if ($("phone1")) {
      $("phone1").textContent =
        contact.phone1 || "01785452580";
    }

    if ($("phone2")) {
      $("phone2").textContent =
        contact.phone2 || "01608341418";
    }

    if ($("address")) {
      $("address").textContent =
        contact.address || "ঢাকা, বাংলাদেশ";
    }

    // OFFER DISPLAY
    if ($("offerText")) {
      if (
        offerSettings.enabled &&
        offerSettings.discountPercent > 0
      ) {
        $("offerText").textContent =
          offer.text || offer.title ||
          "আমাদের বিশেষ অফার।";
      } else {
        $("offerText").textContent =
          "বর্তমানে কোনো অফার চালু নেই।";
      }
    }

    if ($("aboutText") && offer.about) {
      $("aboutText").textContent = offer.about;
    }

    if (contact.logoUrl) {
      document.querySelectorAll(".site-logo, #siteLogo")
        .forEach(img => img.src = contact.logoUrl);
    }

  } catch (error) {
    console.error("Settings load error:", error);
  }
}




/* MENU LOAD
   Firebase collection: menu
*/

async function loadFoods() {
  try {
    const snapshot = await getDocs(
      collection(db, "menu")
    );

    foods = snapshot.docs
      .map(item => ({
        id: item.id,
        ...item.data()
      }))
      .filter(item => item.active !== false);

    renderFoods();

  } catch (error) {
    console.error("Menu load error:", error);

    if ($("menuMessage")) {
      $("menuMessage").textContent =
        "খাবারের তালিকা লোড হয়নি। Firebase Rules পরীক্ষা করতে হবে।";
    }
  }
}


/* MENU DISPLAY */

function renderFoods() {
  if ($("menuMessage")) {
    $("menuMessage").textContent =
      foods.length ? "" : "এখনো কোনো খাবার যোগ করা হয়নি।";
  }

  if ($("menuGrid")) {
    $("menuGrid").innerHTML = foods.map(food => `
      <article class="card">
        <img
          src="${escapeHtml(food.imageUrl || "mutton-kacchi-1.jpg")}"
          alt="${escapeHtml(food.name)}"
          onerror="this.style.display='none'"
        >

        <div class="info">
          <h3>${escapeHtml(food.name)}</h3>
          <p>${escapeHtml(food.description || "")}</p>

          <div class="price">
            ৳ ${Number(food.price || 0)}
          </div>

          <button
            class="primary wide"
            data-food="${escapeHtml(food.id)}"
          >
            🛒 অর্ডার করুন
          </button>
        </div>
      </article>
    `).join("");

    $("menuGrid").querySelectorAll("[data-food]")
      .forEach(button => {
        button.onclick = () => openOrder(button.dataset.food);
      });
  }

  if ($("foodSelect")) {
    $("foodSelect").innerHTML = `
      <option value="">খাবার নির্বাচন করুন</option>
      ${foods.map(food => `
        <option value="${escapeHtml(food.id)}">
          ${escapeHtml(food.name)} — ৳ ${Number(food.price || 0)}
        </option>
      `).join("")}
    `;
  }
}


/* ORDER FORM */

function openOrder(foodId) {
  show("orderModal");

  if (foodId && $("foodSelect")) {
    $("foodSelect").value = foodId;
  }
}




/* ORDER SUBMIT */

async function submitOrder() {
  if (!user) {
    alert("অর্ডার করতে আগে Gmail দিয়ে Login করুন।");
    await login();
    return;
  }

  const food = foods.find(
    item => item.id === $("foodSelect")?.value
  );

  if (!food) {
    alert("একটি খাবার নির্বাচন করুন।");
    return;
  }

  const customerName = $("customerName")?.value.trim() || "";
  const phone = $("customerPhone")?.value.trim() || "";
  const address = $("customerAddress")?.value.trim() || "";
  const quantity = Math.max(
    1,
    Number($("foodQty")?.value || 1)
  );
  const note = $("orderNote")?.value.trim() || "";

  if (!customerName || !phone || !address) {
    alert("নাম, ফোন নম্বর ও সম্পূর্ণ ঠিকানা লিখুন।");
    return;
  }

  // আগে থেকেই WhatsApp-এর জন্য নতুন ট্যাব খোলা
  const whatsappWindow = window.open("about:blank", "_blank");

  try {
    const offerDoc = await getDoc(
      doc(db, "site", "offers")
    );

    const offerData = offerDoc.exists()
      ? offerDoc.data()
      : {};

    offerSettings = {
      enabled: offerData.enabled !== false,
      discountPercent: Math.min(
        100,
        Math.max(
          0,
          Number(offerData.discountPercent ?? 20)
        )
      )
    };

    const price = Number(food.price || 0);
    const subtotal = price * quantity;

    const offerApplied =
      offerSettings.enabled === true &&
      offerSettings.discountPercent > 0;

    const discountPercent = offerApplied
      ? offerSettings.discountPercent
      : 0;

    const discount = Math.round(
      subtotal * discountPercent / 100
    );

    const total = subtotal - discount;

    const order = {
      customerUid: user.uid,
      customerEmail: user.email || "",
      customerName,
      phone,
      address,
      foodId: food.id,
      foodName: food.name,
      price,
      quantity,
      subtotal,
      offerApplied,
      discountPercent,
      discount,
      total,
      note,
      status: "pending",
      createdAt: serverTimestamp()
    };

    // Firestore-এ অর্ডার জমা
    const orderRef = await addDoc(
      collection(db, "orders"),
      order
    );

    // WhatsApp মেসেজ তৈরি
    const message =
      `খাজা বিরানি হাউজ অর্ডার
অর্ডার নম্বর: ${orderRef.id}
নাম: ${customerName}
ফোন: ${phone}
ঠিকানা: ${address}
খাবার: ${food.name}
পরিমাণ: ${quantity}
মূল দাম: ৳ ${subtotal}
ছাড়: ৳ ${discount}
ছাড়ের পর মোট: ৳ ${total}
নোট: ${note}`;

    const whatsappUrl =
      "https://wa.me/8801785452580?text=" +
      encodeURIComponent(message);

    hide("orderModal");

    alert(
      offerApplied && discount > 0
        ? "অফারসহ অর্ডার জমা হয়েছে।"
        : "অর্ডার জমা হয়েছে।"
    );

    // আগে খোলা ট্যাবে WhatsApp চালু
    if (whatsappWindow && !whatsappWindow.closed) {
      whatsappWindow.location.href = whatsappUrl;
    } else {
      // Popup বন্ধ থাকলে বর্তমান ট্যাব থেকে WhatsApp খুলবে
      window.location.href = whatsappUrl;
    }

  } catch (error) {
    if (whatsappWindow && !whatsappWindow.closed) {
      whatsappWindow.close();
    }

    alert(
      "অর্ডার জমা হয়নি:\n" + error.message
    );
  }
}







/* MY ORDERS */

// অর্ডারের তারিখ, টাকা ও স্ট্যাটাস ট্র্যাকিং
function orderHtml(id, order, admin = false) {

  const orderDate = order.createdAt?.toDate
    ? order.createdAt.toDate().toLocaleString("bn-BD", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
      })
    : "তারিখ পাওয়া যায়নি";

  const quantity = Number(order.quantity || 1);
  const price = Number(order.price || 0);

  const subtotal = Number(
    order.subtotal ?? price * quantity
  );

  const discount = Number(order.discount ?? 0);

  const discountPercent = Number(
    order.discountPercent ?? 0
  );

  const total = Number(
    order.total ?? subtotal - discount
  );

  const money = value =>
    Number(value).toLocaleString("bn-BD");

  const statuses = [
    {
      value: "pending",
      label: "Order Received",
      icon: "📥"
    },
    {
      value: "confirmed",
      label: "Order Confirmed",
      icon: "✅"
    },
    {
      value: "preparing",
      label: "Food Preparation",
      icon: "🍽️"
    },
    {
      value: "delivered",
      label: "Delivered Successfully",
      icon: "🚚"
    }
  ];

  const currentStatus = statuses.some(
    item => item.value === order.status
  ) ? order.status : "pending";

  const currentIndex = statuses.findIndex(
    item => item.value === currentStatus
  );

  const isCancelled = order.status === "cancelled";

  const tracker = isCancelled
    ? `
      <div style="
        padding:15px;
        margin:12px 0;
        background:#fff0f0;
        border:1px solid #e5aaaa;
        border-radius:10px;
        text-align:center;
        color:#b42318;
      ">
        <div style="font-size:30px;">❌</div>
        <strong>Order Cancelled</strong>
        <p style="margin:5px 0 0;">
          This order has been cancelled.
        </p>
      </div>
    `
    : `
      <div style="
        padding:14px 8px;
        margin:12px 0;
        background:#fffaf5;
        border:1px solid #ead9ca;
        border-radius:10px;
      ">
        <h4 style="
          text-align:center;
          margin:0 0 18px;
          color:#702512;
        ">
          📦 Order Tracking
        </h4>

        <div style="
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap:2px;
        ">
          ${statuses.map((item, index) => `
            <div style="
              flex:1;
              min-width:0;
              text-align:center;
            ">
              <div style="
                width:32px;
                height:32px;
                line-height:32px;
                margin:auto;
                border-radius:50%;
                background:${index <= currentIndex ? "#702512" : "#ddd"};
                color:white;
                font-size:16px;
              ">
                ${index < currentIndex ? "✓" : item.icon}
              </div>

              <div style="
                font-size:10px;
                font-weight:${index === currentIndex ? "bold" : "normal"};
                color:${index <= currentIndex ? "#702512" : "#888"};
                margin-top:7px;
                overflow-wrap:anywhere;
              ">
                ${item.label}
              </div>
            </div>
          `).join("")}
        </div>

        <div style="
          height:6px;
          background:#ddd;
          border-radius:10px;
          margin:12px 8px 0;
          overflow:hidden;
        ">
          <div style="
            width:${currentIndex / 3 * 100}%;
            height:100%;
            background:#702512;
            border-radius:10px;
            transition:width .3s;
          "></div>
        </div>
      </div>
    `;

  return `
    <div class="order-row">

      <b>Order: #${escapeHtml(id)}</b><br>

      Food: ${escapeHtml(order.foodName || "")}<br>

      Quantity: ${quantity}<br>

      ${!admin ? `
        <div style="
          padding:12px;
          margin:12px 0;
          border:1px solid #ddd;
          border-radius:10px;
        ">
          <h4>🧾 অর্ডারের টাকার হিসাব</h4>

          <p>মূল দাম:
            <strong>৳ ${money(subtotal)}</strong>
          </p>

          <p>ছাড়ের হার:
            <strong>${money(discountPercent)}%</strong>
          </p>

          <p>মোট ছাড়:
            <strong>৳ ${money(discount)}</strong>
          </p>

          <hr>

          <p style="font-size:18px;">
            সর্বমোট:
            <strong>৳ ${money(total)}</strong>
          </p>
        </div>
      ` : `
        মোট: ৳ ${money(total)}<br>
      `}

      <div style="margin-top:12px;">
        ${tracker}
      </div>

      <p>
        Order Date & Time:
        ${escapeHtml(orderDate)}
      </p>

      ${admin ? `
        নাম: ${escapeHtml(order.customerName || "")}<br>
        ফোন: ${escapeHtml(order.phone || "")}<br>
        ঠিকানা: ${escapeHtml(order.address || "")}<br>

        <label style="display:block;margin-top:12px;">
          Update Order Status:
          <select
            data-status="${escapeHtml(id)}"
            style="
              width:100%;
              padding:10px;
              margin-top:6px;
              border-radius:8px;
            "
          >
            ${statuses.map(item => `
              <option
                value="${item.value}"
                ${currentStatus === item.value ? "selected" : ""}
              >
                ${item.label}
              </option>
            `).join("")}

            <option
              value="cancelled"
              ${isCancelled ? "selected" : ""}
            >
              Order Cancelled
            </option>
          </select>
        </label>
      ` : ""}

      <button
        type="button"
        data-receipt="${escapeHtml(id)}"
        style="
          width:100%;
          padding:12px;
          margin-top:12px;
          background:#702512;
          color:white;
          border:0;
          border-radius:8px;
          font-size:16px;
        "
      >
        🧾 রসিদ দেখুন / প্রিন্ট করুন
      </button>

    </div>
  `;
}




/* PRINT ORDER RECEIPT */

async function printOrderReceipt(id) {

  // আগে প্রিন্ট উইন্ডো খোলা
  const printWindow = window.open("", "_blank");

  if (!printWindow) {
    alert("রসিদ খুলতে সমস্যা হয়েছে। ব্রাউজারের Pop-up অনুমতি দিন।");
    return;
  }

  try {

    const orderSnap = await getDoc(
      doc(db, "orders", id)
    );

    if (!orderSnap.exists()) {
      printWindow.close();
      alert("অর্ডারটি পাওয়া যায়নি।");
      return;
    }

    const order = orderSnap.data();

    const quantity = Number(order.quantity || 1);

    const subtotal = Number(
      order.subtotal ??
      Number(order.price || 0) * quantity
    );

    const discount = Number(order.discount ?? 0);

    const discountPercent = Number(
      order.discountPercent ?? 0
    );

    const total = Number(
      order.total ?? subtotal - discount
    );

    const money = value =>
      Number(value).toLocaleString("bn-BD");

    const orderDate = order.createdAt?.toDate
      ? order.createdAt.toDate().toLocaleString("bn-BD")
      : "তারিখ পাওয়া যায়নি";

    const receiptHTML = `
      <!DOCTYPE html>
      <html lang="bn">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>অর্ডার রসিদ - খাজা বিরানি হাউজ</title>

        <style>
          body {
            font-family: sans-serif;
            padding: 20px;
            color: #333;
          }

          .receipt {
            max-width: 500px;
            margin: auto;
            padding: 22px;
            border: 1px solid #ddd;
            border-radius: 10px;
          }

          h1, h3 {
            text-align: center;
            color: #702512;
          }

          .center {
            text-align: center;
          }

          .total {
            font-size: 22px;
            font-weight: bold;
          }

          hr {
            border: 0;
            border-top: 1px solid #ccc;
          }

          .print-btn {
            display: block;
            width: 100%;
            padding: 13px;
            margin: 20px auto;
            background: #702512;
            color: white;
            border: 0;
            border-radius: 8px;
            font-size: 17px;
          }

          @media print {
            .print-btn {
              display: none;
            }

            .receipt {
              border: none;
            }
          }
        </style>
      </head>

      <body>

        <div class="receipt">

          <h1>খাজা বিরানি হাউজ</h1>
          <h3>🧾 অর্ডার রসিদ</h3>

          <hr>

          <p><strong>অর্ডার নম্বর:</strong> #${escapeHtml(id)}</p>

          <p><strong>গ্রাহকের নাম:</strong>
            ${escapeHtml(order.customerName || "")}
          </p>

          <p><strong>ফোন:</strong>
            ${escapeHtml(order.phone || "")}
          </p>

          <p><strong>ঠিকানা:</strong>
            ${escapeHtml(order.address || "")}
          </p>

          <hr>

          <p><strong>খাবার:</strong>
            ${escapeHtml(order.foodName || "")}
          </p>

          <p><strong>পরিমাণ:</strong> ${quantity}</p>

          <hr>

          <p>মূল দাম: ৳ ${money(subtotal)}</p>

          <p>ছাড়ের হার: ${money(discountPercent)}%</p>

          <p>মোট ছাড়: ৳ ${money(discount)}</p>

          <hr>

          <p class="total">
            সর্বমোট: ৳ ${money(total)}
          </p>

          <hr>

          <p>অর্ডারের তারিখ: ${escapeHtml(orderDate)}</p>

          <p>অর্ডারের অবস্থা:
            ${escapeHtml(order.status || "pending")}
          </p>

          <hr>

          <h3>ধন্যবাদ!</h3>
          <p class="center">
            খাজা বিরানি হাউজের সঙ্গে থাকার জন্য।
          </p>

          <button class="print-btn" onclick="window.print()">
            🖨️ প্রিন্ট করুন / PDF সংরক্ষণ করুন
          </button>

        </div>

      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(receiptHTML);
    printWindow.document.close();
    printWindow.focus();

  } catch (error) {

    printWindow.close();

    alert("রসিদ তৈরি হয়নি: " + error.message);

  }
}


// গ্রাহক ও অ্যাডমিনের রসিদ বাটন
document.addEventListener("click", event => {

  const button = event.target.closest?.("[data-receipt]");

  if (!button) return;

  printOrderReceipt(button.dataset.receipt);

});


/* CUSTOMER ORDERS */

async function openOrders() {

  show("ordersModal");

  if (!user) {
    $("myOrders").innerHTML =
      "<p>অর্ডার দেখতে Gmail দিয়ে Login করুন।";
    return;
  }

  $("myOrders").textContent = "লোড হচ্ছে...";

  try {

    const ordersQuery = query(
      collection(db, "orders"),
      where("customerUid", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(ordersQuery);

    $("myOrders").innerHTML = snapshot.docs
      .map(item => orderHtml(item.id, item.data()))
      .join("") || "<p>এখনো কোনো অর্ডার নেই।</p>";

  } catch (error) {

    $("myOrders").textContent =
      "অর্ডার লোড হয়নি: " + error.message;

  }
}





/* SETTINGS MENU */

function openSettings() {
  if (!isAdmin) {
    alert("Settings শুধু অনুমোদিত Admin ব্যবহার করতে পারবেন।");
    return;
  }

  show("settingsModal");
}

function settingAction(type) {
  hide("settingsModal");

  if (type === "menu") return openAdmin("menu");
  if (type === "images") return openAdmin("images");
  if (type === "contact") return openAdmin("contact");
  if (type === "offer") return openAdmin("offer");
  if (type === "admin") return openAdmin("admins");
}



/* ADMIN PANEL */

async function openAdmin(section = "orders") {
  if (!user) {
    alert("আগে Gmail দিয়ে Login করুন।");
    await login();
    return;
  }

  isAdmin = await checkAdmin(user);

  if (!isAdmin) {
    alert("আপনার Gmail এখনো Admin হিসেবে অনুমোদিত নয়।");
    return;
  }

  show("adminModal");

  $("adminPanel").innerHTML = `
    <div class="admin-grid">

      <button class="stat" data-admin-section="orders">
        🛒 অর্ডার
      </button>

      <button class="stat" data-admin-section="menu">
        🍛 মেনু
      </button>

      <button class="stat" data-admin-section="images">
        🖼️ ছবি
      </button>

      <button class="stat" data-admin-section="settings">
        ⚙️ Settings
      </button>
<button class="stat" data-admin-section="customers">
  👥 গ্রাহক তালিকা
</button>
    </div>

    <div id="adminContent" class="admin-section">
      লোড হচ্ছে...
    </div>
  `;

  $("adminPanel")
    .querySelectorAll("[data-admin-section]")
    .forEach(button => {

      button.onclick = async () => {
  const action = button.dataset.adminSection;

  

  try {
    await renderAdminSection(action);
  } catch (error) {
    alert("সমস্যা হয়েছে: " + error.message);
  }
};

});

await renderAdminSection(section);
}


/* ADMIN SECTION */

async function renderAdminSection(section) {
  const content = $("adminContent");
  if (!content) return;
  /* SETTINGS MENU */

  if (section === "settings") {
    content.innerHTML = `
      <h3>⚙️ Website Settings</h3>

      <button class="stat" data-setting="menu">
        🍛 Menu Management
      </button>

      <button class="stat" data-setting="images">
        🖼️ ছবি
      </button>

      <button class="stat" data-setting="contact">
        📞 Contact Settings
      </button>

      <button class="stat" data-setting="offer">
        🎁 Offer Settings
      </button>

      <button class="stat" data-setting="admins">
        👥 Admin Management
      </button>
    `;

    content.querySelectorAll("[data-setting]")
      .forEach(button => {
        button.onclick = async () => {
          await renderAdminSection(button.dataset.setting);
        };
      });

    return;
  }

  


/* ALL ORDERS */

if (section === "orders") {
  try {
    const snapshot = await getDocs(
      query(
        collection(db, "orders"),
        orderBy("createdAt", "desc")
      )
    );

    const money = value =>
      Number(value || 0).toLocaleString("bn-BD");

    content.innerHTML =
      "<h3>🛒 সব অর্ডার</h3>" +
      (
        snapshot.docs.length
          ? snapshot.docs.map(item => {
              const data = item.data();

              const subtotal = Number(
                data.subtotal ??
                (Number(data.price || 0) *
                 Number(data.quantity || 1))
              );

              const discount = Number(data.discount ?? 0);

              const total = Number(
                data.total ?? (subtotal - discount)
              );

              const discountPercent = Number(
                data.discountPercent ?? 0
              );

              const showDeliveryButton =
                data.status !== "delivered" &&
                data.status !== "cancelled";

              return `
                ${orderHtml(item.id, data, true)}

                ${showDeliveryButton ? `
                  <button
                    type="button"
                    data-mark-delivered="${escapeHtml(item.id)}"
                    style="
                      width:100%;
                      padding:13px;
                      margin:0 0 15px;
                      background:#18794e;
                      color:white;
                      border:0;
                      border-radius:8px;
                      font-size:16px;
                      font-weight:bold;
                    "
                  >
                    🚚 Mark as Delivered
                  </button>
                ` : ""}

                <div style="
                  padding:15px;
                  margin:10px 0 20px;
                  border:1px solid #ddd;
                  border-radius:10px;
                  background:#fff;
                ">
                  <h4>🧾 অর্ডারের টাকার হিসাব</h4>

                  <p>
                    মূল দাম:
                    <strong>৳ ${money(subtotal)}</strong>
                  </p>

                  <p>
                    ছাড়ের হার:
                    <strong>${discountPercent}%</strong>
                  </p>

                  <p>
                    মোট ছাড়:
                    <strong>৳ ${money(discount)}</strong>
                  </p>

                  <hr>

                  <p style="font-size:19px;">
                    গ্রাহকের মোট বিল:
                    <strong>৳ ${money(total)}</strong>
                  </p>
                </div>
              `;
            }).join("")
          : "<p>কোনো অর্ডার নেই।</p>"
      );

    // আগের Status পরিবর্তনের ব্যবস্থা
    content.querySelectorAll("[data-status]")
      .forEach(select => {
        const item = snapshot.docs.find(
          order => order.id === select.dataset.status
        );

        if (item) {
          select.value = item.data().status || "pending";
        }

        select.onchange = async () => {
          try {
            await updateDoc(
              doc(db, "orders", select.dataset.status),
              { status: select.value }
            );

            alert("অর্ডারের অবস্থা পরিবর্তন হয়েছে।");

          } catch (error) {
            alert("পরিবর্তন হয়নি: " + error.message);
          }
        };
      });

    // Delivery Complete Button
    content.querySelectorAll("[data-mark-delivered]")
      .forEach(button => {

        button.onclick = async () => {
          const orderId = button.dataset.markDelivered;

          const confirmed = confirm(
            "আপনি কি নিশ্চিত যে খাবার গ্রাহকের হাতে পৌঁছে দেওয়া হয়েছে?"
          );

          if (!confirmed) return;

          button.disabled = true;
          button.textContent = "Updating...";

          try {
            await updateDoc(
              doc(db, "orders", orderId),
              {
                status: "delivered",
                deliveredAt: serverTimestamp()
              }
            );

            alert("Delivery Successfully Completed!");

            await renderAdminSection("orders");

          } catch (error) {
            button.disabled = false;
            button.textContent = "🚚 Mark as Delivered";

            alert("ডেলিভারি আপডেট হয়নি: " + error.message);
          }
        };

      });

  } catch (error) {
    content.textContent =
      "অর্ডার লোড হয়নি: " + error.message;
  }

  return;
}



  /* MENU MANAGEMENT */

  if (section === "menu") {
    content.innerHTML = `
      <h3>🍛 Menu Management</h3>

      <label>
        খাবারের নাম
        <input id="mName">
      </label>

      <label>
        খাবারের দাম
        <input id="mPrice" type="number" min="1">
      </label>

      <label>
        বিবরণ
        <textarea id="mDescription"></textarea>
      </label>

      <label>
        খাবারের ছবি
        <input id="mFile" type="file" accept="image/*">
      </label>

      <button class="primary" id="mSave">
        নতুন খাবার যোগ করুন
      </button>

      <hr>
${foods.map(food => `
  <div class="order-row">
    <b>${escapeHtml(food.name)}</b>
    — ৳ ${Number(food.price || 0)}

    <button class="primary" data-edit="${escapeHtml(food.id)}">
      ✏️ সম্পাদনা
    </button>

    <button class="danger" data-del="${escapeHtml(food.id)}">
      তালিকা থেকে সরান
    </button>
  </div>
`).join("")}
    `;

    $("mSave").onclick = saveFood;

    content.querySelectorAll("[data-del]").forEach(button => {
      button.onclick = async () => {
        if (!confirm("এই খাবারটি তালিকা থেকে সরাবেন?")) return;

        try {
          await updateDoc(
            doc(db, "menu", button.dataset.del),
            { active: false }
          );

          await loadFoods();
          await renderAdminSection("menu");

        } catch (error) {
          alert("খাবার সরানো যায়নি: " + error.message);
        }
      };
    });

    /* পুরনো খাবার সম্পাদনা */

    content.querySelectorAll("[data-edit]").forEach(button => {
      button.onclick = async () => {
        const food = foods.find(
          item => item.id === button.dataset.edit
        );

        if (!food) return;

        const name = prompt("খাবারের নতুন নাম লিখুন:", food.name);
        if (name === null) return;

        const priceText = prompt("নতুন দাম লিখুন:", food.price);
        if (priceText === null) return;

        const description = prompt(
          "নতুন বিবরণ লিখুন:",
          food.description || ""
        );
        if (description === null) return;

        const price = Number(priceText);

        if (!name.trim() || !Number.isFinite(price) || price <= 0) {
          alert("সঠিক নাম ও দাম লিখুন।");
          return;
        }

        try {
          await updateDoc(
            doc(db, "menu", food.id),
            {
              name: name.trim(),
              price: price,
              description: description.trim()
            }
          );

          await loadFoods();
          await renderAdminSection("menu");

          alert("খাবারের তথ্য পরিবর্তন হয়েছে।");

        } catch (error) {
          alert("পরিবর্তন করা যায়নি: " + error.message);
        }
      };
    });

    return;
  }


  /* IMAGE MANAGEMENT */

  if (section === "images") {
    content.innerHTML = `
      <h3>🖼️ Logo ও খাবারের ছবি</h3>

      <label>
        নতুন Logo নির্বাচন করুন
        <input id="logoFile" type="file" accept="image/*">
      </label>

      <button class="primary" id="logoUpload">
        Logo Upload
      </button>

      <hr>

      <label>
        খাবার নির্বাচন করুন
        <select id="imageFood">
          ${foods.map(food => `
            <option value="${escapeHtml(food.id)}">
              ${escapeHtml(food.name)}
            </option>
          `).join("")}
        </select>
      </label>

      <label>
        নতুন খাবারের ছবি
        <input id="foodFile" type="file" accept="image/*">
      </label>

      <button class="primary" id="foodUpload">
        খাবারের ছবি Upload
      </button>
    `;

    $("logoUpload").onclick = uploadLogo;
    $("foodUpload").onclick = uploadFoodImage;
    return;
  }


  /* CONTACT SETTINGS */

  if (section === "contact") {
    const snap = await getDoc(doc(db, "site", "contact"));
    const data = snap.exists() ? snap.data() : {};

    content.innerHTML = `
      <h3>📞 যোগাযোগের তথ্য</h3>

      <label>
        ফোন নম্বর ১
        <input id="sPhone1" value="${escapeHtml(data.phone1 || "01785452580")}">
      </label>

      <label>
        ফোন নম্বর ২
        <input id="sPhone2" value="${escapeHtml(data.phone2 || "01608341418")}">
      </label>

      <label>
        ঠিকানা
        <input id="sAddress" value="${escapeHtml(data.address || "")}">
      </label>

      <button class="save" id="saveSettings">Save</button>
    `;

    $("saveSettings").onclick = async () => {
      try {
        await setDoc(doc(db, "site", "contact"), {
          ...data,
          phone1: $("sPhone1").value.trim(),
          phone2: $("sPhone2").value.trim(),
          address: $("sAddress").value.trim()
        }, { merge: true });

        await loadSettings();
        alert("যোগাযোগের তথ্য সংরক্ষণ হয়েছে।");

      } catch (error) {
        alert("সংরক্ষণ হয়নি: " + error.message);
      }
    };

    return;
  }


  
  /* OFFER SETTINGS */

  if (section === "offer") {
    const snap = await getDoc(doc(db, "site", "offers"));
    const data = snap.exists() ? snap.data() : {};

    const enabled = data.enabled !== false;
    const discountPercent = Math.min(
      100,
      Math.max(0, Number(data.discountPercent ?? 20))
    );

    content.innerHTML = `
      <h3>🎁 অফার ও পরিচিতি</h3>

      <label>
        অফার চালু / বন্ধ
        <input
          id="sOfferEnabled"
          type="checkbox"
          ${enabled ? "checked" : ""}
        >
        অফার চালু রাখুন
      </label>

      <label>
        ছাড়ের পরিমাণ (%)
        <input
          id="sDiscountPercent"
          type="number"
          min="0"
          max="100"
          step="1"
          value="${discountPercent}"
        >
      </label>

      <label>
        অফারের শিরোনাম
        <input
          id="sTitle"
          value="${escapeHtml(data.title || "")}"
        >
      </label>

      <label>
        অফারের বিবরণ
        <textarea id="sOffer">${escapeHtml(data.text || "")}</textarea>
      </label>

      <label>
        আমাদের সম্পর্কে
        <textarea id="sAbout">${escapeHtml(data.about || "")}</textarea>
      </label>

      <button class="save" id="saveSettings">
        Save
      </button>
    `;

    $("saveSettings").onclick = async () => {
      try {
        const percent = Number(
          $("sDiscountPercent").value
        );

        if (
          !Number.isFinite(percent) ||
          percent < 0 ||
          percent > 100
        ) {
          alert("ছাড়ের পরিমাণ ০ থেকে ১০০-এর মধ্যে দিন।");
          return;
        }

        await setDoc(doc(db, "site", "offers"), {
          enabled: $("sOfferEnabled").checked,
          discountPercent: percent,
          title: $("sTitle").value.trim(),
          text: $("sOffer").value.trim(),
          about: $("sAbout").value.trim()
        }, { merge: true });

        await loadSettings();

        alert("অফার সেটিংস সংরক্ষণ হয়েছে।");

      } catch (error) {
        alert("সংরক্ষণ হয়নি: " + error.message);
      }
    };

    return;
  }


// CUSTOMER ACCOUNT MANAGEMENT

if (section === "customers") {
  content.innerHTML = `
    <h3>👥 গ্রাহক তালিকা</h3>
    <div id="customerList">লোড হচ্ছে...</div>
  `;

  try {
    const snapshot = await getDocs(
      collection(db, "customers")
    );

    const list = $("customerList");

    if (snapshot.empty) {
      list.innerHTML = "<p>এখনো কোনো গ্রাহক Login করেনি।</p>";
    } else {
      list.innerHTML = snapshot.docs.map(item => {
        const data = item.data();
        const active = data.active !== false;

        return `
          <div class="food-card" style="padding:12px;margin:10px 0;">
            <p><b>নাম:</b> ${escapeHtml(data.name || "নাম নেই")}</p>
            <p><b>Gmail:</b> ${escapeHtml(data.email || "ইমেইল নেই")}</p>
            <p><b>UID:</b></p>
            <p style="word-break:break-all;">
              ${escapeHtml(item.id)}
            </p>
            <p><b>শেষ Login:</b> ${
              data.lastLoginAt?.toDate
                ? escapeHtml(data.lastLoginAt.toDate().toLocaleString("bn-BD"))
                : "তথ্য নেই"
            }</p>

            <p>অ্যাকাউন্টের অবস্থা:
              <b>${active ? "সক্রিয়" : "নিষ্ক্রিয়"}</b>
            </p>

            <button
              class="save customer-toggle"
              data-uid="${escapeHtml(item.id)}"
              data-active="${active}">
              ${active ? "নিষ্ক্রিয় করুন" : "আবার সক্রিয় করুন"}
            </button>
          </div>
        `;
      }).join("");

      list.querySelectorAll(".customer-toggle").forEach(button => {
        button.onclick = async () => {
          const uid = button.dataset.uid;
          const nextActive = button.dataset.active !== "true";

          const message = nextActive
            ? "এই গ্রাহকের অ্যাকাউন্ট আবার সক্রিয় করবেন?"
            : "এই গ্রাহকের অ্যাকাউন্ট নিষ্ক্রিয় করবেন?";

          if (!confirm(message)) return;

          try {
            await updateDoc(doc(db, "customers", uid), {
              active: nextActive
            });

            alert("গ্রাহকের অ্যাকাউন্টের অবস্থা পরিবর্তন হয়েছে।");

            await renderAdminSection("customers");

          } catch (error) {
            alert("পরিবর্তন হয়নি: " + error.message);
          }
        };
      });
    }

  } catch (error) {
    $("customerList").innerHTML =
      "<p>গ্রাহক তালিকা লোড হয়নি: " +
      escapeHtml(error.message) + "</p>";
  }

  return;
}

if (section === "admins") {
  content.innerHTML = `
    <h3>👥 Admin Management</h3>

    <p>নতুন Admin-এর Firebase UID লিখুন।</p>

    <label>
      Admin UID
      <input id="newAdminUid" type="text"
        placeholder="এখানে UID লিখুন">
    </label>

    <button class="save" id="addAdminBtn">
      Admin যোগ করুন
    </button>

    <hr>
    <h3>📋 Admin তালিকা</h3>
    <div id="adminList">লোড হচ্ছে...</div>
  `;

  // নতুন Admin যোগ
  $("addAdminBtn").onclick = async () => {
    const uid = $("newAdminUid").value.trim();

    if (!uid) {
      alert("Admin UID লিখুন।");
      return;
    }

    if (uid === user.uid) {
      alert("নিজেকে আবার Admin হিসেবে যোগ করার প্রয়োজন নেই।");
      return;
    }

    try {
      const adminRef = doc(db, "admins", uid);
      const existing = await getDoc(adminRef);

      if (existing.exists()) {
        alert("এই UID আগে থেকেই Admin তালিকায় আছে।");
        return;
      }

      await setDoc(adminRef, {
        role: "admin",
        active: true,
        createdAt: serverTimestamp()
      });

      alert("নতুন Admin সফলভাবে যোগ হয়েছে।");
      $("newAdminUid").value = "";

      await renderAdminSection("admins");

    } catch (error) {
      alert("Admin যোগ হয়নি: " + error.message);
    }
  };

  // Admin তালিকা দেখানো
  try {
    const snapshot = await getDocs(collection(db, "admins"));
    const list = $("adminList");

    if (snapshot.empty) {
      list.innerHTML = "<p>কোনো Admin পাওয়া যায়নি।</p>";
    } else {
      list.innerHTML = snapshot.docs.map(item => {
        const uid = item.id;
        const data = item.data();
        const active = data.active !== false;
        const isSelf = uid === user.uid;

        return `
          <div class="food-card" style="padding:12px;margin:10px 0;">
            <p><b>Admin UID:</b></p>
            <p style="word-break:break-all;">
              ${escapeHtml(uid)}
            </p>

            <p>অবস্থা:
              <b>${active ? "সক্রিয়" : "নিষ্ক্রিয়"}</b>
            </p>

            ${
              isSelf
                ? "<p>এটি আপনার নিজের Admin অ্যাকাউন্ট।</p>"
                : `
                  <button
                    class="save admin-toggle"
                    data-uid="${escapeHtml(uid)}"
                    data-active="${active}">
                    ${active ? "নিষ্ক্রিয় করুন" : "আবার সক্রিয় করুন"}
                  </button>
                `
            }
          </div>
        `;
      }).join("");

      list.querySelectorAll(".admin-toggle").forEach(button => {
        button.onclick = async () => {
          const uid = button.dataset.uid;
          const nextActive = button.dataset.active !== "true";

          const confirmText = nextActive
            ? "এই Admin-কে আবার সক্রিয় করবেন?"
            : "এই Admin-কে নিষ্ক্রিয় করবেন?";

          if (!confirm(confirmText)) return;

          try {
            await updateDoc(doc(db, "admins", uid), {
              active: nextActive
            });

            alert("Admin-এর অবস্থা পরিবর্তন হয়েছে।");

            await renderAdminSection("admins");

          } catch (error) {
            alert("পরিবর্তন হয়নি: " + error.message);
          }
        };
      });
    }

  } catch (error) {
    $("adminList").innerHTML =
      "<p>Admin তালিকা লোড হয়নি: " +
      escapeHtml(error.message) + "</p>";
  }

  return;
}


}


/* ADD FOOD - FIRESTORE */

async function saveFood() {
  const name = $("mName").value.trim();
  const price = Number($("mPrice").value);
  const description = $("mDescription").value.trim();
  const file = $("mFile").files[0];

  if (!name || !Number.isFinite(price) || price <= 0) {
    alert("খাবারের নাম ও সঠিক দাম লিখুন।");
    return;
  }

  if (file && !validImage(file)) return;

  try {
    let imageUrl = "";

    if (file) {
      imageUrl = await makeSmallImage(file);
    }

    await addDoc(collection(db, "menu"), {
      name,
      price,
      description,
      imageUrl,
      active: true,
      createdAt: serverTimestamp()
    });

    await loadFoods();

    alert("নতুন খাবার যোগ হয়েছে।");

    await renderAdminSection("menu");

  } catch (error) {
    alert("খাবার যোগ হয়নি: " + error.message);
  }
}




/* UPLOAD LOGO - FIRESTORE */

async function uploadLogo() {
  const file = $("logoFile")?.files[0];

  if (!file || !validImage(file)) {
    alert("প্রথমে Logo-এর ছবি নির্বাচন করুন।");
    return;
  }

  try {
    const imageData = await makeSmallImage(file);

    await setDoc(
      doc(db, "site", "contact"),
      { logoUrl: imageData },
      { merge: true }
    );

    document.querySelectorAll(".site-logo, #siteLogo")
      .forEach(img => img.src = imageData);

    alert("Logo পরিবর্তন হয়েছে।");

    await renderAdminSection("images");

  } catch (error) {
    alert("Logo পরিবর্তন হয়নি: " + error.message);
  }
}






/* UPLOAD FOOD IMAGE - FIRESTORE */

async function uploadFoodImage() {
  const file = $("foodFile")?.files[0];
  const foodId = $("imageFood")?.value;

  if (!file || !validImage(file)) {
    alert("প্রথমে খাবারের ছবি নির্বাচন করুন।");
    return;
  }

  if (!foodId) {
    alert("একটি খাবার নির্বাচন করুন।");
    return;
  }

  try {
    const imageData = await makeSmallImage(file);

    await updateDoc(
      doc(db, "menu", foodId),
      { imageUrl: imageData }
    );

    await loadFoods();

    alert("খাবারের ছবি পরিবর্তন হয়েছে।");

    await renderAdminSection("images");

  } catch (error) {
    alert("ছবি পরিবর্তন হয়নি: " + error.message);
  }
}



/* BUTTON EVENTS */

if ($("moreBtn")) {
  $("moreBtn").onclick = () => {
    $("moreMenu")?.classList.toggle("show");
  };
}

document.querySelectorAll("#moreMenu button").forEach(button => {
  button.onclick = () => {
    $("moreMenu")?.classList.remove("show");

    const action = button.dataset.action;

    if (action === "login") login();
    if (action === "logout") logout();
    if (action === "profile") openProfile();
    if (action === "orders") openOrders();
    if (action === "settings") openSettings();
    if (action === "admin") openAdmin();
  };
});

document.querySelectorAll("[data-close]").forEach(button => {
  button.onclick = () => hide(button.dataset.close);
});

document.querySelectorAll(".setting").forEach(button => {
  button.onclick = () => settingAction(button.dataset.setting);
});

if ($("navOrder")) {
  $("navOrder").onclick = () => openOrder();
}

if ($("heroOrder")) {
  $("heroOrder").onclick = () => openOrder();
}

if ($("submitOrder")) {
  $("submitOrder").onclick = submitOrder;
}



/* WEBSITE START */

if ($("year")) {
  $("year").textContent = new Date().getFullYear();
}

await loadSettings();
await loadFoods();


/* ORDER PRICE SUMMARY */

function updateOrderSummary() {
  const foodSelect = $("foodSelect");
  const qtyInput = $("foodQty");

  if (!foodSelect || !qtyInput) return;

  const food = foods.find(
    item => item.id === foodSelect.value
  );

  if (!food) {
    $("orderSubtotal").textContent = "৳ ০";
    $("orderDiscount").textContent = "৳ ০";
    $("orderGrandTotal").textContent = "৳ ০";
    $("orderOfferMessage").textContent = "খাবার নির্বাচন করুন।";
    return;
  }

  const price = Number(food.price || 0);
  const quantity = Math.max(
    1,
    Math.floor(Number(qtyInput.value) || 1)
  );

  const subtotal = price * quantity;

  const offerApplied =
    offerSettings.enabled === true &&
    offerSettings.discountPercent > 0;

  const discountPercent = offerApplied
    ? Number(offerSettings.discountPercent)
    : 0;

  const discount = Math.round(
    subtotal * discountPercent / 100
  );

  const total = subtotal - discount;

  $("orderSubtotal").textContent = "৳ " + subtotal;
  $("orderDiscount").textContent = "৳ " + discount;
  $("orderGrandTotal").textContent = "৳ " + total;

  $("orderOfferMessage").textContent =
    offerApplied
      ? discountPercent + "% ছাড় প্রয়োগ হয়েছে।"
      : "বর্তমানে কোনো ছাড় নেই।";
}


// খাবার পরিবর্তন হলে হিসাব আপডেট
$("foodSelect")?.addEventListener(
  "change",
  updateOrderSummary
);


// পরিমাণ পরিবর্তন হলে হিসাব আপডেট
$("foodQty")?.addEventListener(
  "input",
  updateOrderSummary
);


// প্রথমবার হিসাব দেখানো
updateOrderSummary();

