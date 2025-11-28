'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface MCPServer {
  name: string;
  purpose: string;
  capabilities: string[];
  exampleUseCase: string;
  icon: string;
}

const mcpServers: MCPServer[] = [
  {
    name: 'Email MCP',
    purpose: 'Send and manage emails on behalf of users',
    capabilities: [
      'Send emails with attachments',
      'Reply to email threads',
      'Search and retrieve emails',
      'Manage email folders'
    ],
    exampleUseCase: 'User faxes a handwritten letter → AI extracts content → Email sent to recipient',
    icon: '📧'
  },
  {
    name: 'Shopping MCP',
    purpose: 'Browse products and place orders from e-commerce platforms',
    capabilities: [
      'Search product catalogs',
      'Add items to cart',
      'Process payments',
      'Track order status'
    ],
    exampleUseCase: 'User circles products in catalog → AI detects selections → Order placed automatically',
    icon: '🛒'
  },
  {
    name: 'AI Chat MCP',
    purpose: 'Enable conversational AI interactions via fax',
    capabilities: [
      'Answer questions',
      'Provide recommendations',
      'Explain complex topics',
      'Multi-turn conversations'
    ],
    exampleUseCase: 'User writes question on fax → AI generates response → Answer faxed back',
    icon: '💬'
  },
  {
    name: 'Payment MCP',
    purpose: 'Process payments and manage financial transactions',
    capabilities: [
      'Register payment methods',
      'Process bill payments',
      'Generate payment barcodes',
      'Transaction history'
    ],
    exampleUseCase: 'User faxes utility bill → AI extracts amount → Payment processed via registered method',
    icon: '💳'
  },
  {
    name: 'Appointment MCP',
    purpose: 'Schedule and manage appointments with service providers',
    capabilities: [
      'Check availability',
      'Book appointments',
      'Send reminders',
      'Reschedule or cancel'
    ],
    exampleUseCase: 'User requests doctor appointment → AI finds available slots → Appointment confirmed',
    icon: '📅'
  }
];

