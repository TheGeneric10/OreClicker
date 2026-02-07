import { renderChangelog } from "./changelog.js";
import { InventoryUI, invDefault, makeItem, addItem, equipped, ITEMS, sanitizeSlot } from "./inventory.js";
import { ShopUI, BUILDINGS } from "./shop.js";

/* Firebase CDN (modular) */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-analytics.js";
import { getDatabase, ref, get, set, update, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  GoogleAuthProvider, signInWithPopup, setPersistence, browserLocalPersistence, browserSessionPersistence,
  sendPasswordResetEmail, updateProfile, deleteUser
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const clampN=(n,f=0)=>Number.isFinite(Number(n))?Number(n):f;
const fmtI=(n)=>Math.floor(clampN(n,0)).toLocaleString();
const now=()=>Date.now();

const RTDB_BASE_URL = "https://thegeneric-685b0-default-rtdb.firebaseio.com";
const RTDB_ROOT = "OreClicker";
const RTDB_DATA = `${RTDB_ROOT}/data`;
const RTDB_REF = `${RTDB_BASE_URL}/${RTDB_ROOT}`;

const el={
  screens:{
    loading: $("#screenLoading"),
    menu: $("#screenMenu"),
    whatsNew: $("#screenWhatsNew"),
    login: $("#screenLogin"),
    register: $("#screenRegister"),
    game: $("#screenGame"),
  },
  loadingBar: $("#loadingBar"),
  canvas: $("#gameCanvas"),
  fpsCounter: $("#fpsCounter"),

  whatsNewRoot: $("#whatsNewRoot"),
  btnWhatsNewBack: $("#btnWhatsNewBack"),

  hud:{
    hpText: $("#hudHpText"),
    hpBar: $("#hudHpBar"),
    shText: $("#hudShieldText"),
    shBar: $("#hudShieldBar"),
  },

  profile:{
    chip: $("#profileChip"),
    name: $("#profileChipName")
  },

  sidebar:{
    status: $("#sideStatus"),
    hint: $("#sideHint"),
    saveMode: $("#saveModeText"),
    pause: $("#btnPause"),
    whatsNew: $("#btnWhatsNew"),
    gameSettings: $("#btnGameSettings"),
  },

  inv:{ hotbar: $("#hotbarSlots"), bag: $("#invSlots") },

  binds:{
    money: $$('[data-bind="money"]'),
    ore_basic: $$('[data-bind="ore_basic"]'),
    ore_coal: $$('[data-bind="ore_coal"]'),
    ore_iron: $$('[data-bind="ore_iron"]'),
    ore_gold: $$('[data-bind="ore_gold"]'),
    ore_diamond: $$('[data-bind="ore_diamond"]'),
    wood: $$('[data-bind="wood"]'),
  },

  menu:{
    playGuest: $("#btnPlayGuest"),
    goLogin: $("#btnGoLogin"),
    goRegister: $("#btnGoRegister"),
    menuAuthRow: $("#menuAuthRow"),
    confirmUser: $("#menuConfirmUser"),
    lastUserLabel: $("#lastUserLabel"),
    quickPass: $("#quickPass"),
    quickForm: $("#quickLoginForm"),
    notMe: $("#btnNotMe"),
    whatsNew: $("#btnMenuWhatsNew"),
    how: $("#btnMenuHow"),
    settings: $("#btnMenuSettings"),
  },

  login:{
    form: $("#loginForm"),
    email: $("#loginEmail"),
    pass: $("#loginPass"),
    remember: $("#loginRemember"),
    google: $("#btnGoogleLogin"),
    toReg: $("#btnLoginToRegister"),
    back: $("#btnLoginBack"),
    forgot: $("#btnForgot"),
  },

  reg:{
    form: $("#registerForm"),
    email: $("#regEmail"),
    user: $("#regUser"),
    pass: $("#regPass"),
    pass2: $("#regPass2"),
    tos: $("#regTos"),
    robot: $("#regRobot"),
    google: $("#btnGoogleRegister"),
    toLogin: $("#btnRegisterToLogin"),
    back: $("#btnRegisterBack"),
    userMeter: $("#userMeter"),
    userMeterText: $("#userMeterText"),
    passMeter: $("#passMeter"),
    passMeterText: $("#passMeterText"),
    userTakenText: $("#userTakenText"),
    terms: $("#btnTerms"),
    privacy: $("#btnPrivacy"),
  },

  modal:{
    back: $("#modalBackdrop"),
    title: $("#modalTitle"),
    body: $("#modalBody"),
    foot: $("#modalFoot"),
    close: $("#modalClose"),

    mini: $("#miniPopup"),
    miniTitle: $("#miniTitle"),
    miniBody: $("#miniBody"),
    miniFoot: $("#miniFoot"),
  },

  toast:{ root: $("#toast"), inner: $("#toastInner"), t: null },

  error:{
    root: $("#errorBanner"),
    code: $("#errorCode"),
    title: $("#errorTitle"),
    desc: $("#errorDesc"),
    more: $("#errorMore"),
    close: $("#errorClose"),
    t: null
  },
  touch:{
    root: $("#touchControls"),
    pad: $("#touchPad"),
    knob: $("#touchKnob"),
    mine: $("#touchMine"),
    attack: $("#touchAttack"),
    use: $("#touchUse"),
  }
};

const showScreen = (screenEl)=>{
  Object.values(el.screens).forEach(s=>s.classList.remove("active"));
  screenEl.classList.add("active");
};

const toast=(msg)=>{
  clearTimeout(el.toast.t);
  el.toast.inner.textContent = msg;
  el.toast.root.classList.add("show");
  el.toast.t = setTimeout(()=>el.toast.root.classList.remove("show"), 1400);
};

/* Error banner: hidden by default, shows ONLY 2.5s then auto hides */
const hideError=()=>{
  clearTimeout(el.error.t);
  el.error.root.hidden = true;
  el.error.more.hidden = true;
  el.error.more.textContent = "";
};
const showError=(code, title, desc, moreText="")=>{
  if(Number(code) === 500){
    console.warn("Suppressing 500 error banner:", title, desc, moreText);
    return;
  }
  hideError();
  el.error.code.textContent = String(code||"503");
  el.error.title.textContent = title || "SERVICE ERROR";
  el.error.desc.textContent = desc || "Temporary issue. Try again.";
  if(moreText){
    el.error.more.hidden = false;
    el.error.more.textContent = moreText;
  }
  el.error.root.hidden = false;
  el.error.t = setTimeout(()=>hideError(), 2500);
};
el.error.close.addEventListener("click",(e)=>{ e.preventDefault(); hideError(); });

/* Modal manager (focus-safe) */
let paused = false;
let tabPaused = false;
let lastFocusEl = null;

const syncPaused = ()=>{
  paused = isRunning && el.modal.back.classList.contains("open");
};

const miniPopup = {
  open({ title, bodyNode, buttons=[] }){
    el.modal.miniTitle.textContent = title || "Popup";
    el.modal.miniBody.innerHTML = "";
    if(bodyNode) el.modal.miniBody.appendChild(bodyNode);
    el.modal.miniFoot.innerHTML = "";
    buttons.forEach(b=>{
      const btn = document.createElement("button");
      btn.type="button";
      btn.className = `btn sharp small ${b.kind||""}`.trim();
      btn.textContent = b.text || "OK";
      btn.addEventListener("click", ()=>b.onClick?.());
      el.modal.miniFoot.appendChild(btn);
    });
    el.modal.mini.hidden = false;
  },
  close(){
    el.modal.mini.hidden = true;
    el.modal.miniBody.innerHTML = "";
    el.modal.miniFoot.innerHTML = "";
  }
};

const modal = {
  openState:null,
  open({title, bodyHTML, bodyNode, buttons=[], refreshable=false, onRefresh=null}){
    if(!el.modal.back.classList.contains("open")){
      lastFocusEl = document.activeElement;
    }
    miniPopup.close();

    el.modal.title.textContent = title || "Menu";
    el.modal.body.innerHTML = "";
    if(bodyNode) el.modal.body.appendChild(bodyNode);
    else el.modal.body.innerHTML = bodyHTML || "";
    el.modal.foot.innerHTML = "";

    buttons.forEach(b=>{
      const btn=document.createElement("button");
      btn.type="button";
      btn.className = `btn sharp small ${b.kind||""}`.trim();
      btn.textContent = b.text || "OK";
      btn.addEventListener("click", ()=>b.onClick?.());
      el.modal.foot.appendChild(btn);
    });

    this.openState = refreshable ? { title, bodyHTML, bodyNode, buttons, refreshable, onRefresh } : null;

    el.modal.back.classList.add("open");
    el.modal.back.removeAttribute("inert");
    el.modal.back.setAttribute("aria-hidden","false");

    syncPaused();
    setTimeout(()=>el.modal.close.focus?.(), 0);
  },
  close(){
    miniPopup.close();
    if(el.modal.back.classList.contains("open")){
      const target = lastFocusEl && typeof lastFocusEl.focus==="function" ? lastFocusEl : document.body;
      try{ target.focus?.(); }catch{}
    }
    el.modal.back.classList.remove("open");
    el.modal.back.setAttribute("aria-hidden","true");
    el.modal.back.setAttribute("inert","");
    el.modal.body.innerHTML="";
    el.modal.foot.innerHTML="";
    this.openState=null;
    syncPaused();
  },
  refresh(){
    if(this.openState?.onRefresh) this.openState.onRefresh();
  }
};
el.modal.close.addEventListener("click", ()=>modal.close());
el.modal.back.addEventListener("click",(e)=>{ if(e.target===el.modal.back) modal.close(); });

/* Firebase config */
const firebaseConfig = {
  apiKey: "AIzaSyA375t6p_Zc9Ztfi-RUniqAmjttsjPyy1k",
  authDomain: "thegeneric-685b0.firebaseapp.com",
  databaseURL: RTDB_BASE_URL,
  projectId: "thegeneric-685b0",
  storageBucket: "thegeneric-685b0.firebasestorage.app",
  messagingSenderId: "272113167212",
  appId: "1:272113167212:web:febd730bbbcaeefa292149",
  measurementId: "G-1KH1C9NN8P"
};

let app=null, db=null, auth=null, analytics=null;
try{
  app = initializeApp(firebaseConfig);
  db = getDatabase(app);
  auth = getAuth(app);
  try{ analytics = getAnalytics(app); }catch{}
}catch{
  // guest still works
}
if(db){
  ensureOreClickerRoot().catch(()=>{});
}

/* Save model */
const SAVE_VERSION="0.9";
const LAST_USER_KEY="oreclicker_last_user";

const defaultHotkeys=()=>({
  moveUp:"KeyW", moveDown:"KeyS", moveLeft:"KeyA", moveRight:"KeyD",
  mine:"KeyE", attack:"Space", use:"KeyQ", pause:"Escape",
  hot1:"Digit1", hot2:"Digit2", hot3:"Digit3", hot4:"Digit4", hot5:"Digit5"
});

const defaultState=()=>({
  version: SAVE_VERSION,
  lastSaveAt: now(),
  lastOnlineAt: now(),

  mode:"guest", uid:null, username:null, email:null,

  resources:{ money:0, ore_basic:0, ore_coal:0, ore_iron:0, ore_gold:0, ore_diamond:0, wood:0 },
  inventory: invDefault(),

  player:{ x:0, y:0, hp:250, maxHp:250, shield:50, maxShield:50, level:1, exp:0, lastHitAt:0 },

  buildings:[],
  upgrades:{ dropperRate:1, sellSpeed:1, moneyMult:1 },
  rebirths:{ count:0, mult:1 },

  wheel:{ lastSpinAt:0 },
  daily:{ streak:0, lastClaimAt:0, day:1 },
  weekly:{ streak:0, lastClaimAt:0, day:1 },

  offline:{ showThresholdMin:30 },

  settings:{ showFps:false },

  hotkeys: defaultHotkeys()
});

let S = defaultState();
let isRunning=false;

/* Bind helpers */
const setSideStatus=(t)=>{ el.sidebar.status.textContent = t; };
const setSideHint=(t)=>{ el.sidebar.hint.textContent = t; };

function renderResources(){
  Object.entries(el.binds).forEach(([k,nodes])=>{
    const v = S.resources[k] ?? 0;
    nodes.forEach(n=>n.textContent = fmtI(v));
  });
}
function renderHud(){
  const hp = Math.max(0, Math.min(S.player.hp, S.player.maxHp));
  const sh = Math.max(0, Math.min(S.player.shield, S.player.maxShield));
  el.hud.hpText.textContent = `${Math.floor(hp)}/${Math.floor(S.player.maxHp)}`;
  el.hud.shText.textContent = `${Math.floor(sh)}/${Math.floor(S.player.maxShield)}`;
  el.hud.hpBar.style.width = `${Math.round((hp/(S.player.maxHp||1))*100)}%`;
  el.hud.shBar.style.width = `${Math.round((sh/(S.player.maxShield||1))*100)}%`;
}

/* profile chip */
function setProfileChip(){
  const logged = (S.mode==="user" && (S.username || S.email));
  el.profile.chip.hidden = !logged;
  if(logged){
    el.profile.name.textContent = (S.username || S.email || "user");
  }
}
el.profile.chip.addEventListener("click", ()=>{
  if(S.mode!=="user") return;
  modal.open({
    title: "Profile",
    bodyHTML: `
      <div class="card sharp">
        <div class="cardTitle">Account</div>
        <div class="smallmuted">Signed in as:</div>
        <div style="margin-top:6px; font-family:Orbitron,Rajdhani,system-ui; letter-spacing:0.6px; text-transform:uppercase;">
          ${S.username || "User"}
        </div>
        <div class="smallmuted" style="margin-top:6px;">${S.email || ""}</div>
      </div>
    `,
    buttons: [{ text:"CLOSE", onClick: ()=>modal.close() }]
  });
});

/* Migration-friendly sanitize */
function sanitizeLoadedState(raw){
  const base = defaultState();
  if(!raw || typeof raw!=="object") return base;

  base.lastSaveAt = Number.isFinite(raw.lastSaveAt)? raw.lastSaveAt : base.lastSaveAt;
  base.lastOnlineAt = Number.isFinite(raw.lastOnlineAt)? raw.lastOnlineAt : base.lastOnlineAt;

  if(raw.resources && typeof raw.resources==="object"){
    for(const k of Object.keys(base.resources)){
      base.resources[k] = Math.max(0, Math.floor(clampN(raw.resources[k], base.resources[k])));
    }
  }

  if(raw.inventory && typeof raw.inventory==="object"){
    const inv = invDefault();
    inv.selectedHotbar = Math.max(0, Math.min(4, Math.floor(clampN(raw.inventory.selectedHotbar,0))));
    inv.hotbar = Array(5).fill(null).map((_,i)=>sanitizeSlot(raw.inventory.hotbar?.[i]));
    inv.inv = Array(inv.inv.length).fill(null).map((_,i)=>sanitizeSlot(raw.inventory.inv?.[i]));
    base.inventory = inv;
  }

  if(raw.player && typeof raw.player==="object"){
    base.player.x = clampN(raw.player.x, 0);
    base.player.y = clampN(raw.player.y, 0);
    base.player.hp = Math.max(0, clampN(raw.player.hp, base.player.hp));
    base.player.maxHp = Math.max(1, clampN(raw.player.maxHp, base.player.maxHp));
    base.player.shield = Math.max(0, clampN(raw.player.shield, base.player.shield));
    base.player.maxShield = Math.max(0, clampN(raw.player.maxShield, base.player.maxShield));
    base.player.level = Math.max(1, Math.floor(clampN(raw.player.level, 1)));
    base.player.exp = Math.max(0, Math.floor(clampN(raw.player.exp, 0)));
    base.player.lastHitAt = Math.max(0, Math.floor(clampN(raw.player.lastHitAt, 0)));
  }

  if(Array.isArray(raw.buildings)){
    base.buildings = raw.buildings
      .filter(b=>b && typeof b==="object" && typeof b.kind==="string")
      .map(b=>({ kind:b.kind, x: clampN(b.x,0), y: clampN(b.y,0) }))
      .slice(0, 250);
  }

  if(raw.upgrades && typeof raw.upgrades==="object"){
    base.upgrades.dropperRate = Math.max(1, clampN(raw.upgrades.dropperRate, 1));
    base.upgrades.sellSpeed = Math.max(1, clampN(raw.upgrades.sellSpeed, 1));
    base.upgrades.moneyMult = Math.max(1, clampN(raw.upgrades.moneyMult, 1));
  }

  if(raw.rebirths && typeof raw.rebirths==="object"){
    base.rebirths.count = Math.max(0, Math.floor(clampN(raw.rebirths.count,0)));
    base.rebirths.mult = Math.max(1, clampN(raw.rebirths.mult,1));
  }

  if(raw.wheel && typeof raw.wheel==="object") base.wheel.lastSpinAt = Math.max(0, Math.floor(clampN(raw.wheel.lastSpinAt,0)));
  if(raw.daily && typeof raw.daily==="object"){
    base.daily.streak = Math.max(0, Math.floor(clampN(raw.daily.streak,0)));
    base.daily.lastClaimAt = Math.max(0, Math.floor(clampN(raw.daily.lastClaimAt,0)));
    base.daily.day = Math.max(1, Math.min(28, Math.floor(clampN(raw.daily.day,1))));
  }
  if(raw.weekly && typeof raw.weekly==="object"){
    base.weekly.streak = Math.max(0, Math.floor(clampN(raw.weekly.streak,0)));
    base.weekly.lastClaimAt = Math.max(0, Math.floor(clampN(raw.weekly.lastClaimAt,0)));
    base.weekly.day = Math.max(1, Math.min(7, Math.floor(clampN(raw.weekly.day,1))));
  }

  if(raw.offline && typeof raw.offline==="object"){
    const m = Math.floor(clampN(raw.offline.showThresholdMin, 30));
    base.offline.showThresholdMin = [10,30,60].includes(m) ? m : 30;
  }

  if(raw.hotkeys && typeof raw.hotkeys==="object"){
    base.hotkeys = { ...defaultHotkeys(), ...raw.hotkeys };
  }

  if(raw.settings && typeof raw.settings==="object"){
    base.settings.showFps = !!raw.settings.showFps;
  }

  // keep save version, but do NOT wipe older data
  base.version = SAVE_VERSION;
  return base;
}

/* RTDB paths */
const path = {
  root: ()=> RTDB_ROOT,
  meta: ()=> `${RTDB_ROOT}/meta`,
  dataRoot: ()=> RTDB_DATA,
  userSave: (uid)=> `${RTDB_DATA}/users/${uid}/save`,
  userProfile: (uid)=> `${RTDB_DATA}/users/${uid}/profile`,
  usernames: (u)=> `${RTDB_ROOT}/usernames/${String(u||"").toLowerCase()}`
};

const isPerm = (e)=>{
  const c = String(e?.code||"");
  const m = String(e?.message||"");
  return c.includes("PERMISSION_DENIED") || m.toLowerCase().includes("permission denied");
};

async function dbGet(p){
  const snap = await get(ref(db, p));
  return snap.exists() ? snap.val() : null;
}
async function dbSet(p, v){ await set(ref(db, p), v); }
async function dbUpdate(p, v){ await update(ref(db, p), v); }

async function ensureOreClickerRoot(){
  if(!db) return;
  try{
    const meta = await dbGet(path.meta());
    if(!meta){
      await dbSet(path.meta(), { createdAt: now(), version: SAVE_VERSION });
    }
    const data = await dbGet(path.dataRoot());
    if(!data){
      await dbSet(path.dataRoot(), { createdAt: now() });
    }
  }catch(e){
    if(!isPerm(e)) throw e;
  }
}

async function ensureUserRecords(user){
  if(!db || !user?.uid) return;
  const uid = user.uid;
  const email = user.email || null;
  const username = user.displayName || S.username || null;

  const profilePath = path.userProfile(uid);
  const savePath = path.userSave(uid);

  let profile = null;
  let save = null;
  try{
    [profile, save] = await Promise.all([dbGet(profilePath), dbGet(savePath)]);
  }catch(e){
    if(isPerm(e)) return;
    throw e;
  }

  if(!profile){
    await dbSet(profilePath, { username, email, createdAt: now() });
  }else{
    const patch = {};
    if(username && profile.username !== username) patch.username = username;
    if(email && profile.email !== email) patch.email = email;
    if(Object.keys(patch).length) await dbUpdate(profilePath, patch);
  }

  if(username){
    try{
      const existing = await dbGet(path.usernames(username));
      if(!existing) await dbSet(path.usernames(username), uid);
    }catch(e){
      if(!isPerm(e)) throw e;
    }
  }

  if(!save){
    const base = defaultState();
    base.mode = "user";
    base.uid = uid;
    base.email = email;
    base.username = username;
    await dbSet(savePath, base);
  }
}

function mapAuthError(e){
  const msg = String(e?.code || e?.message || "");
  if(msg.includes("network")) return { code:503, title:"SERVICE ERROR", desc:"Network problem. Try again." };
  if(msg.includes("PERMISSION_DENIED")) return { code:403, title:"FORBIDDEN", desc:"Database rules blocked access." };
  if(msg.includes("wrong-password") || msg.includes("invalid-credential") || msg.includes("invalid-login-credentials"))
    return { code:401, title:"UNAUTHORIZED", desc:"Incorrect login credentials." };
  if(msg.includes("user-not-found")) return { code:404, title:"NOT FOUND", desc:"Account not found." };
  if(msg.includes("email-already-in-use")) return { code:409, title:"CONFLICT", desc:"Email already in use." };
  if(msg.includes("weak-password")) return { code:400, title:"BAD REQUEST", desc:"Password too weak." };
  if(msg.includes("invalid-email")) return { code:400, title:"BAD REQUEST", desc:"Invalid email." };
  return { code:500, title:"SERVER ERROR", desc:"Something went wrong. Try again." };
}

function getLastUser(){ try { return JSON.parse(localStorage.getItem(LAST_USER_KEY) || "null"); } catch { return null; } }
function setLastUser(emailOrUser){ try { localStorage.setItem(LAST_USER_KEY, JSON.stringify({ emailOrUser })); } catch {} }
function clearLastUser(){ try { localStorage.removeItem(LAST_USER_KEY); } catch {} }

/* Username checks: gracefully handle RTDB rules */
let usernameLookupEnabled = true;
let usernameCheckWarned = false;

async function checkUsernameTaken(u){
  if(!db || !usernameLookupEnabled) return null;
  try{
    const v = await dbGet(path.usernames(u));
    return !!v;
  }catch(e){
    if(isPerm(e)){
      usernameLookupEnabled = false;
      if(!usernameCheckWarned){ usernameCheckWarned=true; toast("Username check unavailable."); }
      return null;
    }
    throw e;
  }
}

async function resolveUsernameOrEmail(input){
  const txt = String(input||"").trim();
  if(!txt) return null;
  if(txt.includes("@")) return { email: txt, via:"email" };
  if(!db || !usernameLookupEnabled) return null;

  try{
    const uid = await dbGet(path.usernames(txt));
    if(!uid) return null;
    const prof = await dbGet(path.userProfile(uid));
    if(!prof?.email) return null;
    return { email: prof.email, via:"username" };
  }catch(e){
    if(isPerm(e)){
      usernameLookupEnabled = false;
      toast("Username login unavailable. Use email.");
      return null;
    }
    throw e;
  }
}

/* Claim username after register (transaction) */
async function claimUsername(uid, username){
  const r = ref(db, path.usernames(username));
  const res = await runTransaction(r, (cur)=> cur===null ? uid : cur);
  return !!res.committed && res.snapshot.val() === uid;
}

async function loginEmailPass(input, pass, remember){
  if(!auth) throw new Error("auth_not_ready");
  await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);

  const id = await resolveUsernameOrEmail(input);
  if(!id){
    if(String(input||"").includes("@")){
      const cred = await signInWithEmailAndPassword(auth, input.trim(), pass);
      setLastUser(input.trim());
      return cred.user;
    }
    throw Object.assign(new Error("username_lookup_unavailable"), { code:"auth/user-not-found" });
  }
  const cred = await signInWithEmailAndPassword(auth, id.email, pass);
  setLastUser(input.trim());
  return cred.user;
}

