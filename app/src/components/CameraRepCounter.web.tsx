import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import type { CameraRepCounterProps } from './exercisePoseSupport';

export function CameraRepCounter({ onStatusChange }: CameraRepCounterProps) {
  useEffect(() => {
    onStatusChange('unavailable', 'Le comptage par caméra est uniquement disponible dans l’application mobile.');
  }, [onStatusChange]);

  return <View pointerEvents="none" style={StyleSheet.absoluteFill} />;
}