export function MCPIntegration() {
  const [expandedServer, setExpandedServer] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);

  const toggleServer = (name: string) => {
    setExpandedServer(expandedServer === name ? null : name);
  };

  const exampleCode = `// Example: Integrating a new MCP server
import { MCPServer } from '@modelcontextprotocol/sdk';

class WeatherMCPServer extends MCPServer {
  async getWeather(location: string) {
    // Fetch weather data
    const weather = await weatherAPI.get(location);
    
    return {
      temperature: weather.temp,
      conditions: weather.conditions,
      forecast: weather.forecast
    };
  }
}

// Register with Faxi
faxiSystem.registerMCP('weather', new WeatherMCPServer());

// Now users can fax: "What&apos;s the weather in Tokyo?"
// AI extracts intent → Weather MCP called → Response faxed back`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>MCP Integration</CardTitle>
        <CardDescription>
          Model Context Protocol servers extend Faxi&apos;s capabilities to interact with external services
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Overview */}
        <div className="mb-6 p-4 bg-muted/50 rounded-lg">
          <h3 className="font-semibold mb-2">What is MCP?</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Model Context Protocol (MCP) is an open standard that enables AI systems to securely connect with external data sources and tools. 
            Faxi uses MCP servers to extend functionality beyond basic fax processing, allowing users to interact with email, shopping, 
            appointments, and more—all through their familiar fax machine.
          </p>
        </div>

        {/* Available MCP Servers */}
        <div className="space-y-3 mb-6">
          <h3 className="text-lg font-semibold">Available MCP Servers</h3>
          {mcpServers.map((server) => (
            <div
              key={server.name}
              className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow"
            >
              <button
                onClick={() => toggleServer(server.name)}
                className="w-full p-4 flex items-center justify-between bg-card hover:bg-muted/50 transition-colors text-left"
                aria-expanded={expandedServer === server.name}
                aria-label={`${expandedServer === server.name ? 'Collapse' : 'Expand'} ${server.name} server details`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl" role="img" aria-label={server.name}>
                    {server.icon}
                  </span>
                  <div>
                    <h4 className="font-semibold">{server.name}</h4>
                    <p className="text-sm text-muted-foreground">{server.purpose}</p>
                  </div>
                </div>
                <span className="text-muted-foreground" aria-hidden="true">
                  {expandedServer === server.name ? '−' : '+'}
                </span>
              </button>
              
              {expandedServer === server.name && (
                <div className="p-4 border-t bg-muted/20">
                  <div className="mb-3">
                    <h5 className="text-sm font-semibold mb-2">Capabilities:</h5>
                    <ul className="space-y-1">
                      {server.capabilities.map((capability, idx) => (
                        <li key={idx} className="text-sm text-muted-foreground flex gap-2">
                          <span className="text-amber-700">✓</span>
                          <span>{capability}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <h5 className="text-sm font-semibold mb-1 text-amber-700">Example Use Case:</h5>
                    <p className="text-sm text-stone-700">{server.exampleUseCase}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Extensibility */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">Extensibility</h3>
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            The MCP architecture makes Faxi infinitely extensible. Organizations can develop custom MCP servers 
            to integrate with their own systems—healthcare records, inventory management, CRM platforms, and more. 
            This allows Faxi to adapt to any use case while maintaining a simple fax interface for users.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg bg-card">
              <div className="text-2xl mb-2">🏥</div>
              <h4 className="font-semibold text-sm mb-1">Healthcare</h4>
              <p className="text-xs text-muted-foreground">
                Integrate with EHR systems for appointment booking and prescription refills
              </p>
            </div>
            <div className="p-4 border rounded-lg bg-card">
              <div className="text-2xl mb-2">🏛️</div>
              <h4 className="font-semibold text-sm mb-1">Government</h4>
              <p className="text-xs text-muted-foreground">
                Connect to public services for permit applications and benefit enrollment
              </p>
            </div>
            <div className="p-4 border rounded-lg bg-card">
              <div className="text-2xl mb-2">🏢</div>
              <h4 className="font-semibold text-sm mb-1">Enterprise</h4>
              <p className="text-xs text-muted-foreground">
                Build custom integrations for internal workflows and legacy systems
              </p>
            </div>
          </div>
        </div>

        {/* Code Example (Optional) */}
        <div>
          <button
            onClick={() => setShowCode(!showCode)}
            className="text-sm font-semibold text-faxi-brown hover:text-faxi-brown-dark mb-3"
            aria-expanded={showCode}
            aria-label={showCode ? 'Hide code example' : 'Show code example'}
          >
            {showCode ? '− Hide' : '+ Show'} Code Example
          </button>
          
          {showCode && (
            <div className="relative">
              <pre className="p-4 bg-gray-900 text-gray-100 rounded-lg overflow-x-auto text-xs leading-relaxed">
                <code>{exampleCode}</code>
              </pre>
              <div className="mt-2 text-xs text-muted-foreground">
                Example showing how to create and register a custom MCP server
              </div>
            </div>
          )}
        </div>

        {/* Benefits */}
        <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <h3 className="font-semibold mb-2 text-amber-700">Why MCP Matters</h3>
          <ul className="space-y-1 text-sm text-stone-700">
            <li className="flex gap-2">
              <span>•</span>
              <span><strong>Standardized:</strong> Open protocol ensures compatibility and interoperability</span>
            </li>
            <li className="flex gap-2">
              <span>•</span>
              <span><strong>Secure:</strong> Built-in authentication and authorization mechanisms</span>
            </li>
            <li className="flex gap-2">
              <span>•</span>
              <span><strong>Scalable:</strong> Add new capabilities without modifying core system</span>
            </li>
            <li className="flex gap-2">
              <span>•</span>
              <span><strong>Future-proof:</strong> Adapt to new services and technologies as they emerge</span>
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
