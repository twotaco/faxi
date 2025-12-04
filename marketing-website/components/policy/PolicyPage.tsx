interface PolicyPageProps {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}

export function PolicyPage({ title, lastUpdated, children }: PolicyPageProps) {
  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <h1 className="text-4xl font-bold mb-4 text-faxi-brown-dark">{title}</h1>
        <p className="text-faxi-grey mb-8">最終更新日: {lastUpdated}</p>
        <div className="prose prose-lg max-w-none prose-headings:text-faxi-brown-dark prose-headings:font-semibold prose-p:text-faxi-grey prose-li:text-faxi-grey prose-strong:text-faxi-brown">
          {children}
        </div>
      </div>
    </div>
  );
}
