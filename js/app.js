import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, query, where, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-storage.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-functions.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app);
const provider = new GoogleAuthProvider();

let user = null;
let isAdmin = false;
let foods = [];

const $ = id => document.getElementById(id);
const show = id => $(id)?.classList.add("show");
const hide = id => $(id)?.classList.remove("show");

document.querySelectorAll("[data-close]").forEach(b => {
  b.onclick = () => hide(b.dataset.close);
});

if ($("moreBtn")) $("moreBtn").onclick = () => $("moreMenu").classList.toggle("show");

document.querySelectorAll("#moreMenu button").forEach(b => {
  b.onclick = () => handleAction(b.dataset.action);
});

if ($("navOrder")) $("navOrder").onclick = () => openOrder();
if ($("heroOrder")) $("heroOrder").onclick = () => openOrder();
document.querySelectorAll(".setting").forEach(b => {
  b.onclick = () => settingAction(b.dataset.setting);
});
if ($("submitOrder")) $("submitOrder").onclick = submitOrder;

async function handleAction(a) {
  $("moreMenu")?.classList.remove("show");

  if (a === "login") return login();
  if (a === "logout") return signOut(auth);
  if (a === "profile") return openProfile();
  if (a === "orders") return openOrders();
  if (a === "settings") return openSettings();
  if (a === "admin") return openAdmin();
}

async function login() {
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    alert("Login হয়নি: " + e.message);
  }
}

async function logout() {
  await signOut(auth);
}

onAuthStateChanged(auth, async u => {
  user = u;
  isAdmin = false;

  if (u) {
    const a = await getDoc(doc(db, "admins", u.uid));
    isAdmin = a.exists() && a.data().active !== false;
  }

  renderProfile();

  if ($("loginHint")) {
    $("loginHint").textContent = u
      ? `লগইন: ${u.email}`
      : "অর্ডার পাঠাতে আগে Gmail দিয়ে Login করুন।";
  }
});

async function loadSettings() {
  const s = await getDoc(doc(db, "settings", "site"));

  if (s.exists()) {
    const d = s.data();

    if ($("offerText")) $("offerText").textContent = d.offer || $("offerText").textContent;
    if ($("aboutText")) $("aboutText").textContent = d.about || $("aboutText").textContent;
    if ($("phone1")) $("phone1").textContent = d.phone1 || $("phone1").textContent;
    if ($("phone2")) $("phone2").textContent = d.phone2 || $("phone2").textContent;
    if ($("address")) $("address").textContent = d.address || $("address").textContent;

    if (d.logoUrl && $("siteLogo")) $("siteLogo").src = d.logoUrl;
  }
}

async function loadFoods() {
  const snap = await getDocs(collection(db, "foods"));

  foods = snap.docs
    .map(x => ({ id: x.id, ...x.data() }))
    .filter(x => x.active !== false);

  if (!foods.length) {
    foods = [
      { id: "mutton-kacchi", name: "মাটন কাচ্চি", price: 210, imageUrl: "images/mutton-kacchi.jpg", active: true },
      { id: "beef-kacchi", name: "বিফ কাচ্চি", price: 160, imageUrl: "images/beef-kacchi.jpg", active: true },
      { id: "beef-tehari", name: "বিফ তেহারি", price: 120, imageUrl: "images/chicken-biryani.jpg", active: true },
      { id: "beef-rezala", name: "গরুর রেজালা", price: 160, imageUrl: "images/mutton-kacchi.jpg", active: true },
      { id: "chicken-khichuri", name: "চিকেন খিচুড়ি", price: 90, imageUrl: "images/chicken-biryani.jpg", active: true },
      { id: "egg-khichuri", name: "ডিম খিচুড়ি", price: 80, imageUrl: "images/chicken-biryani.jpg", active: true },
      { id: "egg-pulao", name: "ডিম পোলাও", price: 70, imageUrl: "images/chicken-biryani.jpg", active: true },
      { id: "borhani", name: "বোরহানি", price: 80, imageUrl: "images/chicken-biryani.jpg", active: true },
      { id: "mojo", name: "Mojo", price: 20, imageUrl: "images/chicken-biryani.jpg", active: true }
    ];
  }

  renderFoods();
}

