import { request } from '../http';
import type { FeatureStatus } from 'types/core/features';

export const getFeatures = (signal?: AbortSignal) => request<FeatureStatus>('/auth/features', { signal });
