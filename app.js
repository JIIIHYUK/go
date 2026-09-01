const BALL_LIMITS = { blue: 5, red: 5, orange: 1 };
const COLOR_LABELS = { blue: '파란 공', red: '빨간 공', orange: '주황 공' };
const COLORS = ['blue', 'red', 'orange'];

// DOM references
const court = document.querySelector('#court');
const currentLayer = document.querySelector('#current-layer');
const overlappedLayer = document.querySelector('#overlapped-layer');
const rosterGroups = document.querySelector('#roster-groups');
const noticeText = document.querySelector('#notice-text');
const sessionCount = document.querySelector('#session-count');
const moveButton = document.querySelector('#mode-move');
const arrowButton = document.querySelector('#mode-arrow');
const activeToolIcon = document.querySelector('#active-tool-icon');
const activeToolLabel = document.querySelector('#active-tool-label');
const dragGhost = document.querySelector('#drag-ghost');

// Board state
let mode = 'move';
let currentMarkers = [];
let overlappedMarkers = [];
let nextId = 1;
let arrowStart = null;
let arrowEnd = null;
let ballDrag = null;

function setNotice(message) {
  noticeText.textContent = message;
}

function pointFromClient(clientX, clientY, clamp = false) {
  const bounds = court.getBoundingClientRect();
  const isInside =
    clientX >= bounds.left &&
    clientX <= bounds.right &&
    clientY >= bounds.top &&
    clientY <= bounds.bottom;

  if (!isInside && !clamp) return null;

  return {
    x: Math.min(1, Math.max(0, (clientX - bounds.left) / bounds.width)),
    y: Math.min(1, Math.max(0, (clientY - bounds.top) / bounds.height)),
  };
}

function currentCircleCount(color) {
  return currentMarkers.filter((marker) => marker.kind === 'circle' && marker.color === color).length;
}

function availableBalls(color) {
  return Math.max(0, BALL_LIMITS[color] - currentCircleCount(color));
}

// UI rendering
function updateMode() {
  const isMove = mode === 'move';
  moveButton.classList.toggle('is-active', isMove);
  moveButton.setAttribute('aria-pressed', String(isMove));
  arrowButton.classList.toggle('is-active', !isMove);
  arrowButton.setAttribute('aria-pressed', String(!isMove));
  court.classList.toggle('move-cursor', isMove);
  court.classList.toggle('arrow-cursor', !isMove);
  court.setAttribute('aria-label', `${isMove ? '공 이동' : '화살표 그리기'} 모드의 농구 전술 코트`);
  activeToolIcon.className = `active-tool-icon active-${mode}`;
  activeToolLabel.textContent = isMove ? '공 이동 모드' : '화살표 모드';
}

function renderRoster() {
  rosterGroups.replaceChildren();

  COLORS.forEach((color) => {
    const available = availableBalls(color);
    const group = document.createElement('div');
    group.className = `roster-group roster-${color}`;

    const label = document.createElement('div');
    label.className = 'roster-label';
    label.innerHTML = `<span>${COLOR_LABELS[color]}</span><b>${available}/${BALL_LIMITS[color]}</b>`;

    const slots = document.createElement('div');
    slots.className = 'roster-slots';

    for (let index = 0; index < BALL_LIMITS[color]; index += 1) {
      if (index < available) {
        const ball = document.createElement('button');
        ball.type = 'button';
        ball.className = `bench-ball bench-${color}`;
        ball.setAttribute('aria-label', `${COLOR_LABELS[color]} ${index + 1} 코트로 드래그`);
        ball.addEventListener('pointerdown', (event) => startTrayDrag(event, color));
        ball.addEventListener('pointermove', moveTrayBall);
        ball.addEventListener('pointerup', finishTrayDrag);
        ball.addEventListener('pointercancel', cancelBallDrag);
        slots.append(ball);
      } else {
        const slot = document.createElement('span');
        slot.className = `bench-slot bench-slot-${color}`;
        slot.setAttribute('aria-hidden', 'true');
        slots.append(slot);
      }
    }

    group.append(label, slots);
    rosterGroups.append(group);
  });
}

