import { useTranslations } from 'next-intl';
import { ArchitectureDiagram } from '@/components/tech/ArchitectureDiagram';
import { TechStack } from '@/components/tech/TechStack';
import { MCPIntegration } from '@/components/tech/MCPIntegration';
import { AIModels } from '@/components/tech/AIModels';

export default function TechPage() {
  const t = useTranslations('navigation');

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-7xl mx-auto">
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-4">{t('tech')}</h1>
          <p className="text-lg text-muted-foreground">
            Technical architecture and AI models
          </p>
        </div>
        
        {/* Architecture Diagram */}
        <div className="mb-8">
          <ArchitectureDiagram />
        </div>

        {/* AI Models */}
        <div className="mb-8">
          <AIModels />
        </div>

        {/* Tech Stack */}
        <div className="mb-8">
          <TechStack />
        </div>

        {/* MCP Integration */}
        <div className="mb-8">
          <MCPIntegration />
        </div>
      </div>
    </div>
  );
}
