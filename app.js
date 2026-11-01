/* All positions are in the artwork's original 256 × 256 coordinate system. */
const viewport = document.querySelector('#viewport');
const appWindow = document.querySelector('#window');
const mainMenu = document.querySelector('#main-menu');
const selectionMenu = document.querySelector('#selection-menu');
const textMenu = document.querySelector('#text-menu');
const voiceMenu = document.querySelector('#voice-menu');
const voiceArticle = document.querySelector('#voice-text');
const list = document.querySelector('#operator-list');
const article = document.querySelector('#operator-text');
let operators = window.KITCHEN_OPERATORS;
let selected = 0;
let inverseMode = false;
let futabaState = null;
let inverseState = { selected: 0, scroll: 0 };
let applyButton = null;
let textReturnFocus = null;
let voiceButton = null;
const mobileLayout = window.matchMedia('(max-width: 600px), (max-width: 1000px) and (pointer: coarse)');

// Scrollable readers can delay :active on touch. Paint feedback immediately,
// without preventing native scrolling or changing click-on-release behavior.
let readerPress = null;
function clearReaderPress() {
  readerPress?.button.classList.remove('touch-pressed');
  readerPress = null;
}
document.addEventListener('pointerdown', event => {
  if (event.pointerType !== 'touch' || !event.isPrimary) return;
  clearReaderPress();
  const button = event.target.closest('#voice, #apply');
  if (!button || button.disabled) return;
  readerPress = { button, id: event.pointerId, x: event.clientX, y: event.clientY };
  button.classList.add('touch-pressed');
}, { passive: true });
document.addEventListener('pointermove', event => {
  if (!readerPress || event.pointerId !== readerPress.id) return;
  if (Math.hypot(event.clientX - readerPress.x, event.clientY - readerPress.y) > 8) clearReaderPress();
}, { passive: true });
for (const type of ['pointerup', 'pointercancel']) {
  document.addEventListener(type, event => {
    if (event.pointerId === readerPress?.id) clearReaderPress();
  }, { passive: true });
}
window.addEventListener('blur', clearReaderPress);
window.addEventListener('pagehide', clearReaderPress);

// Keep one history entry while inside the app, so browser Back acts like Escape.
let backEntryActive = false;
let handlingBrowserBack = false;
let removingBackEntry = false;
function navigateBack() {
  if (!voiceMenu.hidden) closeVoice();
  else if (!textMenu.hidden) closeText();
  else if (mainMenu.hidden) returnToMainMenu();
}
function syncBackNavigation() {
  if (handlingBrowserBack || removingBackEntry) return;
  const insideApp = mainMenu.hidden || !textMenu.hidden;
  if (insideApp && !backEntryActive) {
    window.history.pushState({ kitchenBack: true }, '');
    backEntryActive = true;
  } else if (!insideApp && backEntryActive) {
    backEntryActive = false;
    removingBackEntry = true;
    window.history.back();
  }
}
window.addEventListener('popstate', () => {
  if (removingBackEntry) {
    removingBackEntry = false;
    syncBackNavigation();
    return;
  }
  if (!backEntryActive) {
    syncBackNavigation();
    return;
  }
  backEntryActive = false;
  handlingBrowserBack = true;
  try { navigateBack(); }
  finally { handlingBrowserBack = false; }
  syncBackNavigation();
});

function resize() {
  document.documentElement.classList.toggle('mobile-layout', mobileLayout.matches);
  if (mobileLayout.matches) {
    viewport.style.width = '';
    viewport.style.height = '';
    appWindow.style.transform = '';
    return;
  }
  const scale = Math.min(window.innerWidth, window.innerHeight) / 256;
  viewport.style.width = `${256 * scale}px`;
  viewport.style.height = `${256 * scale}px`;
  appWindow.style.transform = `scale(${scale})`;
}
window.addEventListener('resize', resize);
mobileLayout.addEventListener('change', resize);
resize();

