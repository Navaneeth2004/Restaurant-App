import { useContext } from 'react';
import { FeaturesContext, FeaturesValue } from './features-context';

export const useFeatures = (): FeaturesValue => useContext(FeaturesContext);