async function loginGoogle(){
  if(!auth) throw new Error("auth_not_ready");
  const prov = new GoogleAuthProvider();
  const res = await signInWithPopup(auth, prov);
  return res.user;
}

/* Username/password meters */
function usernameScore(u){
  const s = String(u||"");
  const rules = [ s.length>=3, s.length<=16, /^[a-zA-Z][a-zA-Z0-9_]*$/.test(s), !/__/.test(s) ];
  const score = rules.filter(Boolean).length;
  return { score, max: rules.length, ok: score===rules.length };
}
function passwordScore(p){
  const s = String(p||"");
  const rules = [ s.length>=8, /[A-Z]/.test(s), /[a-z]/.test(s), /[0-9]/.test(s) ];
  const score = rules.filter(Boolean).length;
  return { score, max: rules.length, ok: score>=3 && s.length>=8 };
}

let usernameCheckTimer=null;
function wireRegisterMeters(){
  const updUser = async ()=>{
    const u = el.reg.user.value.trim();
    const { score, max, ok } = usernameScore(u);
    el.reg.userMeter.style.width = `${Math.round((score/max)*100)}%`;
    el.reg.userMeterText.textContent = ok ? "Username OK" : "3-16 chars, start letter, letters/numbers/_ only";
    el.reg.userTakenText.textContent = "";

    clearTimeout(usernameCheckTimer);
    usernameCheckTimer = setTimeout(async ()=>{
      if(!u) return;
      const taken = await checkUsernameTaken(u);
      if(taken === null){
        el.reg.userTakenText.textContent = "Username availability cannot be checked right now.";
        el.reg.userTakenText.style.color = "rgba(255,255,255,0.65)";
        return;
      }
      el.reg.userTakenText.textContent = taken ? "Username already taken" : "Username available";
      el.reg.userTakenText.style.color = taken ? "rgba(255,80,80,0.95)" : "rgba(120,255,170,0.95)";
    }, 350);
  };

  const updPass = ()=>{
    const p = el.reg.pass.value;
    const { score, max, ok } = passwordScore(p);
    el.reg.passMeter.style.width = `${Math.round((score/max)*100)}%`;
    el.reg.passMeterText.textContent = ok ? "Password OK" : "Use 8+ chars, mix letters/numbers";
  };

  el.reg.user.addEventListener("input", updUser);
  el.reg.pass.addEventListener("input", updPass);
  updUser(); updPass();
}

