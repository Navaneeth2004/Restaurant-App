import { useContext } from 'react';
import { DeviceContext, DeviceValue } from './device-context';

export const useDevice = (): DeviceValue => useContext(DeviceContext);
