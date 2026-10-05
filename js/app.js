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


/* =========================
   FIREBASE
========================= */

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app);

const provider = new GoogleAuthProvider();

let user = null;
let isAdmin = false;
let foods = [];


/* =========================
   HELPERS
========================= */

const $ = id => document.getElementById(id);

const show = id => {
  $(id)?.classList.add("show");
};

const hide = id => {
  $(id)?.classList.remove("show");
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, m => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));
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


/* =========================
   BUTTON EVENTS
========================= */

document.querySelectorAll("[data-close]").forEach(button => {
  button.onclick = () => hide(button.dataset.close);
});

if ($("moreBtn")) {
  $("moreBtn").onclick = () => {
    $("moreMenu")?.classList.toggle("show");
  };
}

document.querySelectorAll("#moreMenu button").forEach(button => {
  button.onclick = () => handleAction(button.dataset.action);
});

if ($("navOrder")) {
  $("navOrder").onclick = () => openOrder();
}

if ($("heroOrder")) {
  $("heroOrder").onclick = () => openOrder();
}

document.querySelectorAll(".setting").forEach(button => {
  button.onclick = () => settingAction(button.dataset.setting);
});

if ($("submitOrder")) {
  $("submitOrder").onclick = submitOrder;
}


/* =========================
   MENU ACTIONS
========================= */

async function handleAction(action) {

  $("moreMenu")?.classList.remove("show");

  if (action === "login") return login();

  if (action === "logout") return logout();

  if (action === "profile") return openProfile();

  if (action === "orders") return openOrders();

  if (action === "settings") return openSettings();

  if (action === "admin") return openAdmin();
}


/* =========================
   GOOGLE LOGIN
========================= */

async function login() {
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    alert("Login হয়নি:\n" + error.message);
  }
}

async function logout() {
  try {
    await signOut(auth);
  } catch (error) {
    alert("Logout হয়নি:\n" + error.message);
  }
}


/* =========================
   AUTH STATE
========================= */

onAuthStateChanged(auth, async currentUser => {

  user = currentUser;
  isAdmin = false;

  if (user) {

    try {

      const adminDoc = await getDoc(
        doc(db, "admins", user.uid)
      );

      isAdmin =
        adminDoc.exists() &&
        adminDoc.data().active !== false;

    } catch (error) {
      isAdmin = false;
    }
  }

  renderProfile();

  if ($("loginHint")) {
    $("loginHint").textContent =
      user
        ? `লগইন: ${user.email}`
        : "অর্ডার পাঠাতে আগে Gmail দিয়ে Login করুন।";
  }
});


/* =========================
   LOAD SETTINGS
========================= */

async function loadSettings() {

  try {

    const settingsDoc =
      await getDoc(doc(db, "settings", "site"));

    if (!settingsDoc.exists()) return;

    const data = settingsDoc.data();

    if ($("offerText") && data.offer) {
      $("offerText").textContent = data.offer;
    }

    if ($("aboutText") && data.about) {
      $("aboutText").textContent = data.about;
    }

    if ($("phone1") && data.phone1) {
      $("phone1").textContent = data.phone1;
    }

    if ($("phone2") && data.phone2) {
      $("phone2").textContent = data.phone2;
    }

    if ($("address") && data.address) {
      $("address").textContent = data.address;
    }

    if (data.logoUrl) {
      document
        .querySelectorAll(".site-logo, #siteLogo")
        .forEach(img => {
          img.src = data.logoUrl;
        });
    }

  } catch (error) {

    console.log("Settings load error:", error);

  }
}


/* =========================
   DEFAULT FOODS
========================= */

const defaultFoods = [

  {
    id: "mutton-kacchi",
    name: "মাটন কাচ্চি",
    price: 210,
    imageUrl: "mutton-kacchi-1.jpg",
    active: true
  },

  {
    id: "beef-kacchi",
    name: "বিফ কাচ্চি",
    price: 160,
    imageUrl: "mutton-kacchi-1.jpg",
    active: true
  },

  {
    id: "beef-tehari",
    name: "বিফ তেহারি",
    price: 120,
    imageUrl: "mutton-kacchi-1.jpg",
    active: true
  },

  {
    id: "beef-rezala",
    name: "গরুর রেজালা",
    price: 160,
    imageUrl: "mutton-kacchi-1.jpg",
    active: true
  },

  {
    id: "chicken-khichuri",
    name: "চিকেন খিচুড়ি",
    price: 90,
    imageUrl: "mutton-kacchi-1.jpg",
    active: true
  },

  {
    id: "egg-khichuri",
    name: "ডিম খিচুড়ি",
    price: 80,
    imageUrl: "mutton-kacchi-1.jpg",
    active: true
  },

  {
    id: "egg-pulao",
    name: "ডিম পোলাও",
    price: 70,
    imageUrl: "mutton-kacchi-1.jpg",
    active: true
  },

  {
    id: "borhani",
    name: "বোরহানি",
    price: 80,
    imageUrl: "mutton-kacchi-1.jpg",
    active: true
  },

  {
    id: "mojo",
    name: "Mojo",
    price: 20,
    imageUrl: "mutton-kacchi-1.jpg",
    active: true
  }

];


