import { ScrollViewStyleReset } from 'expo-router/html';

// Custom root HTML shell for the web export. Adds "Add to Home Screen" support —
// without these tags, iOS Safari always keeps its URL/back-forward bar visible;
// with them, launching from a home-screen icon opens fully chrome-less, like a
// native app.
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />

        {/* iOS home-screen install: standalone (chrome-less) launch */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="RIVAL" />
        <link rel="apple-touch-icon" href="/assets/images/icon.png" />

        {/* Android/Chrome install prompt + standalone display */}
        <meta name="theme-color" content="#0e0e0e" />
        <link rel="manifest" href="/manifest.json" />

        <ScrollViewStyleReset />

        {/* The document's own backdrop. Without this it stays the browser default
            (white), which shows through as a bright band in the home-indicator safe
            area when launched from the Home Screen, and flashes white on load. Must
            come after ScrollViewStyleReset so it wins over Expo's injected reset. */}
        <style dangerouslySetInnerHTML={{ __html: `
          html, body, #root { background-color: #0e0e0e; }
        ` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
