import { useContext } from 'react';
import { SettingsContext, SettingsValue } from './settings-context';

export const useSettingsState = (): SettingsValue => useContext(SettingsContext);
export const useSettings = () => useContext(SettingsContext).settings;