// Move content by whole artwork pixels, independently of browser/device zoom.
function pixelScroller(viewport, label, onScroll = () => {}) {
  const content = document.createElement('div');
  content.className = 'scroll-content';
  viewport.append(content);
  const bar = document.createElement('div');
  bar.className = 'pixel-scrollbar';
  bar.setAttribute('role', 'scrollbar');
  bar.setAttribute('aria-label', label);
  bar.setAttribute('aria-controls', viewport.id);
  bar.setAttribute('aria-orientation', 'vertical');
  bar.setAttribute('aria-valuemin', '0');
  bar.tabIndex = 0;
  const thumb = document.createElement('div');
  thumb.className = 'pixel-scrollbar-thumb';
  bar.append(thumb);
  function makeArrow(direction, name) {
    const arrow = document.createElement('button');
    arrow.type = 'button';
    arrow.className = `pixel-scrollbar-arrow ${name}`;
    arrow.tabIndex = -1;
    arrow.setAttribute('aria-label', `Scroll ${name}`);
    arrow.addEventListener('click', event => {
      if (event.detail === 0) set(position + direction * arrowStep);
    });
    bar.append(arrow);
    return arrow;
  }
  const arrowStep = 40;
  const upArrow = makeArrow(-1, 'up');
  const downArrow = makeArrow(1, 'down');
  viewport.parentElement.append(bar);
  let position = 0;
  let remainder = 0;
  let drag = null;
  let touch = null;
  let repeatTimer;
  let pressedArrow = null;
  function stopPress() {
    clearTimeout(repeatTimer);
    pressedArrow?.classList.remove('pressed');
    pressedArrow = null;
    drag = null;
  }
  const scale = () => appWindow.getBoundingClientRect().height / 256;
  const maximum = () => Math.max(0, content.scrollHeight - viewport.clientHeight);
  const travel = () => Math.max(0, bar.clientHeight - 16 - 71);
  function set(value) {
    position = Math.max(0, Math.min(maximum(), Math.round(value)));
    content.style.transform = mobileLayout.matches ? '' : `translateY(${-position}px)`;
    if (mobileLayout.matches) viewport.scrollTop = position;
    thumb.style.top = `${6 + Math.round(maximum() ? position / maximum() * travel() : 0)}px`;
    bar.setAttribute('aria-valuemax', String(maximum()));
    bar.setAttribute('aria-valuenow', String(position));
    bar.setAttribute('aria-disabled', String(maximum() === 0));
    onScroll(position, maximum());
  }
  function wheel(event) {
    if (mobileLayout.matches) return;
    event.preventDefault();
    remainder += event.deltaY * (event.deltaMode === 1 ? 9 : event.deltaMode === 2 ? viewport.clientHeight : 1 / scale());
    const pixels = Math.trunc(remainder);
    remainder -= pixels;
    set(position + pixels);
  }
  viewport.addEventListener('wheel', wheel, { passive: false });
  bar.addEventListener('wheel', wheel, { passive: false });
  bar.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    event.preventDefault();
    bar.focus({ preventScroll: true });
    stopPress();
    const y = (event.clientY - bar.getBoundingClientRect().top) / scale();
    if (event.target === upArrow || event.target === downArrow) {
      const direction = event.target === upArrow ? -1 : 1;
      pressedArrow = event.target;
      pressedArrow.classList.add('pressed');
      bar.setPointerCapture(event.pointerId);
      set(position + direction * arrowStep);
      function repeat() {
        set(position + direction * arrowStep);
        repeatTimer = setTimeout(repeat, 80);
      }
      repeatTimer = setTimeout(repeat, 300);
    } else if (event.target === thumb) {
      drag = { y: event.clientY, position };
      bar.setPointerCapture(event.pointerId);
    } else {
      set((y - 8 - 75 / 2) / travel() * maximum());
    }
  });
  bar.addEventListener('pointermove', event => {
    if (drag && travel()) set(drag.position + (event.clientY - drag.y) / scale() / travel() * maximum());
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    bar.addEventListener(type, stopPress);
  }
  bar.addEventListener('blur', stopPress);
  window.addEventListener('blur', stopPress);
  viewport.addEventListener('pointerdown', event => {
    if (mobileLayout.matches) return;
    if (event.pointerType === 'touch') touch = { y: event.clientY, position, moved: false };
  });
  viewport.addEventListener('pointermove', event => {
    if (mobileLayout.matches) return;
    if (!touch) return;
    const delta = (touch.y - event.clientY) / scale();
    touch.moved ||= Math.abs(delta) >= 1;
    if (touch.moved) {
      viewport.setPointerCapture(event.pointerId);
      set(touch.position + delta);
    }
  });
  viewport.addEventListener('click', event => {
    if (touch?.moved) { event.preventDefault(); event.stopImmediatePropagation(); }
    touch = null;
  }, true);
  viewport.addEventListener('pointercancel', () => { touch = null; });
  viewport.addEventListener('scroll', () => {
    if (!mobileLayout.matches) return;
    position = viewport.scrollTop;
    onScroll(position, maximum());
  }, { passive: true });
  mobileLayout.addEventListener('change', () => {
    touch = null;
    stopPress();
    viewport.scrollTop = 0;
    set(position);
  });
  function key(event) {
    if (event.target.tagName === 'BUTTON') return;
    const steps = { ArrowDown: arrowStep, ArrowUp: -arrowStep, PageDown: viewport.clientHeight, PageUp: -viewport.clientHeight };
    if (event.key in steps || event.key === 'Home' || event.key === 'End' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      set(event.key === 'Home' ? 0 : event.key === 'End' ? maximum() : position + (event.key === ' ' ? viewport.clientHeight * (event.shiftKey ? -1 : 1) : steps[event.key]));
    }
  }
  bar.addEventListener('keydown', key);
  if (viewport === article || viewport === voiceArticle) viewport.addEventListener('keydown', key);
  new ResizeObserver(() => set(position)).observe(content);
  new ResizeObserver(() => set(position)).observe(viewport);
  return {
    content, set,
    get position() { return position; },
    get atBottom() { return Math.abs(position - maximum()) < 1; },
    reveal(element) {
      const top = element.offsetTop;
      const bottom = top + element.offsetHeight;
      if (top < position) set(top);
      else if (bottom > position + viewport.clientHeight) set(bottom - viewport.clientHeight);
    },
  };
}
const listScroll = pixelScroller(list, 'Scroll operators');
const textScroll = pixelScroller(article, 'Scroll operator text', (position, maximum) => {
  if (!applyButton) return;
  const atBottom = Math.abs(position - maximum) < 1;
  applyButton.style.visibility = atBottom ? 'visible' : 'hidden';
  applyButton.disabled = !atBottom;
});
const cards = listScroll.content;
const voiceScroll = pixelScroller(voiceArticle, 'Scroll behavior and voice');

