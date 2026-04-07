// src/firebase.js
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCeTZPTphaHoCuo1NwwyO-l_QlGqIuZEfI",
  authDomain: "foodtelepathy-3a82b.firebaseapp.com",
  // 🔽 이 주소가 싱가포르 서버 주소입니다. (수정 완료!)
  databaseURL: "https://foodtelepathy-3a82b-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "foodtelepathy-3a82b",
  storageBucket: "foodtelepathy-3a82b.firebasestorage.app",
  messagingSenderId: "619536040392",
  appId: "1:619536040392:web:3d96e0011f3e71b70440fd",
  measurementId: "G-6HDT3EZZEL"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);