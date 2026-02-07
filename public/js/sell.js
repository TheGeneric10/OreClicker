import { ITEMS } from "./inventory.js";

const clampN = (n,f=0)=>Number.isFinite(Number(n))?Number(n):f;

export const SELL_TIMES_SEC = {
  ore_basic: 3,
  ore_coal: 5,
  ore_iron: 10,
  ore_gold: 30,
  ore_diamond: 60
};

export class SellSystem {
  constructor(){ this.current = null; }

  update(dt, inSell, resources, moneyMultiplier = 1){
    if(!inSell) { this.current = null; return { sold:false }; }
    const order = ["ore_diamond","ore_gold","ore_iron","ore_coal","ore_basic"];

    const pickNext = ()=>{
      for(const id of order){
        if((resources[id]||0) > 0) return { id, t:0, need: SELL_TIMES_SEC[id] || 3 };
      }
      return null;
    };

    if(!this.current) this.current = pickNext();
    if(!this.current) return { sold:false };

    this.current.t += dt;

    if(this.current.t >= this.current.need){
      const id = this.current.id;
      resources[id] = Math.max(0, Math.floor(clampN(resources[id],0) - 1));
      const value = (ITEMS[id]?.value || 1);
      resources.money = Math.floor(clampN(resources.money,0) + value * moneyMultiplier);

      this.current = pickNext();
      return { sold:true, id, value };
    }
    return { sold:false, progress: this.current.t / this.current.need, id: this.current.id };
  }
}
