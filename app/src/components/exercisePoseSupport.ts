export interface CameraRepCounterProps {
  activity: string;
  targetRepetitions: number;
  onCountChange: (count: number) => void;
  onStatusChange: (status: PoseCounterStatus, error?: string) => void;
}

export type PoseExercise = 'pushup' | 'squat';

export function getPoseExercise(activity: string): PoseExercise | null {
  const normalizedActivity = activity
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('fr-FR');

  if (['pompe', 'pompes', 'push-up', 'push-ups', 'pushup', 'pushups'].includes(normalizedActivity)) {
    return 'pushup';
  }
  if (['squat', 'squats'].includes(normalizedActivity)) {
    return 'squat';
  }
  return null;
}

export type PoseCounterStatus =
  | 'requesting'
  | 'initializing'
  | 'positioning'
  | 'tracking'
  | 'permission-required'
  | 'unavailable'
  | 'error';

export function getPoseCounterStatusMessage(status: PoseCounterStatus) {
  switch (status) {
    case 'requesting':
      return 'Demande d’accès à la caméra…';
    case 'initializing':
      return 'Préparation du comptage sur ton téléphone…';
    case 'positioning':
      return 'Place-toi de profil, corps entier visible. Le comptage démarre quand ta posture est détectée.';
    case 'tracking':
      return 'Comptage en cours · caméra de profil recommandée.';
    case 'permission-required':
      return 'Accès caméra refusé. Tu peux continuer avec le compteur manuel.';
    case 'unavailable':
      return 'Caméra indisponible sur cet appareil. Le compteur manuel reste disponible.';
    case 'error':
      return 'Le suivi caméra a échoué. Tu peux continuer avec le compteur manuel.';
  }
}
