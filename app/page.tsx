'use client';

import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from 'react';

type Mode = 'move' | 'arrow';
type CircleColor = 'blue' | 'red' | 'orange';

type CircleMarker = {
  id: number;
  kind: 'circle';
  color: CircleColor;
  x: number;
  y: number;
};

type ArrowMarker = {
  id: number;
  kind: 'arrow';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

type Marker = CircleMarker | ArrowMarker;
type Point = { x: number; y: number };

type TrayDrag = {
  source: 'tray';
  color: CircleColor;
  pointerId: number;
  clientX: number;
  clientY: number;
};

type CourtDrag = {
  source: 'court';
  markerId: number;
  color: CircleColor;
  pointerId: number;
  clientX: number;
  clientY: number;
};

type BallDrag = TrayDrag | CourtDrag;

const BALL_LIMITS: Record<CircleColor, number> = {
  blue: 5,
  red: 5,
  orange: 1,
};

const colorLabels: Record<CircleColor, string> = {
  blue: '파란 공',
  red: '빨간 공',
  orange: '주황 공',
};

export default function Home() {
  const [mode, setMode] = useState<Mode>('move');
  const [currentMarkers, setCurrentMarkers] = useState<Marker[]>([]);
  const [overlappedMarkers, setOverlappedMarkers] = useState<Marker[]>([]);
  const [arrowStart, setArrowStart] = useState<Point | null>(null);
  const [arrowEnd, setArrowEnd] = useState<Point | null>(null);
  const [ballDrag, setBallDrag] = useState<BallDrag | null>(null);
  const [courtSize, setCourtSize] = useState({ width: 740, height: 485 });
  const [notice, setNotice] = useState('대기석의 공을 끌어 코트에 배치하세요.');

  const courtRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  useEffect(() => {
    const court = courtRef.current;
    if (!court) return;

    const updateSize = () => {
      const bounds = court.getBoundingClientRect();
      setCourtSize({ width: bounds.width, height: bounds.height });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(court);
    return () => observer.disconnect();
  }, []);

  const pointFromClient = (clientX: number, clientY: number, clamp = false): Point | null => {
    const court = courtRef.current;
    if (!court) return null;
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
  };

  const pointFromCourtEvent = (event: ReactPointerEvent<HTMLDivElement>): Point => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)),
      y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)),
    };
  };

  const cancelArrow = () => {
    setArrowStart(null);
    setArrowEnd(null);
  };

  const selectMode = (nextMode: Mode) => {
    cancelArrow();
    setMode(nextMode);
    setNotice(
      nextMode === 'arrow'
        ? '코트 위에서 원하는 방향으로 드래그해 화살표를 만드세요.'
        : '공을 대기석에서 끌어오거나 코트 안에서 다시 이동하세요.',
    );
  };

  const handleCourtPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (mode !== 'arrow') return;
    if (event.button !== 0 && event.pointerType === 'mouse') return;

    const point = pointFromCourtEvent(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    setArrowStart(point);
    setArrowEnd(point);
    setNotice('원하는 방향으로 계속 드래그하세요.');
  };

  const handleCourtPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!arrowStart || mode !== 'arrow') return;
    setArrowEnd(pointFromCourtEvent(event));
  };

  const finishArrow = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!arrowStart || mode !== 'arrow') return;

    const finalPoint = pointFromCourtEvent(event);
    const distance = Math.hypot(
      (finalPoint.x - arrowStart.x) * courtSize.width,
      (finalPoint.y - arrowStart.y) * courtSize.height,
    );

    if (distance >= 14) {
      const marker: ArrowMarker = {
        id: nextId.current++,
        kind: 'arrow',
        x1: arrowStart.x,
        y1: arrowStart.y,
        x2: finalPoint.x,
        y2: finalPoint.y,
      };
      setCurrentMarkers((markers) => [...markers, marker]);
      setNotice('화살표를 추가했습니다.');
    } else {
      setNotice('조금 더 길게 드래그해 주세요.');
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    cancelArrow();
  };

  const startTrayDrag = (
    event: ReactPointerEvent<HTMLButtonElement>,
    color: CircleColor,
  ) => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setBallDrag({
      source: 'tray',
      color,
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
    });
    setNotice(`${colorLabels[color]}을 코트의 원하는 위치에 놓으세요.`);
  };

  const moveTrayBall = (event: ReactPointerEvent<HTMLButtonElement>) => {
    setBallDrag((drag) =>
      drag?.source === 'tray' && drag.pointerId === event.pointerId
        ? { ...drag, clientX: event.clientX, clientY: event.clientY }
        : drag,
    );
  };

  const finishTrayDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (ballDrag?.source !== 'tray' || ballDrag.pointerId !== event.pointerId) return;
    const point = pointFromClient(event.clientX, event.clientY);

    if (point) {
      const marker: CircleMarker = {
        id: nextId.current++,
        kind: 'circle',
        color: ballDrag.color,
        ...point,
      };
      setCurrentMarkers((markers) => [...markers, marker]);
      setNotice(`${colorLabels[ballDrag.color]}을 코트에 배치했습니다.`);
    } else {
      setNotice('코트 안에 놓아야 공이 배치됩니다.');
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setBallDrag(null);
  };

  const startCourtBallDrag = (
    event: ReactPointerEvent<HTMLButtonElement>,
    marker: CircleMarker,
  ) => {
    event.stopPropagation();
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setBallDrag({
      source: 'court',
      markerId: marker.id,
      color: marker.color,
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
    });
    setNotice(`${colorLabels[marker.color]}을 이동하고 있습니다.`);
  };

  const moveCourtBall = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (ballDrag?.source !== 'court' || ballDrag.pointerId !== event.pointerId) return;
    const point = pointFromClient(event.clientX, event.clientY, true);
    if (!point) return;

    setCurrentMarkers((markers) =>
      markers.map((marker) =>
        marker.kind === 'circle' && marker.id === ballDrag.markerId
          ? { ...marker, ...point }
          : marker,
      ),
    );
    setBallDrag({ ...ballDrag, clientX: event.clientX, clientY: event.clientY });
  };

  const finishCourtBallDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (ballDrag?.source !== 'court' || ballDrag.pointerId !== event.pointerId) return;
    const point = pointFromClient(event.clientX, event.clientY, true);

    if (point) {
      setCurrentMarkers((markers) =>
        markers.map((marker) =>
          marker.kind === 'circle' && marker.id === ballDrag.markerId
            ? { ...marker, ...point }
            : marker,
        ),
      );
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setNotice(`${colorLabels[ballDrag.color]}의 위치를 옮겼습니다.`);
    setBallDrag(null);
  };

  const cancelBallDrag = () => {
    setBallDrag(null);
    setNotice('드래그가 취소되었습니다.');
  };

  const overlapCurrent = () => {
    if (currentMarkers.length === 0) {
      setNotice('중첩할 현재 표시가 없습니다.');
      return;
    }
    const movedCount = currentMarkers.length;
    setOverlappedMarkers((markers) => [...markers, ...currentMarkers]);
    setCurrentMarkers([]);
    setBallDrag(null);
    cancelArrow();
    setNotice(`${movedCount}개 표시를 중첩했습니다. 대기석도 다시 채워졌습니다.`);
  };

  const resetCurrent = () => {
    const removedCount = currentMarkers.length;
    setCurrentMarkers([]);
    setBallDrag(null);
    cancelArrow();
    setNotice(
      removedCount > 0
        ? `현재 표시 ${removedCount}개를 지우고 대기석을 채웠습니다.`
        : '현재 표시는 없으며 대기석은 모두 채워져 있습니다.',
    );
  };

  const resetOverlaps = () => {
    const removedCount = overlappedMarkers.length;
    setOverlappedMarkers([]);
    setNotice(
      removedCount > 0
        ? `중첩 표시 ${removedCount}개를 지웠습니다.`
        : '지울 중첩 표시가 없습니다.',
    );
  };

  const currentCircleCount = (color: CircleColor) =>
    currentMarkers.filter((marker) => marker.kind === 'circle' && marker.color === color).length;

  const availableBalls: Record<CircleColor, number> = {
    blue: Math.max(0, BALL_LIMITS.blue - currentCircleCount('blue')),
    red: Math.max(0, BALL_LIMITS.red - currentCircleCount('red')),
    orange: Math.max(0, BALL_LIMITS.orange - currentCircleCount('orange')),
  };

  const previewArrow: ArrowMarker | null =
    arrowStart && arrowEnd
      ? {
          id: -1,
          kind: 'arrow',
          x1: arrowStart.x,
          y1: arrowStart.y,
          x2: arrowEnd.x,
          y2: arrowEnd.y,
        }
      : null;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">
            PB
          </div>
          <div>
            <p className="eyebrow">BASKETBALL TACTICS</p>
            <h1>PLAYBOARD</h1>
          </div>
        </div>

        <div className="reset-actions" aria-label="초기화 도구">
          <button type="button" className="reset-button" onClick={resetCurrent}>
            <span aria-hidden="true">↺</span>
            현재 초기화
          </button>
          <button
            type="button"
            className="reset-button reset-button-muted"
            onClick={resetOverlaps}
          >
            <span aria-hidden="true">◎</span>
            중첩 초기화
          </button>
        </div>

        <div className="session-badge" aria-label="현재 표시 개수">
          <span className="live-dot" aria-hidden="true" />
          현재 {currentMarkers.length} · 중첩 {overlappedMarkers.length}
        </div>
      </header>

      <section className="workspace">
        <aside className="tool-rail" aria-label="코트 표시 도구">
          <p className="tool-heading">MODE</p>
          <button
            type="button"
            className={`tool-button ${mode === 'move' ? 'is-active' : ''}`}
            aria-pressed={mode === 'move'}
            onClick={() => selectMode('move')}
          >
            <span className="tool-symbol move-symbol" aria-hidden="true">
              ✥
            </span>
            <span>공 이동</span>
          </button>
          <button
            type="button"
            className={`tool-button ${mode === 'arrow' ? 'is-active' : ''}`}
            aria-pressed={mode === 'arrow'}
            onClick={() => selectMode('arrow')}
          >
            <span className="tool-symbol arrow-symbol" aria-hidden="true">
              ↗
            </span>
            <span>화살표</span>
          </button>

          <div className="tool-divider" />
          <p className="tool-heading">ACTION</p>
          <button type="button" className="tool-button overlap-button" onClick={overlapCurrent}>
            <span className="tool-symbol overlap-symbol" aria-hidden="true">
              ◉
            </span>
            <span>중첩</span>
          </button>

          <div className="rail-help">
            <span aria-hidden="true">?</span>
            <p>공은 끌어서 배치·이동, 화살표는 코트에서 드래그</p>
          </div>
        </aside>

        <div className="court-area">
          <div className="court-heading-row">
            <div>
              <p className="court-kicker">TACTIC 01</p>
              <h2>새 전술 보드</h2>
            </div>
            <div className="active-tool-pill">
              <span className={`active-tool-icon active-${mode}`} aria-hidden="true" />
              {mode === 'arrow' ? '화살표 모드' : '공 이동 모드'}
            </div>
          </div>

          <section className="player-dock" aria-label="드래그 가능한 선수 대기석">
            <div className="dock-title">
              <span className="dock-grip" aria-hidden="true">•••</span>
              <div>
                <p>PLAYER BENCH</p>
                <strong>공을 끌어 코트에 배치하세요</strong>
              </div>
            </div>
            <div className="roster-groups">
              {(['blue', 'red', 'orange'] as CircleColor[]).map((color) => (
                <RosterGroup
                  key={color}
                  color={color}
                  available={availableBalls[color]}
                  total={BALL_LIMITS[color]}
                  onPointerDown={startTrayDrag}
                  onPointerMove={moveTrayBall}
                  onPointerUp={finishTrayDrag}
                  onPointerCancel={cancelBallDrag}
                />
              ))}
            </div>
          </section>

          <div className="court-frame">
            <div
              ref={courtRef}
              className={`court ${mode === 'arrow' ? 'arrow-cursor' : 'move-cursor'}`}
              onPointerDown={handleCourtPointerDown}
              onPointerMove={handleCourtPointerMove}
              onPointerUp={finishArrow}
              onPointerCancel={cancelArrow}
              onKeyDown={(event) => {
                if (event.key === 'Escape') cancelArrow();
              }}
              role="application"
              aria-label={`${mode === 'arrow' ? '화살표 그리기' : '공 이동'} 모드의 농구 전술 코트`}
              tabIndex={0}
            >
              <img src="/basketball-court.png" alt="농구 코트 전술판" draggable={false} />
              <div className="marker-layer overlapped-layer" aria-label="중첩된 표시">
                {overlappedMarkers.map((marker) => (
                  <MarkerView key={marker.id} marker={marker} courtSize={courtSize} />
                ))}
              </div>
              <div className="marker-layer current-layer" aria-label="현재 표시">
                {currentMarkers.map((marker) => (
                  <MarkerView
                    key={marker.id}
                    marker={marker}
                    courtSize={courtSize}
                    isDragging={ballDrag?.source === 'court' && ballDrag.markerId === marker.id}
                    onCirclePointerDown={startCourtBallDrag}
                    onCirclePointerMove={moveCourtBall}
                    onCirclePointerUp={finishCourtBallDrag}
                    onCirclePointerCancel={cancelBallDrag}
                  />
                ))}
                {previewArrow && (
                  <MarkerView marker={previewArrow} courtSize={courtSize} preview />
                )}
              </div>
            </div>
          </div>

          <div className="court-footer">
            <p className="notice" role="status" aria-live="polite">
              <span aria-hidden="true">●</span>
              {notice}
            </p>
            <p className="opacity-note">
              중첩된 표시는 횟수와 관계없이 항상 <strong>50%</strong>
            </p>
          </div>
        </div>
      </section>

      {ballDrag?.source === 'tray' && (
        <span
          className={`drag-ghost circle-${ballDrag.color}`}
          style={{ left: ballDrag.clientX, top: ballDrag.clientY }}
          aria-hidden="true"
        />
      )}
    </main>
  );
}