function textRenderer(content) {
  let paragraph = [];
  function flush() {
    if (!paragraph.length) return;
    const p = document.createElement('p');
    p.textContent = paragraph.join('\n');
    content.append(p);
    paragraph = [];
  }
  function linebreak(addLine) {
    if(addLine){
      const lp = document.createElement('p');
      lp.textContent = " ";
      content.append(lp);
    }
    const p = document.createElement('p');
    p.textContent = "";
    content.append(p);
    p.className = "end-section"
  }
  function addText(textLines, withSpacing) {
    for (const line of textLines) {
      if (!line.trim()) flush();
      else paragraph.push(line
        .replace(/\t/g, '  ')
        .replace(/- /g, '   - ')
      );
    }
    flush(withSpacing);
  }
   function addLine(line, className) {
    const p = document.createElement('p');
    p.textContent = line
      .replace(/\t/g, '  ')
      .replace(/- /g, '   - ');
    p.className = className
    content.append(p);

  }
  function addHeader(text, className) {
      const element = document.createElement(content.children.length ? 'h2' : 'h1');
      element.textContent = text;
      if (className) element.className = className;
      content.append(element);
  }

  return { addHeader, addText, linebreak, flush, addLine };
}

function openVoice() {
  if (inverseMode || textMenu.hidden || !voiceButton) return;
  const operator = operators[selected];
  const behavior = window.KITCHEN_BEHAVIORS.find(entry => entry.id === operator.id);
  document.querySelector('#voice-title').textContent = `${operator.id}.behavior.md`;
  voiceScroll.content.replaceChildren();
  const title = document.createElement('h1');

  function addIntro(parts) {
    const line = document.createElement('p');
    line.className = 'inverse-intro';
    for (const [text, className] of parts) {
      const span = document.createElement('span');
      span.textContent = text;
      if (className) span.className = className;
      line.append(span);
    }
    voiceScroll.content.append(line);
  }
  addIntro([
    [`${operator.title}`, 'operator-highlight'],
    [' operator behavior.', 'operator-voice-header'],
  ]);

  voiceScroll.content.append(title);
  const { addHeader, addText, linebreak, flush, addLine } = textRenderer(voiceScroll.content);
  linebreak();

  for (const section of behavior.sections) {
    if( section.heading == "Who") {
      addHeader(section.heading, "voice-heading") 
      let firstLine = true
      for (const line of section.lines) {
        addLine(line, firstLine ? 'behavior-name' : 'behavior-who')
        firstLine = false
      }
      flush(true)
    } else if(section.heading == "Rules") {
      addHeader(section.heading, "voice-heading") 
      const rules = document.createElement('ul');
      rules.className = 'behavior-rules';
      for (const line of section.lines) {
        if (!line.trim()) continue;
        const rule = document.createElement('li');
        rule.textContent = line.replace(/^\s*-\s+/, '').replace(/\t/g, '  ');
        rules.append(rule);
      }
      voiceScroll.content.append(rules);
    } else if(section.heading == "Voice") {
      addHeader(section.heading, "voice-heading") 
      
      const voices = document.createElement('ul');
      voices.className = 'behavior-voice';
      for (const line of section.lines) {
        const voice = document.createElement('li');
        voice.textContent = line.replace(/^\s*-\s+/, '').replace(/\t/g, '  ');
        voices.append(voice);
        // voiceScroll.content.append(rules);
        // addLine(line, 'behavior-voice')
      }
      voiceScroll.content.append(voices);
      flush(true)
    }
    if(section.heading !== "Voice") {
      linebreak();
    }
    
  }
  voiceMenu.hidden = false;
  textMenu.inert = true;
  textMenu.setAttribute('aria-modal', 'false');
  voiceArticle.focus({ preventScroll: true });
  voiceScroll.set(0);
}

