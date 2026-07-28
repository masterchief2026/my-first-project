import { useEffect, useState } from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function StravaCallbackScreen() {
  const [status, setStatus] = useState('Connecting to Strava...');

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof window === 'undefined') return;

    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const accessToken = urlParams.get('state');
    const error = urlParams.get('error');

    if (error || !code || !accessToken) {
      setStatus('Connection cancelled or session expired.');
      setTimeout(() => window.close(), 2000);
      return;
    }

    exchangeToken(code, accessToken);
  }, []);

  async function exchangeToken(code: string, accessToken: string) {
    try {
      setStatus('Saving connection...');

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/strava-token-exchange`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
          },
          body: JSON.stringify({ code }),
        }
      );

      const data = await response.json();

      if (!response.ok || data.error) {
        console.error('Edge function error:', data);
        setStatus(response.status === 409 && data.error ? data.error : 'Failed to connect Strava. Please try again.');
        setTimeout(() => window.close(), response.status === 409 ? 4000 : 2000);
        return;
      }

      setStatus("Don't close this tab yet — importing your full training history now. This can take a minute for a long history.");

      // Pull the user's entire Strava history, not just recent activities, so
      // connecting doesn't feel like starting their Effort/Time Earned from
      // zero. Must be awaited — closing this tab kills the in-flight request
      // to the edge function before it finishes, truncating the import.
      try {
        await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/strava-full-import`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
          },
        });
        setStatus('Import complete!');
      } catch {
        setStatus("Strava connected, but the history import didn't finish — you can re-run it anytime from your profile.");
      }

      setTimeout(() => window.close(), 1500);

    } catch (err) {
      console.error('Exchange error:', err);
      setStatus('Something went wrong. Please try again.');
      setTimeout(() => window.close(), 2000);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.logo}>RIVAL</Text>
        <Text style={styles.status}>{status}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111111',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
  },
  logo: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 6,
  },
  status: {
    fontSize: 16,
    color: '#999999',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});