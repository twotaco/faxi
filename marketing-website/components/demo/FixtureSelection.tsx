'use client';

import { DemoFixture } from '@/lib/api/types';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image';

interface FixtureSelectionProps {
  fixtures: DemoFixture[];
  selectedFixture: DemoFixture | null;
  onSelect: (fixture: DemoFixture) => void;
  isLoading?: boolean;
}

const categoryLabels: Record<string, { en: string; ja: string }> = {
  email: { en: 'Email', ja: 'メール' },
  shopping: { en: 'Shopping', ja: 'ショッピング' },
  'ai-chat': { en: 'AI Chat', ja: 'AIチャット' },
  payment: { en: 'Payment', ja: '支払い' },
};

export function FixtureSelection({
  fixtures,
  selectedFixture,
  onSelect,
  isLoading = false,
}: FixtureSelectionProps) {
  // Group fixtures by category
  const groupedFixtures = fixtures.reduce((acc, fixture) => {
    if (!acc[fixture.category]) {
      acc[fixture.category] = [];
    }
    acc[fixture.category].push(fixture);
    return acc;
  }, {} as Record<string, DemoFixture[]>);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-2">Select a Sample Fax</h2>
        <p className="text-muted-foreground">
          Choose from our test fixtures to see how Faxi processes different types of faxes
        </p>
      </div>

      {Object.entries(groupedFixtures).map(([category, categoryFixtures]) => (
        <div key={category} className="space-y-4">
          <h3 className="text-lg font-semibold capitalize">
            {categoryLabels[category]?.en || category}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categoryFixtures.map((fixture) => (
              <Card
                key={fixture.id}
                className={`cursor-pointer transition-all hover:shadow-lg ${
                  selectedFixture?.id === fixture.id
                    ? 'ring-2 ring-primary'
                    : ''
                }`}
                onClick={() => onSelect(fixture)}
              >
                <CardHeader className="p-4">
                  <div className="relative w-full h-40 mb-2 bg-gray-100 rounded overflow-hidden">
                    <Image
                      src={fixture.thumbnailUrl}
                      alt={`Sample fax demonstrating ${fixture.name}: ${fixture.description}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      loading="lazy"
                    />
                  </div>
                  <CardTitle className="text-base">{fixture.name}</CardTitle>
                  <CardDescription className="text-sm">
                    {fixture.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