function renderFoods() {
  if ($("menuGrid")) {
    $("menuGrid").innerHTML = foods.map(f => `
      <article class="card">
        <img src="${f.imageUrl || "images/mutton-kacchi.jpg"}" alt="${escapeHtml(f.name)}">
        <div class="info">
          <h3>${escapeHtml(f.name)}</h3>
          <div class="price">৳ ${Number(f.price || 0)}</div>
          <button class="primary wide" data-food="${f.id}">🛒 অর্ডার করুন</button>
        </div>
      </article>
    `).join("");

    $("menuGrid").querySelectorAll("[data-food]").forEach(b => {
      b.onclick = () => openOrder(b.dataset.food);
    });
  }

  if ($("foodSelect")) {
    $("foodSelect").innerHTML = foods.map(f =>
      `<option value="${f.id}">${escapeHtml(f.name)} — ৳ ${Number(f.price || 0)}</option>`
    ).join("");
  }
}

function openOrder(id) {
  show("orderModal");

  if (id && $("foodSelect")) {
    $("foodSelect").value = id;
  }
}

async function submitOrder() {
  if (!user) {
    alert("আগে Gmail/Google দিয়ে Login করুন।");
    return login();
  }

  const f = foods.find(x => x.id === $("foodSelect").value);
  if (!f) return alert("খাবার নির্বাচন করুন।");

  const qty = Math.max(1, Number($("foodQty").value || 1));

  const order = {
    customerUid: user.uid,
    customerEmail: user.email,
    customerName: $("customerName").value.trim(),
    phone: $("customerPhone").value.trim(),
    address: $("customerAddress").value.trim(),
    foodId: f.id,
    foodName: f.name,
    price: Number(f.price),
    quantity: qty,
    total: Number(f.price) * qty,
    note: $("orderNote").value.trim(),
    status: "pending",
    createdAt: serverTimestamp()
  };

  if (!order.customerName || !order.phone || !order.address) {
    alert("নাম, ফোন নম্বর ও সম্পূর্ণ ঠিকানা দিন।");
    return;
  }

  try {
    const refOrder = await addDoc(collection(db, "orders"), order);

    const wa =
      `খাজা বিরানি হাউজ অর্ডার\n` +
      `অর্ডার: ${refOrder.id}\n` +
      `নাম: ${order.customerName}\n` +
      `ফোন: ${order.phone}\n` +
      `ঠিকানা: ${order.address}\n` +
      `খাবার: ${order.foodName}\n` +
      `পরিমাণ: ${qty}\n` +
      `মোট: ৳ ${order.total}\n` +
      `নোট: ${order.note}`;

    window.open(
      "https://wa.me/8801785452580?text=" + encodeURIComponent(wa),
      "_blank"
    );

    alert("অর্ডার সফলভাবে জমা হয়েছে।");
    hide("orderModal");
  } catch (e) {
    alert("অর্ডার সংরক্ষণ হয়নি: " + e.message);
  }
}

function renderProfile() {
  if (!$("profileBox")) return;

  if (!user) {
    $("profileBox").innerHTML =
      `<button class="primary" id="profileLogin">🔐 Gmail দিয়ে Login</button>`;

    $("profileLogin").onclick = login;
    return;
  }

  $("profileBox").innerHTML = `
    <p><b>${escapeHtml(user.displayName || "Customer")}</b></p>
    <p>${escapeHtml(user.email || "")}</p>
    <button class="primary" id="pLogout">🚪 Logout</button>
  `;

  $("pLogout").onclick = logout;
}

function openProfile() {
  show("profileModal");
  renderProfile();
}

async function openOrders() {
  show("ordersModal");

  if (!user) {
    $("myOrders").innerHTML =
      "<p>অর্ডার দেখতে Gmail দিয়ে Login করুন।</p>";
    return;
  }

  $("myOrders").innerHTML = "<p>লোড হচ্ছে...</p>";

  const q = query(
    collection(db, "orders"),
    where("customerUid", "==", user.uid),
    orderBy("createdAt", "desc")
  );

  try {
    const s = await getDocs(q);

    $("myOrders").innerHTML =
      s.docs.map(d => orderHtml(d.id, d.data(), false)).join("") ||
      "<p>এখনও কোনো অর্ডার নেই।</p>";
  } catch (e) {
    $("myOrders").innerHTML =
      "<p>অর্ডার লোড করা যায়নি।</p>";
  }
}

function orderHtml(id, o, admin) {
  return `
    <div class="order-row">
      <b>#${id}</b> — ${escapeHtml(o.foodName || "")} × ${o.quantity || 1}
      <br>৳ ${o.total || 0} |
      <span class="status">${escapeHtml(o.status || "pending")}</span>
      ${
        admin
          ? `
            <br>${escapeHtml(o.customerName || "")}
            — ${escapeHtml(o.phone || "")}
            <br>${escapeHtml(o.address || "")}
            <br>
            <select data-status="${id}">
              <option value="pending">pending</option>
              <option value="confirmed">confirmed</option>
              <option value="preparing">preparing</option>
              <option value="delivered">delivered</option>
              <option value="cancelled">cancelled</option>
            </select>
          `
          : ""
      }
    </div>
  `;
}

