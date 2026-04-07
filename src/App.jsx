import React from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { db } from './firebase';
import { ref, set } from 'firebase/database';
import SwipeRoom from './pages/SwipeRoom';

function Home() {
  const navigate = useNavigate();

  const createRoom = async () => {
    const roomId = Math.random().toString(36).substring(2, 7);
    try {
      await set(ref(db, `rooms/${roomId}`), {
        createdAt: Date.now(),
        status: "waiting"
      });
      navigate(`/room/${roomId}`);
    } catch (error) {
      alert("방 생성 실패: " + error.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-sm w-full bg-white rounded-[40px] shadow-2xl p-10 text-center border border-gray-100">
        <div className="w-20 h-20 bg-orange-100 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
          <span className="text-4xl">🍕</span>
        </div>
        <h1 className="text-4xl font-black text-orange-500 mb-3 tracking-tighter">푸드 텔레파시</h1>
        <p className="text-gray-400 font-medium mb-10 leading-relaxed">우리 뭐 먹을까?<br/>친구랑 메뉴 취향을 맞춰보세요!</p>
        <button 
          onClick={createRoom}
          className="w-full py-5 bg-orange-500 text-white rounded-2xl font-bold text-xl shadow-lg shadow-orange-200 active:scale-95 transition-transform"
        >
          방 만들기 (친구 초대)
        </button>
      </div>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/room/:roomId" element={<SwipeRoom />} />
    </Routes>
  );
}

export default App;