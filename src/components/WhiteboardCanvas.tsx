import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import {
  Canvas,
  Path,
  Skia,
  useCanvasRef,
} from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
  useDerivedValue,
} from 'react-native-reanimated';

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
  backgroundUri?: string;
  penColor: string;
  penWidth: number;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

const PALM_ERASER_SIZE = 60;

export const WhiteboardCanvas: React.FC<WhiteboardCanvasProps> = ({
  tool, paths, onPathsChange, backgroundUri, penColor, penWidth,
  onSwipeLeft, onSwipeRight,
}) => {
  const canvasRef = useCanvasRef();

  // ─── Pan / Zoom ─────────────────────────────────────────────────────────
  const scale        = useSharedValue(1);
  const savedScale   = useSharedValue(1);
  const translateX   = useSharedValue(0);
  const translateY   = useSharedValue(0);
  const savedTX      = useSharedValue(0);
  const savedTY      = useSharedValue(0);

  // ─── Stroke state ────────────────────────────────────────────────────────
  const activeSvg      = useSharedValue('');   // current live stroke SVG string
  const isErasing      = useSharedValue(false);// true for both eraser tool AND palm erase
  const isPalmErasing  = useSharedValue(false);// true ONLY when 3+ fingers detected
  const palmX          = useSharedValue(-200);
  const palmY          = useSharedValue(-200);
  const prevNumPtrs    = useSharedValue(0);    // helps detect mid-gesture finger changes

  // Clear live stroke when slide switches (paths becomes empty)
  React.useEffect(() => {
    if (paths.length === 0) activeSvg.value = '';
  }, [paths.length === 0]);

  // ─── Commit stroke to JS state ───────────────────────────────────────────
  const handleEnd = (svg: string, isEraser: boolean) => {
    if (!svg || !svg.includes('L')) return; // ignore tap-only (no movement)
    onPathsChange([
      ...paths,
      {
        svgPath: svg,
        color: isEraser ? '#000000' : penColor,
        strokeWidth: isEraser ? PALM_ERASER_SIZE : penWidth,
        isEraser,
      },
    ]);
  };

  // ─── UNIFIED gesture: 1 finger = draw / 2 fingers = pan / 3+ fingers = palm erase ──
  //
  // Why unified? If we use Race(palm, draw), the 1-finger draw gesture wins
  // immediately before finger 2 and 3 land, so the palm eraser never activates.
  // With a single Pan(minPointers:1, maxPointers:10) we read numberOfPointers
  // inside each callback and switch mode dynamically, even mid-gesture.
  const mainGesture = Gesture.Pan()
    .minPointers(1)
    .maxPointers(10)  // accept any number of fingers
    .onStart((e) => {
      prevNumPtrs.value = e.numberOfPointers;

      if (e.numberOfPointers >= 3) {
        // ── Palm erase START ───────────────────────────────────────────────
        isErasing.value     = true;
        isPalmErasing.value = true;
        palmX.value = e.x;
        palmY.value = e.y;
        const ax = (e.x - translateX.value) / scale.value;
        const ay = (e.y - translateY.value) / scale.value;
        activeSvg.value = `M ${ax} ${ay}`;

      } else if (e.numberOfPointers === 2 || tool === 'pan') {
        // ── Pan START ──────────────────────────────────────────────────────
        savedTX.value = translateX.value;
        savedTY.value = translateY.value;
        activeSvg.value = '';

      } else {
        // ── Draw/Erase (1 finger) START ────────────────────────────────────
        isErasing.value     = tool === 'eraser';
        isPalmErasing.value = false;
        const ax = (e.x - translateX.value) / scale.value;
        const ay = (e.y - translateY.value) / scale.value;
        activeSvg.value = `M ${ax} ${ay}`;
      }
    })
    .onUpdate((e) => {
      const n = e.numberOfPointers;

      if (n >= 3) {
        // ── Palm erase CONTINUE ────────────────────────────────────────────
        if (prevNumPtrs.value < 3) {
          // Mid-gesture: fingers jumped to 3. Reset the path so the old
          // single-finger stroke is discarded and erasing starts fresh.
          isErasing.value     = true;
          isPalmErasing.value = true;
          const ax = (e.x - translateX.value) / scale.value;
          const ay = (e.y - translateY.value) / scale.value;
          activeSvg.value = `M ${ax} ${ay}`;
        } else {
          const ax = (e.x - translateX.value) / scale.value;
          const ay = (e.y - translateY.value) / scale.value;
          activeSvg.value += ` L ${ax} ${ay}`;
        }
        palmX.value = e.x;
        palmY.value = e.y;

      } else if (n === 2 || tool === 'pan') {
        // ── Pan CONTINUE ───────────────────────────────────────────────────
        translateX.value = savedTX.value + e.translationX;
        translateY.value = savedTY.value + e.translationY;

      } else if (n === 1 && !isPalmErasing.value) {
        // ── Draw/Erase (1 finger) CONTINUE ────────────────────────────────
        const ax = (e.x - translateX.value) / scale.value;
        const ay = (e.y - translateY.value) / scale.value;
        activeSvg.value += ` L ${ax} ${ay}`;
      }

      prevNumPtrs.value = n;
    })
    .onEnd(() => {
      if (activeSvg.value && activeSvg.value.includes('L')) {
        runOnJS(handleEnd)(activeSvg.value, isErasing.value);
      }
      // Reset erase state
      isErasing.value     = false;
      isPalmErasing.value = false;
      palmX.value = -200;
      palmY.value = -200;
    });

  // ─── Pinch zoom (always simultaneous with main gesture) ──────────────────
  const zoomGesture = Gesture.Pinch()
    .onStart(() => { savedScale.value = scale.value; })
    .onUpdate((e) => { scale.value = savedScale.value * e.scale; });

  const combined = Gesture.Simultaneous(mainGesture, zoomGesture);

  // ─── Animated styles ──────────────────────────────────────────────────────
  const canvasTransform = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const eraserCursorStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: palmX.value - PALM_ERASER_SIZE / 2,
    top: palmY.value - PALM_ERASER_SIZE / 2,
    width: PALM_ERASER_SIZE,
    height: PALM_ERASER_SIZE,
    opacity: isPalmErasing.value ? 1 : 0,
    borderWidth: 2,
    borderColor: '#4fc3f7',
    backgroundColor: 'rgba(79,195,247,0.1)',
    borderRadius: 4,
  }));

  const activePathStr = useDerivedValue(() =>
    activeSvg.value ? activeSvg.value : 'M 0 0'
  );
  const activeColor = useDerivedValue(() =>
    isErasing.value ? '#000000' : penColor
  );
  const activeWidth = useDerivedValue(() =>
    isErasing.value ? PALM_ERASER_SIZE : penWidth
  );
  const activeBlend = useDerivedValue(() =>
    isErasing.value ? 'clear' : 'srcOver'
  );

  return (
    <View style={styles.container}>
      <GestureDetector gesture={combined}>
        <Animated.View style={[styles.canvasContainer, canvasTransform]}>
          {backgroundUri && (
            <Image
              source={{ uri: backgroundUri }}
              style={StyleSheet.absoluteFill}
              contentFit="fill"
              cachePolicy="memory-disk"
            />
          )}

          <Canvas style={styles.canvas} ref={canvasRef}>
            {paths.map((p, i) => {
              const sk = Skia.Path.MakeFromSVGString(p.svgPath);
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

            {/* Live stroke on the UI thread — zero latency */}
            <Path
              path={activePathStr}
              color={activeColor}
              style="stroke"
              strokeWidth={activeWidth}
              strokeCap="square"
              strokeJoin="round"
              blendMode={activeBlend as any}
            />
          </Canvas>
        </Animated.View>
      </GestureDetector>

      {/* Palm eraser cursor — outside the transformed view so it's screen-fixed */}
      <Animated.View style={eraserCursorStyle} pointerEvents="none">
        <View style={[styles.corner, styles.tl]} />
        <View style={[styles.corner, styles.tr]} />
        <View style={[styles.corner, styles.bl]} />
        <View style={[styles.corner, styles.br]} />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container:       { flex: 1, overflow: 'hidden' },
  canvasContainer: { flex: 1, width: '100%', height: '100%' },
  canvas:          { flex: 1 },
  corner: {
    position: 'absolute',
    width: 10, height: 10,
    borderColor: '#4fc3f7',
    borderWidth: 2,
  },
  tl: { top: -1, left: -1,  borderRightWidth: 0, borderBottomWidth: 0 },
  tr: { top: -1, right: -1, borderLeftWidth: 0,  borderBottomWidth: 0 },
  bl: { bottom: -1, left: -1,  borderRightWidth: 0, borderTopWidth: 0 },
  br: { bottom: -1, right: -1, borderLeftWidth: 0,  borderTopWidth: 0 },
});
