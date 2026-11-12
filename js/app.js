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

    return snapshot.exists() &&
      snapshot.data().active !== false;

  } catch (error) {
    console.error("Admin check:", error);
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

    if ($("offerText")) {
      $("offerText").textContent =
        offer.text || offer.title ||
        "আমাদের বিশেষ অফার।";
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
  const quantity = Math.max(1, Number($("foodQty")?.value || 1));
  const note = $("orderNote")?.value.trim() || "";

  if (!customerName || !phone || !address) {
    alert("নাম, ফোন নম্বর ও সম্পূর্ণ ঠিকানা লিখুন।");
    return;
  }

  const order = {
    customerUid: user.uid,
    customerEmail: user.email || "",
    customerName,
    phone,
    address,
    foodId: food.id,
    foodName: food.name,
    price: Number(food.price || 0),
    quantity,
    total: Number(food.price || 0) * quantity,
    note,
    status: "pending",
    createdAt: serverTimestamp()
  };

  try {
    const orderRef = await addDoc(
      collection(db, "orders"),
      order
    );

    const message =
      `খাজা বিরানি হাউজ অর্ডার
অর্ডার নম্বর: ${orderRef.id}
নাম: ${customerName}
ফোন: ${phone}
ঠিকানা: ${address}
খাবার: ${food.name}
পরিমাণ: ${quantity}
মোট: ৳ ${order.total}
নোট: ${note}`;

    window.open(
      "https://wa.me/8801785452580?text=" +
      encodeURIComponent(message),
      "_blank"
    );

    alert("অর্ডার জমা হয়েছে।");

    hide("orderModal");

  } catch (error) {
    alert("অর্ডার জমা হয়নি:\n" + error.message);
  }
}


/* MY ORDERS */

function orderHtml(id, order, admin = false) {
  return `
    <div class="order-row">
      <b>অর্ডার: #${escapeHtml(id)}</b><br>
      খাবার: ${escapeHtml(order.foodName || "")}<br>
      পরিমাণ: ${Number(order.quantity || 1)}<br>
      মোট: ৳ ${Number(order.total || 0)}<br>
      অবস্থা: ${escapeHtml(order.status || "pending")}<br>

      ${admin ? `
        নাম: ${escapeHtml(order.customerName || "")}<br>
        ফোন: ${escapeHtml(order.phone || "")}<br>
        ঠিকানা: ${escapeHtml(order.address || "")}<br>

        <select data-status="${escapeHtml(id)}">
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="preparing">Preparing</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
      ` : ""}
    </div>
  `;
}

async function openOrders() {
  show("ordersModal");

  if (!user) {
    $("myOrders").innerHTML =
      "<p>অর্ডার দেখতে Gmail দিয়ে Login করুন।</p>";
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

  alert("বাটন কাজ করছে: " + action);

  if (action === "settings") {
    openSettings();
    return;
  }

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


  /* ALL ORDERS */

  if (section === "orders") {
    try {
      const snapshot = await getDocs(
        query(
          collection(db, "orders"),
          orderBy("createdAt", "desc")
        )
      );

      content.innerHTML =
        "<h3>🛒 সব অর্ডার</h3>" +
        snapshot.docs.map(item =>
          orderHtml(item.id, item.data(), true)
        ).join("") ||
        "<p>কোনো অর্ডার নেই।</p>";

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

    } catch (error) {
      content.textContent = "অর্ডার লোড হয়নি: " + error.message;
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

    content.innerHTML = `
      <h3>🎁 অফার ও পরিচিতি</h3>

      <label>
        অফারের শিরোনাম
        <input id="sTitle" value="${escapeHtml(data.title || "")}">
      </label>

      <label>
        অফারের বিবরণ
        <textarea id="sOffer">${escapeHtml(data.text || "")}</textarea>
      </label>

      <label>
        আমাদের সম্পর্কে
        <textarea id="sAbout">${escapeHtml(data.about || "")}</textarea>
      </label>

      <button class="save" id="saveSettings">Save</button>
    `;

    $("saveSettings").onclick = async () => {
      try {
        await setDoc(doc(db, "site", "offers"), {
          title: $("sTitle").value.trim(),
          text: $("sOffer").value.trim(),
          about: $("sAbout").value.trim()
        }, { merge: true });

        await loadSettings();
        alert("অফার ও পরিচিতি সংরক্ষণ হয়েছে।");

      } catch (error) {
        alert("সংরক্ষণ হয়নি: " + error.message);
      }
    };

    return;
  }


  /* ADMIN MANAGEMENT */

  if (section === "admins") {
    content.innerHTML = `
      <h3>👥 Admin Management</h3>
      <p>নতুন Admin যোগ করার জন্য তার Gmail লিখুন।</p>

      <label>
        Admin Gmail
        <input id="newAdminEmail" type="email">
      </label>

      <button class="save" id="addAdminBtn">
        Admin যোগ করুন
      </button>

      <p class="muted">
        এই সুবিধার জন্য Firebase Cloud Function
        addAdminByEmail আগে থেকে চালু থাকতে হবে।
      </p>
    `;

    $("addAdminBtn").onclick = async () => {
      const email = $("newAdminEmail").value.trim();

      if (!email) {
        alert("Gmail লিখুন।");
        return;
      }

      try {
        const addAdmin = httpsCallable(
          functions,
          "addAdminByEmail"
        );

        await addAdmin({ email });

        alert("Admin যোগ করার অনুরোধ সফল হয়েছে।");

      } catch (error) {
        alert("Admin যোগ হয়নি: " + error.message);
      }
    };

    return;
  }
}


/* ADD FOOD */

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
      const imageRef = ref(
        storage,
        `foods/${Date.now()}-${file.name}`
      );

      await uploadBytes(imageRef, file);
      imageUrl = await getDownloadURL(imageRef);
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


/* UPLOAD LOGO */

async function uploadLogo() {
  const file = $("logoFile")?.files[0];

  if (!file || !validImage(file)) {
    alert("প্রথমে Logo-এর ছবি নির্বাচন করুন।");
    return;
  }

  try {
    const imageRef = ref(
      storage,
      `site/logo-${Date.now()}-${file.name}`
    );

    await uploadBytes(imageRef, file);
    const url = await getDownloadURL(imageRef);

    await setDoc(
      doc(db, "site", "contact"),
      { logoUrl: url },
      { merge: true }
    );

    document.querySelectorAll(".site-logo, #siteLogo")
      .forEach(img => img.src = url);

    alert("Logo পরিবর্তন হয়েছে।");

  } catch (error) {
    alert("Logo Upload হয়নি: " + error.message);
  }
}


/* UPLOAD FOOD IMAGE */

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
    const imageRef = ref(
      storage,
      `foods/${foodId}-${Date.now()}-${file.name}`
    );

    await uploadBytes(imageRef, file);
    const url = await getDownloadURL(imageRef);

    await updateDoc(
      doc(db, "menu", foodId),
      { imageUrl: url }
    );

    await loadFoods();
    alert("খাবারের ছবি পরিবর্তন হয়েছে।");

  } catch (error) {
    alert("ছবি Upload হয়নি: " + error.message);
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
