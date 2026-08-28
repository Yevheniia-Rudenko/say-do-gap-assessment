(function () {
  const { CATEGORIES } = window.CONTENT;
  const KEY_STORAGE = "sayDoGap_facilitatorKey";

  let refreshTimer = null;

  function getStoredKey() {
    return localStorage.getItem(KEY_STORAGE) || "";
  }

  function setStoredKey(k) {
    localStorage.setItem(KEY_STORAGE, k);
  }

  function apiUrl(path) {
    const key = getStoredKey();
    if (!key) return path;
    const sep = path.includes("?") ? "&" : "?";
    return `${path}${sep}key=${encodeURIComponent(key)}`;
  }

  async function loadResults() {
    const status = document.getElementById("status");
    try {
      const res = await fetch(apiUrl("/api/results"));
      if (res.status === 401) {
        showKeyGate();
        return;
      }
      const data = await res.json();
      hideKeyGate();
      renderDashboard(data);
      document.getElementById("export").href = apiUrl("/api/export.csv");
      status.textContent = `Updated ${new Date().toLocaleTimeString()}`;
    } catch (e) {
      status.textContent = "Could not load results.";
    }
  }

  function showKeyGate() {
    document.getElementById("keyGate").classList.remove("hidden");
    document.getElementById("main").classList.add("hidden");
  }

  function hideKeyGate() {
    document.getElementById("keyGate").classList.add("hidden");
    document.getElementById("main").classList.remove("hidden");
  }

  function barRow(key, count, max) {
    const cat = CATEGORIES[key];
    const pct = max === 0 ? 0 : Math.round((count / max) * 100);
    return `
      <div class="bar-row">
        <div class="bar-label">${cat.label}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${cat.color}"></div></div>
        <div class="bar-count">${count}</div>
      </div>`;
  }

  function renderBars(containerId, counts) {
    const max = Math.max(1, ...Object.values(counts));
    const order = Object.keys(CATEGORIES).sort((a, b) => counts[b] - counts[a]);
    document.getElementById(containerId).innerHTML = order.map((k) => barRow(k, counts[k], max)).join("");
  }

  function renderSayBars(containerId, sayCounts) {
    // SAY statements share the same A-F keys/colors as categories for this brief.
    renderBars(containerId, sayCounts);
  }

  function renderDashboard(data) {
    document.getElementById("totalResponses").textContent = data.totalResponses;

    const lowCard = document.getElementById("lowCatCard");
    if (data.lowCategories && data.lowCategories.length) {
      lowCard.style.display = "";
      document.getElementById("lowCatCount").textContent = data.lowCategories.length;
      document.getElementById("lowCatNames").textContent = data.lowCategories
        .map((k) => CATEGORIES[k].label)
        .join(", ");
    } else {
      lowCard.style.display = "none";
    }

    renderBars("primaryChart", data.primaryCounts);
    renderBars("secondaryChart", data.secondaryCounts);
    renderSayBars("sayChart", data.sayCounts);

    const tbody = document.querySelector("#responseTable tbody");
    tbody.innerHTML = data.responses
      .slice()
      .reverse()
      .map((r, i) => {
        const rankStr = r.doRanking.map((k) => CATEGORIES[k].label.split(" ")[0]).join(" → ");
        const sayStr = (r.sayAnswers || []).length;
        const time = new Date(r.submittedAt).toLocaleTimeString();
        return `<tr><td>${data.responses.length - i}</td><td>${time}</td><td>${rankStr}</td><td>${sayStr} selected</td></tr>`;
      })
      .join("");
  }

  document.getElementById("keySubmit").addEventListener("click", () => {
    const val = document.getElementById("keyInput").value.trim();
    if (val) setStoredKey(val);
    loadResults();
  });

  document.getElementById("refresh").addEventListener("click", loadResults);

  document.getElementById("reset").addEventListener("click", async () => {
    if (!confirm("This clears all stored responses. Use this between rehearsal runs, not during the live workshop. Continue?")) return;
    await fetch(apiUrl("/api/reset"), { method: "POST" });
    loadResults();
  });

  loadResults();
  refreshTimer = setInterval(loadResults, 5000);
})();
