const sprite = document.querySelector('#sprite');
const stage = document.querySelector('#pet-stage');
const menuButton = document.querySelector('#menu-button');
const speech = document.querySelector('#speech');
const needIndicator = document.querySelector('#need-indicator');

const CELL = { width: 192, height: 208 };
const ANIMATIONS = {
  idle: { row: 0, sequence: [0, 2, 4, 5, 4, 2], fps: 2.5, loop: true },
  blink: { row: 0, sequence: [0, 1, 0], fps: 7, loop: false },
  walkRight: { row: 1, sequence: [0, 1, 2, 3, 4, 5, 6], fps: 8, loop: true },
  walkLeft: { row: 2, sequence: [0, 1, 2, 3, 4, 5, 6], fps: 8, loop: true },
  wave: { row: 3, frames: 4, fps: 4.5, loop: false },
  jump: { row: 4, frames: 5, fps: 5.5, loop: false },
  sad: { row: 5, frames: 8, fps: 4.5, loop: false },
  sit: { row: 6, frames: 6, fps: 3.2, loop: false },
  eat: { row: 7, frames: 6, fps: 4, loop: false },
  inspect: { row: 8, frames: 6, fps: 3.3, loop: false },
  badminton: { row: 0, frames: 8, fps: 4.2, loop: false, sheet: 'badminton' }
};
for (const name of ['soccer', 'basketball', 'weights', 'singing', 'pingpong', 'overtime', 'reminder']) {
  ANIMATIONS[name] = { row: 0, frames: 8, fps: 4.2, loop: false, sheet: name };
}

let animationName = 'idle';
let frame = 0;
let animationFrameRequest;
let walking = false;
let movementTimer;
let randomTimer;
let blinkTimer;
let bubbleTimer;
let dragState;
let settings = { autoRoam: true, bubbles: true };
let activeMemoId = null;

function clearReminder() {
  activeMemoId = null;
  speech.classList.remove('visible', 'memo-speech');
  play('idle');
  scheduleRandomBehavior();
}

async function dismissReminder() {
  if (!activeMemoId) return;
  await window.zhubaoDesktop.command('complete-memo', { id: activeMemoId });
}

function paintFrame() {
  const animation = ANIMATIONS[animationName];
  const actualFrame = animation.sequence ? animation.sequence[frame] : frame;
  sprite.style.backgroundImage = animation.sheet
    ? `url('../app-assets/${animation.sheet}.webp')`
    : "url('../app-assets/spritesheet.webp')";
  sprite.style.backgroundPosition = `${-actualFrame * CELL.width}px ${-animation.row * CELL.height}px`;
}

function play(name, { onComplete } = {}) {
  cancelAnimationFrame(animationFrameRequest);
  animationName = name;
  frame = 0;
  paintFrame();
  const animation = ANIMATIONS[name];
  const frameCount = animation.sequence?.length || animation.frames;
  const frameDuration = 1000 / animation.fps;
  let lastAdvance = performance.now();

  function advance(now) {
    const elapsed = now - lastAdvance;
    if (elapsed >= frameDuration) {
      const steps = Math.floor(elapsed / frameDuration);
      lastAdvance += steps * frameDuration;
      frame += steps;
      if (frame >= frameCount) {
        if (animation.loop) frame %= frameCount;
        else {
          if (onComplete) onComplete();
          else play('idle');
          return;
        }
      }
      paintFrame();
    }
    animationFrameRequest = requestAnimationFrame(advance);
  }

  animationFrameRequest = requestAnimationFrame(advance);
  if (name === 'idle') scheduleBlink();
  else if (name !== 'blink') clearTimeout(blinkTimer);
}

function scheduleBlink() {
  clearTimeout(blinkTimer);
  blinkTimer = setTimeout(() => {
    if (animationName === 'idle' && !walking && !dragState) {
      play('blink', { onComplete: () => play('idle') });
    } else {
      scheduleBlink();
    }
  }, 5500 + Math.random() * 6500);
}

function showSpeech(message, reminder = false) {
  if ((!settings.bubbles && !reminder) || !message) return;
  clearTimeout(bubbleTimer);
  speech.textContent = message;
  if (reminder) {
    const button = document.createElement('button');
    button.className = 'dismiss-memo';
    button.textContent = '知道了 · 结束提醒';
    button.addEventListener('click', event => { event.stopPropagation(); dismissReminder(); });
    speech.append(button);
  }
  speech.classList.add('visible');
  speech.classList.toggle('memo-speech', reminder);
  if (!reminder) bubbleTimer = setTimeout(() => speech.classList.remove('visible'), 3200);
}