function openSettings() {
  if (!isAdmin) {
    alert("Settings শুধু অনুমোদিত Admin-এর জন্য।");
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

async function openAdmin(section = "orders") {
  if (!user) {
    alert("Admin Panel-এর জন্য Gmail Login করুন।");
    return login();
  }

  if (!isAdmin) {
    alert("আপনার অ্যাকাউন্ট Admin নয়।");
    return;
  }

  show("adminModal");

  const p = $("adminPanel");

  p.innerHTML = `
    <div class="admin-grid">
      <div class="stat">🛒 অর্ডার</div>
      <div class="stat">🍛 মেনু</div>
      <div class="stat">🖼️ ছবি</div>
      <div class="stat">⚙️ Settings</div>
    </div>

    <div class="admin-section" id="adminContent">
      লোড হচ্ছে...
    </div>
  `;

  await renderAdminSection(section);
}

async function renderAdminSection(section) {
  const c = $("adminContent");

  if (section === "orders") {
    const s = await getDocs(
      query(collection(db, "orders"), orderBy("createdAt", "desc"))
    );

    c.innerHTML =
      "<h3>🛒 সব অর্ডার</h3>" +
      s.docs.map(d => orderHtml(d.id, d.data(), true)).join("");

    c.querySelectorAll("[data-status]").forEach(sel => {
      const current = sel.parentElement
        .querySelector(".status")
        ?.textContent;

      if (current) sel.value = current;

      sel.onchange = async () => {
        await updateDoc(
          doc(db, "orders", sel.dataset.status),
          { status: sel.value }
        );
      };
    });

    return;
  }

  if (section === "menu") {
    c.innerHTML = `
      <h3>🍛 Menu Management</h3>

      <label>
        খাবারের নাম
        <input id="mName">
      </label>

      <label>
        দাম
        <input id="mPrice" type="number">
      </label>

      <label>
        ছবি
        <input id="mFile" type="file" accept="image/*">
      </label>

      <button class="primary" id="mSave">➕ খাবার যোগ</button>

      <hr>

      ${foods.map(f => `
        <div class="order-row">
          <img class="preview" src="${f.imageUrl}">
          <b>${escapeHtml(f.name)}</b>
          — ৳ ${f.price}
          <button class="danger" data-del="${f.id}">
            মুছুন
          </button>
        </div>
      `).join("")}
    `;

    c.querySelector("#mSave").onclick = saveFood;

    c.querySelectorAll("[data-del]").forEach(b => {
      b.onclick = async () => {
        if (confirm("মুছবেন?")) {
          await updateDoc(
            doc(db, "foods", b.dataset.del),
            { active: false }
          );

          await loadFoods();
          renderAdminSection("menu");
        }
      };
    });

    return;
  }

  if (section === "images") {
    c.innerHTML = `
      <h3>🖼️ Logo & Food Images</h3>

      <label>
        Logo নতুন ছবি
        <input id="logoFile" type="file" accept="image/*">
      </label>

      <button class="primary" id="logoUpload">
        ⬆️ Logo Upload
      </button>

      <p>যে খাবারের ছবি বদলাবেন:</p>

      <select id="imageFood">
        ${foods.map(f =>
          `<option value="${f.id}">
            ${escapeHtml(f.name)}
          </option>`
        ).join("")}
      </select>

      <input id="foodFile" type="file" accept="image/*">

      <button class="primary" id="foodUpload">
        ⬆️ Food Image Upload
      </button>
    `;

    c.querySelector("#logoUpload").onclick = uploadLogo;
    c.querySelector("#foodUpload").onclick = uploadFoodImage;

    return;
  }

  if (section === "contact" || section === "offer") {
    const s = await getDoc(doc(db, "settings", "site"));
    const d = s.exists() ? s.data() : {};

    c.innerHTML = `
      <h3>⚙️ ${
        section === "contact" ? "Contact" : "Offer"
      } Settings</h3>

      ${
        section === "contact"
          ? `
            <label>
              Phone 1
              <input id="sPhone1"
                value="${d.phone1 || "01785452580"}">
            </label>

            <label>
              Phone 2
              <input id="sPhone2"
                value="${d.phone2 || "01608341418"}">
            </label>

            <label>
              ঠিকানা
              <input id="sAddress"
                value="${d.address || "ঢাকা, বাংলাদেশ"}">
            </label>
          `
          : `
            <label>
              Offer
              <input id="sOffer"
                value="${
                  d.offer ||
                  "ওয়েবসাইট উদ্বোধন উপলক্ষে সকল খাবারে ২০% ডিসকাউন্ট।"
                }">
            </label>

            <label>
              About
              <textarea id="sAbout">${
                d.about ||
                "ঐতিহ্যবাহী স্বাদ, মানসম্মত উপকরণ ও যত্নে রান্না।"
              }</textarea>
            </label>
          `
      }

      <button class="save" id="saveSettings">
        💾 Save Settings
      </button>
    `;

    c.querySelector("#saveSettings").onclick = async () => {
      const patch =
        section === "contact"
          ? {
              phone1: $("sPhone1").value,
              phone2: $("sPhone2").value,
              address: $("sAddress").value
            }
          : {
              offer: $("sOffer").value,
              about: $("sAbout").value
            };

      await setDoc(
        doc(db, "settings", "site"),
        patch,
        { merge: true }
      );

      await loadSettings();

      alert("Settings সংরক্ষণ হয়েছে।");
    };

    return;
  }

  if (section === "admins") {
    c.innerHTML = `
      <h3>👥 Admin Management</h3>

      <p>
        নতুন Admin-এর Gmail লিখে যোগ করুন।
      </p>

      <label>
        নতুন Admin Gmail
        <input
          id="newAdminEmail"
          type="email"
          placeholder="admin@example.com">
      </label>

      <button class="save" id="addAdminBtn">
        ➕ Admin যোগ করুন
      </button>

      <div id="adminList" class="admin-section">
        লোড হচ্ছে...
      </div>
    `;

    c.querySelector("#addAdminBtn").onclick = async () => {
      const email =
        c.querySelector("#newAdminEmail").value.trim();

      if (!email) {
        return alert("Admin-এর Gmail দিন।");
      }

      try {
        const fn =
          httpsCallable(functions, "addAdminByEmail");

        await fn({ email });

        alert("নতুন Admin যোগ হয়েছে।");

        renderAdminSection("admins");
      } catch (e) {
        alert("Admin যোগ হয়নি: " + e.message);
      }
    };

    try {
      const s = await getDocs(collection(db, "admins"));

      c.querySelector("#adminList").innerHTML =
        "<b>বর্তমান Admin:</b><br>" +
        s.docs.map(d => `
          <div class="order-row">
            ${escapeHtml(d.data().email || d.id)}
            —
            ${
              d.data().active === false
                ? "বন্ধ"
                : "সক্রিয়"
            }
          </div>
        `).join("");
    } catch (e) {}
  }
}

async function saveFood() {
  const name = $("mName").value.trim();
  const price = Number($("mPrice").value);
  const file = $("mFile").files[0];

  if (!name || !price) {
    alert("নাম ও দাম দিন।");
    return;
  }

  let imageUrl = "images/mutton-kacchi.jpg";

  if (file) {
    const r = ref(
      storage,
      `foods/${crypto.randomUUID()}-${file.name}`
    );

    await uploadBytes(r, file);
    imageUrl = await getDownloadURL(r);
  }

  await addDoc(
    collection(db, "foods"),
    {
      name,
      price,
      imageUrl,
      active: true,
      createdAt: serverTimestamp()
    }
  );

  await loadFoods();

  alert("খাবার যোগ হয়েছে।");
}

async function uploadLogo() {
  const f = $("logoFile").files[0];

  if (!f) {
    return alert("ছবি নির্বাচন করুন।");
  }

  const r = ref(
    storage,
    `site/logo-${Date.now()}-${f.name}`
  );

  await uploadBytes(r, f);

  const url = await getDownloadURL(r);

  await setDoc(
    doc(db, "settings", "site"),
    { logoUrl: url },
    { merge: true }
  );

  if ($("siteLogo")) $("siteLogo").src = url;

  alert("লোগো পরিবর্তন হয়েছে।");
}

async function uploadFoodImage() {
  const f = $("foodFile").files[0];
  const id = $("imageFood").value;

  if (!f) {
    return alert("ছবি নির্বাচন করুন।");
  }

  const r = ref(
    storage,
    `foods/${id}-${Date.now()}-${f.name}`
  );

  await uploadBytes(r, f);

  const url = await getDownloadURL(r);

  await updateDoc(
    doc(db, "foods", id),
    { imageUrl: url }
  );

  await loadFoods();

  alert("খাবারের ছবি পরিবর্তন হয়েছে।");
}

function escapeHtml(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    m => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[m])
  );
}

await loadSettings();
await loadFoods();
