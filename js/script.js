// Khaja Biryani House - Website JavaScript

// Mobile menu
const menuBtn = document.getElementById("menuBtn");
const navLinks = document.getElementById("navLinks");

if (menuBtn && navLinks) {
  menuBtn.addEventListener("click", function () {
    navLinks.classList.toggle("active");
  });

  navLinks.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () {
      navLinks.classList.remove("active");
    });
  });
}

// Order button
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

// Order form
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

    alert(
      "ধন্যবাদ " +
      name +
      "!\nআপনার " +
      food +
      " এর " +
      quantity +
      "টি অর্ডারের তথ্য গ্রহণ করা হয়েছে।"
    );

    orderForm.reset();
  });
}

// Current year
const year = document.getElementById("year");

if (year) {
  year.textContent = new Date().getFullYear();
}
