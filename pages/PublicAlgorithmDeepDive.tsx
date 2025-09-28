import React from 'react';
import AlgorithmDeepDive from './AlgorithmDeepDive';
import { PublicPageLayout } from '../components/PublicPageLayout';

interface PublicAlgorithmDeepDiveProps {
  onGoToApp: () => void;
  onGoToHome: () => void;
  onShowHowItWorks: () => void;
  onShowAlgorithmDeepDive: () => void;
}

const PublicAlgorithmDeepDive: React.FC<PublicAlgorithmDeepDiveProps> = (props) => {
  return (
    <PublicPageLayout {...props} currentPage="AlgorithmDeepDive">
        <AlgorithmDeepDive />
    </PublicPageLayout>
  );
};

export default PublicAlgorithmDeepDive;
