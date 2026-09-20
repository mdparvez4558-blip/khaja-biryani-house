
// Khaja Biryani House

// Mobile menu
const menuBtn = document.getElementById("menuBtn");
const navMenu = document.getElementById("navMenu");

if (menuBtn && navMenu) {
  menuBtn.addEventListener("click", function () {
    navMenu.classList.toggle("active");
  });
}

// Menu order button
function pick(food) {
  const foodSelect = document.getElementById("food");

  if (foodSelect) {
    foodSelect.value = food;
    foodSelect.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }
}

// Website order form → WhatsApp
const orderForm = document.getElementById("orderForm");

if (orderForm) {
  orderForm.addEventListener("submit", function (e) {
    e.preventDefault();

    const name = document.getElementById("name")?.value.trim();
    const phone = document.getElementById("phone")?.value.trim();
    const food = document.getElementById("food")?.value;
    const quantity = document.getElementById("quantity")?.value;
    const address = document.getElementById("address")?.value.trim();

    if (!name || !phone || !food || !quantity || !address) {
      alert("দয়া করে সব তথ্য পূরণ করুন।");
      return;
    }

    const whatsappNumber = "8801785452580";

    const message =
      "🍛 খাজা বিরানি হাউজ - নতুন অর্ডার\n\n" +
      "নাম: " + name + "\n" +
      "ফোন: " + phone + "\n" +
      "খাবার: " + food + "\n" +
      "পরিমাণ: " + quantity + "\n" +
      "ঠিকানা: " + address;

    const whatsappURL =
      "https://wa.me/" +
      whatsappNumber +
      "?text=" +
      encodeURIComponent(message);

    window.open(whatsappURL, "_blank");

    orderForm.reset();
  });
}