async function walk() {
  if (walking) return;
  walking = true;
  const bounds = await window.zhubaoDesktop.getWindowBounds();
  const area = await window.zhubaoDesktop.getWorkArea();
  if (activeMemoId || !walking) return;
  const roomRight = area.x + area.width - CELL.width - bounds.x;
  const roomLeft = bounds.x - area.x;
  const direction = roomRight > roomLeft ? 1 : -1;
  play(direction > 0 ? 'walkRight' : 'walkLeft');
  let x = bounds.x;
  const targetDistance = Math.min(220 + Math.random() * 240, direction > 0 ? roomRight : roomLeft);
  const startX = x;
  clearInterval(movementTimer);
  movementTimer = setInterval(() => {
    x += direction * 3;
    window.zhubaoDesktop.moveWindow({ x, y: bounds.y });
    if (Math.abs(x - startX) >= targetDistance) {
      clearInterval(movementTimer);
      walking = false;
      play('idle');
      scheduleRandomBehavior();
    }
  }, 33);
}

function perform(action) {
  if (activeMemoId && action !== 'reminder') return;
  clearTimeout(randomTimer);
  if (action === 'walk') {
    walk();
    return;
  }
  if (!ANIMATIONS[action]) action = 'idle';
  if (walking) {
    clearInterval(movementTimer);
    walking = false;
  }
  play(action, {
    onComplete: () => {
      if (action === 'reminder' && activeMemoId) { perform('reminder'); return; }
      play('idle');
      scheduleRandomBehavior();
    }
  });
}

function scheduleRandomBehavior() {
  clearTimeout(randomTimer);
  if (!settings.autoRoam || activeMemoId) return;
  randomTimer = setTimeout(() => {
    perform(window.zhubaoBehavior.chooseBehavior());
  }, 6000 + Math.random() * 9000);
}

async function pet() {
  await window.zhubaoDesktop.command('interact', { type: 'pet' });
}

stage.addEventListener('dblclick', () => perform('wave'));
stage.addEventListener('pointerdown', async (event) => {
  if (event.button !== 0 || event.target === menuButton || event.target.closest('.memo-speech')) return;
  clearTimeout(randomTimer);
  const bounds = await window.zhubaoDesktop.getWindowBounds();
  dragState = {
    pointerId: event.pointerId,
    screenX: event.screenX,
    screenY: event.screenY,
    windowX: bounds.x,
    windowY: bounds.y,
    moved: false,
    startedAt: Date.now()
  };
  stage.setPointerCapture(event.pointerId);
  stage.classList.add('dragging');
});
stage.addEventListener('pointermove', (event) => {
  if (!dragState || dragState.pointerId !== event.pointerId) return;
  const dx = event.screenX - dragState.screenX;
  const dy = event.screenY - dragState.screenY;
  if (Math.abs(dx) + Math.abs(dy) > 5) dragState.moved = true;
  window.zhubaoDesktop.moveWindow({ x: dragState.windowX + dx, y: dragState.windowY + dy });
});
stage.addEventListener('pointerup', (event) => {
  if (!dragState || dragState.pointerId !== event.pointerId) return;
  const wasClick = !dragState.moved && Date.now() - dragState.startedAt < 500;
  dragState = undefined;
  stage.releasePointerCapture(event.pointerId);
  stage.classList.remove('dragging');
  if (wasClick) { if (activeMemoId) dismissReminder(); else pet(); }
  else scheduleRandomBehavior();
});
stage.addEventListener('pointercancel', () => {
  dragState = undefined;
  stage.classList.remove('dragging');
  scheduleRandomBehavior();
});
stage.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  window.zhubaoDesktop.showMenu();
});
menuButton.addEventListener('pointerdown', (event) => event.stopPropagation());
menuButton.addEventListener('click', () => window.zhubaoDesktop.openPanel('home'));

window.zhubaoDesktop.onReaction((reaction) => {
  if (reaction.reminder) activeMemoId = reaction.memoId;
  else if (activeMemoId) return;
  if (reaction.animation) perform(reaction.animation);
  showSpeech(reaction.message, reaction.reminder);
});

window.zhubaoDesktop.onState((state) => {
  settings = state.settings;
  if (activeMemoId && !state.memos.some(m => m.id === activeMemoId && m.awaitingAck && !m.completed)) clearReminder();
  needIndicator.className = state.needs.satiety < 22 ? 'hungry' : state.needs.energy < 20 ? 'tired' : '';
  needIndicator.textContent = state.needs.satiety < 22 ? '🎋' : state.needs.energy < 20 ? 'Zz' : '';
  if (settings.autoRoam) scheduleRandomBehavior();
  else clearTimeout(randomTimer);
});

window.zhubaoDesktop.getState().then((state) => {
  settings = state.settings;
  if (state.needs.satiety < 22) showSpeech('肚子有一点点空……');
  scheduleRandomBehavior();
});

play('idle');
