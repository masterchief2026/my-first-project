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

        {/* Overrides Expo's injected reset. Must come after ScrollViewStyleReset to win.
            Two things matter here, and they're why the app looked letterboxed on iOS
            while ordinary sites don't:

            1. height:100vh, not 100%. Expo's reset pins the document to 100%, which on
               iOS resolves to the SMALL viewport — the strip between the status bar and
               the toolbar. The page then physically cannot reach the screen edges. 100vh
               is the LARGE viewport, so the document spans the full screen length.

            2. Scrollable, not overflow:hidden. iOS Safari only floats its bars
               translucently OVER page content when the document is scrollable; on a
               locked page it reserves solid bars and insets the content instead. Expo
               sets overflow:hidden because React Native scrolls via its own ScrollViews,
               which is what kept Safari in the solid-bar mode.

            overscroll-behavior stops the rubber-band bounce that scrollability
            reintroduces. background-color keeps the document itself dark, so nothing
            white shows through the home-indicator area in standalone mode. */}
        <style dangerouslySetInnerHTML={{ __html: `
          html, body, #root { height: 100vh; background-color: #0e0e0e; }
          body { overflow-y: auto; overscroll-behavior-y: none; }
        ` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