function closeVoice() {
  voiceMenu.hidden = true;
  textMenu.inert = false;
  textMenu.setAttribute('aria-modal', 'true');
  voiceButton.focus({ preventScroll: true });
}

function select(index, focus = false) {
  const previous = selected;
  selected = Math.max(0, Math.min(operators.length - 1, index));
  [...cards.children].forEach((button, i) => {
    button.classList.toggle('selected', i === selected);
    button.tabIndex = i === selected ? 0 : -1;
    button.setAttribute('aria-current', i === selected ? 'true' : 'false');
  });
  if (focus) {
    cards.children[selected].focus({ preventScroll: true });
    listScroll.reveal(cards.children[selected]);
  }
}

function renderCards() {
  cards.replaceChildren();
  for (const [index, operator] of operators.entries()) {
  const button = document.createElement('button');
  button.className = 'operator';
  button.setAttribute('aria-label', `Read ${operator.name}`);
  const name = document.createElement('span');
  name.className = 'operator-file';
  if(operator.original_id) {
    name.textContent =`${operator.original_id}-¹.md`;
  } else {
    name.textContent =`${operator.id}.md`;
  }
  button.append(name);
  if (operator.icon) {
    const image = document.createElement('img');
    image.className = 'portrait';
    image.src = operator.icon;
    image.alt = '';
    image.draggable = false;
    button.append(image);
  }
  const filename = document.createElement('span');
  filename.className = 'operator-name';
  filename.textContent = operator.name
  button.append(filename);
  button.addEventListener('click', () => {
    if (mobileLayout.matches || selected === index) openOperator(index);
    else select(index, true);
  });
  cards.append(button);
  }
}
renderCards();
select(0);

function updateSelectionLabels() {
  appWindow.classList.toggle('inverse-mode', inverseMode);
  selectionMenu.setAttribute('aria-label', inverseMode ? 'Choose an inverse operator' : 'Choose an operator');
  list.setAttribute('aria-label', inverseMode ? 'Inverse operators' : 'Operators');
  document.querySelector('#home').setAttribute('aria-label', inverseMode ? 'Close: return to operators' : 'Close: return to main menu');
  document.querySelector('#minimize').setAttribute('aria-label', inverseMode ? 'Minimize: return to operators' : 'Minimize: return to main menu');
}

function showInverseSelection() {
  if (inverseMode || operators[selected].id !== 'futaba' || applyButton?.disabled) return;
  futabaState = { selected, listScroll: listScroll.position };
  inverseMode = true;
  operators = window.KITCHEN_OPERATORS.map(original =>
    window.KITCHEN_INVERSE_OPERATORS.find(inverse => inverse.original_id === original.id)
  ).filter(Boolean);
  selected = inverseState.selected;
  textMenu.hidden = true;
  selectionMenu.inert = false;
  applyButton = null;
  renderCards();
  updateSelectionLabels();
  select(selected);
  cards.children[selected]?.focus({ preventScroll: true });
  listScroll.set(0);
}

