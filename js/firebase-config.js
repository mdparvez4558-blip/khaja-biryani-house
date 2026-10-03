// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAu6FHeFbK3GOaURfVhIdmhf54QKqrpOmA",
  authDomain: "khaja-biryani-house.firebaseapp.com",
  projectId: "khaja-biryani-house",
  storageBucket: "khaja-biryani-house.firebasestorage.app",
  messagingSenderId: "1098336642792",
  appId: "1:1098336642792:web:2780a67deda29759f5cb5d",
  measurementId: "G-992NHDK9ZL"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