/* =========================
   LOAD FOODS
========================= */

async function loadFoods() {

  try {

    const snapshot =
      await getDocs(collection(db, "foods"));

    foods = snapshot.docs
      .map(item => ({
        id: item.id,
        ...item.data()
      }))
      .filter(item => item.active !== false);


    /*
      যদি Firebase-এ এখনো কোনো খাবার না থাকে,
      তাহলে প্রথমবার default খাবারগুলো Firebase-এ তৈরি হবে।
    */

    if (!foods.length) {

      for (const food of defaultFoods) {

        await setDoc(
          doc(db, "foods", food.id),
          {
            name: food.name,
            price: food.price,
            imageUrl: food.imageUrl,
            active: true,
            createdAt: serverTimestamp()
          }
        );

      }

      const newSnapshot =
        await getDocs(collection(db, "foods"));

      foods = newSnapshot.docs
        .map(item => ({
          id: item.id,
          ...item.data()
        }))
        .filter(item => item.active !== false);
    }

    renderFoods();

  } catch (error) {

    console.log("Foods load error:", error);

    foods = defaultFoods;

    renderFoods();
  }
}


/* =========================
   RENDER FOODS
========================= */

function renderFoods() {

  if ($("menuGrid")) {

    $("menuGrid").innerHTML =
      foods.map(food => `

        <article class="card">

          <img
            src="${escapeHtml(
              food.imageUrl || "mutton-kacchi-1.jpg"
            )}"
            alt="${escapeHtml(food.name)}"
          >

          <div class="info">

            <h3>${escapeHtml(food.name)}</h3>

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

    $("menuGrid")
      .querySelectorAll("[data-food]")
      .forEach(button => {

        button.onclick = () =>
          openOrder(button.dataset.food);

      });
  }


  if ($("foodSelect")) {

    $("foodSelect").innerHTML =
      foods.map(food => `

        <option value="${escapeHtml(food.id)}">
          ${escapeHtml(food.name)}
          — ৳ ${Number(food.price || 0)}
        </option>

      `).join("");
  }
}


/* =========================
   ORDER
========================= */

function openOrder(foodId) {

  show("orderModal");

  if (foodId && $("foodSelect")) {
    $("foodSelect").value = foodId;
  }
}


async function submitOrder() {

  if (!user) {

    alert("আগে Gmail/Google দিয়ে Login করুন।");

    return login();
  }

  const food =
    foods.find(item =>
      item.id === $("foodSelect")?.value
    );

  if (!food) {
    alert("খাবার নির্বাচন করুন।");
    return;
  }

  const quantity =
    Math.max(
      1,
      Number($("foodQty")?.value || 1)
    );

  const order = {

    customerUid: user.uid,

    customerEmail:
      user.email || "",

    customerName:
      $("customerName")?.value.trim() || "",

    phone:
      $("customerPhone")?.value.trim() || "",

    address:
      $("customerAddress")?.value.trim() || "",

    foodId: food.id,

    foodName: food.name,

    price: Number(food.price),

    quantity,

    total:
      Number(food.price) * quantity,

    note:
      $("orderNote")?.value.trim() || "",

    status: "pending",

    createdAt: serverTimestamp()
  };


  if (
    !order.customerName ||
    !order.phone ||
    !order.address
  ) {

    alert(
      "নাম, ফোন নম্বর ও সম্পূর্ণ ঠিকানা দিন।"
    );

    return;
  }


  try {

    const orderRef =
      await addDoc(
        collection(db, "orders"),
        order
      );


    const whatsappText =

      `খাজা বিরানি হাউজ অর্ডার
অর্ডার: ${orderRef.id}
নাম: ${order.customerName}
ফোন: ${order.phone}
ঠিকানা: ${order.address}
খাবার: ${order.foodName}
পরিমাণ: ${quantity}
মোট: ৳ ${order.total}
নোট: ${order.note}`;


    window.open(
      "https://wa.me/8801785452580?text=" +
      encodeURIComponent(whatsappText),
      "_blank"
    );


    alert(
      "অর্ডার সফলভাবে জমা হয়েছে।"
    );

    hide("orderModal");

  } catch (error) {

    alert(
      "অর্ডার সংরক্ষণ হয়নি:\n" +
      error.message
    );
  }
}


/* =========================
   PROFILE
========================= */

function renderProfile() {

  if (!$("profileBox")) return;

  if (!user) {

    $("profileBox").innerHTML = `

      <button
        class="primary"
        id="profileLogin"
      >
        🔐 Gmail দিয়ে Login
      </button>

    `;

    $("profileLogin").onclick = login;

    return;
  }


  $("profileBox").innerHTML = `

    <p>
      <b>
        ${escapeHtml(
          user.displayName || "Customer"
        )}
      </b>
    </p>

    <p>
      ${escapeHtml(user.email || "")}
    </p>

    <button
      class="primary"
      id="pLogout"
    >
      🚪 Logout
    </button>

  `;


  $("pLogout").onclick = logout;
}


function openProfile() {

  show("profileModal");

  renderProfile();
}


/* =========================
   CUSTOMER ORDERS
========================= */

async function openOrders() {

  show("ordersModal");

  if (!user) {

    if ($("myOrders")) {
      $("myOrders").innerHTML =
        "<p>অর্ডার দেখতে Gmail দিয়ে Login করুন।</p>";
    }

    return;
  }


  $("myOrders").innerHTML =
    "<p>লোড হচ্ছে...</p>";


  try {

    const ordersQuery =
      query(
        collection(db, "orders"),
        where(
          "customerUid",
          "==",
          user.uid
        ),
        orderBy(
          "createdAt",
          "desc"
        )
      );


    const snapshot =
      await getDocs(ordersQuery);


    $("myOrders").innerHTML =

      snapshot.docs
        .map(docItem =>
          orderHtml(
            docItem.id,
            docItem.data(),
            false
          )
        )
        .join("") ||

      "<p>এখনও কোনো অর্ডার নেই।</p>";


  } catch (error) {

    $("myOrders").innerHTML =
      "<p>অর্ডার লোড করা যায়নি।</p>";
  }
}


/* =========================
   ORDER HTML
========================= */

function orderHtml(id, order, admin) {

  return `

    <div class="order-row">

      <b>#${escapeHtml(id)}</b>

      —
      ${escapeHtml(order.foodName || "")}

      × ${order.quantity || 1}

      <br>

      ৳ ${order.total || 0}

      |

      <span class="status">
        ${escapeHtml(
          order.status || "pending"
        )}
      </span>

      ${
        admin

          ? `

            <br>

            ${escapeHtml(
              order.customerName || ""
            )}

            —

            ${escapeHtml(
              order.phone || ""
            )}

            <br>

            ${escapeHtml(
              order.address || ""
            )}

            <br>

            <select
              data-status="${escapeHtml(id)}"
            >

              <option value="pending">
                pending
              </option>

              <option value="confirmed">
                confirmed
              </option>

              <option value="preparing">
                preparing
              </option>

              <option value="delivered">
                delivered
              </option>

              <option value="cancelled">
                cancelled
              </option>

            </select>

          `

          : ""
      }

    </div>

  `;
}


/* =========================
   SETTINGS
========================= */

function openSettings() {

  if (!isAdmin) {

    alert(
      "Settings শুধু অনুমোদিত Admin-এর জন্য।"
    );

    return;
  }

  show("settingsModal");
}


function settingAction(type) {

  hide("settingsModal");

  if (type === "menu")
    return openAdmin("menu");

  if (type === "images")
    return openAdmin("images");

  if (type === "contact")
    return openAdmin("contact");

  if (type === "offer")
    return openAdmin("offer");

  if (type === "admin")
    return openAdmin("admins");
}


/* =========================
   ADMIN PANEL
========================= */

async function openAdmin(section = "orders") {

  if (!user) {

    alert(
      "Admin Panel-এর জন্য Gmail Login করুন।"
    );

    return login();
  }


  if (!isAdmin) {

    alert(
      "আপনার অ্যাকাউন্ট Admin নয়।"
    );

    return;
  }


  show("adminModal");

  const panel = $("adminPanel");

  if (!panel) return;


  panel.innerHTML = `

    <div class="admin-grid">

      <div class="stat">
        🛒 অর্ডার
      </div>

      <div class="stat">
        🍛 মেনু
      </div>

      <div class="stat">
        🖼️ ছবি
      </div>

      <div class="stat">
        ⚙️ Settings
      </div>

    </div>

    <div
      class="admin-section"
      id="adminContent"
    >
      লোড হচ্ছে...
    </div>

  `;


  await renderAdminSection(section);
}


/* =========================
   ADMIN SECTIONS
========================= */

async function renderAdminSection(section) {

  const content =
    $("adminContent");

  if (!content) return;


  /* ---------- ORDERS ---------- */

  if (section === "orders") {

    try {

      const snapshot =
        await getDocs(
          query(
            collection(db, "orders"),
            orderBy(
              "createdAt",
              "desc"
            )
          )
        );


      content.innerHTML =

        "<h3>🛒 সব অর্ডার</h3>" +

        snapshot.docs
          .map(item =>
            orderHtml(
              item.id,
              item.data(),
              true
            )
          )
          .join("");


      content
        .querySelectorAll("[data-status]")
        .forEach(select => {

          const currentOrder =
            snapshot.docs.find(
              item =>
                item.id ===
                select.dataset.status
            );

          if (currentOrder) {

            select.value =
              currentOrder.data().status ||
              "pending";
          }


          select.onchange =
            async () => {

              try {

                await updateDoc(
                  doc(
                    db,
                    "orders",
                    select.dataset.status
                  ),
                  {
                    status:
                      select.value
                  }
                );

                alert(
                  "অর্ডারের Status পরিবর্তন হয়েছে।"
                );

              } catch (error) {

                alert(
                  "Status পরিবর্তন হয়নি:\n" +
                  error.message
                );
              }
            };
        });

    } catch (error) {

      content.innerHTML =
        "<p>অর্ডার লোড করা যায়নি।</p>";
    }

    return;
  }


  /* ---------- MENU ---------- */

  if (section === "menu") {

    content.innerHTML = `

      <h3>
        🍛 Menu Management
      </h3>

      <label>
        খাবারের নাম
        <input id="mName">
      </label>

      <label>
        দাম
        <input
          id="mPrice"
          type="number"
        >
      </label>

      <label>
        ছবি
        <input
          id="mFile"
          type="file"
          accept="image/*"
        >
      </label>

      <button
        class="primary"
        id="mSave"
      >
        ➕ খাবার যোগ
      </button>

      <hr>

      ${
        foods.map(food => `

          <div class="order-row">

            <img
              class="preview"
              src="${escapeHtml(
                food.imageUrl ||
                "mutton-kacchi-1.jpg"
              )}"
            >

            <b>
              ${escapeHtml(food.name)}
            </b>

            —
            ৳ ${Number(food.price)}

            <button
              class="danger"
              data-del="${escapeHtml(food.id)}"
            >
              মুছুন
            </button>

          </div>

        `).join("")
      }

    `;


    $("mSave").onclick =
      saveFood;


    content
      .querySelectorAll("[data-del]")
      .forEach(button => {

        button.onclick =
          async () => {

            if (
              !confirm(
                "এই খাবারটি মুছে ফেলবেন?"
              )
            ) return;


            try {

              await updateDoc(
                doc(
                  db,
                  "foods",
                  button.dataset.del
                ),
                {
                  active: false
                }
              );

              await loadFoods();

              await renderAdminSection(
                "menu"
              );

            } catch (error) {

              alert(
                "খাবার মুছে ফেলা যায়নি:\n" +
                error.message
              );
            }
          };
      });

    return;
  }


  /* ---------- IMAGES ---------- */

  if (section === "images") {

    content.innerHTML = `

      <h3>
        🖼️ Logo & Food Images
      </h3>

      <p>
        এখান থেকেই ওয়েবসাইটের Logo ও খাবারের ছবি পরিবর্তন করতে পারবেন।
      </p>

      <label>
        Logo নতুন ছবি

        <input
          id="logoFile"
          type="file"
          accept="image/*"
        >
      </label>

      <button
        class="primary"
        id="logoUpload"
      >
        ⬆️ Logo Upload
      </button>

      <hr>

      <p>
        যে খাবারের ছবি পরিবর্তন করবেন:
      </p>

      <select id="imageFood">

        ${
          foods.map(food => `

            <option
              value="${escapeHtml(food.id)}"
            >
              ${escapeHtml(food.name)}
            </option>

          `).join("")
        }

      </select>

      <input
        id="foodFile"
        type="file"
        accept="image/*"
      >

      <button
        class="primary"
        id="foodUpload"
      >
        ⬆️ Food Image Upload
      </button>

    `;


    $("logoUpload").onclick =
      uploadLogo;


    $("foodUpload").onclick =
      uploadFoodImage;

    return;
  }


  /* ---------- CONTACT ---------- */

  if (
    section === "contact" ||
    section === "offer"
  ) {

    const settingsDoc =
      await getDoc(
        doc(db, "settings", "site")
      );

    const data =
      settingsDoc.exists()
        ? settingsDoc.data()
        : {};


    if (section === "contact") {

      content.innerHTML = `

        <h3>
          📞 Contact Settings
        </h3>

        <label>
          Phone 1

          <input
            id="sPhone1"
            value="${escapeHtml(
              data.phone1 ||
              "01785452580"
            )}"
          >
        </label>

        <label>
          Phone 2

          <input
            id="sPhone2"
            value="${escapeHtml(
              data.phone2 ||
              "01608341418"
            )}"
          >
        </label>

        <label>
          ঠিকানা

          <input
            id="sAddress"
            value="${escapeHtml(
              data.address ||
              "ঢাকা, বাংলাদেশ"
            )}"
          >
        </label>

        <button
          class="save"
          id="saveSettings"
        >
          💾 Save Settings
        </button>

      `;

    } else {

      content.innerHTML = `

        <h3>
          🎁 Offer & About Settings
        </h3>

        <label>
          Offer

          <input
            id="sOffer"
            value="${escapeHtml(
              data.offer ||
              "ওয়েবসাইট উদ্বোধন উপলক্ষে সকল খাবারে ২০% ডিসকাউন্ট।"
            )}"
          >
        </label>

        <label>
          About

          <textarea
            id="sAbout"
          >${escapeHtml(
            data.about ||
            "ঐতিহ্যবাহী স্বাদ, মানসম্মত উপকরণ ও যত্নে রান্না।"
          )}</textarea>

        </label>

        <button
          class="save"
          id="saveSettings"
        >
          💾 Save Settings
        </button>

      `;
    }


    $("saveSettings").onclick =
      async () => {

        try {

          let dataToSave;


          if (section === "contact") {

            dataToSave = {

              phone1:
                $("sPhone1").value.trim(),

              phone2:
                $("sPhone2").value.trim(),

              address:
                $("sAddress").value.trim()

            };

          } else {

            dataToSave = {

              offer:
                $("sOffer").value.trim(),

              about:
                $("sAbout").value.trim()

            };
          }


          await setDoc(
            doc(db, "settings", "site"),
            dataToSave,
            {
              merge: true
            }
          );


          await loadSettings();


          alert(
            "Settings সংরক্ষণ হয়েছে।"
          );

        } catch (error) {

          alert(
            "Settings সংরক্ষণ হয়নি:\n" +
            error.message
          );
        }
      };

    return;
  }


  /* ---------- ADMINS ---------- */

  if (section === "admins") {

    content.innerHTML = `

      <h3>
        👥 Admin Management
      </h3>

      <p>
        নতুন Admin-এর Gmail যোগ করতে পারবেন।
      </p>

      <label>
        নতুন Admin Gmail

        <input
          id="newAdminEmail"
          type="email"
          placeholder="admin@example.com"
        >
      </label>

      <button
        class="save"
        id="addAdminBtn"
      >
        ➕ Admin যোগ করুন
      </button>

      <div
        id="adminList"
        class="admin-section"
      >
        লোড হচ্ছে...
      </div>

    `;


    $("addAdminBtn").onclick =
      async () => {

        const email =
          $("newAdminEmail")
            .value
            .trim();


        if (!email) {

          alert(
            "Admin-এর Gmail দিন।"
          );

          return;
        }


        try {

          const addAdmin =
            httpsCallable(
              functions,
              "addAdminByEmail"
            );


          await addAdmin({
            email
          });


          alert(
            "নতুন Admin যোগ হয়েছে।"
          );


          await renderAdminSection(
            "admins"
          );

        } catch (error) {

          alert(
            "Admin যোগ হয়নি:\n" +
            error.message
          );
        }
      };


    try {

      const snapshot =
        await getDocs(
          collection(
            db,
            "admins"
          )
        );


      $("adminList").innerHTML =

        "<b>বর্তমান Admin:</b><br>" +

        snapshot.docs
          .map(item => `

            <div class="order-row">

              ${escapeHtml(
                item.data().email ||
                item.id
              )}

              —

              ${
                item.data().active === false
                  ? "বন্ধ"
                  : "সক্রিয়"
              }

            </div>

          `)
          .join("");

    } catch (error) {

      $("adminList").innerHTML =
        "<p>Admin তালিকা লোড করা যায়নি।</p>";
    }

    return;
  }
}


/* =========================
   ADD NEW FOOD
========================= */

async function saveFood() {

  const name =
    $("mName")
      .value
      .trim();

  const price =
    Number(
      $("mPrice").value
    );

  const file =
    $("mFile").files[0];


  if (!name || !price) {

    alert(
      "খাবারের নাম ও দাম দিন।"
    );

    return;
  }


  if (file && !validImage(file)) {
    return;
  }


  try {

    let imageUrl =
      "mutton-kacchi-1.jpg";


    if (file) {

      const storageRef =
        ref(
          storage,
          `foods/${Date.now()}-${file.name}`
        );


      await uploadBytes(
        storageRef,
        file
      );


      imageUrl =
        await getDownloadURL(
          storageRef
        );
    }


    await addDoc(
      collection(db, "foods"),
      {
        name,
        price,
        imageUrl,
        active: true,
        createdAt:
          serverTimestamp()
      }
    );


    await loadFoods();


    alert(
      "নতুন খাবার যোগ হয়েছে।"
    );


    await renderAdminSection(
      "menu"
    );

  } catch (error) {

    alert(
      "খাবার যোগ হয়নি:\n" +
      error.message
    );
  }
}


/* =========================
   UPLOAD LOGO
========================= */

async function uploadLogo() {

  const file =
    $("logoFile")
      ?.files[0];


  if (!file) {

    alert(
      "প্রথমে Logo-এর ছবি নির্বাচন করুন।"
    );

    return;
  }


  if (!validImage(file)) {
    return;
  }


  try {

    const storageRef =
      ref(
        storage,
        `site/logo-${Date.now()}-${file.name}`
      );


    await uploadBytes(
      storageRef,
      file
    );


    const url =
      await getDownloadURL(
        storageRef
      );


    await setDoc(
      doc(
        db,
        "settings",
        "site"
      ),
      {
        logoUrl: url
      },
      {
        merge: true
      }
    );


    document
      .querySelectorAll(
        ".site-logo, #siteLogo"
      )
      .forEach(img => {
        img.src = url;
      });


    alert(
      "Logo সফলভাবে পরিবর্তন হয়েছে।"
    );

  } catch (error) {

    alert(
      "Logo Upload হয়নি:\n" +
      error.message
    );
  }
}


/* =========================
   UPLOAD FOOD IMAGE
========================= */

async function uploadFoodImage() {

  const file =
    $("foodFile")
      ?.files[0];

  const foodId =
    $("imageFood")
      ?.value;


  if (!file) {

    alert(
      "প্রথমে খাবারের ছবি নির্বাচন করুন।"
    );

    return;
  }


  if (!foodId) {

    alert(
      "একটি খাবার নির্বাচন করুন।"
    );

    return;
  }


  if (!validImage(file)) {
    return;
  }


  try {

    const storageRef =
      ref(
        storage,
        `foods/${foodId}-${Date.now()}-${file.name}`
      );


    await uploadBytes(
      storageRef,
      file
    );


    const url =
      await getDownloadURL(
        storageRef
      );


    /*
      setDoc + merge ব্যবহার করা হয়েছে।
      তাই Firebase-এ খাবারের document না থাকলেও
      ছবিটি সংরক্ষণ করা যাবে।
    */

    await setDoc(
      doc(
        db,
        "foods",
        foodId
      ),
      {
        imageUrl: url,
        active: true
      },
      {
        merge: true
      }
    );


    await loadFoods();


    alert(
      "খাবারের ছবি সফলভাবে পরিবর্তন হয়েছে।"
    );

  } catch (error) {

    alert(
      "খাবারের ছবি Upload হয়নি:\n" +
      error.message
    );
  }
}


/* =========================
   START WEBSITE
========================= */

await loadSettings();

await loadFoods();
