// Web counterpart of useAppFonts.ts — deliberately empty, and deliberately
// importing nothing from @expo-google-fonts/manrope.
//
// global.css already pulls Manrope from the Google Fonts stylesheet, which is
// the right delivery mechanism on the web: cached across sites, served as woff2
// (far smaller than .ttf), and subset by the browser. Importing the native font
// package here as well would bundle six .ttf files (~570KB) that no web visitor
// ever renders from.
export function useAppFonts() {
  // no-op: the stylesheet in global.css handles this on web.
}
