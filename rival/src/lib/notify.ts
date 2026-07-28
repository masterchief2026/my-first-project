import { Alert, Platform } from 'react-native';

// Alert.alert is a silent no-op on react-native-web, so failure messages on
// critical paths (leave team, sync failed, import failed) never reach web users.
// window.alert is ugly but guaranteed visible; native keeps the real Alert.
export function notify(title: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}