function returnToOperators() {
  inverseState = { selected, scroll: listScroll.position };
  const originalId = operators[selected].original_id;
  inverseMode = false;
  operators = window.KITCHEN_OPERATORS;
  selected = Math.max(0, operators.findIndex(operator => operator.id === originalId));
  renderCards();
  updateSelectionLabels();
  listScroll.set(inverseState.scroll);
  textMenu.hidden = true;
  selectionMenu.hidden = false;
  selectionMenu.inert = false;
  applyButton = null;
  select(selected);
  cards.children[selected]?.focus({ preventScroll: true });
}

function showSelection() {
  mainMenu.hidden = true;
  selectionMenu.hidden = false;
  textMenu.hidden = true;
  select(selected, true);
  syncBackNavigation();
}

function closeText() {
  textMenu.hidden = true;
  mainMenu.inert = false;
  selectionMenu.inert = false;
  if (textReturnFocus) textReturnFocus.focus({ preventScroll: true });
  else select(selected, true);
  textReturnFocus = null;
  syncBackNavigation();
}

function openHelp() {
  if (mainMenu.hidden) return;
  applyButton = null;
  voiceButton = null;
  textReturnFocus = document.querySelector('#help');
  document.querySelector('#text-title').textContent = 'Help!';
  document.querySelector('#close-text').setAttribute('aria-label', 'Back to main menu');
  textScroll.content.replaceChildren();
  const { addHeader, addText, linebreak, flush } = textRenderer(textScroll.content);

  const title = document.createElement('h1');
  title.textContent = window.KITCHEN_HELP.title;
  textScroll.content.append(title);
  const subtitle = document.createElement('h1');
  subtitle.textContent = window.KITCHEN_HELP.subtitle;
  subtitle.className = "subtitle";
  textScroll.content.append(subtitle);


  for (const [section, lines] of Object.entries(window.KITCHEN_HELP)) {
    if (section === 'title') continue;
    if (section === 'subtitle') continue;
    if (section === 'introduction') {
      const p = document.createElement('p');
      p.textContent = '';
      textScroll.content.append(p);
    } else {
      addHeader(section, "procedure-heading") 
    }
    addText(lines)
    if (section !== "Design Principles") {
      linebreak();
    }
    flush();
  }
  textMenu.hidden = false;
  mainMenu.inert = true;
  selectionMenu.inert = true;
  article.focus({ preventScroll: true });
  textScroll.set(0);
  syncBackNavigation();
}

// Render bundled sections as text nodes, preserving wording and indentation.
function renderSections(operator) {
  applyButton = null;
  voiceButton = null;
  textScroll.content.replaceChildren();
  if (!inverseMode && !operator.original_id) {
    voiceButton = document.createElement('button');
    voiceButton.id = 'voice';
    voiceButton.type = 'button';
    voiceButton.setAttribute('aria-label', `Read behavior and voice for ${operator.name}`);
    voiceButton.addEventListener('click', openVoice);
    textScroll.content.append(voiceButton);
  }
  let paragraph = [];
  function flush() {
    if (!paragraph.length) return;
    const p = document.createElement('p');
    p.textContent = paragraph.join('\n');
    textScroll.content.append(p);
    paragraph = [];
  }
  function addHeader(text, className) {
      const element = document.createElement(textScroll.content.children.length ? 'h2' : 'h1');
      element.textContent = text;
      if (className) element.className = className;
      textScroll.content.append(element);
  }
  function addText(textLines, withSpacing) {
    for (const line of textLines) {
      if (!line.trim()) flush();
      else paragraph.push(line
        .replace(/\t/g, '  ')
        .replace(/- /g, '  - ')
      );
    }
    flush(withSpacing);
  }
  function linebreak(addLine) {
    if(addLine){
      const lp = document.createElement('p');
      lp.textContent = " ";
      textScroll.content.append(lp);
    }
    const p = document.createElement('p');
    p.textContent = "";
    textScroll.content.append(p);
    p.className = "end-section"
  }


  
  if (operator.original_id) {
    function addIntro(parts) {
      const line = document.createElement('p');
      line.className = 'inverse-intro';
      for (const [text, className] of parts) {
        const span = document.createElement('span');
        span.textContent = text;
        if (className) span.className = className;
        line.append(span);
      }
      textScroll.content.append(line);
    }
    addIntro([
      ['`futaba.md`', 'operator-highlight'],
      [' operator > '],
      [`\`${operator.original_id}.md\``, 'operator-highlight'],
      [' operator.'],
    ]);
    addIntro([
      ['Nickname: ', 'nickname-label'],
      [operator.title, 'operator-highlight'],
    ]);
  }
  else {
    const element = document.createElement('h1');
    element.textContent = operator.title;
    textScroll.content.append(element);
  }
  linebreak()
  addHeader("Trigger")
  addText(operator.trigger)
  addHeader("Purpose")
  addText(operator.purpose)
  addHeader("Key Idea")
  addText(operator.key_idea)
  linebreak()
  addHeader("Procedure", "procedure-heading")
  for (const step of operator.procedure) {
    addText(step)
  }
  linebreak()
  addHeader("Outputs")
  addText(operator.outputs)
  linebreak()
  addHeader("Do Not Use")
  addText(operator.do_not_use)

  if (!inverseMode && operator.id === 'futaba') {
    applyButton = document.createElement('button');
    applyButton.id = 'apply';
    applyButton.type = 'button';
    applyButton.setAttribute('aria-label', 'Apply Futaba: choose an inverse operator');
    applyButton.style.visibility = 'hidden';
    applyButton.disabled = true;
    applyButton.addEventListener('click', showInverseSelection);
    textScroll.content.append(applyButton);
  }

  textScroll.set(0);
}

