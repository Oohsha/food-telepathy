import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../firebase';
// 🔽 remove를 추가했습니다.
import { ref, update, onValue, get, remove } from 'firebase/database';
import { foodItems } from '../data/foodItems';

function SwipeRoom() {
  const { roomId } = useParams();
  const [userRole, setUserRole] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [direction, setDirection] = useState(null);
  const [matchResult, setMatchResult] = useState(null);
  const [waitingForFriend, setWaitingForFriend] = useState(false);
  const [worldCupState, setWorldCupState] = useState(null);

  // ⏪ 되돌리기를 위한 히스토리 상태 추가
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const roomRef = ref(db, `rooms/${roomId}`);
    const assignRole = async () => {
      const snapshot = await get(roomRef);
      const data = snapshot.val();
      if (!data) return;
      let role = localStorage.getItem(`role_${roomId}`);
      if (!role) {
        role = !data.userA ? 'userA' : 'userB';
        localStorage.setItem(`role_${roomId}`, role);
      }
      await update(ref(db, `rooms/${roomId}/${role}`), { active: true });
      setUserRole(role);
    };
    assignRole();

    const unsubscribe = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (data && data.userA?.status === "finished" && data.userB?.status === "finished") {
        const likesA = Object.keys(data.userA.likes || {});
        const likesB = Object.keys(data.userB.likes || {});
        const common = likesA.filter(food => likesB.includes(food));
        setMatchResult(common);
        if (data.worldCup) setWorldCupState(data.worldCup);
      }
    });
    return () => unsubscribe();
  }, [roomId]);

  const handleSwipe = async (swipeDir) => {
    if (isFinished || currentIndex >= foodItems.length) return;
    const currentFood = foodItems[currentIndex];

    // ⏪ 히스토리에 현재 행동 저장
    setHistory(prev => [...prev, { index: currentIndex, name: currentFood.name, dir: swipeDir }]);

    setDirection(swipeDir);
    if (swipeDir === 'right' && userRole) {
      update(ref(db, `rooms/${roomId}/${userRole}/likes`), { [currentFood.name]: true });
    }
    setTimeout(() => {
      if (currentIndex >= foodItems.length - 1) {
        setIsFinished(true);
        setWaitingForFriend(true);
        update(ref(db, `rooms/${roomId}/${userRole}`), { status: "finished" });
      } else {
        setCurrentIndex(prev => prev + 1);
        setDirection(null);
      }
    }, 200);
  };

  // ⏪ 되돌리기 함수 추가
  const handleUndo = async () => {
    if (history.length === 0) return;

    const lastAction = history[history.length - 1];

    // 1. 만약 직전에 '좋아요'를 눌렀다면 Firebase에서 삭제
    if (lastAction.dir === 'right' && userRole) {
      const likeRef = ref(db, `rooms/${roomId}/${userRole}/likes/${lastAction.name}`);
      await remove(likeRef);
    }

    // 2. 상태값 복구
    setCurrentIndex(lastAction.index);
    setHistory(prev => prev.slice(0, -1)); // 마지막 기록 제거
    setIsFinished(false);
    setWaitingForFriend(false);
    setDirection(null);

    // 3. Firebase 상태도 다시 "swiping"으로 변경
    update(ref(db, `rooms/${roomId}/${userRole}`), { status: "swiping" });
  };

  const startWorldCup = () => {
    if (matchResult.length < 2) return;
    const items = [...matchResult].sort(() => Math.random() - 0.5);
    update(ref(db, `rooms/${roomId}/worldCup`), {
      isStarted: true,
      roundItems: items,
      nextRoundItems: [0],
      currentPair: [items[0], items[1]],
      winner: ""
    });
  };

  const pickWinner = (pickedName) => {
    if (userRole !== 'userA') return;
    const roundItems = worldCupState.roundItems || [];
    const nextItems = (worldCupState.nextRoundItems || []).filter(i => i !== 0);
    const currentPair = worldCupState.currentPair || [];
    const newNextRound = [...nextItems, pickedName];
    const lastPickedIndex = roundItems.indexOf(currentPair[1]);
    const nextIndex = lastPickedIndex + 1;

    if (nextIndex < roundItems.length - 1) {
      update(ref(db, `rooms/${roomId}/worldCup`), {
        nextRoundItems: newNextRound,
        currentPair: [roundItems[nextIndex], roundItems[nextIndex + 1]]
      });
    } else {
      if (nextIndex === roundItems.length - 1) newNextRound.push(roundItems[nextIndex]);
      if (newNextRound.length === 1) {
        update(ref(db, `rooms/${roomId}/worldCup`), { winner: newNextRound[0], isStarted: false });
      } else {
        update(ref(db, `rooms/${roomId}/worldCup`), {
          roundItems: newNextRound, nextRoundItems: [0], currentPair: [newNextRound[0], newNextRound[1]]
        });
      }
    }
  };

  if (!userRole) return <div className="min-h-screen flex items-center justify-center font-bold">로딩 중...</div>;

  // --- 🏆 월드컵 화면 (기존과 동일) ---
  if (worldCupState?.isStarted && worldCupState.currentPair) {
    const leftFood = foodItems.find(f => f.name === worldCupState.currentPair[0]);
    const rightFood = foodItems.find(f => f.name === worldCupState.currentPair[1]);
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center p-4 text-center">
        <div className="mt-8 mb-4 text-orange-400 font-black text-xl tracking-widest uppercase">Food World Cup</div>
        <h2 className="text-white text-2xl font-bold mb-8 leading-tight">둘 중 오늘 더<br/>땡기는 음식은?</h2>
        <div className="flex flex-col gap-4 w-full max-w-md">
          {[leftFood, rightFood].map((food, idx) => food && (
            <motion.div key={food.id} whileTap={{ scale: 0.95 }} onClick={() => pickWinner(food.name)} className={`relative h-60 rounded-[35px] overflow-hidden shadow-2xl cursor-pointer border-4 ${userRole === 'userA' ? 'border-transparent hover:border-orange-500' : 'border-gray-800'}`}>
              <img src={food.image} className="w-full h-full object-cover" alt="" />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><span className="text-white text-3xl font-black">{food.name}</span></div>
            </motion.div>
          ))}
        </div>
        {userRole !== 'userA' && <p className="text-gray-500 mt-6 animate-pulse">방장이 메뉴를 고르고 있습니다...</p>}
      </div>
    );
  }

  // --- 🎉 최종 우승 화면 (기존과 동일) ---
  if (worldCupState?.winner) {
    const winnerFood = foodItems.find(f => f.name === worldCupState.winner);
    const searchMap = (type) => {
      const query = encodeURIComponent(`${winnerFood.name} 맛집`);
      const url = type === 'naver' 
        ? `https://m.map.naver.com/search2/search.naver?query=${query}`
        : `https://map.kakao.com/link/search/${query}`;
      window.open(url, "_blank");
    };
    return (
      <div className="min-h-screen bg-orange-50 flex flex-col items-center justify-center p-6 text-center">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white p-8 rounded-[50px] shadow-2xl w-full max-w-sm border-8 border-orange-200">
          <span className="text-5xl mb-4 block">🏆</span>
          <h2 className="text-gray-400 font-bold text-xs mb-1 uppercase tracking-widest leading-none">Today's Menu</h2>
          <h1 className="text-4xl font-black text-gray-800 mb-6 font-sans leading-tight">{winnerFood.name}</h1>
          <div className="w-full h-48 rounded-[30px] overflow-hidden mb-8 shadow-lg ring-4 ring-orange-50">
            <img src={winnerFood.image} className="w-full h-full object-cover" alt="" />
          </div>
          <div className="flex flex-col gap-3">
            <button onClick={() => searchMap('naver')} className="w-full py-4 bg-[#03C75A] text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform"><span className="bg-white text-[#03C75A] px-1.5 py-0.5 rounded text-[10px] font-black">N</span>네이버 지도로 맛집 찾기</button>
            <button onClick={() => searchMap('kakao')} className="w-full py-4 bg-[#FEE500] text-[#3C1E1E] rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform"><span className="bg-[#3C1E1E] text-[#FEE500] px-1.5 py-0.5 rounded text-[10px] font-black">K</span>카카오맵으로 맛집 찾기</button>
            <button onClick={() => window.location.href = '/'} className="mt-4 text-gray-400 font-bold text-sm underline underline-offset-4 decoration-gray-200">처음으로 돌아가기</button>
          </div>
        </motion.div>
      </div>
    );
  }

  // --- 📊 매칭 결과 화면 ---
  if (matchResult) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-orange-50">
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white p-8 rounded-[40px] shadow-2xl w-full max-w-sm text-center">
          <span className="text-6xl mb-4 block">🥳</span>
          <h2 className="text-2xl font-black text-gray-800 mb-2 font-sans">텔레파시 성공!</h2>
          <p className="text-gray-400 font-bold mb-8 leading-tight">우리 둘 다 좋아하는 메뉴<br/>{matchResult.length}개를 찾았어요!</p>
          <div className="space-y-2 mb-10 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
            {matchResult.map((food, i) => (
              <div key={i} className="p-4 bg-orange-50 text-orange-600 font-black rounded-2xl border border-orange-100 text-lg">{food}</div>
            ))}
          </div>
          {matchResult.length > 1 ? (
            <button onClick={startWorldCup} className="w-full py-5 bg-orange-500 text-white rounded-2xl font-black text-xl shadow-lg active:scale-95 transition-transform">최종 월드컵 시작 🏆</button>
          ) : (
            matchResult.length === 1 ? 
            <button onClick={() => update(ref(db, `rooms/${roomId}/worldCup`), {winner: matchResult[0], isStarted: false})} className="w-full py-5 bg-gray-800 text-white rounded-2xl font-black active:scale-95 transition-transform">이걸로 결정! ✅</button>
            : <button onClick={() => window.location.href = '/'} className="w-full py-5 bg-gray-300 text-gray-600 rounded-2xl font-black">다시 하기 🔄</button>
          )}
        </motion.div>
      </div>
    );
  }

  // --- 🃏 스와이프 화면 (되돌리기 버튼 추가됨) ---
  const currentFood = foodItems[currentIndex];
  return (
    <div className="min-h-screen flex flex-col items-center bg-gray-50 overflow-hidden">
      <header className="w-full max-w-md p-5 flex justify-between items-center bg-white shadow-sm z-20">
        <div><h1 className="font-black text-xl text-orange-500 font-sans">푸드 텔레파시</h1><p className="text-[10px] text-gray-400">ROOM ID: {roomId}</p></div>
        <div className="flex gap-2">
          {!waitingForFriend && <button onClick={() => {navigator.clipboard.writeText(window.location.href); alert("링크 복사됨!")}} className="text-[11px] font-bold px-3 py-2 bg-orange-100 text-orange-600 rounded-xl active:scale-90 transition-transform">초대</button>}
          <div className="text-[11px] font-bold px-3 py-2 bg-blue-100 text-blue-600 rounded-xl">{userRole === 'userA' ? '방장' : '친구'}</div>
        </div>
      </header>
      <div className="relative w-full max-w-[340px] h-[480px] mt-10">
        <AnimatePresence mode='wait'>
          {waitingForFriend ? (
            <motion.div key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center text-center bg-white w-full h-full rounded-[40px] shadow-xl p-8 border-2 border-dashed border-gray-200">
              <span className="text-4xl mb-6 block animate-bounce">💬</span>
              <h2 className="text-2xl font-bold mb-2 text-gray-800 font-sans">선택 완료!</h2>
              <p className="text-gray-400 mb-6">친구가 다 고를 때까지<br/>잠시만 기다려주세요.</p>
              {/* 대기 화면에서도 되돌리기 가능 */}
              <button onClick={handleUndo} className="text-sm font-bold text-orange-500 underline underline-offset-4">아차! 다시 고를래요 (되돌리기)</button>
            </motion.div>
          ) : (
            currentFood && (
              <motion.div
                key={currentFood.id}
                drag="x" dragConstraints={{ left: 0, right: 0 }}
                onDragEnd={(e, info) => { if (info.offset.x > 100) handleSwipe('right'); else if (info.offset.x < -100) handleSwipe('left'); }}
                initial={{ x: 0, opacity: 0, scale: 0.9 }} animate={{ x: 0, opacity: 1, scale: 1 }}
                exit={{ x: direction === 'right' ? 800 : -800, opacity: 0, rotate: direction === 'right' ? 30 : -30 }}
                className="absolute w-full h-full bg-white rounded-[40px] shadow-2xl overflow-hidden border-4 border-white cursor-grab active:cursor-grabbing"
              >
                <img src={currentFood.image} className="absolute inset-0 w-full h-full object-cover pointer-events-none" alt=""/>
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none" />
                <div className="absolute bottom-0 left-0 right-0 p-10 text-white pointer-events-none">
                  <span className="text-orange-400 font-bold text-xs uppercase tracking-widest">{currentFood.category}</span>
                  <h3 className="text-4xl font-black mt-1 leading-tight">{currentFood.name}</h3>
                  <div className="mt-6 h-1 w-full bg-white/20 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-500 transition-all duration-300" style={{ width: `${((currentIndex + 1) / foodItems.length) * 100}%` }}></div>
                  </div>
                </div>
              </motion.div>
            )
          )}
        </AnimatePresence>
      </div>
      {!waitingForFriend && (
        <div className="mt-12 flex gap-6 items-center">
          <motion.button whileTap={{ scale: 0.8 }} onClick={() => handleSwipe('left')} className="w-16 h-16 bg-white rounded-full shadow-lg text-2xl flex items-center justify-center active:scale-90 transition-transform border border-gray-100">❌</motion.button>
          
          {/* ⏪ 되돌리기 버튼 추가 */}
          <motion.button 
            whileTap={{ scale: 0.8 }} 
            onClick={handleUndo} 
            disabled={history.length === 0}
            className={`w-12 h-12 rounded-full shadow-md flex items-center justify-center transition-all ${history.length === 0 ? 'bg-gray-100 text-gray-300' : 'bg-orange-100 text-orange-500 active:scale-90'}`}
          >
            <span className="text-xl">⏪</span>
          </motion.button>

          <motion.button whileTap={{ scale: 0.8 }} onClick={() => handleSwipe('right')} className="w-16 h-16 bg-white rounded-full shadow-lg text-2xl flex items-center justify-center active:scale-90 transition-transform text-red-500 border border-orange-50">❤️</motion.button>
        </div>
      )}
    </div>
  );
}

export default SwipeRoom;