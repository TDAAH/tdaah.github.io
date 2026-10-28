// Side Effects Are WHAT?! page: the "Get Kickstarter Updates" buttons and the How to Play walkthrough.
// The signup form itself is handled by site.js.

// Buttons that go to the signup form: scroll there, then put the cursor in the email field.
(function () {
  const signup = document.getElementById('signup');
  const email = document.getElementById('signup-email');
  if (!signup) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-scroll-to-signup]');
    if (!link) return;
    e.preventDefault();
    signup.scrollIntoView({ behavior: reduce.matches ? 'auto' : 'smooth', block: 'start' });
    history.replaceState(null, '', '#signup');
    // Focusing without scrolling keeps the smooth scroll going.
    const target = email && !email.closest('[hidden]') ? email : signup;
    window.setTimeout(() => target.focus({ preventScroll: true }), reduce.matches ? 0 : 500);
  });
})();

// The How to Play sample round. You play against two computer players (Player 2 and Player 3) who
// pick at random. Each step waits for you, then the computer players take their turn and a button
// moves on to the next step. The rules for the step on screen are in the matching .ht-panel.
(function () {
  const root = document.getElementById('ht');
  const deckEl = document.getElementById('ht-deck');
  if (!root || !deckEl) return;
  const DECK = JSON.parse(deckEl.textContent);
  const stage = root.querySelector('.ht-stage');
  const conditionEl = root.querySelector('.ht-condition');
  const spotsEl = root.querySelector('.ht-spots');
  const tray = root.querySelector('.ht-tray');
  const prompt = root.querySelector('.ht-prompt');
  const hand = root.querySelector('.ht-hand');
  const button = root.querySelector('.ht-next');
  const panels = root.querySelectorAll('[data-panel]');
  const progress = root.querySelectorAll('[data-goto]');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  const HAND_TREATMENTS = 3;
  const HAND_SIDE_EFFECTS = 5;
  const TO_PLACE = 3; // Side Effects each player plays
  const MAX_PER_TREATMENT = 2; // of one player's own Side Effects on one treatment
  const NAMES = { p1: 'You', p2: 'Player 2', p3: 'Player 3' };
  const BOTS = ['p2', 'p3'];
  const LABEL = { condition: 'Condition', treatment: 'Treatment', 'side-effect': 'Side Effect' };
  const SIZE = { condition: [600, 818], treatment: [600, 818], 'side-effect': [440, 605] };
  const scores = { p1: 0, p2: 0, p3: 0 };

  // Each round gets a new id, so a computer turn still animating from an old round stops.
  let round = 0;
  let state;

  const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const shuffle = (list) => {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const wait = (ms) => new Promise((done) => window.setTimeout(done, reduce.matches ? 0 : ms));
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };

  function img(kind, name, cls) {
    const i = new Image(SIZE[kind][0], SIZE[kind][1]);
    i.src = `/img/cards/${kind}-${slug(name || 'back')}.webp`;
    i.alt = name ? `${LABEL[kind]} card: ${name}` : '';
    i.decoding = 'async';
    if (cls) i.className = cls;
    return i;
  }

  // A card that starts face down; adding .flipped turns it over (sideeffects.css).
  function flipCard(kind, name) {
    const f = el('div', 'flip');
    const inner = el('div', 'flip-inner');
    inner.append(img(kind, null, 'face face-back'), img(kind, name, 'face face-front'));
    f.append(inner);
    return f;
  }

  // New elements start in their .enter state and animate in once they're laid out.
  function appear(e) {
    e.classList.add('enter');
    requestAnimationFrame(() => requestAnimationFrame(() => e.classList.remove('enter')));
    return e;
  }

  function say(text) {
    prompt.textContent = text;
  }

  function showButton(text, onClick) {
    button.textContent = text;
    button.hidden = !text;
    button.disabled = false;
    button.onclick = onClick || null;
  }

  function setStep(n) {
    state.step = n;
    panels.forEach((p) => p.classList.toggle('active', Number(p.dataset.panel) === n));
    progress.forEach((d) => {
      const k = Number(d.dataset.goto);
      if (k === n) d.setAttribute('aria-current', 'step');
      else d.removeAttribute('aria-current');
      d.classList.toggle('done', k < n);
    });
    stage.dataset.step = String(n);
  }

  // After a step change, bring the table back into view if it scrolled away (phones mostly).
  function revealTable() {
    const box = stage.getBoundingClientRect();
    if (box.top < -box.height * 0.5 || box.top > window.innerHeight * 0.6) {
      stage.scrollIntoView({ behavior: reduce.matches ? 'auto' : 'smooth', block: 'start' });
    }
  }

  // ---- The hand -------------------------------------------------------------------------

  function handCard(kind, name) {
    const b = el('button', `ht-card ht-card-${kind}`);
    b.type = 'button';
    b.dataset.name = name;
    b.setAttribute('aria-pressed', 'false');
    b.append(img(kind, name));
    return b;
  }

  function dealHand(kind, names) {
    hand.replaceChildren(...names.map((n) => appear(handCard(kind, n))));
    tray.classList.toggle('has-hand', names.length > 0);
  }

  function clearHand() {
    hand.replaceChildren();
    tray.classList.remove('has-hand');
  }

  // ---- The table ------------------------------------------------------------------------

  function spotEl(spot) {
    const li = el('li', 'ht-spot');
    const cards = el('div', 'ht-cards');
    const treat = el('div', 'ht-treat');
    const target = el('button', 'ht-target');
    target.type = 'button';
    target.setAttribute('aria-label', `Treatment card: ${spot.name}`);
    treat.append(flipCard('treatment', spot.name), target);
    const effects = el('div', 'ht-effects');
    const votes = el('div', 'ht-votes');
    votes.append(el('span', 'tokens'), el('span', 'vote-count'));
    const owner = el('p', 'ht-owner', spot.owner === 'p1' ? 'Yours' : '');
    cards.append(treat, effects);
    li.append(owner, cards, votes);
    spot.el = li;
    spot.effectsEl = effects;
    return li;
  }

  function sideEffectEl(spot, effect) {
    const mine = effect.owner === 'p1' && state.step === 3 && !state.locked;
    const e = el(mine ? 'button' : 'div', `ht-se owner-${effect.owner}`);
    if (mine) {
      e.type = 'button';
      e.classList.add('mine');
      e.setAttribute('aria-label', `Take back ${effect.name} from ${spot.name}`);
    }
    e.style.setProperty('--r', `${(Math.random() * 7 - 3.5).toFixed(1)}deg`);
    e.append(img('side-effect', effect.name), el('span', 'se-dot'));
    e.querySelector('.se-dot').setAttribute('aria-hidden', 'true');
    effect.el = e;
    return e;
  }

  function addSideEffect(spot, name, owner) {
    const effect = { name, owner };
    spot.effects.push(effect);
    spot.effectsEl.append(appear(sideEffectEl(spot, effect)));
    spot.el.style.setProperty('--n', String(spot.effects.length));
  }

  const ownCount = (spot, owner) => spot.effects.filter((e) => e.owner === owner).length;

  // ---- The round ------------------------------------------------------------------------

  function newRound() {
    round++;
    const treatments = shuffle(DECK.treatments);
    const effects = shuffle(DECK.sideEffects);
    state = {
      round,
      step: 1,
      condition: pick(DECK.conditions),
      // Your hand, then the computer players' cards: never ones that are in your hand.
      handTreatments: treatments.slice(0, HAND_TREATMENTS),
      botTreatments: treatments.slice(HAND_TREATMENTS, HAND_TREATMENTS + BOTS.length),
      handEffects: effects.slice(0, HAND_SIDE_EFFECTS),
      botEffects: effects.slice(HAND_SIDE_EFFECTS, HAND_SIDE_EFFECTS + BOTS.length * TO_PLACE),
      spots: [],
      selected: null, // { kind: 'effect', name } or { kind: 'spot', spot }
      locked: false,
      busy: false,
    };
    // Load this round's cards now, so nothing flips over to a blank face.
    [
      ...state.handTreatments.concat(state.botTreatments).map((n) => ['treatment', n]),
      ...state.handEffects.concat(state.botEffects).map((n) => ['side-effect', n]),
      ['condition', state.condition],
    ].forEach(([kind, n]) => { img(kind, n); });

    stage.classList.remove('scored');
    spotsEl.replaceChildren();
    clearHand();
    const card = flipCard('condition', state.condition);
    const flip = el('button', 'ht-flip-btn');
    flip.type = 'button';
    flip.setAttribute('aria-label', 'Flip the Condition card');
    flip.append(card);
    conditionEl.replaceChildren(flip);
    flip.addEventListener('click', revealCondition);
    setStep(1);
    say('Tap the Condition card to flip it over.');
    showButton('');
  }

  function revealCondition() {
    const flip = conditionEl.querySelector('.ht-flip-btn');
    if (!flip || flip.disabled) return;
    flip.disabled = true;
    flip.querySelector('.flip').classList.add('flipped');
    say(`The Condition is ${state.condition}. Now everyone needs a treatment for it.`);
    showButton('Next: Prescribe a Treatment', startPrescribe);
    button.focus({ preventScroll: true });
  }

  function startPrescribe() {
    setStep(2);
    showButton('');
    dealHand('treatment', state.handTreatments);
    say(`Pick the Treatment from your hand that you'd prescribe for ${state.condition}.`);
  }

  async function playTreatment(name) {
    const id = state.round;
    state.busy = true;
    clearHand();
    say('Player 2 and Player 3 pick their treatments…');
    const submitted = [{ name, owner: 'p1' }].concat(state.botTreatments.map((n, i) => ({ name: n, owner: BOTS[i] })));
    // The Orator shuffles them, so nobody knows whose is whose.
    state.spots = shuffle(submitted).map((s) => ({ ...s, effects: [], votes: [] }));
    for (const spot of state.spots) {
      spotsEl.append(appear(spotEl(spot)));
      await wait(220);
      if (id !== round) return;
    }
    await wait(350);
    for (const spot of state.spots) {
      spot.el.querySelector('.flip').classList.add('flipped');
      await wait(260);
      if (id !== round) return;
    }
    await wait(300);
    if (id !== round) return;
    state.busy = false;
    say(`The treatments are shuffled so nobody knows whose is whose. Yours is ${name}.`);
    showButton('Next: Add the Side Effects', startSideEffects);
    revealTable();
  }

  function startSideEffects() {
    setStep(3);
    showButton('');
    dealHand('side-effect', state.handEffects);
    stage.classList.add('choosing');
    sideEffectPrompt();
  }

  function placed() {
    return state.spots.reduce((n, s) => n + ownCount(s, 'p1'), 0);
  }

  function sideEffectPrompt(extra) {
    const n = placed();
    if (n >= TO_PLACE) {
      say(extra || 'All three placed. Tap one of yours on the table to take it back, or lock them in.');
      showButton('Lock In My Side Effects', lockSideEffects);
    } else {
      const sel = state.selected;
      const how = sel && sel.kind === 'effect'
        ? `Now tap the treatment to attach ${sel.name} to.`
        : sel && sel.kind === 'spot'
          ? `Now tap the Side Effect from your hand to attach to ${sel.spot.name}.`
          : 'Pick a Side Effect from your hand, then the treatment to attach it to (or the treatment first).';
      say(`${extra ? extra + ' ' : ''}${how} ${n} of ${TO_PLACE} placed.`);
      showButton('');
    }
    refreshTargets();
  }

  // Marks which treatments can take one of your Side Effects, and which hand card is picked.
  function refreshTargets() {
    const sel = state.selected;
    const full = placed() >= TO_PLACE;
    state.spots.forEach((spot) => {
      const open = ownCount(spot, 'p1') < MAX_PER_TREATMENT && !full;
      spot.el.classList.toggle('targetable', state.step === 3 && open && !state.locked);
      spot.el.classList.toggle('blocked', state.step === 3 && !open && !full && !state.locked);
      spot.el.classList.toggle('selected', !!sel && sel.kind === 'spot' && sel.spot === spot);
      const t = spot.el.querySelector('.ht-target');
      t.setAttribute('aria-pressed', String(!!sel && sel.kind === 'spot' && sel.spot === spot));
    });
    hand.querySelectorAll('.ht-card').forEach((c) => {
      const on = !!sel && sel.kind === 'effect' && sel.name === c.dataset.name;
      c.setAttribute('aria-pressed', String(on));
      c.disabled = full;
    });
  }

  function place(spot, name) {
    if (ownCount(spot, 'p1') >= MAX_PER_TREATMENT) {
      state.selected = { kind: 'effect', name };
      sideEffectPrompt(`You already have two Side Effects on ${spot.name}. Pick another treatment.`);
      return;
    }
    const card = [...hand.children].find((c) => c.dataset.name === name);
    if (card) card.remove();
    addSideEffect(spot, name, 'p1');
    state.selected = null;
    sideEffectPrompt(`${name} is on ${spot.name}.`);
  }

  function takeBack(spot, effect) {
    spot.effects.splice(spot.effects.indexOf(effect), 1);
    effect.el.remove();
    spot.el.style.setProperty('--n', String(spot.effects.length));
    hand.append(appear(handCard('side-effect', effect.name)));
    state.selected = null;
    sideEffectPrompt(`${effect.name} is back in your hand.`);
  }

  async function lockSideEffects() {
    const id = state.round;
    state.locked = true;
    state.busy = true;
    state.selected = null;
    stage.classList.remove('choosing');
    // Your Side Effects on the table stop being "take back" buttons.
    state.spots.forEach((spot) => spot.effects.forEach((e) => {
      if (e.owner === 'p1') e.el.replaceWith(sideEffectEl(spot, e));
    }));
    refreshTargets();
    clearHand();
    showButton('');
    for (const [b, bot] of BOTS.entries()) {
      say(`${NAMES[bot]} adds their Side Effects…`);
      const cards = state.botEffects.slice(b * TO_PLACE, (b + 1) * TO_PLACE);
      for (const name of cards) {
        await wait(450);
        if (id !== round) return;
        addSideEffect(pick(state.spots.filter((s) => ownCount(s, bot) < MAX_PER_TREATMENT)), name, bot);
      }
      await wait(250);
    }
    if (id !== round) return;
    state.busy = false;
    say('Every Side Effect is on the table. The colored dot on each card shows who played it.');
    showButton('Next: Vote', startVote);
    revealTable();
  }

  function startVote() {
    setStep(4);
    showButton('');
    stage.classList.add('voting');
    state.spots.forEach((s) => s.el.classList.add('targetable'));
    say('Tap the treatment you\'d actually take, side effects and all.');
  }

  function addVote(spot, voter) {
    spot.votes.push(voter);
    const t = el('span', `token token-${voter}`);
    t.title = NAMES[voter];
    spot.el.querySelector('.tokens').append(appear(t));
    spot.el.querySelector('.vote-count').textContent = plural(spot.votes.length, 'vote');
  }

  // Most votes wins. A tie goes to the tied treatment with the most Side Effects; if two of them
  // share the most, the one with the next most wins, and so on. Equal all the way down: random.
  function decide() {
    const top = Math.max(...state.spots.map((s) => s.votes.length));
    const tied = state.spots.filter((s) => s.votes.length === top);
    if (tied.length === 1) return { winner: tied[0], tied };
    const counts = [...new Set(tied.map((s) => s.effects.length))].sort((a, b) => b - a);
    for (const c of counts) {
      const only = tied.filter((s) => s.effects.length === c);
      if (only.length === 1) return { winner: only[0], tied, count: c, first: c === counts[0], counts };
    }
    return { winner: pick(tied), tied, random: true };
  }

  function list(names) {
    return names.length <= 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  }

  function resultText(r) {
    const w = r.winner;
    if (r.tied.length === 1) return `${w.name} wins with ${plural(w.votes.length, 'vote')}.`;
    const tie = r.tied.length === state.spots.length
      ? `It's a tie: every treatment got ${plural(r.tied[0].votes.length, 'vote')}.`
      : `It's a tie between ${list(r.tied.map((s) => s.name))}.`;
    if (r.random) return `${tie} They all have the same number of Side Effects too, so one was picked at random: ${w.name} wins.`;
    if (r.first) return `${tie} The tie goes to the one with the most Side Effects: ${w.name}, with ${plural(r.count, 'Side Effect')}.`;
    const most = r.tied.filter((s) => s.effects.length === r.counts[0]).map((s) => s.name);
    return `${tie} ${list(most)} both have ${r.counts[0]} Side Effects, so the next most wins: ${w.name}, with ${plural(r.count, 'Side Effect')}.`;
  }

  async function vote(spot) {
    const id = state.round;
    state.busy = true;
    state.spots.forEach((s) => s.el.classList.remove('targetable'));
    addVote(spot, 'p1');
    say(`You voted for ${spot.name}. Now Player 2 and Player 3 vote…`);
    for (const bot of BOTS) {
      await wait(650);
      if (id !== round) return;
      addVote(pick(state.spots), bot);
    }
    await wait(500);
    if (id !== round) return;
    const r = decide();
    state.winner = r.winner;
    r.winner.el.classList.add('win');
    r.winner.el.querySelector('.ht-votes').append(appear(el('span', 'winner-tag', 'Winner!')));
    state.busy = false;
    say(resultText(r));
    showButton('Next: Score Your Points', startScore);
    revealTable();
  }

  function points(owner, n) {
    const p = el('span', `points points-${owner}`, `+${n}`);
    p.setAttribute('aria-hidden', 'true');
    return appear(p);
  }

  function startScore() {
    setStep(5);
    stage.classList.remove('voting');
    stage.classList.add('scored');
    const w = state.winner;
    // Reveal whose treatment was whose.
    state.spots.forEach((s) => {
      s.el.querySelector('.ht-owner').textContent = s.owner === 'p1' ? 'Your treatment' : `${NAMES[s.owner]}'s treatment`;
    });
    const earned = { p1: 0, p2: 0, p3: 0 };
    earned[w.owner] += 3;
    w.el.querySelector('.ht-treat').append(points(w.owner, 3));
    w.effects.forEach((e) => {
      earned[e.owner] += 1;
      e.el.append(points(e.owner, 1));
    });
    Object.keys(earned).forEach((p) => {
      scores[p] += earned[p];
      root.querySelector(`[data-score="${p}"]`).textContent = String(scores[p]);
    });
    const parts = Object.keys(earned).map((p) => `${NAMES[p]} ${earned[p] ? '+' + earned[p] : '+0'}`);
    const yours = w.owner === 'p1' ? 'Your treatment won, so you get 3 points.' : `${w.name} was ${NAMES[w.owner]}'s, so they get 3 points.`;
    say(`${yours} Each Side Effect on it scores 1 point for whoever played it. This round: ${parts.join(', ')}.`);
    showButton('Play Another Round', () => {
      newRound();
      revealTable();
      conditionEl.querySelector('button').focus({ preventScroll: true });
    });
  }

  // ---- Clicks ---------------------------------------------------------------------------

  hand.addEventListener('click', (e) => {
    const c = e.target.closest('.ht-card');
    if (!c || state.busy) return;
    const name = c.dataset.name;
    if (state.step === 2) {
      playTreatment(name);
    } else if (state.step === 3 && !state.locked) {
      const sel = state.selected;
      if (sel && sel.kind === 'spot') return place(sel.spot, name);
      state.selected = sel && sel.kind === 'effect' && sel.name === name ? null : { kind: 'effect', name };
      sideEffectPrompt();
    }
  });

  spotsEl.addEventListener('click', (e) => {
    const li = e.target.closest('.ht-spot');
    if (!li || state.busy) return;
    const spot = state.spots.find((s) => s.el === li);
    if (state.step === 3 && !state.locked) {
      const mine = e.target.closest('.ht-se.mine');
      if (mine) return takeBack(spot, spot.effects.find((x) => x.el === mine));
      if (placed() >= TO_PLACE) return;
      const sel = state.selected;
      if (sel && sel.kind === 'effect') return place(spot, sel.name);
      if (ownCount(spot, 'p1') >= MAX_PER_TREATMENT) {
        return sideEffectPrompt(`You already have two Side Effects on ${spot.name}. Pick another treatment.`);
      }
      state.selected = sel && sel.spot === spot ? null : { kind: 'spot', spot };
      sideEffectPrompt();
    } else if (state.step === 4 && li.classList.contains('targetable')) {
      vote(spot);
    }
  });

  newRound();
})();