async function registerEmailPass(){
  if(!auth || !db) throw new Error("auth_db_not_ready");
  const email = el.reg.email.value.trim();
  const username = el.reg.user.value.trim();
  const pass = el.reg.pass.value;
  const pass2 = el.reg.pass2.value;

  const uScore = usernameScore(username);
  const pScore = passwordScore(pass);

  if(!email || !username || !pass) return toast("Fill all fields");
  if(!uScore.ok) return toast("Username requirements not met");
  if(!pScore.ok) return toast("Password requirements not met");
  if(pass !== pass2) return toast("Passwords do not match");
  if(!el.reg.tos.checked) return toast("Agree to Terms");
  if(!el.reg.robot.checked) return toast("Robot check required");

  const cred = await createUserWithEmailAndPassword(auth, email, pass);
  await ensureOreClickerRoot();

  try{
    const ok = await claimUsername(cred.user.uid, username);
    if(!ok){
      await deleteUser(cred.user);
      toast("Username taken. Choose another.");
      return null;
    }
  }catch(e){
    if(isPerm(e)){
      await deleteUser(cred.user);
      showError(
        403,
        "FORBIDDEN",
        "Database rules blocked username registration.",
        `Check RTDB rules at: ${RTDB_REF}`
      );
      return null;
    }
    throw e;
  }

  try{ await updateProfile(cred.user, { displayName: username }); }catch{}

  await dbSet(path.userProfile(cred.user.uid), { username, email, createdAt: now() });
  const base = defaultState();
  base.mode = "user";
  base.uid = cred.user.uid;
  base.email = email;
  base.username = username;
  await dbSet(path.userSave(cred.user.uid), base);
  setLastUser(username);

  toast("Registered!");
  return cred.user;
}

async function resetPasswordFlow(){
  const input = el.login.email.value.trim();
  if(!input) return toast("Enter email or username");
  const id = await resolveUsernameOrEmail(input);
  const email = id?.email || (input.includes("@") ? input : null);
  if(!email) return toast("Use email for password reset");
  try{
    await sendPasswordResetEmail(auth, email);
    toast("Password reset sent");
  }catch(e){
    const m = mapAuthError(e);
    showError(m.code, m.title, m.desc, "");
  }
}

function wirePasswordToggles(){
  document.querySelectorAll(".togglePass").forEach((btn)=>{
    btn.addEventListener("click", ()=>{
      const targetId = btn.dataset.target;
      const input = targetId ? document.getElementById(targetId) : null;
      if(!input) return;
      const makeVisible = input.type === "password";
      input.type = makeVisible ? "text" : "password";
      btn.textContent = makeVisible ? "HIDE" : "SHOW";
      btn.classList.toggle("primary", makeVisible);
    });
  });
}

/* UI: menu auth */
function setMenuAuthUI(user){
  const last = getLastUser();
  if(!user && last?.emailOrUser){
    el.menu.confirmUser.hidden = false;
    el.menu.lastUserLabel.textContent = last.emailOrUser;
  } else el.menu.confirmUser.hidden = true;

  if(user){
    el.menu.menuAuthRow.hidden = true;
    el.menu.playGuest.textContent = "CONTINUE";
  } else {
    el.menu.menuAuthRow.hidden = false;
    el.menu.playGuest.textContent = "PLAY AS GUEST";
  }
}

/* Canvas core */
let ctx=null, cw=0, ch=0;
const keys = {};
let lastFrame = 0;
let placementMode = null;
let lastMouseWorld=null;
const touchSupported = ("ontouchstart" in window) || (navigator.maxTouchPoints > 0);
let touchState = { active:false, dx:0, dy:0 };
let fpsAcc = 0;
let fpsFrames = 0;
let fpsValue = 0;

let cam = { x:0, y:0 };
let minimapExpanded = false;

function resizeCanvas(){
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  cw = Math.floor(el.canvas.clientWidth * dpr);
  ch = Math.floor(el.canvas.clientHeight * dpr);
  el.canvas.width = cw;
  el.canvas.height = ch;
  ctx = el.canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
}
window.addEventListener("resize", resizeCanvas);

function updateTouchVisibility(){
  if(!el.touch.root) return;
  el.touch.root.hidden = !touchSupported || !isRunning;
}

if(el.touch.pad){
  const resetPad = ()=>{
    touchState.active = false;
    touchState.dx = 0;
    touchState.dy = 0;
    el.touch.knob.style.left = "50%";
    el.touch.knob.style.top = "50%";
    el.touch.knob.style.transform = "translate(-50%,-50%)";
  };

  const updatePad = (e)=>{
    const rect = el.touch.pad.getBoundingClientRect();
    const cx = rect.left + rect.width/2;
    const cy = rect.top + rect.height/2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const radius = rect.width/2;
    const len = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(radius, len);
    const nx = dx / len;
    const ny = dy / len;
    touchState.dx = (clamped / radius) * nx;
    touchState.dy = (clamped / radius) * ny;
    el.touch.knob.style.transform = "translate(-50%,-50%)";
    el.touch.knob.style.left = `${rect.width/2 + nx*clamped}px`;
    el.touch.knob.style.top = `${rect.height/2 + ny*clamped}px`;
  };

  el.touch.pad.addEventListener("pointerdown", (e)=>{
    if(!touchSupported) return;
    e.preventDefault();
    touchState.active = true;
    updatePad(e);
    el.touch.pad.setPointerCapture(e.pointerId);
  });
  el.touch.pad.addEventListener("pointermove", (e)=>{
    if(!touchState.active) return;
    e.preventDefault();
    updatePad(e);
  });
  el.touch.pad.addEventListener("pointerup", (e)=>{
    if(!touchState.active) return;
    e.preventDefault();
    resetPad();
    el.touch.pad.releasePointerCapture(e.pointerId);
  });
  el.touch.pad.addEventListener("pointercancel", resetPad);
  el.touch.pad.addEventListener("pointerleave", (e)=>{
    if(!touchState.active) return;
    resetPad();
  });
}

el.touch.mine?.addEventListener("click", (e)=>{ e.preventDefault(); if(!paused && !tabPaused) mineOre(); });
el.touch.attack?.addEventListener("click", (e)=>{ e.preventDefault(); if(!paused && !tabPaused) attack(); });
el.touch.use?.addEventListener("click", (e)=>{ e.preventDefault(); if(!paused && !tabPaused) useSelected(); });

/* World */
const WORLD = {
  w: 4600, h: 3400,
  shop: { x: 140, y: 140, w: 240, h: 160 },
  sell: { x: 420, y: 140, w: 240, h: 160 },
  base: { x: 140, y: 360, w: 520, h: 320 },
  wild: { x: 1200, y: 400, w: 3000, h: 2700 },
};
const inRect=(px,py,r)=> (px>=r.x && py>=r.y && px<=r.x+r.w && py<=r.y+r.h);
const rand=(a,b)=>a+Math.random()*(b-a);
const clamp=(v,mi,ma)=>Math.max(mi, Math.min(ma, v));
const worldToScreen=(wx,wy)=>({ x: (wx - cam.x), y:(wy - cam.y) });
const screenToWorld=(sx,sy)=>({ x:sx+cam.x, y:sy+cam.y });
const minimapCssRect=()=>({ x:12, y:12, size: minimapExpanded ? 240 : 120 });

/* Ores */
const ORE_TYPES = [
  { id:"ore_basic",   hp:2,  minRespawn:3,  maxRespawn:8,  cap: 18, radius: 900 },
  { id:"ore_coal",    hp:3,  minRespawn:4,  maxRespawn:10, cap: 12, radius: 1100 },
  { id:"ore_iron",    hp:4,  minRespawn:6,  maxRespawn:12, cap: 9,  radius: 1300 },
  { id:"ore_gold",    hp:6,  minRespawn:10, maxRespawn:18, cap: 6,  radius: 1500 },
  { id:"ore_diamond", hp:8,  minRespawn:14, maxRespawn:22, cap: 4,  radius: 1700 },
];
const ORE_COL = {
  ore_basic:"rgba(150,150,150,0.85)",
  ore_coal:"rgba(0,255,120,0.8)",
  ore_iron:"rgba(60,140,255,0.85)",
  ore_gold:"rgba(170,80,255,0.85)",
  ore_diamond:"rgba(255,210,70,0.9)"
};
const TREE_TYPES = [
  { id:"wood", hp:3, minRespawn:6, maxRespawn:14, cap: 26, radius: 1500 }
];

let ores = []; // {id,x,y,r,hp,maxHp,deadUntil}
let trees = []; // {id,x,y,r,hp,maxHp,deadUntil}
function scheduleOreRespawn(o){
  const t = ORE_TYPES.find(x=>x.id===o.id);
  const sec = rand(t.minRespawn, t.maxRespawn);
  o.deadUntil = performance.now() + sec*1000;
}
function spawnOreOne(type){
  const cx = WORLD.wild.x + WORLD.wild.w*0.5;
  const cy = WORLD.wild.y + WORLD.wild.h*0.5;
  for(let i=0;i<30;i++){
    const ang = Math.random()*Math.PI*2;
    const rad = Math.random()*type.radius;
    const x = clamp(cx + Math.cos(ang)*rad, WORLD.wild.x+30, WORLD.wild.x+WORLD.wild.w-30);
    const y = clamp(cy + Math.sin(ang)*rad, WORLD.wild.y+30, WORLD.wild.y+WORLD.wild.h-30);
    const ok = ores.every(o => o.deadUntil>0 || Math.hypot(o.x-x,o.y-y) > 60);
    if(ok){
      ores.push({ id:type.id, x, y, r:14, hp:type.hp, maxHp:type.hp, deadUntil:0 });
      return true;
    }
  }
  return false;
}
function ensureOreCaps(){
  for(const t of ORE_TYPES){
    const alive = ores.filter(o=>o.id===t.id && o.deadUntil===0).length;
    for(let i=0;i<Math.max(0, t.cap - alive);i++) spawnOreOne(t);
  }
}
function updateOres(){
  const tnow = performance.now();
  for(const o of ores){
    if(o.deadUntil && tnow >= o.deadUntil){
      o.deadUntil = 0; o.hp = o.maxHp;
      const t = ORE_TYPES.find(x=>x.id===o.id);
      const ang = Math.random()*Math.PI*2;
      const rad = rand(80, t.radius);
      o.x = clamp(o.x + Math.cos(ang)*rad, WORLD.wild.x+30, WORLD.wild.x+WORLD.wild.w-30);
      o.y = clamp(o.y + Math.sin(ang)*rad, WORLD.wild.y+30, WORLD.wild.y+WORLD.wild.h-30);
    }
  }
  ensureOreCaps();
}

function scheduleTreeRespawn(o){
  const t = TREE_TYPES.find(x=>x.id===o.id);
  const sec = rand(t.minRespawn, t.maxRespawn);
  o.deadUntil = performance.now() + sec*1000;
}
function spawnTreeOne(type){
  const cx = WORLD.wild.x + WORLD.wild.w*0.5;
  const cy = WORLD.wild.y + WORLD.wild.h*0.5;
  for(let i=0;i<30;i++){
    const ang = Math.random()*Math.PI*2;
    const rad = Math.random()*type.radius;
    const x = clamp(cx + Math.cos(ang)*rad, WORLD.wild.x+30, WORLD.wild.x+WORLD.wild.w-30);
    const y = clamp(cy + Math.sin(ang)*rad, WORLD.wild.y+30, WORLD.wild.y+WORLD.wild.h-30);
    const ok = trees.every(o => o.deadUntil>0 || Math.hypot(o.x-x,o.y-y) > 70);
    if(ok){
      trees.push({ id:type.id, x, y, r:16, hp:type.hp, maxHp:type.hp, deadUntil:0 });
      return true;
    }
  }
  return false;
}
function ensureTreeCaps(){
  for(const t of TREE_TYPES){
    const alive = trees.filter(o=>o.id===t.id && o.deadUntil===0).length;
    for(let i=0;i<Math.max(0, t.cap - alive);i++) spawnTreeOne(t);
  }
}
function updateTrees(){
  const tnow = performance.now();
  for(const o of trees){
    if(o.deadUntil && tnow >= o.deadUntil){
      o.deadUntil = 0; o.hp = o.maxHp;
      const t = TREE_TYPES.find(x=>x.id===o.id);
      const ang = Math.random()*Math.PI*2;
      const rad = rand(120, t.radius);
      o.x = clamp(o.x + Math.cos(ang)*rad, WORLD.wild.x+30, WORLD.wild.x+WORLD.wild.w-30);
      o.y = clamp(o.y + Math.sin(ang)*rad, WORLD.wild.y+30, WORLD.wild.y+WORLD.wild.h-30);
    }
  }
  ensureTreeCaps();
}

