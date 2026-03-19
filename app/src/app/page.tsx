import { NewReportWizard } from '@/components/NewReportWizard';

/**
 * The New Report wizard.
 *
 * The `?from=<reportId>` round trip back from a generated report is read inside
 * the wizard's mount effect rather than through useSearchParams, so this route
 * still prerenders and hydrates normally instead of being served as a shell
 * around a Suspense boundary that never resolves.
 */
export default function WizardPage() {
  return <NewReportWizard />;
}
