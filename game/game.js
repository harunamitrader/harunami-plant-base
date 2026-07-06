// そだてて！プラントアニマルズ
(() => {
  const C = GAME_CONFIG;
  const byName = Object.fromEntries(SPECIES.map((s) => [s.name, s]));
  const nowMonth = () => new Date().getMonth() + 1;

  const STAGE_NAMES = ["たね・芽", "苗木", "若木", "成木", "つぼみ…？"];
  const STAGE_EMOJI = ["🌱", "🌱", "🌿", "🌳", "🌳"];
  const TYPE_EMOJI = { flower: "🌸", fruit: "🍊", foliage: "🍁" };

  // ---- state ----
  let state = load();
  function load() {
    try {
      const raw = localStorage.getItem(C.storageKey);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { pot: null, collection: {}, grownTotal: 0 };
  }
  function save() {
    localStorage.setItem(C.storageKey, JSON.stringify(state));
  }

  // ---- 抽選 ----
  function pickSpecies() {
    const m = nowMonth();
    const pool = [];
    for (const s of SPECIES) {
      let w = 1;
      if (!state.collection[s.name]) w *= C.weightUnowned;
      if (s.seasonMonths.includes(m)) w *= C.weightSeasonal;
      pool.push([s.name, w]);
    }
    const total = pool.reduce((a, [, w]) => a + w, 0);
    let r = Math.random() * total;
    for (const [name, w] of pool) {
      r -= w;
      if (r <= 0) return name;
    }
    return pool[pool.length - 1][0];
  }
  function plantNew() {
    state.pot = { species: pickSpecies(), taps: 0, done: false };
    save();
  }

  // ---- DOM ----
  const $ = (id) => document.getElementById(id);
  const potStage = $("potStage"), potImage = $("potImage"), potFallback = $("potFallback");
  const fxLayer = $("fxLayer"), stageLabel = $("stageLabel"), growMeter = $("growMeter");
  const hintBubble = $("hintBubble"), hintText = $("hintText");
  const tapNote = $("tapNote");

  // 画像フォールバック（生成画像が未着でも遊べる）
  potImage.addEventListener("error", () => {
    potImage.style.visibility = "hidden";
    potFallback.hidden = false;
  });
  function setPotImage(src, emoji) {
    potFallback.textContent = emoji;
    potFallback.hidden = true;
    potImage.style.visibility = "visible";
    potImage.src = src;
  }

  function stageIndex(taps) {
    return Math.min(Math.floor(taps / C.tapsPerStage), 4);
  }
  function stageImageSrc(sp, idx) {
    if (idx <= 0) return "assets/stages/stage1-seed.webp";
    if (idx === 1) return "assets/stages/stage2-sapling.webp";
    if (idx === 2) return `assets/stages/stage3-young-${sp.evergreen ? "evergreen" : "deciduous"}.webp`;
    if (idx === 3) return `assets/stages/stage4-mature-${sp.height}.webp`;
    return `assets/stages/stage5-bud-${sp.height}.webp`;
  }

  // ---- にわ描画 ----
  function renderPot() {
    if (!state.pot) plantNew();
    const pot = state.pot;
    const sp = byName[pot.species];
    const idx = stageIndex(pot.taps);

    setPotImage(stageImageSrc(sp, idx), STAGE_EMOJI[idx]);
    stageLabel.textContent = STAGE_NAMES[idx];
    tapNote.textContent = pot.taps === 0 ? "タップして水をあげよう" : `水やり ${pot.taps} 回`;

    [...growMeter.children].forEach((seg, i) => {
      let fill = seg.querySelector("i");
      if (!fill) { fill = document.createElement("i"); seg.appendChild(fill); }
      const pct = Math.max(0, Math.min(1, (pot.taps - i * C.tapsPerStage) / C.tapsPerStage));
      fill.style.width = pct * 100 + "%";
    });

    // ヒント（成木からは樹木の魅力・特徴の説明に切り替わる）
    const period = (t) => (/[。！？]$/.test(t) ? t : t + "。");
    if (idx >= 3) {
      hintBubble.hidden = false;
      hintText.textContent = `${sp.matureDesc}${sp.hintBloom}`;
    } else if (idx === 2) {
      hintBubble.hidden = false;
      hintText.textContent = `${sp.evergreen ? "冬でも葉っぱが落ちない常緑の木みたい" : "冬に葉っぱを落とす落葉の木みたい"}。${period(sp.hintLeaf)}`;
    } else {
      hintBubble.hidden = true;
    }
  }

  // ---- タップ（水やり）----
  potStage.addEventListener("pointerdown", (ev) => {
    const pot = state.pot;
    if (!pot || pot.done) return;

    pot.taps += 1;
    const prevIdx = stageIndex(pot.taps - 1);
    const idx = stageIndex(pot.taps);

    // 水滴エフェクト
    const rect = potStage.getBoundingClientRect();
    const x = ev.clientX - rect.left, y = ev.clientY - rect.top;
    spawnFx("fx-drop", "💧", x - 10, y - 20);
    spawnFx("fx-plus", "+1", x + 12, y - 8);

    potStage.classList.remove("boing", "grew");
    void potStage.offsetWidth;
    potStage.classList.add(idx > prevIdx ? "grew" : "boing");

    if (pot.taps >= C.tapsToComplete) {
      pot.done = true;
      save();
      renderPot();
      setTimeout(openDone, 350);
      return;
    }
    save();
    renderPot();
  });

  function spawnFx(cls, text, x, y) {
    const el = document.createElement("span");
    el.className = cls;
    el.textContent = text;
    el.style.left = x + "px";
    el.style.top = y + "px";
    fxLayer.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  // ---- 完成演出 ----
  const doneOverlay = $("doneOverlay"), petalLayer = $("petalLayer");
  const doneTreeImg = $("doneTreeImg"), doneTreeFallback = $("doneTreeFallback");
  const doneKicker = $("doneKicker"), doneName = $("doneName"), doneAppeal = $("doneAppeal");
  const doneCharImg = $("doneCharImg");
  const step1 = $("doneStep1"), step2 = $("doneStep2"), step3 = $("doneStep3");

  doneTreeImg.addEventListener("error", () => {
    doneTreeImg.style.visibility = "hidden";
    doneTreeFallback.hidden = false;
  });

  function openDone() {
    const sp = byName[state.pot.species];
    doneKicker.textContent = sp.doneText;
    doneTreeFallback.textContent = TYPE_EMOJI[sp.type];
    doneTreeFallback.hidden = true;
    doneTreeImg.style.visibility = "visible";
    doneTreeImg.src = `assets/trees/${sp.name}.webp`;
    step1.hidden = false; step2.hidden = true; step3.hidden = true;
    spawnPetals(sp.bloomColor);
    doneOverlay.hidden = false;
  }

  function spawnPetals(colors) {
    petalLayer.innerHTML = "";
    for (let i = 0; i < 28; i++) {
      const p = document.createElement("span");
      p.className = "petal";
      p.style.left = Math.random() * 100 + "%";
      p.style.background = colors[i % colors.length];
      p.style.animationDuration = 2.6 + Math.random() * 2.2 + "s";
      p.style.animationDelay = Math.random() * 1.4 + "s";
      p.style.setProperty("--spin", 180 + Math.random() * 360 + "deg");
      p.style.setProperty("--sway", (Math.random() < 0.5 ? -1 : 1) * (14 + Math.random() * 40) + "px");
      petalLayer.appendChild(p);
    }
  }

  $("revealBtn").addEventListener("click", () => {
    const sp = byName[state.pot.species];
    doneCharImg.src = `assets/chars/${sp.name}.webp`;
    doneName.textContent = `${sp.name}×${sp.animal} がやってきた！`;
    step1.hidden = true;
    step2.hidden = false;
  });

  $("getBtn").addEventListener("click", () => {
    const pot = state.pot;
    const sp = byName[pot.species];
    const rec = state.collection[sp.name] || { date: null, count: 0 };
    if (!rec.date) rec.date = new Date().toISOString().slice(0, 10);
    rec.count += 1;
    state.collection[sp.name] = rec;
    state.grownTotal += 1;
    save();

    doneAppeal.textContent = sp.appeal;
    step2.hidden = true;
    step3.hidden = false;
    renderHeader();
  });

  $("shareBtn").addEventListener("click", () => {
    const sp = byName[state.pot.species];
    const text = `そだてて！プラントアニマルズで「${sp.name}×${sp.animal}」をゲットしたよ🌳 #プラントアニマルズ`;
    const url = location.href.split("#")[0];
    window.open(
      "https://twitter.com/intent/tweet?text=" + encodeURIComponent(text) + "&url=" + encodeURIComponent(url),
      "_blank"
    );
  });

  $("nextBtn").addEventListener("click", () => {
    plantNew();
    doneOverlay.hidden = true;
    renderPot();
  });

  // ---- ずかん ----
  const zukanGrid = $("zukanGrid"), zukanSub = $("zukanSub");
  const detailOverlay = $("detailOverlay"), detailCard = $("detailCard");

  function renderZukan() {
    const m = nowMonth();
    zukanGrid.innerHTML = "";
    let owned = 0;
    for (const s of SPECIES) {
      const rec = state.collection[s.name];
      if (rec) owned++;
      const card = document.createElement("div");
      card.className = "zukan-card" + (rec ? "" : " locked");
      if (rec) {
        const img = document.createElement("img");
        img.src = `assets/chars/${s.name}.webp`;
        img.alt = s.name;
        img.addEventListener("error", () => { img.remove(); card.insertAdjacentHTML("afterbegin", `<div class="q">${TYPE_EMOJI[s.type]}</div><div style="aspect-ratio:1"></div>`); });
        card.appendChild(img);
      } else {
        card.insertAdjacentHTML("afterbegin", `<div style="aspect-ratio:1;background:var(--cream-deep);border-radius:14px"></div><div class="q">？</div>`);
      }
      const nm = document.createElement("div");
      nm.className = "nm";
      nm.textContent = rec ? s.name : "？？？";
      card.appendChild(nm);

      const badges = document.createElement("div");
      badges.className = "zukan-badges";
      if (s.seasonMonths.includes(m)) badges.insertAdjacentHTML("beforeend", `<span class="badge season">いま見ごろ</span>`);
      if (rec && rec.count > 1) badges.insertAdjacentHTML("beforeend", `<span class="badge count">×${rec.count}</span>`);
      card.appendChild(badges);

      if (rec) card.addEventListener("click", () => openDetail(s, rec));
      zukanGrid.appendChild(card);
    }
    zukanSub.textContent = `あつめた庭木: ${owned}/${SPECIES.length}　そだてた回数: ${state.grownTotal}`;
    return owned;
  }

  function openDetail(s, rec) {
    detailCard.innerHTML = `
      <img class="main" src="assets/chars/${s.name}.webp" alt="${s.name}" onerror="this.style.display='none'" />
      <h3>${s.name}×${s.animal}</h3>
      <p class="sub">ゲット日: ${rec.date}　そだてた回数: ${rec.count}</p>
      <p class="appeal">${s.appeal}</p>
      <a class="more" href="../articles/zukan/${encodeURIComponent(s.name)}.html">🌿 この木をもっとくわしく</a>
      <button class="sub-btn" id="detailClose">とじる</button>`;
    detailOverlay.hidden = false;
    $("detailClose").addEventListener("click", () => (detailOverlay.hidden = true));
  }
  detailOverlay.addEventListener("click", (e) => { if (e.target === detailOverlay) detailOverlay.hidden = true; });

  // ---- セーブ入出力 ----
  $("exportBtn").addEventListener("click", () => {
    prompt("このテキストを保存してね（セーブデータ）", JSON.stringify(state));
  });
  $("importBtn").addEventListener("click", () => {
    const raw = prompt("セーブデータを貼り付けてね");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.collection !== "object") throw new Error("bad");
      state = parsed;
      save();
      renderAll();
      alert("読み込みました！");
    } catch (e) {
      alert("セーブデータが読み込めませんでした");
    }
  });

  // ---- タブ ----
  const tabs = document.querySelectorAll(".tab");
  function switchTab(name) {
    tabs.forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
    $("panel-niwa").hidden = name !== "niwa";
    $("panel-zukan").hidden = name !== "zukan";
    if (name === "zukan") renderZukan();
  }
  tabs.forEach((t) => t.addEventListener("click", () => switchTab(t.dataset.tab)));
  $("zukanCount").addEventListener("click", () => switchTab("zukan"));

  function renderHeader() {
    const owned = Object.keys(state.collection).length;
    $("zukanCount").textContent = `🧸 ${owned}/${SPECIES.length}`;
  }

  // ---- 起動 ----
  function renderAll() {
    renderHeader();
    renderPot();
    renderZukan();
    if (state.pot && state.pot.done) openDone(); // 完成待ちの状態で再訪した場合
  }
  renderAll();
})();