/* Enemies */
const ENEMY_TYPES = [
  { id:"scavenger", name:"Scavenger", hp:18, r:11, spd:[60,90], money:[6,12], color:"rgba(255,140,120,0.8)" },
  { id:"prowler", name:"Prowler", hp:26, r:13, spd:[55,80], money:[10,18], color:"rgba(255,120,90,0.82)" },
  { id:"brute", name:"Brute", hp:38, r:15, spd:[45,70], money:[16,26], color:"rgba(255,90,70,0.84)" }
];
const BOSS_TYPE = { id:"boss", name:"Ancient Guardian", hp:120, r:22, spd:[35,50], money:[60,120], color:"rgba(255,60,60,0.9)" };
let enemies = []; // {x,y,r,hp,maxHp,spd,hitCd,type}
let siphonUntil = 0;
let siphonMult = 1;

function getEnemyDef(enemy){
  if(enemy?.type === "boss") return BOSS_TYPE;
  return ENEMY_TYPES.find(t=>t.id===enemy?.type) || ENEMY_TYPES[0];
}
function spawnEnemy(){
  const x = rand(WORLD.wild.x+60, WORLD.wild.x+WORLD.wild.w-60);
  const y = rand(WORLD.wild.y+60, WORLD.wild.y+WORLD.wild.h-60);
  const bossActive = enemies.some(e=>e.type==="boss");
  const isBoss = !bossActive && Math.random() < 0.03;
  const def = isBoss ? BOSS_TYPE : ENEMY_TYPES[Math.floor(Math.random()*ENEMY_TYPES.length)];
  enemies.push({
    x,
    y,
    r: def.r,
    hp: def.hp,
    maxHp: def.hp,
    spd: rand(def.spd[0], def.spd[1]),
    hitCd: 0,
    type: def.id
  });
}
function ensureEnemies(){
  const cap = 8 + Math.min(10, S.rebirths.count*2);
  while(enemies.length < cap) spawnEnemy();
}

/* Pickups: physical drops + rare consumables */
let pickups = []; // {kind,id,x,y,r,ttlMs,qty} kind: "item"
const pickupCap = 40;

function spawnPickup(id, x, y, ttlMs=60000, qty=1){
  if(pickups.length >= pickupCap) return;
  const def = ITEMS[id];
  if(def?.stack){
    const hit = pickups.find(p=>p.id===id && Math.hypot(p.x-x, p.y-y) <= 22);
    if(hit){
      hit.qty = Math.min(9999, (hit.qty||1) + qty);
      hit.ttlMs = Math.max(hit.ttlMs, ttlMs);
      return;
    }
  }
  pickups.push({ kind:"item", id, x, y, r:10, ttlMs, qty });
}

let consumableTimer=0;
function updateConsumableSpawns(dt){
  consumableTimer += dt;
  if(consumableTimer < 6) return;
  consumableTimer = 0;

  if(Math.random() < 0.18){
    const id = Math.random() < 0.55 ? "cons_shield" : "cons_medkit";
    const x = rand(WORLD.wild.x+80, WORLD.wild.x+WORLD.wild.w-80);
    const y = rand(WORLD.wild.y+80, WORLD.wild.y+WORLD.wild.h-80);
    spawnPickup(id, x, y, 90000);
    toast("A consumable appeared somewhere in the WILD.");
  }
}

function updatePickups(dt){
  for(const p of pickups) p.ttlMs -= dt*1000;
  pickups = pickups.filter(p=>p.ttlMs > 0);
}

function collectPickups(){
  for(let i=pickups.length-1;i>=0;i--){
    const p = pickups[i];
    if(Math.hypot(p.x-S.player.x, p.y-S.player.y) <= (p.r+12)){
      const qty = p.qty || 1;
      if(Object.prototype.hasOwnProperty.call(S.resources, p.id)){
        S.resources[p.id] = (S.resources[p.id]||0) + qty;
      }
      addItem(S.inventory, makeItem(p.id, qty));
      pickups.splice(i,1);
      invUI.render();
      renderResources();
      setSideStatus(`Picked up ${qty} ${ITEMS[p.id]?.name||p.id}`);
    }
  }
}

/* Buildings runtime timers (no save schema changes) */
let dropperRuntime = new WeakMap();
let collectorRuntime = 0;

function updateDroppers(dt){
  for(const b of S.buildings){
    const def = BUILDINGS[b.kind];
    if(!def || def.type!=="dropper") continue;

    let acc = dropperRuntime.get(b) || 0;
    acc += dt;
    if(acc >= 1){
      const steps = Math.floor(acc);
      acc -= steps;

      for(let s=0;s<steps;s++){
        const perMin = (def.ratePerMin||0) * (S.upgrades.dropperRate||1) * (S.rebirths.mult||1);
        const perSec = perMin/60;
        if(Math.random() < perSec){
          if(def.dropType==="direct"){
            S.resources[def.oreId] = (S.resources[def.oreId]||0) + 1;
            addItem(S.inventory, makeItem(def.oreId, 1));
          } else {
            const x = b.x + rand(-22, 22);
            const y = b.y + rand(18, 32);
            spawnPickup(def.oreId, x, y, 80000);
          }
        }
      }
      invUI.render();
      renderResources();
    }
    dropperRuntime.set(b, acc);
  }

  collectorRuntime += dt;
  if(collectorRuntime >= 0.25){
    collectorRuntime = 0;
    const collectors = S.buildings.filter(b=>b.kind==="collector_pad");
    if(!collectors.length) return;
    for(const c of collectors){
      for(let i=pickups.length-1;i>=0;i--){
        const p = pickups[i];
        const d = Math.hypot(p.x-c.x, p.y-c.y);
        if(d <= 90){
          const qty = p.qty || 1;
          if(Object.prototype.hasOwnProperty.call(S.resources, p.id)) S.resources[p.id] = (S.resources[p.id]||0)+qty;
          addItem(S.inventory, makeItem(p.id,qty));
          pickups.splice(i,1);
        }
      }
    }
    invUI.render();
    renderResources();
  }
}

/* Player */
function resetPlayerToBase(){
  S.player.x = WORLD.base.x + 80;
  S.player.y = WORLD.base.y + 80;
  S.player.hp = S.player.maxHp;
  S.player.shield = S.player.maxShield;
}
function rebirthMultiplier(count){ return 1 + (count * 0.25); }

/* Mining / attack / use */
function nearestOre(){
  let best=null, bd=1e9;
  for(const o of ores){
    if(o.deadUntil) continue;
    const d = Math.hypot(o.x-S.player.x, o.y-S.player.y);
    if(d < 34 && d<bd){ best=o; bd=d; }
  }
  return best;
}
function nearestTree(){
  let best=null, bd=1e9;
  for(const o of trees){
    if(o.deadUntil) continue;
    const d = Math.hypot(o.x-S.player.x, o.y-S.player.y);
    if(d < 40 && d<bd){ best=o; bd=d; }
  }
  return best;
}

function damageEquipment(eq){
  if(!eq) return;
  const def = eq.def;
  if(!def || def.stack) return;
  if(def.type!=="tool" && def.type!=="melee" && def.type!=="axe") return;
  const max = def.maxDur ?? 100;
  eq.slot.dur = Math.max(0, (eq.slot.dur ?? max) - 1);
  if(eq.slot.dur<=0){
    S.inventory.hotbar[S.inventory.selectedHotbar]=null;
    toast("Equipment broke!");
  }
}

function mineOre(){
  const eq = equipped(S.inventory);
  if(!eq?.def){
    setSideStatus("Equip a pickaxe or axe");
    return;
  }

  if(eq.def.type==="tool"){
    const o = nearestOre();
    if(!o){ setSideStatus("No ore nearby"); return; }
    const power = eq.def.mine || 1;
    damageEquipment(eq);

    o.hp -= power;
    setSideStatus(`Mining ${ITEMS[o.id].name}…`);
    if(o.hp<=0){
      const yieldAmt = o.id==="ore_basic"?2 : o.id==="ore_coal"?2 : o.id==="ore_iron"?2 : o.id==="ore_gold"?1 : 1;
      S.resources[o.id] = (S.resources[o.id]||0) + yieldAmt;
      addItem(S.inventory, makeItem(o.id, yieldAmt));
      toast(`+${yieldAmt} ${ITEMS[o.id].name}`);
      scheduleOreRespawn(o);
    }
    invUI.render();
    renderResources();
    return;
  }

  if(eq.def.type==="axe"){
    const t = nearestTree();
    if(!t){ setSideStatus("No trees nearby"); return; }
    const power = eq.def.chop || 1;
    damageEquipment(eq);
    t.hp -= power;
    setSideStatus("Chopping wood…");
    if(t.hp<=0){
      const yieldAmt = 2;
      S.resources.wood = (S.resources.wood||0) + yieldAmt;
      addItem(S.inventory, makeItem("wood", yieldAmt));
      toast(`+${yieldAmt} Wood`);
      scheduleTreeRespawn(t);
    }
    invUI.render();
    renderResources();
    return;
  }

  setSideStatus("Equip a pickaxe or axe");
}

function attack(){
  const eq = equipped(S.inventory);
  if(!eq?.def || (eq.def.type!=="melee" && eq.def.type!=="axe")){
    setSideStatus("Equip a sword or axe");
    return;
  }
  const atk = eq.def.atk||1;
  damageEquipment(eq);

  let best=null, bd=1e9;
  for(const m of enemies){
    const d = Math.hypot(m.x-S.player.x, m.y-S.player.y);
    if(d < 46 && d<bd){ best=m; bd=d; }
  }
  if(!best){ setSideStatus("No enemy nearby"); invUI.render(); return; }

  best.hp -= atk;
  setSideStatus(`Hit enemy (-${atk})`);
  if(best.hp<=0){
    const def = getEnemyDef(best);
    const dropRoll = Math.random();
    const drop = dropRoll < 0.15 ? "wood" : (dropRoll < 0.65 ? "ore_basic" : (dropRoll < 0.82 ? "ore_coal" : "ore_iron"));
    if(Object.prototype.hasOwnProperty.call(S.resources, drop)) S.resources[drop] += 1;
    addItem(S.inventory, makeItem(drop,1));
    const baseMoney = Math.round(rand(def.money[0], def.money[1]));
    const nowMs = now();
    const moneyMult = nowMs < siphonUntil ? siphonMult : 1;
    const reward = Math.max(1, Math.round(baseMoney * moneyMult));
    S.resources.money = Math.floor(clampN(S.resources.money, 0) + reward);
    if(def.id === "boss"){
      siphonMult = Math.round(rand(2, 5) * 10) / 10;
      siphonUntil = now() + 5000;
      toast(`Boss defeated! +$${fmtI(reward)} • Siphon x${siphonMult} for 5s.`);
    } else {
      toast(`Enemy defeated! +$${fmtI(reward)}`);
    }
    enemies = enemies.filter(x=>x!==best);
  }
  invUI.render();
  renderResources();
}

function useSelected(){
  const eq = equipped(S.inventory);
  if(!eq?.def || eq.def.type!=="consumable") return;
  const def = eq.def;

  if(def.healHp){
    const before = S.player.hp;
    S.player.hp = Math.min(S.player.maxHp, S.player.hp + def.healHp);
    if(S.player.hp === before) return toast("HP already full");
    toast(`Used ${def.name}`);
  }
  if(def.addShield){
    const before = S.player.shield;
    S.player.shield = Math.min(S.player.maxShield, S.player.shield + def.addShield);
    if(S.player.shield === before) return toast("Shield already full");
    toast(`Used ${def.name}`);
  }
  eq.slot.qty = Math.max(0, (eq.slot.qty||1) - 1);
  if(eq.slot.qty<=0) S.inventory.hotbar[S.inventory.selectedHotbar] = null;
  invUI.render();
  renderHud();
}

/* Enemy update + shield logic + simple shield regen */
function applyPlayerDamage(dmg){
  S.player.lastHitAt = now();
  let left = dmg;
  if(S.player.shield > 0){
    const use = Math.min(S.player.shield, left);
    S.player.shield -= use;
    left -= use;
  }
  if(left>0){
    S.player.hp = Math.max(0, S.player.hp - left);
  }
  renderHud();
}

function updateShieldRegen(dt){
  if(now() - (S.player.lastHitAt||0) < 6000) return;
  if(S.player.shield >= S.player.maxShield) return;
  S.player.shield = Math.min(S.player.maxShield, S.player.shield + 2*dt);
}

function updateEnemies(dt){
  ensureEnemies();
  for(const m of enemies){
    const d = Math.hypot(S.player.x-m.x, S.player.y-m.y);
    if(d<380){
      const dx = (S.player.x-m.x)/(d||1);
      const dy = (S.player.y-m.y)/(d||1);
      m.x += dx*m.spd*dt;
      m.y += dy*m.spd*dt;
    }
    m.x = clamp(m.x, WORLD.wild.x+20, WORLD.wild.x+WORLD.wild.w-20);
    m.y = clamp(m.y, WORLD.wild.y+20, WORLD.wild.y+WORLD.wild.h-20);
    m.hitCd = Math.max(0, (m.hitCd||0) - dt);
    if(d < (m.r+12) && m.hitCd<=0){
      m.hitCd = 0.8;
      applyPlayerDamage(6);
      setSideStatus("You were hit!");
      if(S.player.hp<=0){
        toast("You died. Respawned.");
        resetPlayerToBase();
      }
    }
  }
}

