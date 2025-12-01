'use client';

import { useState, useEffect } from 'react';
import { BookOpen, PlayCircle, HelpCircle, AlertCircle } from 'lucide-react';

interface HelpNavigationProps {
  locale: string;
}

export function HelpNavigation({ locale }: HelpNavigationProps) {
  const [activeSection, setActiveSection] = useState('getting-started');

  const sections = [
    {
      id: 'getting-started',
      icon: BookOpen,
      label: locale === 'ja' ? '始め方' : 'Getting Started',
    },
    {
      id: 'instructions',
      icon: HelpCircle,
      label: locale === 'ja' ? '使い方' : 'How to Use',
    },
    {
      id: 'demo',
      icon: PlayCircle,
      label: locale === 'ja' ? 'デモ' : 'Interactive Demo',
    },
    {
      id: 'faq',
      icon: AlertCircle,
      label: locale === 'ja' ? 'よくある質問' : 'FAQ',
    },
  ];

  useEffect(() => {
    // Check URL hash on mount
    const hash = window.location.hash.slice(1);
    if (hash && sections.some(s => s.id === hash)) {
      setActiveSection(hash);
    }

    // Listen for hash changes
    const handleHashChange = () => {
      const newHash = window.location.hash.slice(1);
      if (newHash && sections.some(s => s.id === newHash)) {
        setActiveSection(newHash);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      const offset = 100; // Account for fixed header
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
    // Update URL hash
    window.history.pushState(null, '', `#${sectionId}`);
  };

  return (
    <nav className="sticky top-20 bg-white border-b border-gray-200 shadow-sm z-40">
      <div className="container mx-auto px-4">
        <div className="flex justify-center gap-2 py-4 overflow-x-auto">
          {sections.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            
            return (
              <button
                key={section.id}
                onClick={() => scrollToSection(section.id)}
                className={`
                  flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all whitespace-nowrap
                  ${isActive 
                    ? 'bg-faxi-brown text-white shadow-md' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }
                `}
              >
                <Icon className="h-5 w-5" />
                {section.label}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
