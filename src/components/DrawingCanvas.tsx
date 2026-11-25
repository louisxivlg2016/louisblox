import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { translate } from '../game/language';

type Tool = 'brush' | 'eraser' | 'line' | 'rectangle' | 'filledRectangle' | 'ellipse' | 'filledEllipse';
type Point = { x: number; y: number };

const WIDTH = 256;
const HEIGHT = 192;
const COLORS = ['#17202a', '#ffffff', '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c', '#3498db', '#3157b7', '#9b59b6', '#ec87bf', '#795548'];
const TOOLS: Array<{ id: Tool; fr: string; en: string }> = [
  { id: 'brush', fr: 'Pinceau', en: 'Brush' },
  { id: 'eraser', fr: 'Gomme', en: 'Eraser' },
  { id: 'line', fr: 'Ligne', en: 'Line' },
  { id: 'rectangle', fr: 'Rectangle', en: 'Rectangle' },
  { id: 'filledRectangle', fr: 'Rectangle plein', en: 'Filled rectangle' },
  { id: 'ellipse', fr: 'Cercle', en: 'Ellipse' },
  { id: 'filledEllipse', fr: 'Cercle plein', en: 'Filled ellipse' },
];

function blankCanvas(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, WIDTH, HEIGHT);
}

export type DrawingCanvasHandle = { save: () => void };

