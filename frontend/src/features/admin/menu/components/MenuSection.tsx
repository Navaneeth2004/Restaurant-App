import { FEATURE } from 'state/features/feature-keys';
import { useFeatures } from 'state/features/useFeatures';
import MenuExportImport from './MenuExportImport';
import MenuPanel from './MenuPanel';

export default function MenuSection() {
  const { isOn } = useFeatures();
  return <div className="space-y-6"><MenuPanel />{isOn(FEATURE.menuTransfer) && <MenuExportImport />}</div>;
}
