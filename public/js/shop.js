import { addItem, makeItem } from "./inventory.js";

const clampN=(n,f=0)=>Number.isFinite(Number(n))?Number(n):f;
const fmtI=(n)=>Math.floor(clampN(n,0)).toLocaleString();

export const BUILDINGS = {
  // DIRECT droppers (adds ore to inventory/resources)
  dropper_direct_basic: { id:"dropper_direct_basic", name:"Direct Basic Dropper", icon:"🏗️", desc:"Adds Basic Ore directly to your inventory over time.", cost: 50,  type:"dropper", dropType:"direct", oreId:"ore_basic", ratePerMin: 10 },
  dropper_direct_coal:  { id:"dropper_direct_coal",  name:"Direct Coal Dropper",  icon:"🏗️", desc:"Adds Coal Ore directly to your inventory over time.",  cost: 250, type:"dropper", dropType:"direct", oreId:"ore_coal",  ratePerMin: 6  },
  dropper_direct_iron:  { id:"dropper_direct_iron",  name:"Direct Iron Dropper",  icon:"🏗️", desc:"Adds Iron Ore directly to your inventory over time.",  cost: 650, type:"dropper", dropType:"direct", oreId:"ore_iron",  ratePerMin: 4  },

  // PHYSICAL droppers (spawns pickup items near the machine)
  dropper_phys_basic: { id:"dropper_phys_basic", name:"Physical Basic Dropper", icon:"📦", desc:"Drops Basic Ore on the ground. Collect it or use a Collector Pad.", cost: 120, type:"dropper", dropType:"physical", oreId:"ore_basic", ratePerMin: 12 },
  dropper_phys_coal:  { id:"dropper_phys_coal",  name:"Physical Coal Dropper",  icon:"📦", desc:"Drops Coal Ore on the ground. Collect it or use a Collector Pad.",  cost: 420, type:"dropper", dropType:"physical", oreId:"ore_coal",  ratePerMin: 7  },

  // Utility
  collector_pad: { id:"collector_pad", name:"Collector Pad", icon:"🧲", desc:"Collects nearby dropped items automatically.", cost: 300, type:"utility" },
  seller_pad:    { id:"seller_pad",    name:"Seller Pad",    icon:"💰", desc:"Stand on SELL zone to sell by time. Seller pads help collectors chain better.", cost: 150, type:"utility" },
};

export const UPGRADES = {
  sell_speed_1: { id:"sell_speed_1", name:"Sell Speed I", icon:"⚡", desc:"Sell timer faster (+10%).", cost: 400, apply:(S)=>{ S.upgrades.sellSpeed = (S.upgrades.sellSpeed||1) * 1.10; } },
  dropper_rate_1:{ id:"dropper_rate_1",name:"Dropper Rate I",icon:"⚙️", desc:"+20% dropper output", cost: 600, apply:(S)=>{ S.upgrades.dropperRate = (S.upgrades.dropperRate||1) * 1.20; } },
  money_mult_1: { id:"money_mult_1", name:"Money Mult I", icon:"💵", desc:"+10% money earned", cost: 900, apply:(S)=>{ S.upgrades.moneyMult = (S.upgrades.moneyMult||1) * 1.10; } },
};

export const BUNDLES = {
  starter_pack: {
    id:"starter_pack",
    name:"Starter Pack",
    icon:"📦",
    desc:"Direct Basic Dropper + Basic Pickaxe + $100 bonus.",
    cost: 500,
    buy:(S)=>{
      S.resources.money += 100;
      S.buildings.push({ kind:"dropper_direct_basic", x:S.baseX+64, y:S.baseY+64 });
      addItem(S.inventory, makeItem("pick_basic",1));
    }
  }
};

export class ShopUI {
  constructor({ openModal, toast, onEnterPlacement, onStateChanged, getS }){
    this.openModal = openModal;
    this.toast = toast;
    this.onEnterPlacement = onEnterPlacement;
    this.onStateChanged = onStateChanged;
    this.getS = getS;
  }

