import Icon from 'components/ui/base/Icon';
import { API_ORIGIN } from 'config/env';

interface Props { name: string; address?: string; phone?: string; logoUrl?: string; tableLabel: string; dateStr: string; timeStr: string }

export default function BillHeader({ name, address, phone, logoUrl, tableLabel, dateStr, timeStr }: Props) {
  return (
    <div className="bill-header">
      {logoUrl && <img className="bill-logo" src={`${API_ORIGIN}${logoUrl}`} alt="" />}
      <div className="bill-name">{name || 'Restaurant'}</div>
      {address && <div className="bill-sub">{address}</div>}
      {phone && <div className="bill-sub">{phone}</div>}
      <div className="bill-header-pill">
        <Icon name="user" className="w-2.5 h-2.5" strokeWidth={2.5} />
        {tableLabel}<span style={{ opacity: 0.6 }}>·</span>{dateStr}<span style={{ opacity: 0.6 }}>·</span>{timeStr}
      </div>
    </div>
  );
}
