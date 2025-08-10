import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// LevelUp Academy — Single-file App
// - Glassmorphism login + sign-up (local users stored in localStorage)
// - Solo Leveling style dashboard with EXP / level system
// - Offline quest generator, quest reminders, penalties for overdue
// - Pop-up notifications for new quests, reminders, completions, penalties
// - Quest creation with due date (reminder) support

// -------------------- Storage helpers --------------------
const LS_ROOT = 'levelup_academy_v1';

function safeGet(key) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}
function safeSet(key, value) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(key, value);
  } catch (e) {
    // ignore
  }
}

function loadUsers() {
  const raw = safeGet(`${LS_ROOT}::users`);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}
function saveUsers(users) {
  safeSet(`${LS_ROOT}::users`, JSON.stringify(users));
}

function persistForUser(userId, obj) {
  safeSet(`${LS_ROOT}::${userId}`, JSON.stringify(obj));
}
function loadForUser(userId) {
  const raw = safeGet(`${LS_ROOT}::${userId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

// -------------------- Utilities --------------------
function uid(prefix = '') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const RARITIES = [
  { id: 'Common', weight: 60, color: 'bg-gray-700', rewardRange: [20, 40] },
  { id: 'Rare', weight: 30, color: 'bg-blue-700', rewardRange: [50, 80] },
  { id: 'Epic', weight: 10, color: 'bg-purple-700', rewardRange: [100, 160] },
];
function pickRarity() {
  const total = RARITIES.reduce((s, r) => s + r.weight, 0);
  let r = Math.floor(Math.random() * total);
  for (const rar of RARITIES) {
    if (r < rar.weight) return rar;
    r -= rar.weight;
  }
  return RARITIES[0];
}

function generateQuests({ stats = {}, preferredSubject = null, count = 4 }) {
  const subjects = ['Math', 'Coding', 'Reading', 'Systems', 'Soft Skills'];
  const chosen = [];
  for (let i = 0; i < count; i++) {
    const subject = preferredSubject || subjects[Math.floor(Math.random() * subjects.length)];
    const rarity = pickRarity();
    const baseTitle = (() => {
      switch (subject) {
        case 'Math':
          return ['Solve 10 algebra problems', 'Practice integration problems', 'Finish geometry sheet'][Math.floor(Math.random() * 3)];
        case 'Coding':
          return ['Build a small React component', 'Solve 2 medium LeetCode problems', 'Refactor a small module'][Math.floor(Math.random() * 3)];
        case 'Reading':
          return ['Read 10 pages of a textbook', 'Summarize one research paper', 'Read chapter & take notes'][Math.floor(Math.random() * 3)];
        case 'Systems':
          return ['Sketch an architecture for a feature', 'Read a system design article', 'Draw sequence diagrams'][Math.floor(Math.random() * 3)];
        default:
          return ['Practice flashcards', 'Do 25 minutes focused study', 'Plan next week study schedule'][Math.floor(Math.random() * 3)];
      }
    })();

    const reward = randInt(rarity.rewardRange[0], rarity.rewardRange[1]);
    const est = Math.max(10, Math.round(reward / 2));

    chosen.push({
      id: uid('q_'),
      title: baseTitle,
      description: `${baseTitle} — focused ${subject.toLowerCase()} practice.`,
      subject,
      rarity: rarity.id,
      rarityColor: rarity.color,
      rewardExp: reward,
      estMins: est,
      repeat: rarity.id !== 'Epic',
      completed: false,
      pendingComplete: false,
      reminderNotified: false,
      penaltyApplied: false,
      createdAt: new Date().toISOString(),
    });
  }
  return chosen;
}

// -------------------- UI Bits --------------------
function Tabs({ activeTab, onChange, tabs }) {
  return (
    <div className="flex gap-2 border-b border-slate-700 pb-2 mb-4">
      {tabs.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`px-3 py-2 rounded-t-md text-sm ${activeTab === t ? 'bg-slate-800 text-emerald-300' : 'bg-slate-700 text-slate-300'}`}>
          {t}
        </button>
      ))}
    </div>
  );
}

// Task popup shows different kinds: new, reminder, complete, penalty
function TaskPopup({ payload, onClose, onClaim, onUndo }) {
  if (!payload) return null;
  return (
    <AnimatePresence>
      <motion.div
        key={payload.id || 'popup'}
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -30 }}
        transition={{ type: 'spring', stiffness: 120 }}
        className="fixed right-5 top-6 z-50 w-80 bg-white/5 backdrop-blur-md border border-white/10 rounded-lg shadow-lg p-4"
      >
        <div className="flex justify-between items-start">
          <div>
            <div className="text-xs text-slate-300">{payload.type === 'new' ? 'New Quest' : payload.type === 'reminder' ? 'Reminder' : payload.type === 'complete' ? 'Quest Completed' : payload.type === 'penalty' ? 'Penalty' : 'Notice'}</div>
            <div className="text-sm font-semibold mt-1">{payload.title}</div>
            {payload.description && <div className="text-xs text-slate-300 mt-1">{payload.description}</div>}
          </div>
          <div className="text-right">
            {payload.rewardExp != null && <div className="text-sm font-bold text-emerald-300">{payload.rewardExp > 0 ? `+${payload.rewardExp} EXP` : `${payload.rewardExp} EXP`}</div>}
            <div className="text-xs text-slate-400">{payload.rarity}</div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-3">
          {payload.type === 'complete' ? (
            <>
              <button className="px-2 py-1 bg-slate-600 rounded text-xs" onClick={onUndo}>Undo</button>
              <button className="px-2 py-1 bg-emerald-600 rounded text-xs" onClick={onClaim}>Claim</button>
            </>
          ) : (
            <button className="px-2 py-1 bg-slate-700 rounded text-xs" onClick={onClose}>Dismiss</button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// -------------------- Auth UI --------------------
function GlassAuth({ onLogin }) {
  const [mode, setMode] = useState('login'); // 'login' or 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [remember, setRemember] = useState(true);

  useEffect(() => {
    const last = safeGet(`${LS_ROOT}::last_user`);
    if (last) setEmail(last);
  }, []);

  function handleSignup(e) {
    e.preventDefault();
    if (!email.trim() || !password) return alert('Provide email and password');
    if (password !== confirm) return alert('Passwords do not match');

    const users = loadUsers();
    const id = email.trim().toLowerCase();
    if (users[id]) return alert('User already exists');

    users[id] = {
      email: id,
      password: btoa(password), // simple encode — offline only
      profile: {
        stats: { Strength: 40, Agility: 45, Intelligence: 65, Endurance: 50, Perception: 55 },
        exp: 0,
        level: 1,
        unspent: 0,
      },
    };
    saveUsers(users);
    if (remember) safeSet(`${LS_ROOT}::last_user`, id);
    onLogin({ id, email: id });
  }

  function handleLogin(e) {
    e.preventDefault();
    const users = loadUsers();
    const id = email.trim().toLowerCase();
    if (!users[id]) return alert('No such user — please sign up');
    if (users[id].password !== btoa(password)) return alert('Wrong password');
    if (remember) safeSet(`${LS_ROOT}::last_user`, id);
    onLogin({ id, email: id });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-xl bg-white/5 backdrop-blur-lg border border-white/10 rounded-3xl p-6 shadow-xl">
        <div className="flex gap-6">
          <div className="w-1/2 pr-4">
            <h1 className="text-3xl font-bold text-emerald-300 mb-2">LevelUp Academy</h1>
            <p className="text-sm text-slate-300 mb-4">Turn studying into a quest. Offline-first, gamified tasks for students.</p>

            <div className="flex gap-2 mb-4">
              <button onClick={() => setMode('login')} className={`px-3 py-2 rounded ${mode === 'login' ? 'bg-emerald-600' : 'bg-slate-700'}`}>Login</button>
              <button onClick={() => setMode('signup')} className={`px-3 py-2 rounded ${mode === 'signup' ? 'bg-emerald-600' : 'bg-slate-700'}`}>Sign Up</button>
            </div>

            <form onSubmit={mode === 'login' ? handleLogin : handleSignup} className="space-y-3">
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full p-3 rounded bg-white/6 text-white" />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full p-3 rounded bg-white/6 text-white" />
              {mode === 'signup' && <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm password" className="w-full p-3 rounded bg-white/6 text-white" />}

              <div className="flex items-center gap-2">
                <input id="remember" checked={remember} onChange={(e) => setRemember(e.target.checked)} type="checkbox" />
                <label htmlFor="remember" className="text-sm text-slate-300">Remember me (local)</label>
              </div>

              <div className="flex gap-2">
                <button type="submit" className="flex-1 py-2 bg-emerald-600 rounded">{mode === 'login' ? 'Login' : 'Create account'}</button>
              </div>
            </form>
          </div>

          <div className="w-1/2 pl-4 border-l border-white/5">
            <h3 className="text-sm text-slate-300">Features</h3>
            <ul className="list-disc pl-5 mt-2 text-slate-200 text-sm">
              <li>Glass UI + smooth animations</li>
              <li>Daily AI-like quests (offline)</li>
              <li>Reminders & penalties for overdue quests</li>
              <li>EXP, levels, and rewards</li>
            </ul>
            <div className="mt-6 text-xs text-slate-400">Accounts stored locally in your browser (offline). Passwords are encoded for convenience — do not use real-sensitive passwords.</div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// -------------------- Quest Editor --------------------
function QuestEditor({ onCreate }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('Coding');
  const [rarity, setRarity] = useState('Common');
  const [reward, setReward] = useState(40);
  const [dueAt, setDueAt] = useState('');

  function submit() {
    if (!title.trim()) return alert('Enter title');
    const q = {
      id: uid('q_'),
      title: title.trim(),
      description: title.trim(),
      subject,
      rarity,
      rewardExp: Number(reward),
      estMins: Math.max(10, Math.round(reward / 2)),
      repeat: true,
      completed: false,
      pendingComplete: false,
      reminderNotified: false,
      penaltyApplied: false,
      createdAt: new Date().toISOString(),
      dueAt: dueAt ? new Date(dueAt).toISOString() : null,
    };
    onCreate(q);
    setOpen(false);
    setTitle('');
    setDueAt('');
  }

  return (
    <div>
      <button onClick={() => setOpen(true)} className="px-3 py-2 bg-slate-600 rounded">Create</button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="relative bg-slate-900 p-4 rounded w-full max-w-md">
            <h4 className="text-lg mb-2">New Quest</h4>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="w-full p-2 mb-2 bg-slate-800 rounded" />
            <div className="grid grid-cols-2 gap-2 mb-2">
              <select value={subject} onChange={(e) => setSubject(e.target.value)} className="p-2 bg-slate-800 rounded">
                <option>Coding</option>
                <option>Math</option>
                <option>Reading</option>
                <option>Systems</option>
                <option>Soft Skills</option>
              </select>
              <select value={rarity} onChange={(e) => setRarity(e.target.value)} className="p-2 bg-slate-800 rounded">
                <option>Common</option>
                <option>Rare</option>
                <option>Epic</option>
              </select>
            </div>
            <div className="flex gap-2 mb-2">
              <input type="number" value={reward} onChange={(e) => setReward(Number(e.target.value))} className="p-2 bg-slate-800 rounded" />
              <div className="text-slate-400 text-sm">Reward EXP</div>
            </div>
            <div className="mb-2">
              <label className="text-xs text-slate-400">Due (reminder)</label>
              <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="w-full p-2 bg-slate-800 rounded mt-1" />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="px-3 py-2 bg-slate-600 rounded">Cancel</button>
              <button onClick={submit} className="px-3 py-2 bg-emerald-600 rounded">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------- Main App --------------------
export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const last = safeGet(`${LS_ROOT}::last_user`);
      if (last) return { id: last, email: last };
      return null;
    } catch (e) {
      return null;
    }
  });

  return user ? <Dashboard key={user.id} user={user} onLogout={() => setUser(null)} /> : <GlassAuth onLogin={setUser} />;
}

// -------------------- Dashboard --------------------
function Dashboard({ user, onLogout }) {
  const persisted = loadForUser(user.id) || {};

  const [activeTab, setActiveTab] = useState('Overview');
  const [stats, setStats] = useState(persisted.stats || { Strength: 40, Agility: 45, Intelligence: 65, Endurance: 50, Perception: 55 });
  const [quests, setQuests] = useState(persisted.quests || []);
  const [history, setHistory] = useState(persisted.history || []);
  const [exp, setExp] = useState(persisted.exp || 0);
  const [level, setLevel] = useState(persisted.level || 1);
  const [unspent, setUnspent] = useState(persisted.unspent || 0);

  // popup queue
  const [popQueue, setPopQueue] = useState([]);
  const [currentPopup, setCurrentPopup] = useState(null);
  const popupTimerRef = useRef(null);

  // level up animation
  const [levelUpActive, setLevelUpActive] = useState(false);

  // generate daily quests (one-time per day)
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const lastGen = persisted.lastGeneratedAt || null;
    if (lastGen !== today) {
      const generated = generateQuests({ stats, count: 4 });
      setQuests((q) => [...generated, ...q]);
      setPopQueue((q) => [...q, ...generated.map((g) => ({ ...g, type: 'new' }))]);
      persistForUser(user.id, { ...persisted, quests: [...generated, ...(persisted.quests || [])], lastGeneratedAt: today, stats, exp, level, unspent, history });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // popup queue handler
  useEffect(() => {
    if (!currentPopup && popQueue.length > 0) {
      const next = popQueue[0];
      setCurrentPopup(next);
      setPopQueue((q) => q.slice(1));

      if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
      popupTimerRef.current = setTimeout(() => setCurrentPopup(null), 7000);
    }
    return () => {
      if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
    };
  }, [popQueue, currentPopup]);

  // reminders & penalties checker every 30s
  useEffect(() => {
    function checkAll() {
      const now = Date.now();
      let updated = false;
      let newQuests = quests.map((q) => ({ ...q }));

      // reminders: if due within next 60 seconds and not yet notified
      newQuests.forEach((q) => {
        if (!q.dueAt || q.completed) return;
        const due = new Date(q.dueAt).getTime();
        if (!q.reminderNotified && due - now <= 60_000 && due - now > -60_000) {
          setPopQueue((p) => [...p, { ...q, type: 'reminder' }]);
          q.reminderNotified = true;
          updated = true;
        }
      });

      // penalties: if overdue by 24h and not yet penalized
      const PENALTY_WINDOW = 24 * 60 * 60 * 1000; // 24 hours
      newQuests.forEach((q) => {
        if (!q.dueAt || q.completed || q.penaltyApplied) return;
        const due = new Date(q.dueAt).getTime();
        if (now - due >= PENALTY_WINDOW) {
          // apply penalty: subtract 30% of reward from player exp
          const penalty = Math.round((q.rewardExp || 0) * 0.3);
          setExp((prev) => Math.max(0, prev - penalty));
          q.penaltyApplied = true;
          setHistory((h) => [{ id: q.id, title: `Penalty: ${q.title}`, reward: -penalty, at: new Date().toISOString() }, ...h].slice(0, 200));
          setPopQueue((p) => [...p, { ...q, type: 'penalty', rewardExp: -penalty }]);
          updated = true;
        }
      });

      if (updated) setQuests(newQuests);
    }

    const iv = setInterval(checkAll, 30_000);
    // run once immediately
    checkAll();
    return () => clearInterval(iv);
  }, [quests]);

  // persist on changes
  useEffect(() => {
    persistForUser(user.id, { quests, history, stats, exp, level, unspent, lastGeneratedAt: persisted.lastGeneratedAt || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quests, history, stats, exp, level, unspent]);

  // leveling logic
  useEffect(() => {
    let nextNeeded = 200 + (level - 1) * 50;
    if (!isFinite(nextNeeded) || nextNeeded <= 0) nextNeeded = 200;

    if (exp >= nextNeeded) {
      let newLevel = level;
      let remaining = exp;
      let gained = 0;
      while (remaining >= (200 + (newLevel - 1) * 50)) {
        remaining -= (200 + (newLevel - 1) * 50);
        newLevel += 1;
        gained += 1;
      }
      setLevel(newLevel);
      setUnspent((u) => u + gained * 3);
      setExp(remaining);
      setLevelUpActive(true);
      setTimeout(() => setLevelUpActive(false), 2200);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exp]);

  function triggerCompletePopup(qid) {
    setQuests((qs) => qs.map((q) => (q.id === qid ? { ...q, pendingComplete: true } : q)));
    const q = quests.find((x) => x.id === qid);
    if (q) setPopQueue((p) => [...p, { ...q, type: 'complete' }]);
  }

  function claimComplete(qid) {
    const q = quests.find((x) => x.id === qid);
    if (!q) return;
    setQuests((qs) => qs.map((x) => (x.id === qid ? { ...x, pendingComplete: false, completed: true } : x)));
    setHistory((h) => [{ id: qid, title: q.title, reward: q.rewardExp, at: new Date().toISOString() }, ...h].slice(0, 200));
    setExp((e) => (isFinite(e) ? e + (typeof q.rewardExp === 'number' ? q.rewardExp : 0) : (typeof q.rewardExp === 'number' ? q.rewardExp : 0)));

    // small stat bump
    if (q.subject === 'Coding') setStats((s) => ({ ...s, Intelligence: Math.min(100, (s.Intelligence || 0) + 1) }));
    if (q.subject === 'Math') setStats((s) => ({ ...s, Perception: Math.min(100, (s.Perception || 0) + 1) }));
  }

  function undoComplete(qid) {
    setQuests((qs) => qs.map((q) => (q.id === qid ? { ...q, pendingComplete: false } : q)));
  }

  function addCustomQuest(q) {
    setQuests((s) => [q, ...s]);
    setPopQueue((p) => [...p, { ...q, type: 'new' }]);
  }

  function removeQuest(qid) {
    setQuests((s) => s.filter((x) => x.id !== qid));
  }

  function quickGenerate(count = 3) {
    const g = generateQuests({ stats, count });
    setQuests((s) => [...g, ...s]);
    setPopQueue((p) => [...p, ...g.map((it) => ({ ...it, type: 'new' }))]);
  }

  // UI helpers
  const radarData = Object.entries(stats).map(([k, v]) => ({ stat: k, value: v, fullMark: 100 }));
  const recentHistory = history.slice(0, 7);
  const nextExpForLevel = (lev) => 200 + (lev - 1) * 50;
  const nextNeeded = nextExpForLevel(level);
  const percent = Math.max(0, Math.min(100, Math.round((exp / nextNeeded) * 100)));

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <TaskPopup
          payload={currentPopup}
          onClose={() => setCurrentPopup(null)}
          onClaim={() => {
            if (currentPopup && currentPopup.type === 'complete') claimComplete(currentPopup.id);
            setCurrentPopup(null);
          }}
          onUndo={() => {
            if (currentPopup && currentPopup.type === 'complete') undoComplete(currentPopup.id);
            setCurrentPopup(null);
          }}
        />

        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">LevelUp Academy</h1>
            <div className="text-sm text-slate-400">Welcome back, <span className="font-medium">{user.email}</span></div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-slate-300">Level {level}</div>
            <button onClick={onLogout} className="px-3 py-2 bg-rose-600 rounded">Logout</button>
          </div>
        </header>

        <Tabs activeTab={activeTab} onChange={setActiveTab} tabs={["Overview", "Abilities", "Analytics", "Quests", "Inventory"]} />

        {activeTab === 'Overview' && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-3 gap-4">
            {/* Level / EXP Bar */}
            <div className="col-span-3 bg-white/3 backdrop-blur rounded-lg p-4 border border-white/10">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-300">Level</div>
                  <div className="text-2xl font-semibold">{level}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-300">EXP</div>
                  <div className="text-sm">{exp} / {nextNeeded} ({percent}%)</div>
                </div>
              </div>

              <div className="mt-3 w-full bg-white/6 rounded-full h-4 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percent}%` }}
                  transition={{ type: 'spring', stiffness: 80 }}
                  className="h-4 bg-emerald-500"
                />
              </div>

              <AnimatePresence>
                {levelUpActive && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.6 }}
                    className="mt-4 p-3 bg-emerald-700/20 rounded-lg border border-emerald-500"
                  >
                    <div className="text-center">
                      <div className="text-lg font-bold">Level Up!</div>
                      <div className="text-sm text-slate-200">You gained +3 attribute points</div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="bg-white/3 backdrop-blur rounded-lg p-4 border border-white/10">
              <h3 className="text-sm text-slate-300 mb-2">Quick AI</h3>
              <div className="flex gap-2">
                <button onClick={() => quickGenerate(3)} className="px-3 py-2 bg-emerald-600 rounded">Generate 3 Quests</button>
                <button onClick={() => setQuests([])} className="px-3 py-2 bg-slate-600 rounded">Clear Quests</button>
              </div>
            </div>

            <div className="bg-white/3 backdrop-blur rounded-lg p-4 border border-white/10">
              <h3 className="text-sm text-slate-300 mb-2">Recent Completions</h3>
              <ul className="text-sm text-slate-300 list-disc pl-5">
                {recentHistory.length === 0 && <li className="text-slate-500">No completions yet</li>}
                {recentHistory.map((h) => <li key={h.at}>{h.title} ({h.reward > 0 ? `+${h.reward}` : h.reward} EXP)</li>)}
              </ul>
            </div>
          </motion.div>
        )}

        {activeTab === 'Abilities' && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 gap-4">
            <div className="bg-white/3 backdrop-blur rounded-lg p-4 border border-white/10">
              <h3 className="text-sm text-slate-300 mb-2">Abilities</h3>
              <ResponsiveContainer width="100%" height={320}>
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="stat" />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} />
                  <Radar dataKey="value" stroke="#00f6ff" fill="#00f6ff" fillOpacity={0.4} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white/3 backdrop-blur rounded-lg p-4 border border-white/10">
              <h3 className="text-sm text-slate-300 mb-2">Stats</h3>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(stats).map(([k, v]) => (
                  <div key={k} className="bg-slate-900 p-2 rounded text-center">
                    <div className="text-xs text-slate-400">{k}</div>
                    <div className="font-semibold">{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'Analytics' && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 gap-4">
            <div className="bg-white/3 backdrop-blur rounded-lg p-4 border border-white/10">
              <h3 className="text-sm text-slate-300 mb-2">Completion History</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={history.map((h, i) => ({ name: `#${i + 1}`, exp: h.reward }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" stroke="#bbb" />
                  <YAxis stroke="#bbb" />
                  <Tooltip />
                  <Line type="monotone" dataKey="exp" stroke="#00e0a8" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white/3 backdrop-blur rounded-lg p-4 border border-white/10">
              <h3 className="text-sm text-slate-300 mb-2">Match-like Example</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={[{ name: 'M1', kills: 5 }, { name: 'M2', kills: 8 }, { name: 'M3', kills: 4 }, { name: 'M4', kills: 10 }]}> 
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" stroke="#bbb" />
                  <YAxis stroke="#bbb" />
                  <Tooltip />
                  <Line type="monotone" dataKey="kills" stroke="#ff6b6b" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}

        {activeTab === 'Quests' && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xl">Quest Log</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => { const g = generateQuests({ stats, count: 1 }); setQuests((s) => [...g, ...s]); setPopQueue((p) => [...p, ...g.map((it) => ({ ...it, type: 'new' }))]); }} className="px-3 py-2 bg-emerald-600 rounded">Generate 1</button>
                <QuestEditor onCreate={addCustomQuest} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {quests.map((q) => (
                <div key={q.id} className={`p-3 rounded-lg ${q.completed ? 'bg-emerald-900/20' : 'bg-white/3 backdrop-blur'}`}>
                  <div className="flex justify-between">
                    <div>
                      <div className="font-medium">{q.title}</div>
                      <div className="text-xs text-slate-400">{q.description}</div>
                      {q.dueAt && <div className="text-xs text-slate-400">Due: {new Date(q.dueAt).toLocaleString()}</div>}
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-400">{q.subject} • {q.rarity}</div>
                      <div className="text-sm font-bold text-emerald-300">+{q.rewardExp} EXP</div>
                    </div>
                  </div>

                  <div className="mt-3 flex justify-between items-center">
                    <div className="text-xs text-slate-400">Est: {q.estMins} mins</div>
                    <div className="flex gap-2">
                      {!q.completed && !q.pendingComplete && <button onClick={() => triggerCompletePopup(q.id)} className="px-3 py-1 bg-emerald-500 rounded text-sm">Complete</button>}
                      {q.pendingComplete && <div className="text-xs text-slate-300">Pending completion...</div>}
                      <button onClick={() => removeQuest(q.id)} className="px-3 py-1 bg-rose-600 rounded text-sm">Remove</button>
                    </div>
                  </div>
                </div>
              ))}

              {quests.length === 0 && <div className="text-slate-400 p-3">No quests — generate some with the AI or create your own.</div>}
            </div>
          </motion.div>
        )}

        {activeTab === 'Inventory' && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            <h3 className="text-xl mb-2">Inventory</h3>
            <p className="text-slate-400">Badges, achievements and automations will show here soon.</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
