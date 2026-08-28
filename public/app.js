(function () {
  const { CATEGORIES, SAY_STATEMENTS, DO_ITEMS, RESULTS } = window.CONTENT;

  function shuffled(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const state = {
    screen: "welcome", // welcome | say | do | submitting | error | result
    sayOrder: shuffled(SAY_STATEMENTS),
    selectedSay: new Set(),
    doOrder: shuffled(DO_ITEMS).map((i) => i.key), // array of category keys, index 0 = "most true"
    result: null,
    errorMessage: "",
  };

  const card = document.getElementById("card");

  function h(html) {
    card.innerHTML = html;
  }

  function progress(step, total) {
    let dots = "";
    for (let i = 0; i < total; i++) {
      dots += `<div class="progress-dot ${i < step ? "done" : ""}"></div>`;
    }
    return `<div class="progress">${dots}</div>`;
  }

  function render() {
    if (state.screen === "welcome") return renderWelcome();
    if (state.screen === "say") return renderSay();
    if (state.screen === "do") return renderDo();
    if (state.screen === "submitting") return renderSubmitting();
    if (state.screen === "error") return renderError();
    if (state.screen === "result") return renderResult();
  }

  // ---- Screen 1: Welcome ---------------------------------------------------

  function renderWelcome() {
    h(`
      <p class="kicker">Say-Do Gap Self-Assessment</p>
      <h1>Your Say-Do Gap</h1>
      <p class="lede">In this self-assessment, you'll first surface the overarching topic in which your personal say-do gap lies. Once the topic is identified, you'll further explore the gap between what you say you value and what you actually do under pressure in a smaller group.</p>
      <p class="lede">This assessment is private, so only you will see your result.</p>
      <button class="primary" id="start">Begin</button>
    `);
    document.getElementById("start").addEventListener("click", () => {
      state.screen = "say";
      render();
    });
  }

  // ---- Screen 2: SAY (multi-select) ---------------------------------------

  function renderSay() {
    const items = state.sayOrder
      .map(
        (item) => `
        <li class="option ${state.selectedSay.has(item.key) ? "selected" : ""}" data-key="${item.key}">
          <span class="checkbox">&#10003;</span>
          <span>&ldquo;${item.text}&rdquo;</span>
        </li>`
      )
      .join("");

    h(`
      ${progress(1, 3)}
      <h2>Which of these have you said yourself?</h2>
      <p class="instruction">Select any statement you've said, in essence, to your team, your peers, or yourself, in the last few weeks. Choose as many as apply.</p>
      <ul class="option-list">${items}</ul>
      <button class="primary" id="next">Continue</button>
      <p class="privacy-note">🔒 Private &mdash; only you will see your own result.</p>
    `);

    card.querySelectorAll(".option").forEach((el) => {
      el.addEventListener("click", () => {
        const key = el.dataset.key;
        if (state.selectedSay.has(key)) state.selectedSay.delete(key);
        else state.selectedSay.add(key);
        render();
      });
    });

    document.getElementById("next").addEventListener("click", () => {
      state.screen = "do";
      render();
    });
  }

  // ---- Screen 3: DO (ranking) ----------------------------------------------

  function renderDo() {
    const byKey = Object.fromEntries(DO_ITEMS.map((i) => [i.key, i]));
    const rows = state.doOrder
      .map((key, idx) => {
        const item = byKey[key];
        return `
        <li class="rank-item" data-key="${key}">
          <span class="rank-num">${idx + 1}</span>
          <span class="rank-text">&ldquo;${item.text}&rdquo;</span>
          <span class="rank-controls">
            <button class="rank-btn" data-dir="up" data-key="${key}" ${idx === 0 ? "disabled" : ""} aria-label="Move up">&#9650;</button>
            <button class="rank-btn" data-dir="down" data-key="${key}" ${idx === state.doOrder.length - 1 ? "disabled" : ""} aria-label="Move down">&#9660;</button>
          </span>
        </li>`;
      })
      .join("");

    h(`
      ${progress(2, 3)}
      <h2>What behavior have you shown?</h2>
      <p class="instruction">Put these in order using the arrows, from "most true of me" at the top to "least true of me" at the bottom. Nobody else will see your ranking.</p>
      <ul class="rank-list">${rows}</ul>
      <button class="primary" id="next">See my result</button>
      <p class="privacy-note">🔒 Private &mdash; only you will see your own result.</p>
    `);

    card.querySelectorAll(".rank-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.key;
        const dir = btn.dataset.dir;
        const idx = state.doOrder.indexOf(key);
        const swapWith = dir === "up" ? idx - 1 : idx + 1;
        if (swapWith < 0 || swapWith >= state.doOrder.length) return;
        [state.doOrder[idx], state.doOrder[swapWith]] = [state.doOrder[swapWith], state.doOrder[idx]];
        render();
      });
    });

    document.getElementById("next").addEventListener("click", submit);
  }

  // ---- Submission -----------------------------------------------------------

  async function submit() {
    state.screen = "submitting";
    render();
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sayAnswers: Array.from(state.selectedSay),
          doRanking: state.doOrder,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      state.result = data;
      state.screen = "result";
    } catch (e) {
      state.errorMessage = e.message || "Could not submit your response. Check your connection and try again.";
      state.screen = "error";
    }
    render();
  }

  function renderSubmitting() {
    h(`<p class="lede">Calculating your result&hellip;</p>`);
  }

  function renderError() {
    h(`
      <h2>Something went wrong</h2>
      <p class="lede">${state.errorMessage}</p>
      <button class="primary" id="retry">Try again</button>
    `);
    document.getElementById("retry").addEventListener("click", submit);
  }

  // ---- Screen 4: private result ---------------------------------------------

  function renderResult() {
    const primaryKey = state.result.primary;
    const secondaryLabel = state.result.secondaryLabel;
    const cat = CATEGORIES[primaryKey];
    const content = RESULTS[primaryKey];

    h(`
      ${progress(3, 3)}
      <div class="result-band" style="background:${cat.color}"></div>
      <p class="result-title">Your Say-Do Gap</p>
      <h1 class="result-heading">${content.title}</h1>
      <p class="result-body">${content.body}</p>
      <div class="secondary-note">Your second-biggest gap leans toward: <strong>${secondaryLabel}</strong> &mdash; worth keeping in mind for today's conversation.</div>
      <p class="privacy-note">🔒 This result was shown only to you. Nothing on this screen is displayed to the room &mdash; head to the table or zone labeled with your category name when you're ready.</p>
    `);
  }

  render();
})();
