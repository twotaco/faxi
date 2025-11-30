'use client';

import { useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface TextToFaxProps {
  onSubmit: (imageData: string) => void;
  isProcessing?: boolean;
}

const TEMPLATES = [
  { id: 'email', label: 'Email', placeholder: 'Send email to john@example.com\n\nSubject: Meeting Tomorrow\n\nHi John,\n\nCan we reschedule our meeting to 3pm?\n\nThanks' },
  { id: 'shopping', label: 'Shopping', placeholder: 'Search for:\n- Wireless headphones\n- Under $100\n- Good reviews' },
  { id: 'question', label: 'AI Question', placeholder: 'Question:\nWhat is the weather forecast for Tokyo this week?' },
  { id: 'custom', label: 'Custom', placeholder: 'Write your message here...' },
];

export function TextToFax({ onSubmit, isProcessing = false }: TextToFaxProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [text, setText] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('custom');
  const [fontFamily, setFontFamily] = useState('handwriting');
  const [fontSize, setFontSize] = useState(20);

  const fontOptions = [
    { id: 'handwriting', label: 'Handwriting', font: 'cursive' },
    { id: 'print', label: 'Print', font: 'sans-serif' },
    { id: 'typewriter', label: 'Typewriter', font: 'monospace' },
  ];

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = TEMPLATES.find(t => t.id === templateId);
    if (template && templateId !== 'custom') {
      setText(template.placeholder);
    }
  };

  const renderTextToCanvas = (): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Set canvas size
    canvas.width = 800;
    canvas.height = 600;

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw fax-style header
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, canvas.width, 60);
    ctx.fillStyle = '#333333';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('FAX MESSAGE', 30, 38);

    // Draw date
    const date = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(date, canvas.width - 30, 38);
    ctx.textAlign = 'left';

    // Draw separator line
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(30, 70);
    ctx.lineTo(canvas.width - 30, 70);
    ctx.stroke();

    // Draw main text
    const selectedFont = fontOptions.find(f => f.id === fontFamily)?.font || 'cursive';
    ctx.fillStyle = '#000000';
    ctx.font = `${fontSize}px ${selectedFont}`;

    const lines = text.split('\n');
    const lineHeight = fontSize * 1.4;
    let y = 100;

    lines.forEach(line => {
      // Word wrap for long lines
      const words = line.split(' ');
      let currentLine = '';
      const maxWidth = canvas.width - 60;

      words.forEach(word => {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        const metrics = ctx.measureText(testLine);

        if (metrics.width > maxWidth && currentLine) {
          ctx.fillText(currentLine, 30, y);
          y += lineHeight;
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      });

      if (currentLine) {
        ctx.fillText(currentLine, 30, y);
        y += lineHeight;
      }

      // Handle empty lines
      if (line === '') {
        y += lineHeight * 0.5;
      }
    });

    // Return data URL
    return canvas.toDataURL('image/png');
  };

  const handleSubmit = () => {
    const imageData = renderTextToCanvas();
    if (imageData) {
      onSubmit(imageData);
    }
  };

  const currentPlaceholder = TEMPLATES.find(t => t.id === selectedTemplate)?.placeholder || '';

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold mb-2">Type Your Message</h2>
        <p className="text-muted-foreground mb-4">
          Type a message and we&apos;ll convert it to a fax-style image for processing.
        </p>
      </div>

      <Card>
        <CardContent className="p-4">
          {/* Template Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Quick Templates</label>
            <div className="flex flex-wrap gap-2">
              {TEMPLATES.map(template => (
                <Button
                  key={template.id}
                  variant={selectedTemplate === template.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleTemplateSelect(template.id)}
                >
                  {template.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Font Options */}
          <div className="flex flex-wrap items-center gap-4 mb-4 pb-4 border-b">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Style:</label>
              <div className="flex gap-1">
                {fontOptions.map(option => (
                  <Button
                    key={option.id}
                    variant={fontFamily === option.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFontFamily(option.id)}
                    style={{ fontFamily: option.font }}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="font-size" className="text-sm font-medium">
                Size:
              </label>
              <input
                id="font-size"
                type="range"
                min="14"
                max="32"
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground w-6">{fontSize}</span>
            </div>
          </div>

          {/* Text Area */}
          <div className="mb-4">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={currentPlaceholder}
              className="w-full h-48 p-4 border rounded-lg resize-none font-mono text-base focus:outline-none focus:ring-2 focus:ring-primary"
              style={{
                fontFamily: fontOptions.find(f => f.id === fontFamily)?.font,
                fontSize: `${Math.min(fontSize, 18)}px`
              }}
            />
            <p className="text-sm text-muted-foreground mt-1">
              {text.length} characters
            </p>
          </div>

          {/* Hidden canvas for rendering */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={!text.trim() || isProcessing}
            className="w-full"
          >
            {isProcessing ? 'Processing...' : 'Process Message'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
