import { useEffect, useState } from 'react';
import { View, Image, StyleProp, ViewStyle } from 'react-native';

// True "cover" crop with a custom focal point, computed by hand instead of
// via CSS object-fit/object-position — verified this RNW build doesn't
// actually apply object-fit to the real <img> node (resizeMode="cover"
// measures back as "fill" in computed style, full stop, even with no other
// style overrides present). This measures the frame via onLayout, the
// photo's real pixel size via Image.getSize, scales up to the larger of the
// two ratios (so neither axis ever shows a gap), then shifts the oversized
// image by -focal fraction of its overflow — pure box-model math, so it
// works regardless of whether object-fit ever gets fixed underneath.
export function CoverImage({
  uri,
  focalX = 0.5,
  focalY = 0.5,
  style,
}: {
  uri: string;
  focalX?: number | null;
  focalY?: number | null;
  style?: StyleProp<ViewStyle>;
}) {
  const [frame, setFrame] = useState({ w: 0, h: 0 });
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setNatural(null);
    Image.getSize(uri, (w, h) => { if (!cancelled) setNatural({ w, h }); }, () => {});
    return () => { cancelled = true; };
  }, [uri]);

  const fx = focalX ?? 0.5;
  const fy = focalY ?? 0.5;
  const ready = natural && frame.w > 0 && frame.h > 0;
  const layout = ready ? computeCoverLayout(frame.w, frame.h, natural!.w, natural!.h, fx, fy) : null;

  return (
    <View
      style={[{ overflow: 'hidden' }, style]}
      onLayout={(e) => setFrame({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {layout && (
        <Image
          source={{ uri }}
          style={{ position: 'absolute', width: layout.renderW, height: layout.renderH, left: layout.left, top: layout.top }}
        />
      )}
    </View>
  );
}

export function computeCoverLayout(frameW: number, frameH: number, naturalW: number, naturalH: number, focalX: number, focalY: number) {
  const scale = Math.max(frameW / naturalW, frameH / naturalH);
  const renderW = naturalW * scale;
  const renderH = naturalH * scale;
  const maxOffsetX = Math.max(0, renderW - frameW);
  const maxOffsetY = Math.max(0, renderH - frameH);
  return { renderW, renderH, left: -maxOffsetX * focalX, top: -maxOffsetY * focalY, maxOffsetX, maxOffsetY };
}