/* Movement */
function isDown(code){ return !!keys[code]; }
function move(dt){
  const hk = S.hotkeys;
  const up = isDown(hk.moveUp) || isDown("ArrowUp");
  const dn = isDown(hk.moveDown) || isDown("ArrowDown");
  const lf = isDown(hk.moveLeft) || isDown("ArrowLeft");
  const rt = isDown(hk.moveRight) || isDown("ArrowRight");
  const ix = (rt?1:0) - (lf?1:0) + (touchState.dx || 0);
  const iy = (dn?1:0) - (up?1:0) + (touchState.dy || 0);
  const len = Math.hypot(ix,iy) || 1;
  const spd = 220;
  S.player.x = clamp(S.player.x + (ix/len)*spd*dt, 0, WORLD.w);
  S.player.y = clamp(S.player.y + (iy/len)*spd*dt, 0, WORLD.h);
}

/* Placement */
function enterPlacement(buildingId){
  placementMode = buildingId;
  setSideStatus(`Placing ${BUILDINGS[buildingId]?.name || buildingId} (click to place, Esc cancel)`);
}
function cancelPlacement(){ placementMode=null; setSideStatus("Ready"); }
function placeBuildingAt(worldX, worldY){
  if(!placementMode) return;
  const gx = Math.round(worldX/32)*32;
  const gy = Math.round(worldY/32)*32;
  if(!inRect(gx, gy, WORLD.base)){ toast("Place inside BASE"); return; }
  S.buildings.push({ kind: placementMode, x: gx, y: gy });
  toast("Placed building");
  placementMode = null;
}

/* Draw helpers */
function drawRect(r, fill, stroke){
  const p = worldToScreen(r.x, r.y);
  ctx.fillStyle = fill; ctx.fillRect(p.x, p.y, r.w, r.h);
  ctx.strokeStyle = stroke; ctx.strokeRect(p.x, p.y, r.w, r.h);
}

/* SELL ZONE detection */
const sellZoneActive=()=>inRect(S.player.x, S.player.y, WORLD.sell);

