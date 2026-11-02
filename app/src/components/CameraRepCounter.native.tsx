import React, { useCallback, useEffect, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Camera,
  useAsyncRunner,
  useCameraDevice,
  useCameraPermission,
  useFrameOutput,
} from 'react-native-vision-camera';
import {
  nitroPoseExercises,
  PUSHUP_CONFIG,
  SQUAT_CONFIG,
} from 'react-native-nitro-pose-exercises';

import type { CameraRepCounterProps, PoseCounterStatus } from './exercisePoseSupport';
import { getPoseExercise } from './exercisePoseSupport';

const isIOS = Platform.OS === 'ios';

export function CameraRepCounter({
  activity,
  targetRepetitions,
  onCountChange,
  onStatusChange,
}: CameraRepCounterProps) {
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const asyncRunner = useAsyncRunner();
  const [engineReady, setEngineReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const poseExercise = getPoseExercise(activity);

  const updateStatus = useCallback((nextStatus: PoseCounterStatus, error?: string) => {
    onStatusChange(nextStatus, error);
  }, [onStatusChange]);

  const frameOutput = useFrameOutput({
    pixelFormat: 'yuv',
    onFrame(frame) {
      'worklet';
      const accepted = asyncRunner.runAsync(() => {
        'worklet';
        try {
          if (isIOS) {
            nitroPoseExercises.processFrameIOS(frame);
          } else {
            nitroPoseExercises.processFrameAndroid(frame);
          }
        } finally {
          frame.dispose();
        }
      });
      if (!accepted) frame.dispose();
    },
  });

  useEffect(() => {
    if (hasPermission) return;

    if (!canRequestPermission) {
      updateStatus('permission-required');
      return;
    }

    let active = true;
    updateStatus('requesting');
    void requestPermission()
      .then((granted) => {
        if (active && !granted) updateStatus('permission-required');
      })
      .catch((reason: unknown) => {
        if (active) {
          setCameraError(reason instanceof Error ? reason.message : 'Permission request failed.');
          updateStatus('error');
        }
      });

    return () => {
      active = false;
    };
  }, [canRequestPermission, hasPermission, requestPermission, updateStatus]);

  useEffect(() => {
    if (!hasPermission) return;
    if (!device || !poseExercise) {
      updateStatus('unavailable');
      return;
    }

    let active = true;
    updateStatus('initializing');

    void nitroPoseExercises.initialize('')
      .then(() => {
        if (!active) {
          nitroPoseExercises.release();
          return;
        }

        nitroPoseExercises.loadExercise(
          poseExercise === 'pushup' ? PUSHUP_CONFIG : SQUAT_CONFIG,
        );
        nitroPoseExercises.onRepComplete = (data) => {
          if (active) onCountChange(Math.min(data.repNumber, targetRepetitions));
        };
        nitroPoseExercises.onPoseLost = () => {
          if (active) updateStatus('positioning');
        };
        nitroPoseExercises.onPoseRegained = () => {
          if (active) updateStatus('tracking');
        };
        nitroPoseExercises.onPostureLost = () => {
          if (active) updateStatus('positioning');
        };
        nitroPoseExercises.onPostureRegained = () => {
          if (active) updateStatus('tracking');
        };
        nitroPoseExercises.startSession(targetRepetitions, 0);
        updateStatus('positioning');
        setCameraError('');
        setEngineReady(true);
      })
      .catch((reason: unknown) => {
        if (active) {
          setCameraError(reason instanceof Error ? reason.message : 'Pose detection failed.');
          updateStatus('error', reason instanceof Error ? reason.message : 'Pose detection failed.');
        }
      });

    return () => {
      active = false;
      nitroPoseExercises.onRepComplete = undefined;
      nitroPoseExercises.onPoseLost = undefined;
      nitroPoseExercises.onPoseRegained = undefined;
      nitroPoseExercises.onPostureLost = undefined;
      nitroPoseExercises.onPostureRegained = undefined;
      nitroPoseExercises.stopSession();
      nitroPoseExercises.release();
    };
  }, [
    device,
    hasPermission,
    onCountChange,
    poseExercise,
    targetRepetitions,
    updateStatus,
  ]);

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {hasPermission && device && engineReady ? (
        <Camera
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={!cameraError}
          outputs={[frameOutput]}
          onError={(error) => {
            setCameraError(error.message);
            updateStatus('error', error.message);
          }}
        />
      ) : null}
      {!hasPermission && !canRequestPermission ? (
        <View style={styles.permissionCard}>
          <Text style={styles.permissionText}>
            Autorise la caméra dans les réglages, ou désactive-la pour utiliser le compteur manuel.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void Linking.openSettings()}
            style={styles.settingsAction}>
            <Text style={styles.settingsActionText}>Ouvrir les réglages</Text>
          </Pressable>
        </View>
      ) : null}
      {cameraError ? (
        <View pointerEvents="none" style={styles.errorOverlay}>
          <Text style={styles.permissionText}>{cameraError}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  permissionCard: { position: 'absolute', top: '35%', alignSelf: 'center', width: '82%', padding: 14, borderRadius: 16, backgroundColor: 'rgba(255, 253, 247, 0.96)' },
  permissionText: { color: '#334238', fontSize: 13, textAlign: 'center' },
  settingsAction: { alignSelf: 'center', padding: 10, marginTop: 5 },
  settingsActionText: { color: '#526D5B', fontSize: 13, fontWeight: '700' },
  errorOverlay: { position: 'absolute', top: '35%', alignSelf: 'center', maxWidth: '82%', padding: 14, borderRadius: 16, backgroundColor: 'rgba(255, 253, 247, 0.96)' },
});
