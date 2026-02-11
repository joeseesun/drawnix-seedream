import React from 'react';
import { SettingsIcon } from '../../icons';
import MenuItem from '../../menu/menu-item';
import { useDrawnix } from '../../../hooks/use-drawnix';

export const SettingsMenuItem: React.FC = () => {
  const { appState, setAppState } = useDrawnix();

  const handleOpenModal = () => {
    setAppState(prevState => ({
      ...prevState,
      openSettings: true,
    }));
  };

  const handleCloseModal = () => {
    setAppState(prevState => ({
      ...prevState,
      openSettings: false,
    }));
  };

  return (
    <MenuItem
      icon={SettingsIcon}
      data-testid="settings-button"
      onSelect={handleOpenModal}
      aria-label="应用设置"
    >
      设置
    </MenuItem>
  );
};

SettingsMenuItem.displayName = 'SettingsMenuItem';