  open(){
    const S = this.getS();
    const body = document.createElement("div");

    body.innerHTML = `
      <div class="card sharp">
        <div class="cardTitle">Shop</div>
        <div class="smallmuted">Money: <b>$${fmtI(S.resources.money)}</b></div>
      </div>

      <div class="card sharp" style="margin-top:10px;">
        <div class="cardTitle">Buildings</div>
        <div id="buildList"></div>
      </div>

      <div class="card sharp" style="margin-top:10px;">
        <div class="cardTitle">Upgrades</div>
        <div id="upgList"></div>
      </div>

      <div class="card sharp" style="margin-top:10px;">
        <div class="cardTitle">Bundles</div>
        <div id="bunList"></div>
      </div>
    `;

    const mkItem = ({name,icon,desc,cost,btn,disabled}) => `
      <div style="border:1px solid rgba(255,255,255,0.10); background: rgba(255,255,255,0.02); padding:12px; margin-top:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
          <div>
            <div style="font-family:Orbitron,Rajdhani,system-ui; text-transform:uppercase; letter-spacing:0.6px;">${icon} ${name}</div>
            <div class="smallmuted" style="margin-top:4px;">${desc}</div>
            <div class="smallmuted" style="margin-top:6px;">Cost: <b>$${fmtI(cost)}</b></div>
          </div>
          <button class="btn sharp small ${disabled?"":"primary"}" ${disabled?"disabled":""} data-action="${btn}">${disabled?"LOCKED":"BUY"}</button>
        </div>
      </div>
    `;

    const buildList = body.querySelector("#buildList");
    buildList.innerHTML = Object.values(BUILDINGS).map(b=>{
      const disabled = S.resources.money < b.cost;
      return mkItem({ ...b, btn:`place:${b.id}`, disabled });
    }).join("");

    const upgList = body.querySelector("#upgList");
    upgList.innerHTML = Object.values(UPGRADES).map(u=>{
      const disabled = S.resources.money < u.cost;
      return mkItem({ ...u, btn:`upgrade:${u.id}`, disabled });
    }).join("");

    const bunList = body.querySelector("#bunList");
    bunList.innerHTML = Object.values(BUNDLES).map(b=>{
      const disabled = S.resources.money < b.cost;
      return mkItem({ ...b, btn:`bundle:${b.id}`, disabled });
    }).join("");

    body.addEventListener("click", (e)=>{
      const btn = e.target.closest("button[data-action]");
      if(!btn) return;
      const action = btn.dataset.action;
      const S2 = this.getS();

      const spend = (amt)=>{ S2.resources.money = Math.max(0, Math.floor(clampN(S2.resources.money,0) - amt)); };

      if(action.startsWith("place:")){
        const id = action.split(":")[1];
        const b = BUILDINGS[id];
        if(!b) return;
        if(S2.resources.money < b.cost){ this.toast("Not enough money"); return; }
        spend(b.cost);
        this.onStateChanged();
        this.openModal.close();
        this.onEnterPlacement(id);
        this.toast(`Placement: ${b.name}`);
      }

      if(action.startsWith("upgrade:")){
        const id = action.split(":")[1];
        const u = UPGRADES[id];
        if(!u) return;
        if(S2.resources.money < u.cost){ this.toast("Not enough money"); return; }
        spend(u.cost);
        u.apply(S2);
        this.onStateChanged();
        this.toast(`Purchased: ${u.name}`);
        this.openModal.refresh();
      }

      if(action.startsWith("bundle:")){
        const id = action.split(":")[1];
        const b = BUNDLES[id];
        if(!b) return;
        if(S2.resources.money < b.cost){ this.toast("Not enough money"); return; }
        spend(b.cost);
        b.buy(S2);
        this.onStateChanged();
        this.toast(`Purchased: ${b.name}`);
        this.openModal.refresh();
      }
    });

    this.openModal.open({
      title: "Shop & Upgrades",
      bodyNode: body,
      buttons: [
        { text:"CLOSE", kind:"", onClick: ()=>this.openModal.close() }
      ],
      refreshable: true,
      onRefresh: ()=>this.open()
    });
  }
}
