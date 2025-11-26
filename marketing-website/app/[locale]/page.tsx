import { HeroSection } from '@/components/home/HeroSection';
import { ProblemSolutionSection } from '@/components/home/ProblemSolutionSection';
import { UseCaseSection } from '@/components/home/UseCaseSection';
import { TestimonialsSection } from '@/components/home/TestimonialsSection';
import { CTABanner } from '@/components/ui/cta-banner';

export default function HomePage({ params: { locale } }: { params: { locale: string } }) {
  return (
    <>
      <HeroSection locale={locale} />
      <ProblemSolutionSection />
      <UseCaseSection locale={locale} />
      <TestimonialsSection />
      <CTABanner audience="families" locale={locale} />
    </>
  );
}
