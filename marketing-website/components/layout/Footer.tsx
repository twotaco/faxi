import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Github, FileText, Book } from 'lucide-react';

export function Footer({ locale }: { locale: string }) {
  const t = useTranslations('navigation');

  return (
    <footer className="border-t mt-auto bg-muted/30">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="font-bold text-lg mb-4">Faxi</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Connecting fax machines to the internet with AI
            </p>
            <div className="flex gap-3">
              <a
                href="https://github.com/faxi-ai/faxi"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="GitHub"
              >
                <Github className="h-5 w-5" />
              </a>
            </div>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">{locale === 'ja' ? 'サービス' : 'Services'}</h4>
            <ul className="space-y-2">
              <li>
                <Link href={`/${locale}/service`} className="text-sm text-muted-foreground hover:text-foreground hover:underline">
                  {t('service')}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/partnering`} className="text-sm text-muted-foreground hover:text-foreground hover:underline">
                  {t('partnering')}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/demo`} className="text-sm text-muted-foreground hover:text-foreground hover:underline">
                  {t('demo')}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/tech`} className="text-sm text-muted-foreground hover:text-foreground hover:underline">
                  {t('tech')}
                </Link>
              </li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">{locale === 'ja' ? '開発者向け' : 'Developers'}</h4>
            <ul className="space-y-2">
              <li>
                <a
                  href="https://github.com/faxi-ai/faxi"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-foreground hover:underline inline-flex items-center gap-1"
                >
                  <Github className="h-3 w-3" />
                  GitHub
                </a>
              </li>
              <li>
                <a
                  href="https://docs.faxi.jp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-foreground hover:underline inline-flex items-center gap-1"
                >
                  <Book className="h-3 w-3" />
                  {locale === 'ja' ? 'ドキュメント' : 'Documentation'}
                </a>
              </li>
              <li>
                <a
                  href="https://api.faxi.jp/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-foreground hover:underline inline-flex items-center gap-1"
                >
                  <FileText className="h-3 w-3" />
                  API {locale === 'ja' ? 'ドキュメント' : 'Docs'}
                </a>
              </li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">{locale === 'ja' ? '法的情報' : 'Legal'}</h4>
            <ul className="space-y-2">
              <li>
                <Link href={`/${locale}/privacy`} className="text-sm text-muted-foreground hover:text-foreground hover:underline">
                  {t('privacy')}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/terms`} className="text-sm text-muted-foreground hover:text-foreground hover:underline">
                  {t('terms')}
                </Link>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Faxi. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