function createMarkerElement(marker, movable) {
  if (marker.kind === 'circle') {
    const element = document.createElement(movable ? 'button' : 'span');
    if (movable) element.type = 'button';
    element.className = `court-marker circle-marker circle-${marker.color}${movable ? ' is-movable' : ''}`;
    element.style.left = `${marker.x * 100}%`;
    element.style.top = `${marker.y * 100}%`;

    if (movable) {
      element.setAttribute('aria-label', `${COLOR_LABELS[marker.color]} 이동`);
      element.addEventListener('pointerdown', (event) => startCourtBallDrag(event, marker, element));
      element.addEventListener('pointermove', moveCourtBall);
      element.addEventListener('pointerup', finishCourtBallDrag);
      element.addEventListener('pointercancel', cancelBallDrag);
    } else {
      element.setAttribute('aria-hidden', 'true');
    }
    return element;
  }

  const element = document.createElement('span');
  const bounds = court.getBoundingClientRect();
  const deltaX = (marker.x2 - marker.x1) * bounds.width;
  const deltaY = (marker.y2 - marker.y1) * bounds.height;
  const length = Math.hypot(deltaX, deltaY);
  const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
  element.className = `court-marker arrow-marker${marker.preview ? ' is-preview' : ''}`;
  element.style.left = `${marker.x1 * 100}%`;
  element.style.top = `${marker.y1 * 100}%`;
  element.style.width = `${length}px`;
  element.style.transform = `rotate(${angle}deg)`;
  element.setAttribute('aria-hidden', 'true');
  return element;
}

function renderLayers() {
  overlappedLayer.replaceChildren(
    ...overlappedMarkers.map((marker) => createMarkerElement(marker, false)),
  );

  const visibleMarkers = currentMarkers.map((marker) => createMarkerElement(marker, true));
  if (arrowStart && arrowEnd) {
    visibleMarkers.push(
      createMarkerElement({
        kind: 'arrow',
        x1: arrowStart.x,
        y1: arrowStart.y,
        x2: arrowEnd.x,
        y2: arrowEnd.y,
        preview: true,
      }, false),
    );
  }
  currentLayer.replaceChildren(...visibleMarkers);
}

function renderCounts() {
  sessionCount.textContent = `현재 ${currentMarkers.length} · 중첩 ${overlappedMarkers.length}`;
}

function renderAll() {
  updateMode();
  renderRoster();
  renderLayers();
  renderCounts();
}

function selectMode(nextMode) {
  mode = nextMode;
  arrowStart = null;
  arrowEnd = null;
  setNotice(
    mode === 'arrow'
      ? '코트 위에서 원하는 방향으로 드래그해 화살표를 만드세요.'
      : '공을 대기석에서 끌어오거나 코트 안에서 다시 이동하세요.',
  );
  renderAll();
}

// Player-ball drag and drop
function startTrayDrag(event, color) {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  event.preventDefault();
  event.currentTarget.setPointerCapture(event.pointerId);
  ballDrag = {
    source: 'tray',
    color,
    pointerId: event.pointerId,
    element: event.currentTarget,
  };
  dragGhost.className = `drag-ghost circle-${color}`;
  dragGhost.style.left = `${event.clientX}px`;
  dragGhost.style.top = `${event.clientY}px`;
  setNotice(`${COLOR_LABELS[color]}을 코트의 원하는 위치에 놓으세요.`);
}

function moveTrayBall(event) {
  if (!ballDrag || ballDrag.source !== 'tray' || ballDrag.pointerId !== event.pointerId) return;
  dragGhost.style.left = `${event.clientX}px`;
  dragGhost.style.top = `${event.clientY}px`;
}

function finishTrayDrag(event) {
  if (!ballDrag || ballDrag.source !== 'tray' || ballDrag.pointerId !== event.pointerId) return;
  const { color } = ballDrag;
  const point = pointFromClient(event.clientX, event.clientY);

  if (point) {
    currentMarkers.push({ id: nextId++, kind: 'circle', color, ...point });
    setNotice(`${COLOR_LABELS[color]}을 코트에 배치했습니다.`);
  } else {
    setNotice('코트 안에 놓아야 공이 배치됩니다.');
  }

  if (ballDrag.element?.hasPointerCapture(event.pointerId)) {
    ballDrag.element.releasePointerCapture(event.pointerId);
  }
  ballDrag = null;
  dragGhost.className = 'drag-ghost hidden';
  renderAll();
}

function startCourtBallDrag(event, marker, element) {
  event.stopPropagation();
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  event.preventDefault();
  element.setPointerCapture(event.pointerId);
  element.classList.add('is-dragging');
  ballDrag = {
    source: 'court',
    markerId: marker.id,
    color: marker.color,
    pointerId: event.pointerId,
    element,
  };
  setNotice(`${COLOR_LABELS[marker.color]}을 이동하고 있습니다.`);
}

function moveCourtBall(event) {
  event.stopPropagation();
  if (!ballDrag || ballDrag.source !== 'court' || ballDrag.pointerId !== event.pointerId) return;
  const point = pointFromClient(event.clientX, event.clientY, true);
  const marker = currentMarkers.find((item) => item.id === ballDrag.markerId);
  if (!point || !marker) return;
  marker.x = point.x;
  marker.y = point.y;
  ballDrag.element.style.left = `${point.x * 100}%`;
  ballDrag.element.style.top = `${point.y * 100}%`;
}

