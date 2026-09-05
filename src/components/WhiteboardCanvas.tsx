/**
 * WhiteboardCanvas.tsx
 *
 * Key rendering optimisations:
 *
 * 1. NO-BLINK: svgStr is NOT cleared in onEnd. It persists on the UI thread
 *    until the next stroke's onStart overwrites it. This means the live stroke
 *    stays visible while React processes commitStroke, so there's never a
 *    blank frame between live and committed path.
 *
 * 2. SMOOTH CURVES: each touch point is converted to a quadratic Bézier
 *    segment (Q cpX cpY midX midY) through the midpoint, so the drawn line
 *    curves naturally instead of producing jagged straight segments.
 *
 * 3. PATH CACHE: committed paths are parsed into Skia objects via useMemo so
 *    Skia.Path.MakeFromSVGString is NOT called on every drawing frame — only
 *    when a new stroke is committed.
 */
import React, { useRef, useMemo, useCallback, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import {
  Canvas, Path, Skia, useCanvasRef,
} from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated';

import { ImageOverlayLayer, ImageOverlay } from './ImageOverlayLayer';

export type DrawingTool = 'pen' | 'eraser' | 'pan';

export interface PathData {
  svgPath: string;
  color: string;
  strokeWidth: number;
  isEraser?: boolean;
}

interface WhiteboardCanvasProps {
  tool: DrawingTool;
  paths: PathData[];
  onPathsChange: (newPaths: PathData[]) => void;
  images: ImageOverlay[];
  onImagesChange: (newImages: ImageOverlay[]) => void;
  backgroundUri?: string;
  penColor: string;
  penWidth: number;
  clearStrokeTick: number;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

const PALM_SIZE = 64;

export const WhiteboardCanvas: React.FC<WhiteboardCanvasProps> = ({
  tool, paths, onPathsChange, images, onImagesChange, backgroundUri, penColor, penWidth, clearStrokeTick,
}) => {
  const canvasRef = useCanvasRef();

  useEffect(() => {
    if (clearStrokeTick > 0) {
      drawSvg.value = '';
    }
  }, [clearStrokeTick]);

  // ─── Stroke shared values ──────────────────────────────────────────────────
  const drawSvg    = useSharedValue('');      // live pen stroke
  const asEraser   = useSharedValue(false);
  const eraserSize = useSharedValue(PALM_SIZE);

  // Previous touch point — used for Bézier midpoint calculation
  const prevX = useSharedValue(0.0);
  const prevY = useSharedValue(0.0);

  // Flag: was the gesture completed normally (onEnd fired)?
  // Used to distinguish a completed stroke from a cancelled one in onFinalize.
  const drawDidEnd = useSharedValue(false);

  // ─── Stale-closure-safe refs ──────────────────────────────────────────────
  const pathsRef  = useRef(paths);   pathsRef.current  = paths;
  const colorRef  = useRef(penColor); colorRef.current  = penColor;
  const widthRef  = useRef(penWidth); widthRef.current  = penWidth;

  const commitStroke = useCallback((svg: string, eraser: boolean, customWidth?: number) => {
    if (!svg || !svg.includes(' Q ') && !svg.includes(' L ')) return;
    onPathsChange([
      ...pathsRef.current,
      {
        svgPath: svg,
        color: eraser ? '#000000' : colorRef.current,
        strokeWidth: eraser ? (customWidth || PALM_SIZE) : widthRef.current,
        isEraser: eraser,
      },
    ]);
  }, [onPathsChange]);

  // ─── Committed path cache ─────────────────────────────────────────────────
  // Parses SVG strings into Skia Path objects. Recalculated only when the
  // paths array changes (i.e. when a stroke is committed), NOT on every
  // drawing frame. This avoids the expensive MakeFromSVGString per frame.
  const parsedPaths = useMemo(
    () => paths.map(p => ({ p, sk: Skia.Path.MakeFromSVGString(p.svgPath) })),
    [paths],
  );

  // ─── Unified drawing and erasing gesture ─────────────────────────────────
  const drawGesture = Gesture.Pan()
    .minPointers(1)
    .maxPointers(10) // allow all fingers for massive eraser
    .minDistance(1)
    .enabled(tool === 'pen' || tool === 'eraser')
    .onStart((e) => {
      // A closed fist or palm often registers as 2+ pointers on capacitive screens
      if (e.numberOfPointers >= 2) {
        asEraser.value = true;
        eraserSize.value = Math.max(120, e.numberOfPointers * 50); // Massive dynamic size for fist/palm
      } else {
        asEraser.value = tool === 'eraser';
        eraserSize.value = PALM_SIZE;
      }
      
      drawSvg.value  = `M ${e.x} ${e.y}`;
      prevX.value    = e.x;
      prevY.value    = e.y;
      drawDidEnd.value = false;
    })
    .onUpdate((e) => {
      // If user adds more fingers mid-stroke, upgrade it to a palm eraser seamlessly!
      if (e.numberOfPointers >= 2) {
        asEraser.value = true;
        eraserSize.value = Math.max(eraserSize.value, Math.max(120, e.numberOfPointers * 50));
      }
      
      const mx = (prevX.value + e.x) / 2;
      const my = (prevY.value + e.y) / 2;
      drawSvg.value += ` Q ${prevX.value} ${prevY.value} ${mx} ${my}`;
      prevX.value = e.x;
      prevY.value = e.y;
    })
    .onEnd(() => {
      drawDidEnd.value = true;
      runOnJS(commitStroke)(drawSvg.value, asEraser.value, asEraser.value ? eraserSize.value : undefined);
    })
    .onFinalize(() => {
      if (!drawDidEnd.value) {
        drawSvg.value  = '';
        asEraser.value = false;
      }
      drawDidEnd.value = false;
    });

  const all = drawGesture;

  // ─── Animated styles ───────────────────────────────────────────────────────
  const cursorStyle = useAnimatedStyle(() => {
    // Only show the cursor block if we are actually erasing with the palm mid-stroke
    // (We removed the old palmX/palmY since the eraser path itself provides enough visual feedback,
    // and maintaining a moving box gets laggy/jittery. The stroke path is sufficient).
    return {
      opacity: 0, 
    };
  });

  // Live stroke values — evaluated on UI thread for zero-latency rendering
  const liveDrawPath = useDerivedValue(() => drawSvg.value || 'M -10 -10');
  const liveDrawCol  = useDerivedValue(() => asEraser.value ? '#000000' : penColor);
  const liveDrawWid  = useDerivedValue(() => asEraser.value ? eraserSize.value : penWidth);
  const liveDrawBnd  = useDerivedValue(() => asEraser.value ? 'clear' : 'srcOver');

  return (
    <View style={styles.root}>
      <GestureDetector gesture={all}>
        <View style={styles.fill}>
          {backgroundUri && (
            <Image
              source={{ uri: backgroundUri }}
              style={StyleSheet.absoluteFill}
              contentFit="fill"
              cachePolicy="memory-disk"
            />
          )}

          {/* Floating Image Overlays (rendered UNDER the ink) */}
          <ImageOverlayLayer
            images={images}
            onUpdate={onImagesChange}
            isInteractive={tool === 'pan'}
          />

          {/* Skia Canvas for Ink (rendered ON TOP of images) */}
          <Canvas style={StyleSheet.absoluteFill} ref={canvasRef} pointerEvents="none">
            {/* Committed strokes — Skia objects pre-parsed by useMemo */}
            {parsedPaths.map(({ p, sk }, i) => {
              if (!sk) return null;
              return (
                <Path
                  key={i}
                  path={sk}
                  color={p.isEraser ? '#000000' : p.color}
                  style="stroke"
                  strokeWidth={p.strokeWidth}
                  strokeCap={p.isEraser ? 'square' : 'round'}
                  strokeJoin="round"
                  blendMode={p.isEraser ? 'clear' : 'srcOver'}
                />
              );
            })}

            {/* Live pen/eraser stroke */}
            <Path
              path={liveDrawPath}
              color={liveDrawCol}
              style="stroke"
              strokeWidth={liveDrawWid}
              strokeCap="round"
              strokeJoin="round"
              blendMode={liveDrawBnd as any}
            />
          </Canvas>
        </View>
      </GestureDetector>

      {/* Palm eraser cursor — always in screen space */}
      <Animated.View style={cursorStyle} pointerEvents="none">
        <View style={[styles.corner, styles.tl]} />
        <View style={[styles.corner, styles.tr]} />
        <View style={[styles.corner, styles.bl]} />
        <View style={[styles.corner, styles.br]} />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  root:   { flex: 1, overflow: 'hidden' },
  fill:   { flex: 1 },
  corner: {
    position: 'absolute',
    width: 10, height: 10,
    borderColor: '#4fc3f7',
    borderWidth: 2.5,
  },
  tl: { top: -1,    left: -1,  borderRightWidth: 0, borderBottomWidth: 0 },
  tr: { top: -1,    right: -1, borderLeftWidth: 0,  borderBottomWidth: 0 },
  bl: { bottom: -1, left: -1,  borderRightWidth: 0, borderTopWidth: 0 },
  br: { bottom: -1, right: -1, borderLeftWidth: 0,  borderTopWidth: 0 },
});
