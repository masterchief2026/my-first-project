import { MaterialIcons } from '@expo/vector-icons';
import { StyleProp, TextStyle } from 'react-native';
import { RivalColors } from '../../constants/rivalTheme';

// Single source of truth for icons — semantic name → Material glyph. Material
// Symbols is what the Stitch mockups use, so MaterialIcons is a near-exact
// match, monochrome, and takes the accent color. Add new icons HERE, once,
// rather than reaching for an emoji in a screen (see feedback: real icons > emoji).
const ICONS = {
  // Navigation / interface
  back: 'arrow-back',
  forward: 'arrow-forward',
  // Calendar month/year nav — chevron family (not arrow-back/forward above,
  // which are line-arrows and don't visually match the double-chevron).
  monthBack: 'keyboard-arrow-left',
  monthForward: 'keyboard-arrow-right',
  yearBack: 'keyboard-double-arrow-left',
  yearForward: 'keyboard-double-arrow-right',
  chevronRight: 'chevron-right',
  edit: 'edit',
  close: 'close',
  add: 'add',
  check: 'check',
  checkCircle: 'check-circle',
  target: 'adjust',
  search: 'search',
  camera: 'photo-camera',
  upload: 'file-upload',
  notifications: 'notifications',
  settings: 'settings',
  logout: 'logout',
  delete: 'delete-outline',
  link: 'link',
  openInNew: 'open-in-new',
  apps: 'apps',
  person: 'person',
  groups: 'groups',
  flag: 'flag',
  key: 'vpn-key',
  globe: 'public',
  chat: 'chat-bubble',
  pin: 'push-pin',
  star: 'star',

  // Add Workout / logging
  scan: 'document-scanner',
  manual: 'edit-note',
  batch: 'calendar-view-week',
  addPhoto: 'add-a-photo',
  brain: 'psychology',
  verified: 'verified',
  ai: 'auto-awesome',
  calendar: 'calendar-today',

  // Stats / metrics
  trophy: 'emoji-events',
  fire: 'local-fire-department',
  medal: 'military-tech',
  crown: 'workspace-premium', // "Unrivaled" max rank
  lock: 'lock',               // locked milestone/achievement
  bolt: 'bolt',
  rest: 'bedtime',            // idle / no recent activity
  trendUp: 'trending-up',
  trendDown: 'trending-down',
  location: 'place',
  elevation: 'terrain',
  distance: 'straighten',
  timer: 'timer',
  stats: 'bar-chart',
  race: 'sports-score',
  impact: 'auto-awesome',

  // Activity types
  run: 'directions-run',
  ride: 'directions-bike',
  swim: 'pool',
  rowing: 'rowing',
  weights: 'fitness-center',
  crossfit: 'sports-gymnastics',
  hyrox: 'local-fire-department',
  hiit: 'bolt',
  hike: 'hiking',
  walk: 'directions-walk',
  yoga: 'self-improvement',
  ski: 'downhill-skiing',
  workout: 'fitness-center',
} as const;

export type RivalIconName = keyof typeof ICONS;

export function RivalIcon({
  name,
  size = 24,
  color = RivalColors.textPrimary,
  style,
}: {
  name: RivalIconName;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  return <MaterialIcons name={ICONS[name]} size={size} color={color} style={style} />;
}

// activity_type (DB value) → RivalIcon name. Mirrors ACTIVITY_ICONS keys.
const ACTIVITY_TYPE_TO_ICON: Record<string, RivalIconName> = {
  Run: 'run', VirtualRun: 'run',
  Ride: 'ride', VirtualRide: 'ride',
  Swim: 'swim',
  Rowing: 'rowing',
  WeightTraining: 'weights', Workout: 'workout',
  CrossFit: 'crossfit',
  Hyrox: 'hyrox',
  HIIT: 'hiit',
  Hike: 'hike',
  Walk: 'walk',
  Yoga: 'yoga',
  AlpineSki: 'ski', NordicSki: 'ski',
};

export function activityIconName(type: string | null | undefined): RivalIconName {
  return ACTIVITY_TYPE_TO_ICON[type ?? ''] ?? 'workout';
}