function finishCourtBallDrag(event) {
  event.stopPropagation();
  if (!ballDrag || ballDrag.source !== 'court' || ballDrag.pointerId !== event.pointerId) return;
  const { color, element } = ballDrag;
  moveCourtBall(event);
  if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
  element.classList.remove('is-dragging');
  ballDrag = null;
  setNotice(`${COLOR_LABELS[color]}의 위치를 옮겼습니다.`);
  renderAll();
}

function cancelBallDrag() {
  if (ballDrag?.element) ballDrag.element.classList.remove('is-dragging');
  ballDrag = null;
  dragGhost.className = 'drag-ghost hidden';
  setNotice('드래그가 취소되었습니다.');
}

// Arrow drawing
function startArrow(event) {
  if (mode !== 'arrow' || (event.pointerType === 'mouse' && event.button !== 0)) return;
  event.preventDefault();
  const point = pointFromClient(event.clientX, event.clientY, true);
  court.setPointerCapture(event.pointerId);
  arrowStart = point;
  arrowEnd = point;
  setNotice('원하는 방향으로 계속 드래그하세요.');
  renderLayers();
}

function moveArrow(event) {
  if (mode !== 'arrow' || !arrowStart) return;
  arrowEnd = pointFromClient(event.clientX, event.clientY, true);
  renderLayers();
}

function finishArrow(event) {
  if (mode !== 'arrow' || !arrowStart) return;
  const finalPoint = pointFromClient(event.clientX, event.clientY, true);
  const bounds = court.getBoundingClientRect();
  const distance = Math.hypot(
    (finalPoint.x - arrowStart.x) * bounds.width,
    (finalPoint.y - arrowStart.y) * bounds.height,
  );

  if (distance >= 14) {
    currentMarkers.push({
      id: nextId++,
      kind: 'arrow',
      x1: arrowStart.x,
      y1: arrowStart.y,
      x2: finalPoint.x,
      y2: finalPoint.y,
    });
    setNotice('화살표를 추가했습니다.');
  } else {
    setNotice('조금 더 길게 드래그해 주세요.');
  }

  if (court.hasPointerCapture(event.pointerId)) court.releasePointerCapture(event.pointerId);
  arrowStart = null;
  arrowEnd = null;
  renderAll();
}

function cancelArrow() {
  arrowStart = null;
  arrowEnd = null;
  renderLayers();
}

// Layer and reset actions
function overlapCurrent() {
  if (currentMarkers.length === 0) {
    setNotice('중첩할 현재 표시가 없습니다.');
    return;
  }
  const movedCount = currentMarkers.length;
  overlappedMarkers.push(...currentMarkers.map((marker) => ({ ...marker })));
  currentMarkers = [];
  arrowStart = null;
  arrowEnd = null;
  ballDrag = null;
  setNotice(`${movedCount}개 표시를 중첩했습니다. 대기석도 다시 채워졌습니다.`);
  renderAll();
}

function resetCurrent() {
  const removedCount = currentMarkers.length;
  currentMarkers = [];
  arrowStart = null;
  arrowEnd = null;
  ballDrag = null;
  setNotice(
    removedCount > 0
      ? `현재 표시 ${removedCount}개를 지우고 대기석을 채웠습니다.`
      : '현재 표시는 없으며 대기석은 모두 채워져 있습니다.',
  );
  renderAll();
}

function resetOverlaps() {
  const removedCount = overlappedMarkers.length;
  overlappedMarkers = [];
  setNotice(removedCount > 0 ? `중첩 표시 ${removedCount}개를 지웠습니다.` : '지울 중첩 표시가 없습니다.');
  renderAll();
}

// Event wiring
moveButton.addEventListener('click', () => selectMode('move'));
arrowButton.addEventListener('click', () => selectMode('arrow'));
document.querySelector('#overlap-current').addEventListener('click', overlapCurrent);
document.querySelector('#reset-current').addEventListener('click', resetCurrent);
document.querySelector('#reset-overlaps').addEventListener('click', resetOverlaps);
court.addEventListener('pointerdown', startArrow);
court.addEventListener('pointermove', moveArrow);
court.addEventListener('pointerup', finishArrow);
court.addEventListener('pointercancel', cancelArrow);
court.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') cancelArrow();
});
window.addEventListener('pointermove', (event) => {
  if (ballDrag?.source === 'tray') moveTrayBall(event);
  if (ballDrag?.source === 'court') moveCourtBall(event);
});
window.addEventListener('pointerup', (event) => {
  if (ballDrag?.source === 'tray') finishTrayDrag(event);
  if (ballDrag?.source === 'court') finishCourtBallDrag(event);
});
window.addEventListener('pointercancel', cancelBallDrag);

new ResizeObserver(renderLayers).observe(court);
renderAll();
