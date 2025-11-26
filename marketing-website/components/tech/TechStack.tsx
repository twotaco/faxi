'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Technology {
  name: string;
  category: 'frontend' | 'backend' | 'ai' | 'infrastructure';
  description: string;
  icon: string;
}

const technologies: Technology[] = [
  // Frontend
  {
    name: 'Next.js 14',
    category: 'frontend',
    description: 'React framework with App Router for server-side rendering and optimal performance',
    icon: '⚡'
  },
  {
    name: 'React 18',
    category: 'frontend',
    description: 'Modern UI library with hooks and concurrent features for responsive interfaces',
    icon: '⚛️'
  },
  {
    name: 'TypeScript',
    category: 'frontend',
    description: 'Type-safe JavaScript for robust code and better developer experience',
    icon: '📘'
  },
  {
    name: 'Tailwind CSS',
    category: 'frontend',
    description: 'Utility-first CSS framework for rapid UI development and consistent styling',
    icon: '🎨'
  },
  {
    name: 'Recharts',
    category: 'frontend',
    description: 'Composable charting library for interactive data visualizations',
    icon: '📊'
  },
  {
    name: 'Framer Motion',
    category: 'frontend',
    description: 'Animation library for smooth, performant UI transitions',
    icon: '✨'
  },
  
  // Backend
  {
    name: 'Express.js',
    category: 'backend',
    description: 'Fast, minimalist web framework for Node.js handling API requests',
    icon: '🚂'
  },
  {
    name: 'Node.js',
    category: 'backend',
    description: 'JavaScript runtime for scalable server-side applications',
    icon: '🟢'
  },
  {
    name: 'PostgreSQL',
    category: 'backend',
    description: 'Robust relational database for storing users, jobs, and metrics',
    icon: '🐘'
  },
  {
    name: 'Redis',
    category: 'backend',
    description: 'In-memory data store for job queues and caching',
    icon: '🔴'
  },
  {
    name: 'AWS S3',
    category: 'backend',
    description: 'Object storage for fax images and generated documents',
    icon: '☁️'
  },
  
  // AI
  {
    name: 'Claude (Anthropic)',
    category: 'ai',
    description: 'Advanced language model for intent extraction and natural language understanding',
    icon: '🤖'
  },
  {
    name: 'GPT-4 Vision',
    category: 'ai',
    description: 'Multimodal AI for OCR, handwriting recognition, and visual analysis',
    icon: '👁️'
  },
  {
    name: 'Custom ML Models',
    category: 'ai',
    description: 'Specialized models for annotation detection and form field recognition',
    icon: '🧠'
  },
  
  // Infrastructure
  {
    name: 'Telnyx',
    category: 'infrastructure',
    description: 'Cloud communications platform for sending and receiving faxes',
    icon: '📠'
  },
  {
    name: 'Vercel',
    category: 'infrastructure',
    description: 'Deployment platform for Next.js with edge network and automatic scaling',
    icon: '▲'
  },
  {
    name: 'Docker',
    category: 'infrastructure',
    description: 'Containerization for consistent development and production environments',
    icon: '🐳'
  }
];

const categoryColors = {
  frontend: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  backend: 'bg-purple-500/10 text-purple-700 border-purple-500/20',
  ai: 'bg-green-500/10 text-green-700 border-green-500/20',
  infrastructure: 'bg-orange-500/10 text-orange-700 border-orange-500/20'
};

const categoryLabels = {
  frontend: 'Frontend',
  backend: 'Backend',
  ai: 'AI & Machine Learning',
  infrastructure: 'Infrastructure'
};

export function TechStack() {
  const categories = ['frontend', 'backend', 'ai', 'infrastructure'] as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Technology Stack</CardTitle>
        <CardDescription>
          Modern, scalable technologies powering the Faxi platform
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-8">
          {categories.map((category) => (
            <div key={category}>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-sm border ${categoryColors[category]}`}>
                  {categoryLabels[category]}
                </span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {technologies
                  .filter((tech) => tech.category === category)
                  .map((tech) => (
                    <div
                      key={tech.name}
                      className="p-4 border rounded-lg hover:shadow-md transition-shadow bg-card"
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl" role="img" aria-label={tech.name}>
                          {tech.icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm mb-1">{tech.name}</h4>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {tech.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>

        {/* Key Highlights */}
        <div className="mt-8 p-4 bg-muted/50 rounded-lg">
          <h3 className="font-semibold mb-3">Why This Stack?</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <span className="text-green-600">✓</span>
              <span><strong>Performance:</strong> Server-side rendering and edge deployment for fast load times</span>
            </li>
            <li className="flex gap-2">
              <span className="text-green-600">✓</span>
              <span><strong>Scalability:</strong> Horizontal scaling with containerization and cloud infrastructure</span>
            </li>
            <li className="flex gap-2">
              <span className="text-green-600">✓</span>
              <span><strong>Reliability:</strong> Type safety, robust error handling, and comprehensive testing</span>
            </li>
            <li className="flex gap-2">
              <span className="text-green-600">✓</span>
              <span><strong>Developer Experience:</strong> Modern tooling with hot reload and TypeScript support</span>
            </li>
            <li className="flex gap-2">
              <span className="text-green-600">✓</span>
              <span><strong>AI-First:</strong> Integration with leading AI models for state-of-the-art accuracy</span>
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
