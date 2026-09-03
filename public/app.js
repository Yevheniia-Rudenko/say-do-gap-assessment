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

  function freshState() {
    return {
      screen: "welcome", // welcome | say | do | submitting | error | result
      sayOrder: shuffled(SAY_STATEMENTS),
      selectedSay: new Set(),
      doOrder: shuffled(DO_ITEMS).map((i) => i.key), // array of category keys, index 0 = "most true"
      result: null,
      errorMessage: "",
    };
  }

  const state = freshState();

  const card = document.getElementById("card");
  const srStatus = document.getElementById("srStatus");

  function h(html) {
    card.innerHTML = html;
  }

  function progress(step, total) {
    let dots = "";
    for (let i = 0; i < total; i++) {
      dots += `<div class="progress-dot ${i < step ? "done" : ""}"></div>`;
    }
    return `
      <div class="progress" role="progressbar" aria-valuenow="${step}" aria-valuemin="0" aria-valuemax="${total}" aria-label="Step ${step} of ${total}">${dots}</div>`;
  }

  // ---- Rendering + a11y focus handling -------------------------------------

  let lastScreen = state.screen;

  function render() {
    const isNewScreen = state.screen !== lastScreen;
    lastScreen = state.screen;

    if (state.screen === "welcome") renderWelcome();
    else if (state.screen === "say") renderSay();
    else if (state.screen === "do") renderDo();
    else if (state.screen === "submitting") renderSubmitting();
    else if (state.screen === "error") renderError();
    else if (state.screen === "result") renderResult();

    // Moving to a new step: send keyboard/screen-reader focus to the new
    // heading and announce it, instead of leaving focus stranded on a
    // button that just got removed from the DOM.
    if (isNewScreen) focusMain();
  }

  function focusMain() {
    const heading = card.querySelector("h1, h2");
    if (!heading) return;
    heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (srStatus) srStatus.textContent = heading.textContent;
  }

  // Re-render after an in-place change (toggling an option, reordering a
  // rank item) without stealing focus away from the control the keyboard
  // user was just on.
  function renderKeepingFocus(selector) {
    render();
    if (!selector) return;
    const el = card.querySelector(selector);
    if (el && !el.disabled) {
      el.focus();
    } else {
      // The element moved out of reach (e.g. "move up" got disabled at the
      // top of the list) — fall back to a sibling control on the same row.
      const fallback = el && el.closest(".rank-item") && el.closest(".rank-item").querySelector("button:not(:disabled)");
      if (fallback) fallback.focus();
    }
  }

  // ---- Screen 1: Welcome ---------------------------------------------------

  function renderWelcome() {
    h(`
      <p class="kicker">Say-Do Gap Self-Assessment</p>
      <h1>Your Say-Do Gap</h1>
      <p class="lede">In this self-assessment, you'll first surface the overarching topic in which your personal say-do gap lies. Once the topic is identified, you'll further explore the gap between what you say you value and what you actually do under pressure in a smaller group.</p>
      <p class="lede">This assessment is private, so only you will see your result.</p>
      <button type="button" class="primary" id="start">Begin</button>
    `);
    document.getElementById("start").addEventListener("click", () => {
      state.screen = "say";
      render();
    });
  }

  // ---- Screen 2: SAY (multi-select) ---------------------------------------

  function renderSay() {
    const items = state.sayOrder
      .map((item) => {
        const isSelected = state.selectedSay.has(item.key);
        return `
        <li class="option ${isSelected ? "selected" : ""}" data-key="${item.key}" role="checkbox" aria-checked="${isSelected}" tabindex="0">
          <span class="checkbox" aria-hidden="true">&#10003;</span>
          <span>&ldquo;${item.text}&rdquo;</span>
        </li>`;
      })
      .join("");

    h(`
      ${progress(1, 3)}
      <h2>Which of these have you said yourself?</h2>
      <p class="instruction">Select any statement you've said, in essence, to your team, your peers, or yourself, in the last few weeks. Choose as many as apply.</p>
      <ul class="option-list" role="group" aria-label="Statements you might have said">${items}</ul>
      <div class="button-row">
        <button type="button" class="secondary" id="back">Back</button>
        <button type="button" class="primary" id="next">Continue</button>
      </div>
      <p class="privacy-note">🔒 Private &mdash; only you will see your own result.</p>
    `);

    function toggle(key) {
      if (state.selectedSay.has(key)) state.selectedSay.delete(key);
      else state.selectedSay.add(key);
      renderKeepingFocus(`.option[data-key="${key}"]`);
    }

    card.querySelectorAll(".option").forEach((el) => {
      el.addEventListener("click", () => toggle(el.dataset.key));
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
          e.preventDefault();
          toggle(el.dataset.key);
        }
      });
    });

    document.getElementById("back").addEventListener("click", () => {
      state.screen = "welcome";
      render();
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
          <span class="rank-num" aria-hidden="true">${idx + 1}</span>
          <span class="rank-text">&ldquo;${item.text}&rdquo;<span class="sr-only"> &mdash; currently rank ${idx + 1} of ${state.doOrder.length}</span></span>
          <span class="rank-controls">
            <button type="button" class="rank-btn" data-dir="up" data-key="${key}" ${idx === 0 ? "disabled" : ""} aria-label="Move &ldquo;${item.text}&rdquo; up">&#9650;</button>
            <button type="button" class="rank-btn" data-dir="down" data-key="${key}" ${idx === state.doOrder.length - 1 ? "disabled" : ""} aria-label="Move &ldquo;${item.text}&rdquo; down">&#9660;</button>
          </span>
        </li>`;
      })
      .join("");

    h(`
      ${progress(2, 3)}
      <h2>What behavior have you shown?</h2>
      <p class="instruction">Put these in order using the arrows, from "most true of me" at the top to "least true of me" at the bottom. Nobody else will see your ranking.</p>
      <ul class="rank-list" aria-label="Behaviors, ranked from most to least true of you">${rows}</ul>
      <div class="button-row">
        <button type="button" class="secondary" id="back">Back</button>
        <button type="button" class="primary" id="next">See my result</button>
      </div>
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
        // Keep focus on the same logical button (same key + direction) so
        // repeated up/down presses stay smooth for keyboard users.
        renderKeepingFocus(`.rank-btn[data-key="${key}"][data-dir="${dir}"]`);
      });
    });

    document.getElementById("back").addEventListener("click", () => {
      state.screen = "say";
      render();
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
    h(`<p class="lede" role="status">Calculating your result&hellip;</p>`);
  }

  function renderError() {
    h(`
      <h2>Something went wrong</h2>
      <p class="lede">${state.errorMessage}</p>
      <div class="button-row">
        <button type="button" class="secondary" id="edit">Edit my answers</button>
        <button type="button" class="primary" id="retry">Try again</button>
      </div>
    `);
    document.getElementById("edit").addEventListener("click", () => {
      state.screen = "do";
      render();
    });
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
      <p class="privacy-note">🔒 This result was shown only to you. Nothing on this screen is displayed to the room.</p>
      <button type="button" class="secondary full" id="retake">Take it again</button>
    `);

    document.getElementById("retake").addEventListener("click", () => {
      if (!confirm("This starts a brand-new assessment and clears your current result. Continue?")) return;
      Object.assign(state, freshState());
      render();
    });
  }

  render();
})();
