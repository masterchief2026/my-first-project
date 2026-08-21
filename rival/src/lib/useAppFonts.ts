import { useFonts, Manrope_300Light, Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';

// Native: register Manrope from the bundled .ttf files. The font must exist
// before any Text using it mounts, so this is a real hook call.
//
// Web has its own copy of this module (useAppFonts.web.ts) that does nothing.
// The split has to happen at MODULE level, not with a conditional hook call:
// the static import above is what pulls six Manrope .ttf files into the bundle,
// so merely skipping the call would still ship them. Metro resolves the .web
// file for web builds, so those imports never enter the web bundle at all —
// which is correct, because global.css already loads Manrope from Google Fonts
// and the browser was otherwise downloading the same typeface twice.
export function useAppFonts() {
  useFonts({
    Manrope_300Light,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });
}