/* Draw */
function draw(){
  ctx.clearRect(0,0,cw,ch);
  ctx.fillStyle = "rgba(0,0,0,1)";
  ctx.fillRect(0,0,cw,ch);

  cam.x = clamp(S.player.x - (cw/2), 0, WORLD.w - cw);
  cam.y = clamp(S.player.y - (ch/2), 0, WORLD.h - ch);

  ctx.strokeStyle="rgba(255,255,255,0.05)";
  for(let x=0; x<WORLD.w; x+=64){
    const p = worldToScreen(x,0);
    ctx.beginPath(); ctx.moveTo(p.x, -cam.y); ctx.lineTo(p.x, WORLD.h - cam.y); ctx.stroke();
  }
  for(let y=0; y<WORLD.h; y+=64){
    const p = worldToScreen(0,y);
    ctx.beginPath(); ctx.moveTo(-cam.x, p.y); ctx.lineTo(WORLD.w - cam.x, p.y); ctx.stroke();
  }

  drawRect(WORLD.shop, "rgba(255,255,255,0.06)", "rgba(255,255,255,0.22)");
  drawRect(WORLD.sell, "rgba(120,255,170,0.05)", "rgba(120,255,170,0.35)");
  drawRect(WORLD.base, "rgba(255,255,255,0.04)", "rgba(255,255,255,0.18)");
  drawRect(WORLD.wild, "rgba(255,80,80,0.02)", "rgba(255,80,80,0.14)");

  ctx.fillStyle="rgba(255,255,255,0.78)";
  ctx.font="800 14px Orbitron, Rajdhani, system-ui";
  const label=(t,x,y)=>{ const p=worldToScreen(x,y); ctx.fillText(t, p.x+10, p.y+24); };
  label("SHOP", WORLD.shop.x, WORLD.shop.y);
  label("SELL", WORLD.sell.x, WORLD.sell.y);
  label("BASE", WORLD.base.x, WORLD.base.y);
  label("WILD", WORLD.wild.x, WORLD.wild.y);

  // buildings
  for(const b of S.buildings){
    const def = BUILDINGS[b.kind];
    const p = worldToScreen(b.x, b.y);
    ctx.fillStyle="rgba(255,255,255,0.08)";
    ctx.fillRect(p.x-14, p.y-14, 28, 28);
    ctx.strokeStyle="rgba(255,255,255,0.22)";
    ctx.strokeRect(p.x-14, p.y-14, 28, 28);
    ctx.fillStyle="rgba(255,255,255,0.85)";
    ctx.font="700 12px Rajdhani, system-ui";
    ctx.fillText(def?.icon||"🏗️", p.x-6, p.y+5);
  }

  // placement ghost
  if(placementMode && lastMouseWorld){
    const gx = Math.round(lastMouseWorld.x/32)*32;
    const gy = Math.round(lastMouseWorld.y/32)*32;
    const ok = inRect(gx, gy, WORLD.base);
    const p = worldToScreen(gx, gy);
    ctx.fillStyle = ok ? "rgba(120,255,170,0.12)" : "rgba(255,80,80,0.10)";
    ctx.fillRect(p.x-14, p.y-14, 28, 28);
    ctx.strokeStyle = ok ? "rgba(120,255,170,0.55)" : "rgba(255,80,80,0.55)";
    ctx.strokeRect(p.x-14, p.y-14, 28, 28);
  }

  // ores
  for(const o of ores){
    if(o.deadUntil) continue;
    const p = worldToScreen(o.x, o.y);
    ctx.fillStyle = ORE_COL[o.id] || "rgba(255,255,255,0.7)";
    ctx.beginPath(); ctx.arc(p.x, p.y, o.r, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle="rgba(255,255,255,0.18)"; ctx.stroke();
    const pct = o.maxHp ? (o.hp/o.maxHp) : 0;
    ctx.fillStyle="rgba(0,0,0,0.55)"; ctx.fillRect(p.x-18, p.y+18, 36, 5);
    ctx.fillStyle="rgba(255,255,255,0.75)"; ctx.fillRect(p.x-18, p.y+18, 36*Math.max(0,pct), 5);
    ctx.strokeStyle="rgba(255,255,255,0.18)"; ctx.strokeRect(p.x-18, p.y+18, 36, 5);
  }

  // trees
  for(const t of trees){
    if(t.deadUntil) continue;
    const p = worldToScreen(t.x, t.y);
    ctx.fillStyle="rgba(120,255,160,0.35)";
    ctx.beginPath(); ctx.arc(p.x, p.y, t.r+4, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle="rgba(120,255,160,0.6)"; ctx.stroke();
    ctx.fillStyle="rgba(60,120,80,0.7)";
    ctx.beginPath(); ctx.arc(p.x, p.y, t.r-2, 0, Math.PI*2); ctx.fill();
    const pct = t.maxHp ? (t.hp/t.maxHp) : 0;
    ctx.fillStyle="rgba(0,0,0,0.55)"; ctx.fillRect(p.x-18, p.y+18, 36, 5);
    ctx.fillStyle="rgba(120,255,170,0.75)"; ctx.fillRect(p.x-18, p.y+18, 36*Math.max(0,pct), 5);
    ctx.strokeStyle="rgba(255,255,255,0.18)"; ctx.strokeRect(p.x-18, p.y+18, 36, 5);
  }

  // pickups
  for(const p0 of pickups){
    const p = worldToScreen(p0.x, p0.y);
    ctx.fillStyle="rgba(255,255,255,0.10)";
    ctx.beginPath(); ctx.arc(p.x, p.y, p0.r+4, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle="rgba(255,255,255,0.18)"; ctx.stroke();
    ctx.fillStyle="rgba(255,255,255,0.85)";
    ctx.font="700 12px Rajdhani, system-ui";
    ctx.fillText(ITEMS[p0.id]?.icon || "❓", p.x-5, p.y+4);
    if(p0.qty && p0.qty>1){
      ctx.fillStyle="rgba(255,255,255,0.9)";
      ctx.font="700 10px Rajdhani, system-ui";
      ctx.fillText(`x${p0.qty}`, p.x-8, p.y+18);
    }
  }

  // enemies
  for(const m of enemies){
    const p = worldToScreen(m.x, m.y);
    const def = getEnemyDef(m);
    ctx.fillStyle = def.color || "rgba(255,80,80,0.75)";
    ctx.beginPath(); ctx.arc(p.x, p.y, m.r, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle="rgba(255,255,255,0.12)"; ctx.stroke();
    ctx.fillStyle="rgba(0,0,0,0.55)"; ctx.fillRect(p.x-18, p.y+18, 36, 5);
    ctx.fillStyle="rgba(255,255,255,0.75)"; ctx.fillRect(p.x-18, p.y+18, 36*(m.hp/(m.maxHp||24)), 5);
  }

  // minimap
  const mini = minimapCssRect();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const mx = mini.x * dpr;
  const my = mini.y * dpr;
  const ms = mini.size * dpr;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(mx, my, ms, ms);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.strokeRect(mx, my, ms, ms);
  const sx = ms / WORLD.w;
  const sy = ms / WORLD.h;
  const mapPoint = (wx,wy)=>({ x: mx + wx*sx, y: my + wy*sy });

  const baseP = mapPoint(WORLD.base.x, WORLD.base.y);
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillRect(baseP.x, baseP.y, WORLD.base.w*sx, WORLD.base.h*sy);

  const wildP = mapPoint(WORLD.wild.x, WORLD.wild.y);
  ctx.fillStyle = "rgba(255,80,80,0.2)";
  ctx.fillRect(wildP.x, wildP.y, WORLD.wild.w*sx, WORLD.wild.h*sy);

  const playerP = mapPoint(S.player.x, S.player.y);
  ctx.fillStyle = "rgba(120,255,170,0.9)";
  ctx.beginPath(); ctx.arc(playerP.x, playerP.y, 3*dpr, 0, Math.PI*2); ctx.fill();

  if(minimapExpanded){
    const baseCx = WORLD.base.x + WORLD.base.w*0.5;
    const baseCy = WORLD.base.y + WORLD.base.h*0.5;
    const dist = Math.hypot(S.player.x - baseCx, S.player.y - baseCy);
    if(dist > 200){
      const dx = baseCx - S.player.x;
      const dy = baseCy - S.player.y;
      const len = Math.hypot(dx, dy) || 1;
      const ax = playerP.x + (dx/len) * 12 * dpr;
      const ay = playerP.y + (dy/len) * 12 * dpr;
      ctx.strokeStyle = "rgba(120,255,170,0.9)";
      ctx.lineWidth = 2 * dpr;
      ctx.beginPath();
      ctx.moveTo(playerP.x, playerP.y);
      ctx.lineTo(ax, ay);
      ctx.stroke();
      ctx.fillStyle = "rgba(120,255,170,0.9)";
      ctx.beginPath();
      ctx.arc(ax, ay, 2*dpr, 0, Math.PI*2);
      ctx.fill();

      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = `${12*dpr}px Rajdhani, system-ui`;
      ctx.fillText(`${Math.round(dist)}m`, mx + 8*dpr, my + ms - 8*dpr);
    }
  }
  ctx.restore();

  // player
  const pp = worldToScreen(S.player.x, S.player.y);
  ctx.fillStyle = sellZoneActive() ? "rgba(120,255,170,0.95)" : "rgba(255,255,255,0.85)";
  ctx.beginPath(); ctx.arc(pp.x, pp.y, 10, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle="rgba(0,0,0,0.55)"; ctx.lineWidth=2; ctx.stroke();
  ctx.lineWidth=1;

  ctx.font="700 12px Rajdhani, system-ui";
  ctx.fillStyle="rgba(255,255,255,0.70)";
  if(inRect(S.player.x, S.player.y, WORLD.shop)) ctx.fillText("Open pause menu to access Shop", pp.x+14, pp.y-14);
  if(sellZoneActive()) ctx.fillText("Open pause menu to access Sell Area", pp.x+14, pp.y+2);
  if(nearestOre()) ctx.fillText("Press mine key to mine ore", pp.x+14, pp.y+18);
  else if(nearestTree()) ctx.fillText("Press mine key to chop wood", pp.x+14, pp.y+18);
}

/* Inventory UI */
const invUI = new InventoryUI({
  hotbarEl: el.inv.hotbar,
  invEl: el.inv.bag,
  onChange: ()=>{},
  onStatus: (t)=> setSideStatus(t)
});
invUI.bind(S.inventory);

/* Shop UI */
const shopUI = new ShopUI({
  openModal: { open:(o)=>modal.open(o), close:()=>modal.close(), refresh:()=>modal.refresh() },
  toast,
  onEnterPlacement: (id)=>enterPlacement(id),
  onStateChanged: ()=>{ invUI.render(); renderResources(); },
  getS: ()=>S
});

/* ===== SELL UI (0.7) ===== */
const SELL_SLOT_COUNT = 15;
let sellTray = Array(SELL_SLOT_COUNT).fill(null);

const isStackable = (slot)=>{
  if(!slot) return false;
  const def = ITEMS[slot.id];
  return !!def?.stack;
};
const itemValue = (id)=>{
  const def = ITEMS[id];
  return Math.max(0, Math.floor(clampN(def?.value, 0)));
};
const trayTotal = ()=>{
  let total = 0;
  for(const s of sellTray){
    if(!s) continue;
    const v = itemValue(s.id);
    const qty = isStackable(s) ? (s.qty||1) : 1;
    total += v * qty;
  }
  total = Math.floor(total * (S.upgrades.moneyMult||1));
  return total;
};

function clearSellTray(){ sellTray = Array(SELL_SLOT_COUNT).fill(null); }

function slotClone(s){
  if(!s) return null;
  return JSON.parse(JSON.stringify(s));
}

function takeFromInv(where, idx, amount){
  const arr = (where==="hotbar") ? S.inventory.hotbar : S.inventory.inv;
  const slot = arr[idx];
  if(!slot) return null;
  const def = ITEMS[slot.id];
  if(!def) return null;

  if(def.stack){
    const max = Math.max(1, Math.floor(amount||slot.qty||1));
    const take = Math.min(slot.qty||1, max);
    const out = { id: slot.id, qty: take };
    slot.qty = (slot.qty||1) - take;
    if(slot.qty<=0) arr[idx] = null;
    return out;
  }
  // non-stack: ignore amount
  arr[idx] = null;
  return { id: slot.id, qty: 1, dur: slot.dur };
}

function placeIntoSellTray(trayIdx, item){
  if(!item) return false;
  const dst = sellTray[trayIdx];
  if(!dst){
    sellTray[trayIdx] = item;
    return true;
  }
  // stack merge if same id
  if(isStackable(dst) && isStackable(item) && dst.id === item.id){
    dst.qty = Math.min(9999, (dst.qty||1) + (item.qty||1));
    return true;
  }
  // swap not allowed here (keep simple)
  return false;
}

function returnTrayItemToInventory(trayIdx){
  const slot = sellTray[trayIdx];
  if(!slot) return;
  const moved = addItem(S.inventory, makeItem(slot.id, slot.qty||1));
  if(moved) sellTray[trayIdx] = null;
}

function openAmountPicker({ maxQty, onPick }){
  const body = document.createElement("div");
  body.innerHTML = `
    <div class="card sharp">
      <div class="cardTitle">Choose amount</div>
      <div class="smallmuted">Max available: <b>${fmtI(maxQty)}</b></div>
      <div class="row" style="margin-top:10px;">
        <button class="btn sharp small primary" id="pickAll">ALL</button>
        <button class="btn sharp small" id="pickHalf">SPLIT</button>
      </div>
      <div style="margin-top:10px;">
        <input class="input sharp" id="pickCustom" type="number" min="1" max="${maxQty}" value="${Math.max(1, Math.floor(maxQty/2))}" />
      </div>
      <div class="row">
        <button class="btn sharp small primary" id="pickOk">OK</button>
        <button class="btn sharp small" id="pickCancel">CANCEL</button>
      </div>
    </div>
  `;

  const close = ()=>miniPopup.close();

  body.querySelector("#pickAll").addEventListener("click", ()=>{ onPick(maxQty); close(); });
  body.querySelector("#pickHalf").addEventListener("click", ()=>{ onPick(Math.max(1, Math.floor(maxQty/2))); close(); });
  body.querySelector("#pickCancel").addEventListener("click", ()=>close());
  body.querySelector("#pickOk").addEventListener("click", ()=>{
    const v = Math.max(1, Math.min(maxQty, Math.floor(clampN(body.querySelector("#pickCustom").value, 1))));
    onPick(v);
    close();
  });

  miniPopup.open({
    title: "Select Amount",
    bodyNode: body,
    buttons: []
  });
}

function renderSellSlot(elSlot, slot, rarityClass){
  elSlot.className = `slot ${rarityClass||"r-common"}`;
  elSlot.innerHTML = "";
  if(slot){
    const def = ITEMS[slot.id];
    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `
      <div class="name">${def?.name || slot.id}</div>
      <div class="icon">${def?.icon || "❓"}</div>
      ${def?.stack ? `<div class="qty">x${fmtI(slot.qty||1)}</div>` : ``}
    `;
    elSlot.appendChild(item);
  }
}

function rarityClass(id){
  const r = ITEMS[id]?.rarity || "Common";
  const map = {
    Common:"r-common", Uncommon:"r-uncommon", Rare:"r-rare", Epic:"r-epic",
    Legendary:"r-legendary", Mythic:"r-mythic", Exotic:"r-exotic"
  };
  return map[r] || "r-common";
}

function openSellArea(){
  clearSellTray();

  const body = document.createElement("div");
  body.innerHTML = `
    <div class="card sharp">
      <div class="cardTitle">Sell Area</div>
      <div class="smallmuted">
        Drag items into the Sell Tray. Total updates instantly. Selling converts items into money.
      </div>
    </div>

    <div class="sellRow">
      <div class="card sharp">
        <div class="sellPanelTitle">Your Inventory</div>
        <div class="smallmuted">Hotbar</div>
        <div class="slots hotbar" id="sellHotbar"></div>
        <div class="smallmuted" style="margin-top:10px;">Backpack</div>
        <div class="slots inv" id="sellBag"></div>
      </div>

      <div class="card sharp">
        <div class="sellPanelTitle">Sell Tray</div>
        <div class="slots sell" id="sellTray"></div>

        <div class="sellTotals">
          <div>Total</div>
          <b id="sellTotal">$0</b>
        </div>

        <div class="row" style="margin-top:10px;">
          <button class="btn sharp primary" id="btnDoSell" type="button">SELL</button>
          <button class="btn sharp" id="btnClearSell" type="button">CLEAR</button>
        </div>

        <div class="smallmuted" style="margin-top:10px;">
          Tip: For stack items, you can choose ALL / SPLIT / CUSTOM amount when dragging.
        </div>
      </div>
    </div>
  `;

  const hotEl = body.querySelector("#sellHotbar");
  const bagEl = body.querySelector("#sellBag");
  const trayEl = body.querySelector("#sellTray");
  const totalEl = body.querySelector("#sellTotal");
  const btnSell = body.querySelector("#btnDoSell");
  const btnClear = body.querySelector("#btnClearSell");

  const rerender = ()=>{
    hotEl.innerHTML = "";
    for(let i=0;i<5;i++){
      const s = S.inventory.hotbar[i];
      const d = document.createElement("div");
      renderSellSlot(d, s, s?rarityClass(s.id):"r-common");
      d.dataset.where="hotbar"; d.dataset.idx=String(i);
      hotEl.appendChild(d);
    }

    bagEl.innerHTML = "";
    for(let i=0;i<S.inventory.inv.length;i++){
      const s = S.inventory.inv[i];
      const d = document.createElement("div");
      renderSellSlot(d, s, s?rarityClass(s.id):"r-common");
      d.dataset.where="inv"; d.dataset.idx=String(i);
      bagEl.appendChild(d);
    }

    trayEl.innerHTML = "";
    for(let i=0;i<SELL_SLOT_COUNT;i++){
      const s = sellTray[i];
      const d = document.createElement("div");
      renderSellSlot(d, s, s?rarityClass(s.id):"r-common");
      d.dataset.tray="1"; d.dataset.idx=String(i);
      trayEl.appendChild(d);
    }

    totalEl.textContent = `$${fmtI(trayTotal())}`;
  };

  // Drag system (simple pointer “grab”)
  let drag = null;

  const startDragFromInv = (where, idx, clientX, clientY)=>{
    const arr = (where==="hotbar") ? S.inventory.hotbar : S.inventory.inv;
    const src = arr[idx];
    if(!src) return;

    const def = ITEMS[src.id];
    if(!def) return;

    const begin = (takeQty)=>{
      const taken = takeFromInv(where, idx, takeQty);
      if(!taken) return;

      drag = {
        item: taken,
        ghost: createGhost(taken, clientX, clientY)
      };
      rerender();
    };

    if(def.stack && (src.qty||1) > 1){
      openAmountPicker({
        maxQty: src.qty||1,
        onPick: (q)=>begin(q)
      });
      return;
    }
    begin(1);
  };

  const startDragFromTray = (trayIdx, clientX, clientY)=>{
    const src = sellTray[trayIdx];
    if(!src) return;
    sellTray[trayIdx] = null;
    drag = { item: src, ghost: createGhost(src, clientX, clientY), fromTray: trayIdx };
    rerender();
  };

  const endDrag = (clientX, clientY)=>{
    if(!drag) return;
    const hit = document.elementFromPoint(clientX, clientY);
    const traySlot = hit?.closest?.("[data-tray='1']");
    const invSlot = hit?.closest?.("[data-where]");

    if(traySlot){
      const idx = Number(traySlot.dataset.idx);
      const ok = placeIntoSellTray(idx, drag.item);
      if(!ok){
        // couldn't place -> return to inventory
        addItem(S.inventory, makeItem(drag.item.id, drag.item.qty||1));
      }
      drag.ghost.remove();
      drag=null;
      rerender();
      return;
    }

    if(invSlot){
      // return into inventory by dropping back
      addItem(S.inventory, makeItem(drag.item.id, drag.item.qty||1));
      drag.ghost.remove();
      drag=null;
      rerender();
      return;
    }

    // drop nowhere -> return to inventory
    addItem(S.inventory, makeItem(drag.item.id, drag.item.qty||1));
    drag.ghost.remove();
    drag=null;
    rerender();
  };

  const onMove = (e)=>{
    if(!drag) return;
    e.preventDefault();
    drag.ghost.style.left = e.clientX + "px";
    drag.ghost.style.top = e.clientY + "px";
  };

  const onUp = (e)=>{
    if(!drag) return;
    e.preventDefault();
    window.removeEventListener("pointermove", onMove, { passive:false });
    window.removeEventListener("pointerup", onUp, { passive:false });
    endDrag(e.clientX, e.clientY);
  };

  const wirePointer = (root)=>{
    root.addEventListener("pointerdown",(e)=>{
      const traySlot = e.target.closest?.("[data-tray='1']");
      const invSlot = e.target.closest?.("[data-where]");
      if(!traySlot && !invSlot) return;

      e.preventDefault();
      miniPopup.close();

      if(traySlot){
        startDragFromTray(Number(traySlot.dataset.idx), e.clientX, e.clientY);
      }else if(invSlot){
        startDragFromInv(invSlot.dataset.where, Number(invSlot.dataset.idx), e.clientX, e.clientY);
      }

      if(drag){
        window.addEventListener("pointermove", onMove, { passive:false });
        window.addEventListener("pointerup", onUp, { passive:false });
      }
    });
  };

  const createGhost = (slot, x, y)=>{
    const def = ITEMS[slot.id];
    const g = document.createElement("div");
    g.style.position="fixed";
    g.style.left = x + "px";
    g.style.top = y + "px";
    g.style.width="62px";
    g.style.height="62px";
    g.style.transform="translate(-50%,-50%)";
    g.style.zIndex="9999";
    g.style.pointerEvents="none";
    g.style.border="1px solid rgba(255,255,255,0.92)";
    g.style.background="#000";
    g.style.boxShadow="0 18px 50px rgba(0,0,0,0.65)";
    g.style.display="grid";
    g.style.placeItems="center";
    g.innerHTML = `<div style="font-family:Orbitron,Rajdhani,system-ui;font-size:22px;">${def?.icon||"❓"}</div>`;
    document.body.appendChild(g);
    return g;
  };

  // clicking tray slots returns items back to inventory (quick remove)
  trayEl?.addEventListener("dblclick",(e)=>{
    const t = e.target.closest?.("[data-tray='1']");
    if(!t) return;
    returnTrayItemToInventory(Number(t.dataset.idx));
    rerender();
  });

  btnClear.addEventListener("click", ()=>{
    // return all tray items to inv
    for(let i=0;i<sellTray.length;i++){
      if(sellTray[i]) returnTrayItemToInventory(i);
    }
    rerender();
  });

  btnSell.addEventListener("click", ()=>{
    const total = trayTotal();
    if(total<=0) return toast("Nothing to sell");

    // remove tray items permanently, add money
    S.resources.money = Math.floor(clampN(S.resources.money,0) + total);
    clearSellTray();
    rerender();
    renderResources();
    toast(`Sold items for $${fmtI(total)}`);
    setSideStatus("Sold items");
  });

  wirePointer(body);
  rerender();

  modal.open({
    title: "Sell Area",
    bodyNode: body,
    buttons: [
      { text:"CLOSE", onClick: ()=>modal.close() }
    ]
  });
}

/* Crafting */
const MATERIALS = ["ore_basic","ore_coal","ore_iron","ore_gold","ore_diamond"];
const craftLabel = (id)=> ITEMS[id]?.name || id;

function countItem(id){
  let count = 0;
  for(const arr of [S.inventory.hotbar, S.inventory.inv]){
    for(const slot of arr){
      if(!slot || slot.id !== id) continue;
      count += ITEMS[id]?.stack ? (slot.qty||1) : 1;
    }
  }
  return count;
}

function consumeItem(id, qty){
  let left = qty;
  for(const arr of [S.inventory.hotbar, S.inventory.inv]){
    for(let i=0;i<arr.length;i++){
      const slot = arr[i];
      if(!slot || slot.id !== id) continue;
      if(ITEMS[id]?.stack){
        const take = Math.min(left, slot.qty||1);
        slot.qty = (slot.qty||1) - take;
        left -= take;
        if(slot.qty<=0) arr[i] = null;
      } else {
        arr[i] = null;
        left -= 1;
      }
      if(left<=0) return true;
    }
  }
  return left<=0;
}

function openCraftingArea(){
  const body = document.createElement("div");
  const status = document.createElement("div");
  status.className = "smallmuted";
  status.textContent = "Select a recipe to craft. Crafting takes 3 seconds.";

  let crafting = false;

  const recipeRows = [];
  for(const mat of MATERIALS){
    recipeRows.push({ label: `${craftLabel(mat)} Sword`, result: `sword_${mat.split("_")[1]}`, mat, matQty:2, stickQty:1 });
    recipeRows.push({ label: `${craftLabel(mat)} Axe`, result: `axe_${mat.split("_")[1]}`, mat, matQty:3, stickQty:1 });
    recipeRows.push({ label: `${craftLabel(mat)} Pickaxe`, result: `pick_${mat.split("_")[1]}`, mat, matQty:5, stickQty:1 });
  }

  const renderRecipes = ()=>{
    body.innerHTML = `
      <div class="card sharp">
        <div class="cardTitle">Crafting Area</div>
        <div class="smallmuted">Use sticks + materials to craft tools.</div>
      </div>
      <div class="card sharp" style="margin-top:10px;">
        <div class="cardTitle">Stick Prep</div>
        <div class="smallmuted">Convert wood into sticks for crafting.</div>
        <div class="row" style="margin-top:8px;">
          <button class="btn sharp small" id="craftStick">CRAFT 1x STICK (4 WOOD)</button>
        </div>
      </div>
      <div class="card sharp" style="margin-top:10px;">
        <div class="cardTitle">Recipes</div>
        <div id="craftRows"></div>
      </div>
    `;
    body.appendChild(status);

    const rows = body.querySelector("#craftRows");
    rows.innerHTML = recipeRows.map((r, i)=>`
      <div style="display:flex; gap:10px; align-items:center; justify-content:space-between; border:1px solid rgba(255,255,255,0.10); background: rgba(255,255,255,0.02); padding:10px; margin-top:10px;">
        <div>
          <div style="font-family:Orbitron,Rajdhani,system-ui;text-transform:uppercase;letter-spacing:0.6px;font-size:12px;">${r.label}</div>
          <div class="smallmuted">Requires: 1x Stick + ${r.matQty}x ${craftLabel(r.mat)}</div>
        </div>
        <button class="btn sharp small primary" data-craft="${i}">CRAFT</button>
      </div>
    `).join("");
  };

  const beginCraft = (recipe)=>{
    if(crafting) return;
    const sticks = countItem("stick");
    const mats = countItem(recipe.mat);
    if(sticks < recipe.stickQty) return toast("Need sticks to craft");
    if(mats < recipe.matQty) return toast("Not enough materials");

    consumeItem("stick", recipe.stickQty);
    consumeItem(recipe.mat, recipe.matQty);
    invUI.render();

    crafting = true;
    status.textContent = `Crafting ${craftLabel(recipe.result)}...`;
    setTimeout(()=>{
      addItem(S.inventory, makeItem(recipe.result, 1));
      invUI.render();
      crafting = false;
      status.textContent = `${craftLabel(recipe.result)} crafted!`;
    }, 3000);
  };

  renderRecipes();
  body.addEventListener("click", (e)=>{
    if(e.target.id==="craftStick"){
      if(countItem("wood") < 4) return toast("Need 4 wood to craft a stick");
      consumeItem("wood", 4);
      addItem(S.inventory, makeItem("stick", 1));
      invUI.render();
      status.textContent = "Crafted 1 stick!";
      return;
    }
    const btn = e.target.closest("[data-craft]");
    if(!btn) return;
    const idx = Number(btn.dataset.craft);
    const recipe = recipeRows[idx];
    if(recipe) beginCraft(recipe);
  });

  modal.open({
    title: "Crafting Area",
    bodyNode: body,
    buttons: [{ text:"CLOSE", onClick: ()=>modal.close() }]
  });
}

/* Pause Menu (pauses because modal open => paused=true) */
function openPauseMenu(){
  const canSell = sellZoneActive();

  const body = document.createElement("div");
  body.innerHTML = `
    <div class="card sharp">
      <div class="cardTitle">Pause Menu</div>
      <div class="smallmuted">
        Mode: <b>${S.mode==="user"?"Logged In":"Guest"}</b> • Rebirths: <b>${S.rebirths.count}</b> • Mult: <b>x${S.rebirths.mult.toFixed(2)}</b>
      </div>
      <div class="smallmuted" style="margin-top:8px;">
        ${S.mode==="guest" ? "Guest progress is temporary. Login to save." : "Saving is enabled for your account."}
      </div>
    </div>

    <div class="card sharp" style="margin-top:10px;">
      <div class="cardTitle">Actions</div>
      <div class="row">
        <button class="btn sharp small primary" id="btnOpenShop">SHOP</button>
        <button class="btn sharp small ${canSell?"primary":""}" id="btnOpenSell" ${canSell?"":"disabled"}>SELL AREA</button>
        <button class="btn sharp small" id="btnOpenCrafting">CRAFTING</button>
        <button class="btn sharp small" id="btnMainMenu">MAIN MENU</button>
      </div>
      <div class="smallmuted" style="margin-top:8px;">
        ${canSell ? "Sell Area available because you are standing in the SELL zone." : "Go to the SELL zone to enable Sell Area."}
      </div>
    </div>

    <div class="card sharp" style="margin-top:10px;">
      <div class="cardTitle">Account</div>
      <div class="row">
        ${S.mode==="guest"
          ? `<button class="btn sharp small primary" id="btnPauseLogin">LOGIN TO SAVE</button>`
          : `<button class="btn sharp small" id="btnLogout">LOGOUT</button>`
        }
      </div>
    </div>
  `;

  body.addEventListener("click",(e)=>{
    if(e.target.id==="btnOpenShop"){ modal.close(); shopUI.open(); }
    if(e.target.id==="btnOpenSell"){ modal.close(); openSellArea(); }
    if(e.target.id==="btnOpenCrafting"){ modal.close(); openCraftingArea(); }
    if(e.target.id==="btnMainMenu"){ modal.close(); stopGameToMenu(); }
    if(e.target.id==="btnPauseLogin"){ modal.close(); showScreen(el.screens.login); }
    if(e.target.id==="btnLogout"){ modal.close(); doLogout(); }
  });

  modal.open({
    title:"Pause Menu",
    bodyNode: body,
    buttons:[ { text:"RESUME", kind:"primary", onClick:()=>modal.close() } ]
  });
}

/* Game Settings */
function openGameSettings(){
  const actions = [
    ["moveUp","Move Up"],["moveDown","Move Down"],["moveLeft","Move Left"],["moveRight","Move Right"],
    ["mine","Mine"],["attack","Attack"],["use","Use"],["pause","Pause"],
    ["hot1","Hotbar 1"],["hot2","Hotbar 2"],["hot3","Hotbar 3"],["hot4","Hotbar 4"],["hot5","Hotbar 5"]
  ];
  const body = document.createElement("div");
  const row = (key,label)=>`
    <div style="display:flex; gap:10px; align-items:center; justify-content:space-between; border:1px solid rgba(255,255,255,0.10); background: rgba(255,255,255,0.02); padding:10px; margin-top:10px;">
      <div>
        <div style="font-family:Orbitron,Rajdhani,system-ui;text-transform:uppercase;letter-spacing:0.6px;font-size:12px;">${label}</div>
        <div class="smallmuted">Current: <b>${S.hotkeys[key]}</b></div>
      </div>
      <button class="btn sharp small" data-bind="${key}">REBIND</button>
    </div>
  `;
  body.innerHTML = `
    <div class="card sharp">
      <div class="cardTitle">Game Settings</div>
      <div class="smallmuted">Settings are grouped by category.</div>
    </div>
    <div class="card sharp" style="margin-top:10px;">
      <div class="cardTitle">Display</div>
      <div class="smallmuted" style="margin-bottom:8px;">Visual helpers and overlays.</div>
      <div class="row">
        <button class="btn sharp small ${S.settings.showFps?"primary":""}" id="toggleFps">${S.settings.showFps?"FPS ON":"FPS OFF"}</button>
      </div>
    </div>
    <div class="card sharp" style="margin-top:10px;">
      <div class="cardTitle">Controls</div>
      <div class="smallmuted">Touch controls ${touchSupported ? "are enabled on touchscreen devices." : "are unavailable on this device."}</div>
    </div>
    <div class="card sharp" style="margin-top:10px;">
      <div class="cardTitle">Hotkeys</div>
      <div id="hkRows"></div>
      <div class="row" style="margin-top:10px;">
        <button class="btn sharp small" id="hkDefault">DEFAULT</button>
      </div>
    </div>
  `;
  body.querySelector("#hkRows").innerHTML = actions.map(([k,l])=>row(k,l)).join("");

  let waitingKey=null;
  const onKey=(e)=>{
    if(!waitingKey) return;
    e.preventDefault();
    S.hotkeys[waitingKey] = e.code;
    waitingKey=null;
    toast("Hotkey set");
    window.removeEventListener("keydown", onKey, { passive:false });
    modal.refresh();
  };

  body.addEventListener("click",(e)=>{
    const b = e.target.closest("button[data-bind]");
    if(b){
      waitingKey=b.dataset.bind;
      toast("Press a key…");
      window.addEventListener("keydown", onKey, { passive:false });
    }
    if(e.target.id==="toggleFps"){
      S.settings.showFps = !S.settings.showFps;
      modal.refresh();
    }
    if(e.target.id==="hkDefault"){
      S.hotkeys = defaultHotkeys();
      toast("Defaults applied");
      modal.refresh();
    }
  });

  modal.open({
    title:"Game Settings",
    bodyNode: body,
    buttons:[ { text:"CLOSE", onClick:()=>modal.close() } ],
    refreshable:true,
    onRefresh: ()=>openGameSettings()
  });
}

/* What's New */
function openWhatsNewModal(){
  const body = document.createElement("div");
  renderChangelog(body, "0.8");
  modal.open({ title:"What’s New", bodyNode: body, buttons:[{text:"CLOSE", onClick:()=>modal.close()}] });
}

/* Sidebar buttons */
el.sidebar.pause.addEventListener("click", ()=>openPauseMenu());
el.sidebar.whatsNew.addEventListener("click", ()=>openWhatsNewModal());
el.sidebar.gameSettings.addEventListener("click", ()=>openGameSettings());

/* Pointer placement */
el.canvas.addEventListener("pointermove",(e)=>{
  const rect = el.canvas.getBoundingClientRect();
  const sx = (e.clientX - rect.left) * (el.canvas.width/rect.width);
  const sy = (e.clientY - rect.top) * (el.canvas.height/rect.height);
  lastMouseWorld = screenToWorld(sx, sy);
});
el.canvas.addEventListener("pointerdown",(e)=>{
  const rect = el.canvas.getBoundingClientRect();
  const cssX = e.clientX - rect.left;
  const cssY = e.clientY - rect.top;
  const mini = minimapCssRect();
  if(cssX >= mini.x && cssX <= mini.x + mini.size && cssY >= mini.y && cssY <= mini.y + mini.size){
    minimapExpanded = !minimapExpanded;
    return;
  }
  if(!placementMode) return;
  e.preventDefault();
  if(!lastMouseWorld) return;
  placeBuildingAt(lastMouseWorld.x, lastMouseWorld.y);
});

/* Disable highlight/drag */
window.addEventListener("selectstart",(e)=>e.preventDefault());
window.addEventListener("dragstart",(e)=>e.preventDefault());
document.addEventListener("visibilitychange", ()=>{
  tabPaused = document.hidden;
  if(tabPaused && isRunning) setSideStatus("Paused (tab inactive)");
});
window.addEventListener("blur", ()=>{
  tabPaused = true;
  if(isRunning) setSideStatus("Paused (tab inactive)");
});
window.addEventListener("focus", ()=>{
  tabPaused = false;
});

/* Saving (cloud) */
let saveTimer=null;
let cloudEnabled=true;

async function cloudSave(){
  if(S.mode!=="user" || !db || !S.uid || !cloudEnabled) return;
  S.lastSaveAt = now();
  S.lastOnlineAt = now();
  try{
    const data = {
      version: S.version,
      lastSaveAt: S.lastSaveAt,
      lastOnlineAt: S.lastOnlineAt,
      resources: S.resources,
      inventory: S.inventory,
      player: S.player,
      buildings: S.buildings,
      upgrades: S.upgrades,
      rebirths: S.rebirths,
      wheel: S.wheel,
      daily: S.daily,
      weekly: S.weekly,
      offline: S.offline,
      hotkeys: S.hotkeys,
      settings: S.settings
    };
    await dbSet(path.userSave(S.uid), data);
  }catch(e){
    if(isPerm(e)){
      cloudEnabled=false;
      showError(403,"FORBIDDEN","Saving blocked by database rules.", `RTDB: ${RTDB_REF}`);
      stopSaving();
      return;
    }
    const m = mapAuthError(e);
    showError(m.code, m.title, "Saving failed. Try again.", "");
  }
}
function startSaving(){
  stopSaving();
  if(S.mode!=="user" || !cloudEnabled) return;
  saveTimer = setInterval(()=>cloudSave(), 20000);
}
function stopSaving(){
  if(saveTimer){ clearInterval(saveTimer); saveTimer=null; }
}

async function loadCloud(uid){
  if(!db) return null;
  const data = await dbGet(path.userSave(uid));
  return data ? sanitizeLoadedState(data) : null;
}

/* Run loop */
function startGame(){
  showScreen(el.screens.game);
  isRunning=true;
  resizeCanvas();
  updateTouchVisibility();

  ores=[]; trees=[]; enemies=[]; pickups=[];
  ensureOreCaps(); ensureTreeCaps(); ensureEnemies();
  dropperRuntime = new WeakMap();
  collectorRuntime = 0;

  S.baseX = WORLD.base.x;
  S.baseY = WORLD.base.y;

  if(!Number.isFinite(S.player.x) || !Number.isFinite(S.player.y) || (S.player.x===0 && S.player.y===0)){
    resetPlayerToBase();
  }

  if(!S.inventory.hotbar.some(Boolean) && !S.inventory.inv.some(Boolean)){
    addItem(S.inventory, makeItem("pick_basic",1));
    addItem(S.inventory, makeItem("sword_basic",1));
    addItem(S.inventory, makeItem("axe_basic",1));
    invUI.render();
  }

  S.rebirths.mult = rebirthMultiplier(S.rebirths.count);
  renderResources();
  renderHud();
  setProfileChip();

  setSideStatus("Ready");
  setSideHint("Move: WASD/Arrows • Mine: E • Attack: Space • Use: Q");
  el.sidebar.saveMode.textContent = (S.mode==="user") ? "Save: ON" : "Guest Mode: no saving";

  startSaving();
  requestAnimationFrame(loop);
}

function stopGameToMenu(){
  isRunning=false;
  placementMode=null;
  stopSaving();
  modal.close();
  showScreen(el.screens.menu);
  updateTouchVisibility();
  setMenuAuthUI(auth?.currentUser || null);
}

function loop(t){
  if(!isRunning) return;
  const rawDt = Math.min(0.033, ((t - lastFrame) / 1000) || 0);
  lastFrame = t;
  const dt = (paused || tabPaused) ? 0 : rawDt;
  fpsAcc += rawDt;
  fpsFrames += 1;
  if(fpsAcc >= 0.5){
    fpsValue = Math.round(fpsFrames / fpsAcc);
    fpsAcc = 0;
    fpsFrames = 0;
  }
  if(el.fpsCounter){
    el.fpsCounter.hidden = !S.settings.showFps || !isRunning;
    el.fpsCounter.textContent = `FPS: ${fpsValue || 0}`;
  }

  if(dt>0){
    updateOres();
    updateTrees();
    updateDroppers(dt);
    updateEnemies(dt);
    updateConsumableSpawns(dt);
    updatePickups(dt);
    collectPickups();
    updateShieldRegen(dt);
    move(dt);
  }

  if(inRect(S.player.x, S.player.y, WORLD.shop)) setSideHint("Shop available from pause menu");
  else if(sellZoneActive()) setSideHint("Sell Area available from pause menu");
  else setSideHint("Move: WASD/Arrows • Mine: E • Attack: Space • Use: Q • Pause: Esc");

  draw();
  renderHud();
  requestAnimationFrame(loop);
}

/* Key handling */
window.addEventListener("keydown",(e)=>{
  keys[e.code]=true;
  if(e.code==="Space") e.preventDefault();
  if(!isRunning) return;

  if(e.code==="Escape" && placementMode){ cancelPlacement(); return; }

  const hk = S.hotkeys;
  if(e.code===hk.pause){ e.preventDefault(); openPauseMenu(); }
  if(paused || tabPaused) return;

  if(e.code===hk.mine){ e.preventDefault(); mineOre(); }
  if(e.code===hk.attack){ e.preventDefault(); attack(); }
  if(e.code===hk.use){ e.preventDefault(); useSelected(); }

  if(e.code===hk.hot1) invUI.selectHotbar(0);
  if(e.code===hk.hot2) invUI.selectHotbar(1);
  if(e.code===hk.hot3) invUI.selectHotbar(2);
  if(e.code===hk.hot4) invUI.selectHotbar(3);
  if(e.code===hk.hot5) invUI.selectHotbar(4);
},{passive:false});
window.addEventListener("keyup",(e)=>{ keys[e.code]=false; });

window.addEventListener("beforeunload", ()=>{ if(S.mode==="user") cloudSave(); });

/* Menu actions */
el.menu.playGuest.addEventListener("click", ()=>{
  if(auth?.currentUser) startGame();
  else{
    S = defaultState();
    S.mode="guest";
    invUI.bind(S.inventory);
    renderResources();
    renderHud();
    setProfileChip();
    startGame();
  }
});
el.menu.goLogin.addEventListener("click", ()=>showScreen(el.screens.login));
el.menu.goRegister.addEventListener("click", ()=>showScreen(el.screens.register));

el.menu.whatsNew.addEventListener("click", ()=>{
  renderChangelog(el.whatsNewRoot, "0.8");
  showScreen(el.screens.whatsNew);
});
el.btnWhatsNewBack?.addEventListener("click", ()=>showScreen(el.screens.menu));

el.menu.how.addEventListener("click", ()=>{
  modal.open({
    title:"How To Play",
    bodyHTML: `
      <div class="card sharp">
        <div class="cardTitle">Basics</div>
        <ul class="list">
          <li>Move around (WASD/Arrows).</li>
          <li>Mine ores in WILD (Mine key).</li>
          <li>Stand in the SELL zone and open pause menu to access Sell Area.</li>
          <li>Buy buildings in BASE (Pause → Shop). Some droppers add items directly; others drop pickups that can be collected.</li>
        </ul>
      </div>
    `,
    buttons:[ {text:"CLOSE", onClick:()=>modal.close()} ]
  });
});
el.menu.settings.addEventListener("click", ()=>openGameSettings());

/* Quick confirm login form */
el.menu.quickForm.addEventListener("submit", async (e)=>{
  e.preventDefault();
  try{
    const last = getLastUser();
    const pass = el.menu.quickPass.value;
    const user = await loginEmailPass(last.emailOrUser, pass, true);
    toast("Logged in");
    showScreen(el.screens.menu);
  }catch(err){
    const m = mapAuthError(err);
    showError(m.code, m.title, m.desc, "");
  }
});
el.menu.notMe.addEventListener("click", ()=>{
  clearLastUser();
  el.menu.confirmUser.hidden = true;
});

/* Login form */
el.login.form.addEventListener("submit", async (e)=>{
  e.preventDefault();
  try{
    await loginEmailPass(el.login.email.value, el.login.pass.value, el.login.remember.checked);
    toast("Logged in");
    showScreen(el.screens.menu);
  }catch(err){
    const m = mapAuthError(err);
    if(String(err?.message||"").includes("username_lookup_unavailable")){
      showError(403,"FORBIDDEN","Username login unavailable. Use email.", `RTDB: ${RTDB_REF}`);
    } else {
      showError(m.code, m.title, m.desc, "");
    }
  }
});
el.login.google.addEventListener("click", async ()=>{
  try{
    await loginGoogle();
    toast("Logged in");
    showScreen(el.screens.menu);
  }catch(e){
    const m = mapAuthError(e);
    showError(m.code, m.title, m.desc, "");
  }
});
el.login.toReg.addEventListener("click", ()=>showScreen(el.screens.register));
el.login.back.addEventListener("click", ()=>showScreen(el.screens.menu));
el.login.forgot.addEventListener("click", ()=>resetPasswordFlow());

/* Register */
wireRegisterMeters();
el.reg.form.addEventListener("submit", async (e)=>{
  e.preventDefault();
  try{
    const u = await registerEmailPass();
    if(!u) return;
    toast("Account created");
    showScreen(el.screens.menu);
  }catch(err){
    const m = mapAuthError(err);
    showError(m.code, m.title, m.desc, "");
  }
});
el.reg.google.addEventListener("click", async ()=>{
  try{
    await loginGoogle();
    toast("Signed in");
    showScreen(el.screens.menu);
  }catch(e){
    const m = mapAuthError(e);
    showError(m.code, m.title, m.desc, "");
  }
});
el.reg.toLogin.addEventListener("click", ()=>showScreen(el.screens.login));
el.reg.back.addEventListener("click", ()=>showScreen(el.screens.menu));

/* Terms / Privacy (long paragraphs) */
el.reg.terms.addEventListener("click", ()=>{
  modal.open({
    title:"Terms & Services",
    bodyHTML: `
      <div class="card sharp">
        <div class="cardTitle">Terms & Services</div>
        <div class="smallmuted" style="line-height:1.5;">
          By using this game, you agree to follow basic fair-use behavior and to avoid activities that disrupt or damage the experience for other users.
          You may not attempt to exploit, reverse engineer, automate, overload, or abuse any account systems, leaderboards, saves, or network features.
          The game is provided “as-is,” which means features may change, be removed, or be reset during development without notice.
          Progress, balances, inventory, and rewards may be adjusted to maintain stability, prevent abuse, or improve balance.
        </div>
        <div class="smallmuted" style="margin-top:10px; line-height:1.5;">
          You are responsible for keeping your login credentials secure. If you choose to remember your account on a shared device, you accept the risk that someone else could access your account.
          We may temporarily disable access to online services during maintenance, outages, or when suspicious activity is detected.
          You may not use the game to distribute harmful content, attempt unauthorized access, or interfere with authentication and saving mechanisms.
        </div>
        <div class="smallmuted" style="margin-top:10px; line-height:1.5;">
          If you do not agree with these terms, you should stop using the game. Continued use indicates acceptance of these terms.
          These terms may be updated as features evolve, and the newest version will apply going forward.
        </div>
      </div>
    `,
    buttons:[{text:"CLOSE", onClick:()=>modal.close()}]
  });
});
el.reg.privacy.addEventListener("click", ()=>{
  modal.open({
    title:"Privacy Policy",
    bodyHTML: `
      <div class="card sharp">
        <div class="cardTitle">Privacy Policy</div>
        <div class="smallmuted" style="line-height:1.5;">
          This game may store gameplay progress and account-related data in order to provide saving and login features.
          When you sign in, the service may store a limited profile (such as a username and email) and your current progress state (money, inventory, upgrades, and position).
          Guest mode is designed to be temporary and may not persist between sessions.
        </div>
        <div class="smallmuted" style="margin-top:10px; line-height:1.5;">
          We do not intentionally collect sensitive personal information beyond what is needed for account access.
          Data is used to support features like saving, restoring progress, and maintaining account integrity.
          You should avoid sharing private information in usernames or any text fields.
        </div>
        <div class="smallmuted" style="margin-top:10px; line-height:1.5;">
          You may request deletion of your stored progress by deleting your account or by choosing to stop using online services.
          Network services can experience outages; during these events, saving or loading may be temporarily unavailable.
        </div>
      </div>
    `,
    buttons:[{text:"CLOSE", onClick:()=>modal.close()}]
  });
});

/* Logout */
async function doLogout(){
  try{ await cloudSave(); }catch{}
  try{ await signOut(auth); }catch{}
  S = defaultState();
  S.mode="guest";
  cloudEnabled=true;
  invUI.bind(S.inventory);
  renderResources();
  renderHud();
  setProfileChip();
  stopGameToMenu();
}

/* Auth listener */
if(auth){
  onAuthStateChanged(auth, async (user)=>{
    setMenuAuthUI(user);
    if(user){
      try{
        cloudEnabled=true;
        await ensureOreClickerRoot();
        await ensureUserRecords(user);
        const loaded = await loadCloud(user.uid);
        S = loaded ? loaded : defaultState();
        S.mode="user";
        S.uid=user.uid;
        S.email=user.email || null;
        S.username = user.displayName || S.username || null;
        S.rebirths.mult = rebirthMultiplier(S.rebirths.count);
        invUI.bind(S.inventory);
        renderResources();
        renderHud();
        setProfileChip();
        setLastUser(S.username || S.email || "user");
      }catch(e){
        const m = mapAuthError(e);
        showError(m.code, m.title, "Loading failed. You can still play as guest.", `RTDB: ${RTDB_REF}`);
      }
    } else {
      // logged out
      setProfileChip();
    }
  });
}

/* Boot */
function boot(){
  hideError();
  showScreen(el.screens.loading);
  wirePasswordToggles();
  let p=0;
  const step=()=>{
    p=Math.min(100, p + 7 + Math.random()*10);
    el.loadingBar.style.width = `${p}%`;
    if(p<100) requestAnimationFrame(step);
    else{
      showScreen(el.screens.menu);
      setMenuAuthUI(auth?.currentUser || null);
      const last = getLastUser();
      if(!auth?.currentUser && last?.emailOrUser){
        el.menu.confirmUser.hidden = false;
        el.menu.lastUserLabel.textContent = last.emailOrUser;
      }
    }
  };
  setTimeout(()=>requestAnimationFrame(step), 220);
}
boot();
