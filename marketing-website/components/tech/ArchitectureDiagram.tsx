'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface TooltipState {
  component: string | null;
  x: number;
  y: number;
}

export function ArchitectureDiagram() {
  const [tooltip, setTooltip] = useState<TooltipState>({ component: null, x: 0, y: 0 });

  const componentDescriptions: Record<string, string> = {
    'marketing': 'Next.js marketing website with bilingual support, interactive demo, and metrics dashboard',
    'backend': 'Express.js REST API handling fax processing, AI orchestration, and metrics aggregation',
    'vision': 'AI-powered vision analysis using Claude/GPT-4 Vision for OCR and handwriting recognition',
    'annotation': 'Visual annotation detector identifying checkmarks, circles, arrows, and underlines',
    'intent': 'Intent extraction service determining user actions and parameters from fax content',
    'mcp': 'Model Context Protocol servers extending capabilities (email, shopping, AI chat, payment, appointments)',
    'database': 'PostgreSQL database storing users, fax jobs, metrics, and processing history',
    'redis': 'Redis queue for asynchronous fax processing and job management',
    's3': 'S3 storage for fax images, generated PDFs, and processing artifacts',
    'telnyx': 'Telnyx API for sending and receiving faxes via cloud infrastructure'
  };

  const handleMouseEnter = (component: string, event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltip({
      component,
      x: rect.left + rect.width / 2,
      y: rect.top - 10
    });
  };

  const handleMouseLeave = () => {
    setTooltip({ component: null, x: 0, y: 0 });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>System Architecture</CardTitle>
        <CardDescription>
          High-level overview of Faxi&apos;s components and data flow
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Mermaid-style diagram rendered as SVG */}
          <svg
            viewBox="0 0 800 600"
            className="w-full h-auto"
            style={{ maxHeight: '600px' }}
            role="img"
            aria-label="Faxi system architecture diagram showing marketing website, backend API, AI processing pipeline with vision AI, annotation detector and intent extractor, MCP servers, and infrastructure including PostgreSQL, Redis, S3, and Telnyx"
          >
            {/* Marketing Website Layer */}
            <g
              onMouseEnter={(e) => handleMouseEnter('marketing', e)}
              onMouseLeave={handleMouseLeave}
              className="cursor-pointer"
            >
              <rect x="50" y="20" width="700" height="80" fill="#3b82f6" fillOpacity="0.1" stroke="#3b82f6" strokeWidth="2" rx="8" />
              <text x="400" y="50" textAnchor="middle" fill="#3b82f6" fontSize="16" fontWeight="bold">
                Marketing Website (Next.js)
              </text>
              <text x="400" y="75" textAnchor="middle" fill="#64748b" fontSize="12">
                Hero • Use Cases • Demo • Metrics Dashboard
              </text>
            </g>

            {/* Arrow down */}
            <line x1="400" y1="100" x2="400" y2="140" stroke="#64748b" strokeWidth="2" markerEnd="url(#arrowhead)" />
            <text x="420" y="125" fill="#64748b" fontSize="11">HTTP/REST</text>

            {/* Backend API Layer */}
            <g
              onMouseEnter={(e) => handleMouseEnter('backend', e)}
              onMouseLeave={handleMouseLeave}
              className="cursor-pointer"
            >
              <rect x="50" y="140" width="700" height="80" fill="#8b5cf6" fillOpacity="0.1" stroke="#8b5cf6" strokeWidth="2" rx="8" />
              <text x="400" y="170" textAnchor="middle" fill="#8b5cf6" fontSize="16" fontWeight="bold">
                Backend API (Express.js)
              </text>
              <text x="400" y="195" textAnchor="middle" fill="#64748b" fontSize="12">
                Demo Endpoints • Metrics API • Webhook Handlers
              </text>
            </g>

            {/* Arrow down */}
            <line x1="400" y1="220" x2="400" y2="260" stroke="#64748b" strokeWidth="2" markerEnd="url(#arrowhead)" />

            {/* AI Services Layer */}
            <g>
              <rect x="50" y="260" width="700" height="120" fill="#10b981" fillOpacity="0.05" stroke="#10b981" strokeWidth="2" rx="8" />
              <text x="400" y="285" textAnchor="middle" fill="#10b981" fontSize="16" fontWeight="bold">
                AI Processing Pipeline
              </text>

              {/* Vision AI */}
              <g
                onMouseEnter={(e) => handleMouseEnter('vision', e)}
                onMouseLeave={handleMouseLeave}
                className="cursor-pointer"
              >
                <rect x="70" y="300" width="200" height="60" fill="#10b981" fillOpacity="0.1" stroke="#10b981" strokeWidth="1.5" rx="6" />
                <text x="170" y="325" textAnchor="middle" fill="#10b981" fontSize="13" fontWeight="600">
                  Vision AI
                </text>
                <text x="170" y="345" textAnchor="middle" fill="#64748b" fontSize="10">
                  OCR • Handwriting
                </text>
              </g>

              {/* Annotation Detector */}
              <g
                onMouseEnter={(e) => handleMouseEnter('annotation', e)}
                onMouseLeave={handleMouseLeave}
                className="cursor-pointer"
              >
                <rect x="290" y="300" width="200" height="60" fill="#10b981" fillOpacity="0.1" stroke="#10b981" strokeWidth="1.5" rx="6" />
                <text x="390" y="325" textAnchor="middle" fill="#10b981" fontSize="13" fontWeight="600">
                  Annotation Detector
                </text>
                <text x="390" y="345" textAnchor="middle" fill="#64748b" fontSize="10">
                  Checkmarks • Circles
                </text>
              </g>

              {/* Intent Extractor */}
              <g
                onMouseEnter={(e) => handleMouseEnter('intent', e)}
                onMouseLeave={handleMouseLeave}
                className="cursor-pointer"
              >
                <rect x="510" y="300" width="200" height="60" fill="#10b981" fillOpacity="0.1" stroke="#10b981" strokeWidth="1.5" rx="6" />
                <text x="610" y="325" textAnchor="middle" fill="#10b981" fontSize="13" fontWeight="600">
                  Intent Extractor
                </text>
                <text x="610" y="345" textAnchor="middle" fill="#64748b" fontSize="10">
                  Action Classification
                </text>
              </g>
            </g>

            {/* Arrow down */}
            <line x1="400" y1="380" x2="400" y2="420" stroke="#64748b" strokeWidth="2" markerEnd="url(#arrowhead)" />

            {/* MCP Servers Layer */}
            <g
              onMouseEnter={(e) => handleMouseEnter('mcp', e)}
              onMouseLeave={handleMouseLeave}
              className="cursor-pointer"
            >
              <rect x="50" y="420" width="700" height="60" fill="#f59e0b" fillOpacity="0.1" stroke="#f59e0b" strokeWidth="2" rx="8" />
              <text x="400" y="445" textAnchor="middle" fill="#f59e0b" fontSize="16" fontWeight="bold">
                MCP Servers
              </text>
              <text x="400" y="465" textAnchor="middle" fill="#64748b" fontSize="12">
                Email • Shopping • AI Chat • Payment • Appointments
              </text>
            </g>

            {/* Infrastructure Layer */}
            <g>
              <text x="400" y="510" textAnchor="middle" fill="#64748b" fontSize="14" fontWeight="600">
                Infrastructure
              </text>

              {/* PostgreSQL */}
              <g
                onMouseEnter={(e) => handleMouseEnter('database', e)}
                onMouseLeave={handleMouseLeave}
                className="cursor-pointer"
              >
                <rect x="70" y="520" width="150" height="50" fill="#6366f1" fillOpacity="0.1" stroke="#6366f1" strokeWidth="1.5" rx="6" />
                <text x="145" y="545" textAnchor="middle" fill="#6366f1" fontSize="12" fontWeight="600">
                  PostgreSQL
                </text>
                <text x="145" y="560" textAnchor="middle" fill="#64748b" fontSize="10">
                  Data Storage
                </text>
              </g>

              {/* Redis */}
              <g
                onMouseEnter={(e) => handleMouseEnter('redis', e)}
                onMouseLeave={handleMouseLeave}
                className="cursor-pointer"
              >
                <rect x="240" y="520" width="150" height="50" fill="#dc2626" fillOpacity="0.1" stroke="#dc2626" strokeWidth="1.5" rx="6" />
                <text x="315" y="545" textAnchor="middle" fill="#dc2626" fontSize="12" fontWeight="600">
                  Redis
                </text>
                <text x="315" y="560" textAnchor="middle" fill="#64748b" fontSize="10">
                  Queue & Cache
                </text>
              </g>

              {/* S3 */}
              <g
                onMouseEnter={(e) => handleMouseEnter('s3', e)}
                onMouseLeave={handleMouseLeave}
                className="cursor-pointer"
              >
                <rect x="410" y="520" width="150" height="50" fill="#ea580c" fillOpacity="0.1" stroke="#ea580c" strokeWidth="1.5" rx="6" />
                <text x="485" y="545" textAnchor="middle" fill="#ea580c" fontSize="12" fontWeight="600">
                  S3
                </text>
                <text x="485" y="560" textAnchor="middle" fill="#64748b" fontSize="10">
                  File Storage
                </text>
              </g>

              {/* Telnyx */}
              <g
                onMouseEnter={(e) => handleMouseEnter('telnyx', e)}
                onMouseLeave={handleMouseLeave}
                className="cursor-pointer"
              >
                <rect x="580" y="520" width="150" height="50" fill="#059669" fillOpacity="0.1" stroke="#059669" strokeWidth="1.5" rx="6" />
                <text x="655" y="545" textAnchor="middle" fill="#059669" fontSize="12" fontWeight="600">
                  Telnyx
                </text>
                <text x="655" y="560" textAnchor="middle" fill="#64748b" fontSize="10">
                  Fax API
                </text>
              </g>
            </g>

            {/* Arrow marker definition */}
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="10"
                refX="9"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 10 3, 0 6" fill="#64748b" />
              </marker>
            </defs>
          </svg>

          {/* Tooltip */}
          {tooltip.component && (
            <div
              className="fixed z-50 px-3 py-2 text-sm bg-gray-900 text-white rounded-lg shadow-lg max-w-xs"
              style={{
                left: `${tooltip.x}px`,
                top: `${tooltip.y}px`,
                transform: 'translate(-50%, -100%)',
                pointerEvents: 'none'
              }}
            >
              {componentDescriptions[tooltip.component]}
            </div>
          )}
        </div>

        {/* Data Flow Description */}
        <div className="mt-8 space-y-4">
          <h3 className="text-lg font-semibold">Data Flow</h3>
          <ol className="space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <span className="font-semibold text-foreground">1.</span>
              <span>User sends fax or uploads image via marketing website demo</span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-foreground">2.</span>
              <span>Backend API receives request and queues processing job in Redis</span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-foreground">3.</span>
              <span>AI pipeline analyzes image: Vision AI extracts text, Annotation Detector finds marks, Intent Extractor determines action</span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-foreground">4.</span>
              <span>MCP servers execute actions (send email, place order, book appointment, etc.)</span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-foreground">5.</span>
              <span>Results stored in PostgreSQL, files saved to S3, confirmation fax sent via Telnyx</span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-foreground">6.</span>
              <span>Metrics aggregated and displayed on dashboard for monitoring and analysis</span>
            </li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
