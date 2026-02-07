export const CHANGELOG = [
    {
      ver: "0.8",
      date: "February 2026",
      items: [
        "Expanded wild region, minimap with full view toggle, and enemy boundaries.",
        "Crafting area for swords, axes, pickaxes plus wood/trees and stick prep.",
        "Touch controls support, FPS counter toggle, and stacked world pickups."
      ]
    },
    {
      ver: "0.7",
      date: "February 2026",
      items: [
        "Sell area improvements with tray UI and inventory drag/drop tweaks.",
        "RTDB profile/username creation fixes and safer cloud save flow.",
        "Pause menu polishing and updated menu UI."
      ]
    },
    {
      ver: "0.6",
      date: "February 2026",
      items: [
        "Two dropper types: Direct + Physical drops, plus Collector Pad.",
        "HP/Shield HUD (250 HP / 50 Shield) + rare consumables.",
        "Pause menu actually pauses singleplayer simulation.",
        "Login/Register fixes: forms, centered UI, less banner spam, better auth/rules handling."
      ]
    },
    {
      ver: "0.5",
      date: "February 2026",
      items: [
        "Full tycoon loop: buildings, timed selling, upgrades, enemies, crafting, rebirths.",
        "Login/Register + Google sign-in + RTDB cloud saves.",
        "Lucky Wheel (30m), Daily Rewards (24h/28d), Weekly Calendar (20h/7d), Offline earnings UI."
      ]
    },
    {
      ver: "0.4",
      date: "February 2026",
      items: [
        "RPG map + inventory slots with rarity gradients + durability sidebar.",
        "Ore nodes + basic selling loop + custom drag/drop."
      ]
    },
    {
      ver: "0.3",
      date: "February 2026",
      items: [
        "Main menu + continue/new game prompts + sharp UI modals."
      ]
    },
    {
      ver: "0.2",
      date: "February 2026",
      items: [
        "Loading/menu/settings/how-to-play screens + autosave options."
      ]
    },
    {
      ver: "0.1",
      date: "February 2026",
      items: [
        "Basic clicker + local save."
      ]
    }
  ];
  
  export function renderChangelog(rootEl, activeVer = "0.8") {
    rootEl.innerHTML = `
      <div class="card sharp">
        <div class="cardTitle">Beta List</div>
        <div class="smallmuted">Select a version to view changes</div>
        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;" id="verTabs"></div>
      </div>
      <div id="verBody" style="margin-top:10px;"></div>
    `;
  
    const tabs = rootEl.querySelector("#verTabs");
    const body = rootEl.querySelector("#verBody");
  
    const setVer = (v) => {
      const row = CHANGELOG.find(x => x.ver === v) || CHANGELOG[0];
      body.innerHTML = `
        <div class="card sharp">
          <div class="cardTitle">v${row.ver} • ${row.date}</div>
          <ul class="list">${row.items.map(i => `<li>${i}</li>`).join("")}</ul>
        </div>
      `;
      [...tabs.children].forEach(b => b.dataset.ver === v ? b.classList.add("primary") : b.classList.remove("primary"));
    };
  
    CHANGELOG.forEach(r => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn sharp small";
      b.textContent = r.ver;
      b.dataset.ver = r.ver;
      b.addEventListener("click", () => setVer(r.ver));
      tabs.appendChild(b);
    });
  
    setVer(activeVer);
  }
  
