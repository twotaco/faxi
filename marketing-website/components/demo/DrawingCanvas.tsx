'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface DrawingCanvasProps {
  onSubmit: (imageData: string) => void;
  isProcessing?: boolean;
}

export function DrawingCanvas({ onSubmit, isProcessing = false }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(3);

  // Initialize canvas with white background
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size based on container
    const container = canvas.parentElement;
    if (container) {
      canvas.width = container.clientWidth;
      canvas.height = 400;
    }

    // White background (important for fax)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Set default stroke style
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [strokeColor, strokeWidth]);

  useEffect(() => {
    initCanvas();

    const handleResize = () => {
      // Save current drawing
      const canvas = canvasRef.current;
      if (!canvas) return;

      const imageData = canvas.toDataURL();

      // Resize and restore
      initCanvas();

      if (hasDrawn) {
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.onload = () => {
          ctx?.drawImage(img, 0, 0);
        };
        img.src = imageData;
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [initCanvas, hasDrawn]);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      const touch = e.touches[0];
      if (!touch) return null;
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const coords = getCoordinates(e);
    if (!coords) return;

    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();

    const coords = getCoordinates(e);
    if (!coords) return;

    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const stopDrawing = () => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.closePath();
    }
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    initCanvas();
    setHasDrawn(false);
  };

  const handleSubmit = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Export as PNG data URL
    const imageData = canvas.toDataURL('image/png');
    onSubmit(imageData);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold mb-2">Draw Your Fax</h2>
        <p className="text-muted-foreground mb-4">
          Write or draw your message below. Use your mouse, trackpad, or touchscreen.
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
          <p className="font-semibold mb-1">Tip</p>
          <p>
            Try writing a message like &quot;Search for wireless headphones&quot; or &quot;Send email to John: Meeting at 3pm&quot;
            to see how the AI interprets handwritten requests.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-4 mb-4 pb-4 border-b">
            <div className="flex items-center gap-2">
              <label htmlFor="stroke-color" className="text-sm font-medium">
                Color:
              </label>
              <input
                id="stroke-color"
                type="color"
                value={strokeColor}
                onChange={(e) => setStrokeColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border border-gray-300"
              />
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="stroke-width" className="text-sm font-medium">
                Size:
              </label>
              <input
                id="stroke-width"
                type="range"
                min="1"
                max="10"
                value={strokeWidth}
                onChange={(e) => setStrokeWidth(Number(e.target.value))}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground w-4">{strokeWidth}</span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={clearCanvas}
              disabled={isProcessing}
            >
              Clear
            </Button>
          </div>

          {/* Canvas */}
          <div className="border-2 border-gray-200 rounded-lg overflow-hidden bg-white">
            <canvas
              ref={canvasRef}
              className="w-full cursor-crosshair touch-none"
              style={{ height: '400px' }}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
          </div>

          {/* Submit */}
          <div className="mt-4">
            <Button
              onClick={handleSubmit}
              disabled={!hasDrawn || isProcessing}
              className="w-full"
            >
              {isProcessing ? 'Processing...' : 'Process Drawing'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
