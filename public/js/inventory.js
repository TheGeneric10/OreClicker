export const RARITY_CLASS = {
    Common: "r-common",
    Uncommon: "r-uncommon",
    Rare: "r-rare",
    Epic: "r-epic",
    Legendary: "r-legendary",
    Mythic: "r-mythic",
    Exotic: "r-exotic"
  };
  
export const ITEMS = {
    ore_basic:   { id:"ore_basic",   name:"Basic Ore",   rarity:"Common",   type:"ore",        icon:"🪨", stack:true,  value:1 },
    ore_coal:    { id:"ore_coal",    name:"Coal Ore",    rarity:"Uncommon", type:"ore",        icon:"⚫", stack:true,  value:3 },
    ore_iron:    { id:"ore_iron",    name:"Iron Ore",    rarity:"Rare",     type:"ore",        icon:"⛓️", stack:true,  value:6 },
    ore_gold:    { id:"ore_gold",    name:"Gold Ore",    rarity:"Epic",     type:"ore",        icon:"🟡", stack:true,  value:12 },
    ore_diamond: { id:"ore_diamond", name:"Diamond Ore", rarity:"Epic",     type:"ore",        icon:"💎", stack:true,  value:25 },

    wood:        { id:"wood",        name:"Wood",        rarity:"Common",   type:"material",   icon:"🪵", stack:true,  value:2 },
    stick:       { id:"stick",       name:"Stick",       rarity:"Common",   type:"material",   icon:"🪄", stack:true,  value:1 },

    sword_basic:   { id:"sword_basic",   name:"Basic Sword",   rarity:"Common",   type:"melee", icon:"🗡️", stack:false, maxDur:60,  atk:2 },
    sword_coal:    { id:"sword_coal",    name:"Coal Sword",    rarity:"Common",   type:"melee", icon:"🗡️", stack:false, maxDur:80,  atk:3 },
    sword_iron:    { id:"sword_iron",    name:"Iron Sword",    rarity:"Uncommon", type:"melee", icon:"🗡️", stack:false, maxDur:110, atk:4 },
    sword_gold:    { id:"sword_gold",    name:"Gold Sword",    rarity:"Rare",     type:"melee", icon:"🗡️", stack:false, maxDur:150, atk:6 },
    sword_diamond: { id:"sword_diamond", name:"Diamond Sword", rarity:"Epic",     type:"melee", icon:"🗡️", stack:false, maxDur:220, atk:9 },

    pick_basic:    { id:"pick_basic",    name:"Basic Pickaxe", rarity:"Common",   type:"tool",  icon:"⛏️", stack:false, maxDur:90,  mine:1 },
    pick_coal:     { id:"pick_coal",     name:"Coal Pickaxe",  rarity:"Common",   type:"tool",  icon:"⛏️", stack:false, maxDur:120, mine:2 },
    pick_iron:     { id:"pick_iron",     name:"Iron Pickaxe",  rarity:"Uncommon", type:"tool",  icon:"⛏️", stack:false, maxDur:160, mine:2 },
    pick_gold:     { id:"pick_gold",     name:"Gold Pickaxe",  rarity:"Rare",     type:"tool",  icon:"⛏️", stack:false, maxDur:210, mine:3 },
    pick_diamond:  { id:"pick_diamond",  name:"Diamond Pickaxe",rarity:"Epic",    type:"tool",  icon:"⛏️", stack:false, maxDur:260, mine:3 },

    axe_basic:     { id:"axe_basic",     name:"Basic Axe",     rarity:"Common",   type:"axe",   icon:"🪓", stack:false, maxDur:80,  atk:2, chop:2 },
    axe_coal:      { id:"axe_coal",      name:"Coal Axe",      rarity:"Common",   type:"axe",   icon:"🪓", stack:false, maxDur:110, atk:3, chop:3 },
    axe_iron:      { id:"axe_iron",      name:"Iron Axe",      rarity:"Uncommon", type:"axe",   icon:"🪓", stack:false, maxDur:150, atk:4, chop:4 },
    axe_gold:      { id:"axe_gold",      name:"Gold Axe",      rarity:"Rare",     type:"axe",   icon:"🪓", stack:false, maxDur:200, atk:5, chop:5 },
    axe_diamond:   { id:"axe_diamond",   name:"Diamond Axe",   rarity:"Epic",     type:"axe",   icon:"🪓", stack:false, maxDur:260, atk:7, chop:6 },

    cons_medkit:   { id:"cons_medkit",   name:"Medkit",        rarity:"Rare",     type:"consumable", icon:"🧰", stack:true, healHp:75 },
    cons_shield:   { id:"cons_shield",   name:"Shield Potion", rarity:"Uncommon", type:"consumable", icon:"🧪", stack:true, addShield:25 },
  };
  
  const clampN = (n,f=0)=>Number.isFinite(Number(n))?Number(n):f;
  const fmtI = (n)=>Math.floor(clampN(n,0)).toLocaleString();
  
  export function makeItem(id, qty=1){
    const it = ITEMS[id];
    if(!it) return null;
    if(it.stack) return { id, qty: Math.max(1, Math.floor(qty)) };
    return { id, qty:1, dur: it.maxDur ?? 100 };
  }
  
  export function sanitizeSlot(slot){
    if(!slot || typeof slot!=="object") return null;
    const id = String(slot.id||"");
    const it = ITEMS[id];
    if(!it) return null;
    if(it.stack){
      return { id, qty: Math.min(9999, Math.max(1, Math.floor(clampN(slot.qty,1)))) };
    }
    const max = it.maxDur ?? 100;
    return { id, qty:1, dur: Math.max(0, Math.min(max, Math.floor(clampN(slot.dur, max)))) };
  }
  
  export function invDefault(){
    return { hotbar: Array(5).fill(null), inv: Array(24).fill(null), selectedHotbar: 0 };
  }
  
  export function equipped(inv){
    const s = inv.hotbar[inv.selectedHotbar];
    return s ? { slot:s, def: ITEMS[s.id] } : null;
  }
  
  export function rarityClassOfSlot(slot){
    if(!slot) return RARITY_CLASS.Common;
    const it = ITEMS[slot.id];
    return RARITY_CLASS[it?.rarity||"Common"] || RARITY_CLASS.Common;
  }
  
  export function addItem(inv, item){
    if(!item) return false;
    const it = ITEMS[item.id];
    if(!it) return false;
  
    const canStack = (a,b)=>a&&b&&a.id===b.id && ITEMS[a.id]?.stack;
  
    if(it.stack){
      for(const arr of [inv.hotbar, inv.inv]){
        for(let i=0;i<arr.length;i++){
          if(canStack(arr[i], item)){
            arr[i].qty = Math.min(9999, arr[i].qty + item.qty);
            return true;
          }
        }
      }
    }
    for(const arr of [inv.inv, inv.hotbar]){
      for(let i=0;i<arr.length;i++){
        if(!arr[i]){ arr[i] = item; return true; }
      }
    }
    return false;
  }
  
  export class InventoryUI {
    constructor({ hotbarEl, invEl, onChange, onStatus }) {
      this.hotbarEl = hotbarEl;
      this.invEl = invEl;
      this.onChange = onChange;
      this.onStatus = onStatus;
      this.inv = null;
      this.drag = null;
    }
  
    bind(inv){ this.inv = inv; this.render(); this._wire(); }
    selectHotbar(i){ this.inv.selectedHotbar = Math.max(0, Math.min(4, i|0)); this.render(); this.onChange?.(); }
  
    render(){
      const mkSlot = (where, idx) => {
        const d = document.createElement("div");
        d.className = "slot " + rarityClassOfSlot(this._get(where, idx));
        d.dataset.where = where;
        d.dataset.idx = String(idx);
        d.setAttribute("draggable","false");
  
        const s = this._get(where, idx);
        if(s){
          const it = ITEMS[s.id];
          const item = document.createElement("div");
          item.className = "item";
          item.innerHTML = `
            <div class="name">${it?.name || s.id}</div>
            <div class="icon">${it?.icon || "❓"}</div>
            ${it?.stack ? `<div class="qty">x${fmtI(s.qty)}</div>` : ``}
          `;
          if(it && !it.stack && (it.type==="melee"||it.type==="tool"||it.type==="axe")){
            const max = it.maxDur ?? 100;
            const pct = Math.max(0, Math.min(1, (s.dur??max)/max));
            const dura = document.createElement("div");
            dura.className = "dura";
            const bar = document.createElement("i");
            bar.style.height = `${Math.round(pct*100)}%`;
            dura.appendChild(bar);
            d.appendChild(dura);
          }
          d.appendChild(item);
        }
  
        if(where==="hotbar" && this.inv.selectedHotbar===idx){
          d.style.outline = "2px solid rgba(255,255,255,0.92)";
          d.style.outlineOffset = "-2px";
        }
        return d;
      };
  
      this.hotbarEl.innerHTML="";
      this.invEl.innerHTML="";
      for(let i=0;i<5;i++) this.hotbarEl.appendChild(mkSlot("hotbar", i));
      for(let i=0;i<this.inv.inv.length;i++) this.invEl.appendChild(mkSlot("inv", i));
    }
  
    _wire(){
      if(this._wired) return;
      this._wired = true;
  
      const onDown = (e)=>{
        const slotEl = e.target.closest(".slot");
        if(!slotEl) return;
        e.preventDefault();
        const where = slotEl.dataset.where;
        const idx = Number(slotEl.dataset.idx);
        const item = this._get(where, idx);
        if(!item) return;
  
        this.drag = {
          fromWhere: where,
          fromIdx: idx,
          item: JSON.parse(JSON.stringify(item)),
          ghost: this._ghost(item, e.clientX, e.clientY)
        };
  
        this._set(where, idx, null);
        this.render();
        this.onStatus?.("Dragging…");
        this.onChange?.();
      };
  
      const onMove = (e)=>{
        if(!this.drag) return;
        e.preventDefault();
        this.drag.ghost.style.left = e.clientX + "px";
        this.drag.ghost.style.top = e.clientY + "px";
        this._clearDrop();
        const hit = this._slotFromPoint(e.clientX, e.clientY);
        if(hit) hit.el.classList.add("drop-ok");
      };
  
      const onUp = (e)=>{
        if(!this.drag) return;
        e.preventDefault();
        this._clearDrop();
        const hit = this._slotFromPoint(e.clientX, e.clientY);
  
        if(hit){
          const dst = this._get(hit.where, hit.idx);
          const src = this.drag.item;
          const canStack = (a,b)=>a&&b&&a.id===b.id && ITEMS[a.id]?.stack;
  
          if(dst && canStack(dst, src)){
            const space = 9999 - dst.qty;
            const moved = Math.min(space, src.qty);
            dst.qty += moved;
            src.qty -= moved;
            this._set(hit.where, hit.idx, dst);
            if(src.qty>0) this._set(this.drag.fromWhere, this.drag.fromIdx, src);
          } else {
            this._set(hit.where, hit.idx, src);
            if(dst) this._set(this.drag.fromWhere, this.drag.fromIdx, dst);
          }
        } else {
          this._set(this.drag.fromWhere, this.drag.fromIdx, this.drag.item);
        }
  
        this.drag.ghost.remove();
        this.drag = null;
        this.render();
        this.onStatus?.("Ready");
        this.onChange?.();
      };
  
      this.hotbarEl.addEventListener("pointerdown", onDown);
      this.invEl.addEventListener("pointerdown", onDown);
      window.addEventListener("pointermove", onMove, { passive:false });
      window.addEventListener("pointerup", onUp, { passive:false });
      window.addEventListener("dragstart", (e)=>e.preventDefault());
      window.addEventListener("contextmenu", (e)=>{ if(e.target.closest(".slot")) e.preventDefault(); });
    }
  
    _get(where, idx){ return (where==="hotbar"?this.inv.hotbar:this.inv.inv)[idx] || null; }
    _set(where, idx, val){ (where==="hotbar"?this.inv.hotbar:this.inv.inv)[idx] = val; }
  
    _slotFromPoint(x,y){
      const elAt = document.elementFromPoint(x,y);
      const slot = elAt && elAt.closest ? elAt.closest(".slot") : null;
      if(!slot) return null;
      return { el:slot, where:slot.dataset.where, idx:Number(slot.dataset.idx) };
    }
  
    _clearDrop(){
      document.querySelectorAll(".slot.drop-ok").forEach(s=>s.classList.remove("drop-ok"));
    }
  
    _ghost(slot, x, y){
      const it = ITEMS[slot.id];
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
      g.innerHTML = `<div style="font-family:Orbitron,Rajdhani,system-ui;font-size:22px;">${it?.icon||"❓"}</div>`;
      document.body.appendChild(g);
      return g;
    }
  }
  