export const DrawingCanvas = forwardRef<DrawingCanvasHandle, { initialImage?: string; onSave: (image: string) => void; onChange?: (image: string) => void; showSave?: boolean }>(function DrawingCanvas({ initialImage, onSave, onChange, showSave = true }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const startRef = useRef<Point>({ x: 0, y: 0 });
  const previousRef = useRef<Point>({ x: 0, y: 0 });
  const shapeSnapshotRef = useRef<ImageData | undefined>(undefined);
  const historyRef = useRef<ImageData[]>([]);
  const [tool, setTool] = useState<Tool>('brush');
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(6);
  const [historyLength, setHistoryLength] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useImperativeHandle(ref, () => ({
    save: () => {
      if (loaded && canvasRef.current) onSave(canvasRef.current.toDataURL('image/png'));
    },
  }), [loaded, onSave]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    blankCanvas(canvas);
    historyRef.current = [];
    setHistoryLength(0);
    if (!initialImage) {
      setLoaded(true);
      return;
    }
    let active = true;
    const image = new Image();
    image.onload = () => {
      if (!active) return;
      canvas.getContext('2d')!.drawImage(image, 0, 0, WIDTH, HEIGHT);
      setLoaded(true);
    };
    image.onerror = () => setLoaded(true);
    image.src = initialImage;
    return () => { active = false; };
  }, [initialImage]);

  const remember = () => {
    const context = canvasRef.current!.getContext('2d')!;
    historyRef.current = [...historyRef.current.slice(-29), context.getImageData(0, 0, WIDTH, HEIGHT)];
    setHistoryLength(historyRef.current.length);
  };

  const point = (event: ReactPointerEvent<HTMLCanvasElement>): Point => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) * WIDTH / bounds.width,
      y: (event.clientY - bounds.top) * HEIGHT / bounds.height,
    };
  };

  const configureStroke = (context: CanvasRenderingContext2D) => {
    context.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
    context.fillStyle = color;
    context.lineWidth = size;
    context.lineCap = 'round';
    context.lineJoin = 'round';
  };

  const drawShape = (context: CanvasRenderingContext2D, start: Point, end: Point, currentTool: Tool) => {
    configureStroke(context);
    context.beginPath();
    if (currentTool === 'line') {
      context.moveTo(start.x, start.y);
      context.lineTo(end.x, end.y);
      context.stroke();
      return;
    }
    if (currentTool === 'rectangle' || currentTool === 'filledRectangle') {
      context.rect(start.x, start.y, end.x - start.x, end.y - start.y);
    } else {
      context.ellipse((start.x + end.x) / 2, (start.y + end.y) / 2, Math.abs(end.x - start.x) / 2, Math.abs(end.y - start.y) / 2, 0, 0, Math.PI * 2);
    }
    if (currentTool === 'filledRectangle' || currentTool === 'filledEllipse') context.fill();
    else context.stroke();
  };

  const pointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!loaded || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const current = point(event);
    const context = event.currentTarget.getContext('2d')!;
    remember();
    drawingRef.current = true;
    startRef.current = current;
    previousRef.current = current;
    shapeSnapshotRef.current = context.getImageData(0, 0, WIDTH, HEIGHT);
    if (tool === 'brush' || tool === 'eraser') {
      configureStroke(context);
      context.beginPath();
      context.moveTo(current.x, current.y);
      context.lineTo(current.x + 0.01, current.y + 0.01);
      context.stroke();
    }
  };

  const pointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    event.preventDefault();
    const current = point(event);
    const context = event.currentTarget.getContext('2d')!;
    if (tool === 'brush' || tool === 'eraser') {
      configureStroke(context);
      context.beginPath();
      context.moveTo(previousRef.current.x, previousRef.current.y);
      context.lineTo(current.x, current.y);
      context.stroke();
    } else if (shapeSnapshotRef.current) {
      context.putImageData(shapeSnapshotRef.current, 0, 0);
      drawShape(context, startRef.current, current, tool);
    }
    previousRef.current = current;
  };

  const pointerEnd = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    shapeSnapshotRef.current = undefined;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    onChange?.(event.currentTarget.toDataURL('image/png'));
  };

  const undo = () => {
    const snapshot = historyRef.current.pop();
    if (!snapshot || !canvasRef.current) return;
    canvasRef.current.getContext('2d')!.putImageData(snapshot, 0, 0);
    setHistoryLength(historyRef.current.length);
    onChange?.(canvasRef.current.toDataURL('image/png'));
  };

  const clear = () => {
    if (!canvasRef.current) return;
    remember();
    blankCanvas(canvasRef.current);
    onChange?.(canvasRef.current.toDataURL('image/png'));
  };

  const toolButton = (id: Tool, label: string) => (
    <button key={id} type="button" className={tool === id ? 'primary-button' : 'secondary-button'} aria-pressed={tool === id} onClick={() => setTool(id)} style={{ padding: '7px 10px', fontSize: 13 }}>{label}</button>
  );

  return (
    <div data-drawing-editor>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {TOOLS.map(({ id, fr, en }) => toolButton(id, translate(fr, en)))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        {COLORS.map((value) => <button key={value} type="button" aria-label={translate(`Couleur ${value}`, `Color ${value}`)} aria-pressed={color === value} onClick={() => { setColor(value); if (tool === 'eraser') setTool('brush'); }} style={{ width: 28, height: 28, padding: 0, background: value, border: color === value ? '3px solid #f4c95d' : '2px solid #9aa99b', borderRadius: 4, cursor: 'pointer' }} />)}
        <input aria-label={translate('Choisir une couleur', 'Choose a color')} type="color" value={color} onChange={(event) => setColor(event.target.value)} style={{ width: 38, height: 32, padding: 0, border: 0, background: 'transparent' }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#eef4e9', fontSize: 13 }}>
          {translate('Trait', 'Stroke')}
          <input data-brush-size type="range" min="1" max="32" value={size} onChange={(event) => setSize(Number(event.target.value))} />
          <span style={{ minWidth: 18 }}>{size}</span>
        </label>
      </div>
      <canvas
        ref={canvasRef}
        data-drawing-canvas
        width={WIDTH}
        height={HEIGHT}
        aria-label={translate('Toile de dessin tactile', 'Touch drawing canvas')}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerEnd}
        onPointerCancel={pointerEnd}
        onContextMenu={(event) => event.preventDefault()}
        style={{ display: 'block', width: '100%', height: 'auto', aspectRatio: '4 / 3', marginBottom: 10, background: '#fff', border: '2px solid #70836d', boxSizing: 'border-box', touchAction: 'none', cursor: 'crosshair' }}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button type="button" className="secondary-button" data-undo-drawing disabled={!historyLength} onClick={undo}>{translate('Annuler', 'Undo')}</button>
        <button type="button" className="secondary-button" data-clear-drawing onClick={clear}>{translate('Tout effacer', 'Clear all')}</button>
        {showSave && <button type="button" className="primary-button" data-save-drawing disabled={!loaded} onClick={() => { if (canvasRef.current) onSave(canvasRef.current.toDataURL('image/png')); }}>{translate('Enregistrer le dessin', 'Save drawing')}</button>}
      </div>
    </div>
  );
});