function openOperator(index) {
  textReturnFocus = null;
  document.querySelector('#close-text').setAttribute('aria-label', 'Back to operators');
  select(index);
  const operator = operators[index];
  document.querySelector('#text-title').textContent = operator.file.split('/').pop();
  renderSections(operator);
  textMenu.hidden = false;
  selectionMenu.inert = true;
  article.focus({ preventScroll: true });
  textScroll.set(0);
}

document.querySelector('#start').addEventListener('click', showSelection);
document.querySelector('#help').addEventListener('click', openHelp);
document.querySelector('#close-text').addEventListener('click', closeText);
document.querySelector('#close-voice').addEventListener('click', closeVoice);
function returnToMainMenu() {
  if (inverseMode) {
    returnToOperators();
    return;
  }
  selectionMenu.hidden = true;
  mainMenu.hidden = false;
  document.querySelector('#start').focus();
  syncBackNavigation();
}
document.querySelector('#home').addEventListener('click', returnToMainMenu);
document.querySelector('#minimize').addEventListener('click', returnToMainMenu);
// Handle button navigation before the text scroller consumes arrow keys.
document.addEventListener('keydown', event => {
  if (!voiceMenu.hidden) return;
  const active = document.activeElement;
  let handled = false;
  if (!textMenu.hidden && !textReturnFocus) {
    if (event.key === 'ArrowRight' && voiceButton) {
      voiceButton.focus({ preventScroll: true });
      handled = true;
    } else if (event.key === 'ArrowDown' && active === voiceButton) {
      article.focus({ preventScroll: true });
      textScroll.set(textScroll.position + 40);
      handled = true;
    } else if (event.key === 'ArrowLeft' && active === voiceButton) {
      article.focus({ preventScroll: true });
      handled = true;
    } else if (event.key === 'ArrowDown' && applyButton && textScroll.atBottom) {
      applyButton.focus({ preventScroll: true });
      handled = true;
    } else if (event.key === 'ArrowUp' && active === applyButton) {
      article.focus({ preventScroll: true });
      textScroll.set(textScroll.position - 40);
      handled = true;
    }
  } else if (!mainMenu.hidden && textMenu.hidden) {
    const start = document.querySelector('#start');
    const help = document.querySelector('#help');
    if (event.key === 'ArrowDown') {
      start.focus({ preventScroll: true });
      handled = true;
    } else if (event.key === 'ArrowUp') {
      if (active === start || active === help) active.blur();
      handled = true;
    } else if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && (active === start || active === help)) {
      (event.key === 'ArrowRight' ? help : start).focus({ preventScroll: true });
      handled = true;
    }
  }
  if (handled) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}, true);

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    event.preventDefault();
    navigateBack();
    return;
  }
  if (!voiceMenu.hidden) {
    return;
  }
  if (!textMenu.hidden) {
    return;
  }
  if (!mainMenu.hidden) {
    if (event.key === 'Enter' && event.target.tagName !== 'BUTTON') { event.preventDefault(); showSelection(); }
    return;
  }
  const movements = { ArrowDown: 3, ArrowUp: -3, ArrowLeft: -1, ArrowRight: 1 };
  if (event.key in movements) {
    event.preventDefault();
    select(selected + movements[event.key], true);
  } else if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault();
    select(event.key === 'Home' ? 0 : operators.length - 1, true);
  }
});
