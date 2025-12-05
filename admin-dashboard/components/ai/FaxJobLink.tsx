import { ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface FaxJobLinkProps {
  faxJobId: string;
  className?: string;
}

export function FaxJobLink({ faxJobId, className = '' }: FaxJobLinkProps) {
  if (!faxJobId) {
    return <span className="text-gray-400 text-sm">N/A</span>;
  }

  return (
    <Link
      href={`/dashboard/jobs/${faxJobId}`}
      className={`inline-flex items-center space-x-1 text-blue-600 hover:text-blue-800 hover:underline transition-colors ${className}`}
      target="_blank"
      rel="noopener noreferrer"
    >
      <span className="text-sm font-mono">{faxJobId.slice(0, 8)}...</span>
      <ExternalLink className="w-3 h-3" />
    </Link>
  );
}
