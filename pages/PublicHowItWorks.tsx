import React from 'react';
import HowItWorks from './HowItWorks';
import { PublicPageLayout } from '../components/PublicPageLayout';

interface PublicHowItWorksProps {
  onGoToApp: () => void;
  onGoToHome: () => void;
  onShowHowItWorks: () => void;
  onShowAlgorithmDeepDive: () => void;
}

const PublicHowItWorks: React.FC<PublicHowItWorksProps> = (props) => {
  return (
    <PublicPageLayout {...props} currentPage="HowItWorks">
        <HowItWorks />
    </PublicPageLayout>
  );
};

export default PublicHowItWorks;
