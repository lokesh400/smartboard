import React, { useMemo } from 'react';
import { StyleSheet, View, Image } from 'react-native';
import {
  Canvas,
  Path,
  useCanvasRef,
  Skia,
} from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  useDerivedValue,
  runOnJS,
} from 'react-native-reanimated';

export type DrawingTool = 'pen' | 'eraser' | 'pan';

export interface PathData {
  svgPath: string;
  color: string;
  strokeWidth: number;
}

interface WhiteboardCanvasProps {
  tool: DrawingTool;
  paths: PathData[];
  onPathsChange: (newPaths: PathData[]) => void;
  backgroundUri?: string;
}

export const WhiteboardCanvas: React.FC<WhiteboardCanvasProps> = ({ 
  tool, 
  paths, 
  onPathsChange,
  backgroundUri
}) => {
  const canvasRef = useCanvasRef();

  // Pan and zoom states
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Active Drawing State on UI Thread
  const activeSvgString = useSharedValue('');
  const isActiveEraser = useSharedValue(false);

  const activePathString = useDerivedValue(() => {
    return activeSvgString.value ? activeSvgString.value : "M 0 0";
  });

  const handleEnd = (finalSvg: string, isEraser: boolean) => {
    if (finalSvg) {
      onPathsChange([
        ...paths,
        {
          svgPath: finalSvg,
          color: isEraser ? '#ffffff' : '#000000',
          strokeWidth: isEraser ? 30 : 5,
        },
      ]);
    }
  };

  // Drawing Gesture (1 Finger or Stylus)
  const drawGesture = Gesture.Pan()
    .minDistance(1)
    .minPointers(1)
    .maxPointers(1)
    .onStart((e) => {
      if (tool === 'pen' || tool === 'eraser') {
        const adjustedX = (e.x - translateX.value) / scale.value;
        const adjustedY = (e.y - translateY.value) / scale.value;
        isActiveEraser.value = tool === 'eraser';
        activeSvgString.value = `M ${adjustedX} ${adjustedY}`;
      }
    })
    .onUpdate((e) => {
      if (tool === 'pen' || tool === 'eraser') {
        const adjustedX = (e.x - translateX.value) / scale.value;
        const adjustedY = (e.y - translateY.value) / scale.value;
        activeSvgString.value += ` L ${adjustedX} ${adjustedY}`;
      }
    })
    .onEnd(() => {
      if (tool === 'pen' || tool === 'eraser') {
        runOnJS(handleEnd)(activeSvgString.value, isActiveEraser.value);
        // Do NOT clear activeSvgString.value here! 
        // Leaving it visible prevents the blink while React state updates.
        // It will be cleared automatically on the next stroke's .onStart().
      }
    });

  // Palm Eraser Gesture (3+ Fingers)
  const palmEraserGesture = Gesture.Pan()
    .minDistance(1)
    .minPointers(3)
    .onStart((e) => {
      const adjustedX = (e.x - translateX.value) / scale.value;
      const adjustedY = (e.y - translateY.value) / scale.value;
      isActiveEraser.value = true;
      activeSvgString.value = `M ${adjustedX} ${adjustedY}`;
    })
    .onUpdate((e) => {
      const adjustedX = (e.x - translateX.value) / scale.value;
      const adjustedY = (e.y - translateY.value) / scale.value;
      activeSvgString.value += ` L ${adjustedX} ${adjustedY}`;
    })
    .onEnd(() => {
      runOnJS(handleEnd)(activeSvgString.value, true);
      // Do NOT clear activeSvgString.value here!
    });

  // Pan Gesture (2 Fingers)
  const panGesture = Gesture.Pan()
    .minPointers(tool === 'pan' ? 1 : 2)
    .maxPointers(tool === 'pan' ? 1 : 2)
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    });

  // Zoom Gesture (2 Fingers)
  const zoomGesture = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    });

  // Combine gestures based on active tool
  const gestures = Gesture.Simultaneous(drawGesture, palmEraserGesture, panGesture, zoomGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  // Reanimated style for the active stroke color
  const activeStrokeColor = useDerivedValue(() => {
    return isActiveEraser.value ? '#ffffff' : '#000000';
  });

  const activeStrokeWidth = useDerivedValue(() => {
    return isActiveEraser.value ? 30 : 5;
  });
  
  const activeBlendMode = useDerivedValue(() => {
    return isActiveEraser.value ? 'clear' : 'srcOver';
  });

  return (
    <View style={styles.container}>
      <GestureDetector gesture={gestures}>
        <Animated.View style={[styles.canvasContainer, animatedStyle]}>
          {backgroundUri && (
            <Image 
              source={{ uri: backgroundUri }} 
              style={StyleSheet.absoluteFill} 
              resizeMode="contain" 
            />
          )}
          <Canvas style={styles.canvas} ref={canvasRef}>
            {paths.map((p, index) => (
              <Path
                key={index}
                path={p.svgPath}
                color={p.color}
                style="stroke"
                strokeWidth={p.strokeWidth}
                strokeCap="round"
                strokeJoin="round"
                blendMode={p.color === '#ffffff' ? 'clear' : 'srcOver'}
              />
            ))}
            <Path
              path={activePathString}
              color={activeStrokeColor}
              style="stroke"
              strokeWidth={activeStrokeWidth}
              strokeCap="round"
              strokeJoin="round"
              blendMode={activeBlendMode as any}
            />
          </Canvas>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  canvasContainer: {
    flex: 1,
  },
  canvas: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});
