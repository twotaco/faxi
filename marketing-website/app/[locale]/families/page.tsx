import FamiliesHeroSection from '@/components/families/FamiliesHeroSection';
import FamiliesProblemSection from '@/components/families/FamiliesProblemSection';
import FamiliesSolutionSection from '@/components/families/FamiliesSolutionSection';
import FamiliesUseCasesSection from '@/components/families/FamiliesUseCasesSection';
import FamiliesTestimonialsSection from '@/components/families/FamiliesTestimonialsSection';
import FamiliesTimeSavingsSection from '@/components/families/FamiliesTimeSavingsSection';
import { CTABanner } from '@/components/ui/cta-banner';

export default function FamiliesPage({ params: { locale } }: { params: { locale: string } }) {
  return (
    <div className="min-h-screen">
      <FamiliesHeroSection locale={locale} />
      <FamiliesProblemSection />
      <FamiliesSolutionSection />
      <FamiliesTimeSavingsSection />
      <FamiliesUseCasesSection locale={locale} />
      <FamiliesTestimonialsSection />
      <CTABanner audience="families" locale={locale} />
    </div>
  );
}