function RosterGroup({
  color,
  available,
  total,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: {
  color: CircleColor;
  available: number;
  total: number;
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>, color: CircleColor) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: () => void;
}) {
  return (
    <div className={`roster-group roster-${color}`}>
      <div className="roster-label">
        <span>{colorLabels[color]}</span>
        <b>{available}/{total}</b>
      </div>
      <div className="roster-slots">
        {Array.from({ length: total }, (_, index) =>
          index < available ? (
            <button
              key={`${color}-available-${index}`}
              type="button"
              className={`bench-ball bench-${color}`}
              aria-label={`${colorLabels[color]} ${index + 1} 코트로 드래그`}
              onPointerDown={(event) => onPointerDown(event, color)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerCancel}
            />
          ) : (
            <span
              key={`${color}-used-${index}`}
              className={`bench-slot bench-slot-${color}`}
              aria-hidden="true"
            />
          ),
        )}
      </div>
    </div>
  );
}

function MarkerView({
  marker,
  courtSize,
  preview = false,
  isDragging = false,
  onCirclePointerDown,
  onCirclePointerMove,
  onCirclePointerUp,
  onCirclePointerCancel,
}: {
  marker: Marker;
  courtSize: { width: number; height: number };
  preview?: boolean;
  isDragging?: boolean;
  onCirclePointerDown?: (
    event: ReactPointerEvent<HTMLButtonElement>,
    marker: CircleMarker,
  ) => void;
  onCirclePointerMove?: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onCirclePointerUp?: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onCirclePointerCancel?: () => void;
}) {
  if (marker.kind === 'circle') {
    const style = {
      left: `${marker.x * 100}%`,
      top: `${marker.y * 100}%`,
    } as CSSProperties;

    if (onCirclePointerDown) {
      return (
        <button
          type="button"
          className={`court-marker circle-marker circle-${marker.color} is-movable ${isDragging ? 'is-dragging' : ''}`}
          style={style}
          aria-label={`${colorLabels[marker.color]} 이동`}
          onPointerDown={(event) => onCirclePointerDown(event, marker)}
          onPointerMove={onCirclePointerMove}
          onPointerUp={onCirclePointerUp}
          onPointerCancel={onCirclePointerCancel}
        />
      );
    }

    return (
      <span
        className={`court-marker circle-marker circle-${marker.color}`}
        style={style}
        aria-hidden="true"
      />
    );
  }

  const deltaX = (marker.x2 - marker.x1) * courtSize.width;
  const deltaY = (marker.y2 - marker.y1) * courtSize.height;
  const length = Math.hypot(deltaX, deltaY);
  const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
  const style = {
    left: `${marker.x1 * 100}%`,
    top: `${marker.y1 * 100}%`,
    width: `${length}px`,
    transform: `rotate(${angle}deg)`,
  } as CSSProperties;

  return (
    <span
      className={`court-marker arrow-marker ${preview ? 'is-preview' : ''}`}
      style={style}
      aria-hidden="true"
    />
  );
}
