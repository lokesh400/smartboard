/**
 * ImageOverlayLayer.tsx
 *
 * Floating, draggable, pinch-resizable images on the whiteboard.
 * Uses RNGH gestures (NOT PanResponder) so they coexist correctly
 * with the canvas GestureDetector.
 *
 * - Pan gesture  → move the image
 * - Pinch gesture → scale (resize) the image
 * - Both run simultaneously
 * - Gestures only enabled when isInteractive (pan tool active)
 */
import React, { useCallback } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useEffect } from 'react';

export interface ImageOverlay {
  id: string;
  uri: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Props {
  images: ImageOverlay[];
  onUpdate: (images: ImageOverlay[]) => void;
  isInteractive: boolean; // true when pan tool is active
}

const MIN_SIZE = 60;

// ─── Single draggable/resizable image ────────────────────────────────────────
const DraggableImage: React.FC<{
  img: ImageOverlay;
  isInteractive: boolean;
  onMove: (id: string, x: number, y: number) => void;
  onResize: (id: string, w: number, h: number) => void;
  onDelete: (id: string) => void;
}> = ({ img, isInteractive, onMove, onResize, onDelete }) => {
  // Saved values at gesture start (set once in onStart, read in onUpdate)
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startW = useSharedValue(0);
  const startH = useSharedValue(0);

  // JS callbacks (stable references via useCallback)
  const move = useCallback(
    (newX: number, newY: number) => onMove(img.id, newX, newY),
    [img.id, onMove],
  );
  const resize = useCallback(
    (newW: number, newH: number) =>
      onResize(img.id, Math.max(MIN_SIZE, newW), Math.max(MIN_SIZE, newH)),
    [img.id, onResize],
  );

  // Live transform state on UI thread for zero-latency dragging
  const liveX = useSharedValue(img.x);
  const liveY = useSharedValue(img.y);
  const liveW = useSharedValue(img.width);
  const liveH = useSharedValue(img.height);

  // Sync if updated from outside (e.g., undo/redo or initial load)
  useEffect(() => {
    liveX.value = img.x;
    liveY.value = img.y;
    liveW.value = img.width;
    liveH.value = img.height;
  }, [img.x, img.y, img.width, img.height]);

  const animatedStyle = useAnimatedStyle(() => ({
    left: liveX.value,
    top: liveY.value,
    width: liveW.value,
    height: liveH.value,
  }));

  // ── Pan: drag image ────────────────────────────────────────────────────────
  const dragGesture = Gesture.Pan()
    .enabled(isInteractive)
    .onStart(() => {
      startX.value = liveX.value;
      startY.value = liveY.value;
    })
    .onUpdate((e) => {
      liveX.value = startX.value + e.translationX;
      liveY.value = startY.value + e.translationY;
    })
    .onEnd(() => {
      runOnJS(move)(liveX.value, liveY.value);
    });

  // ── Pan: drag corner to resize image ───────────────────────────────────────
  const resizeGesture = Gesture.Pan()
    .enabled(isInteractive)
    .onStart(() => {
      startW.value = liveW.value;
      startH.value = liveH.value;
    })
    .onUpdate((e) => {
      liveW.value = Math.max(MIN_SIZE, startW.value + e.translationX);
      liveH.value = Math.max(MIN_SIZE, startH.value + e.translationY);
    })
    .onEnd(() => {
      runOnJS(resize)(liveW.value, liveH.value);
    });

  return (
    <GestureDetector gesture={dragGesture}>
      <Animated.View
        style={[styles.wrapper, animatedStyle]}
      >
        <Image
          source={{ uri: img.uri }}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          cachePolicy="memory-disk"
        />

        {/* Selection border */}
        {isInteractive && <View style={styles.border} pointerEvents="none" />}

        {/* Delete button */}
        {isInteractive && (
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => onDelete(img.id)}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <MaterialCommunityIcons name="close-circle" size={24} color="#FF453A" />
          </TouchableOpacity>
        )}

        {/* Resize handle */}
        {isInteractive && (
          <GestureDetector gesture={resizeGesture}>
            <View style={styles.resizeHandle}>
              <MaterialCommunityIcons name="resize-bottom-right" size={16} color="#4fc3f7" />
            </View>
          </GestureDetector>
        )}
      </Animated.View>
    </GestureDetector>
  );
};

// ─── Layer that holds all images ──────────────────────────────────────────────
export const ImageOverlayLayer: React.FC<Props> = ({ images, onUpdate, isInteractive }) => {
  const handleMove = useCallback(
    (id: string, x: number, y: number) =>
      onUpdate(images.map((img) => (img.id === id ? { ...img, x, y } : img))),
    [images, onUpdate],
  );

  const handleResize = useCallback(
    (id: string, width: number, height: number) =>
      onUpdate(images.map((img) => (img.id === id ? { ...img, width, height } : img))),
    [images, onUpdate],
  );

  const handleDelete = useCallback(
    (id: string) => onUpdate(images.filter((img) => img.id !== id)),
    [images, onUpdate],
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {images.map((img) => (
        <DraggableImage
          key={img.id}
          img={img}
          isInteractive={isInteractive}
          onMove={handleMove}
          onResize={handleResize}
          onDelete={handleDelete}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
  },
  border: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderWidth: 1.5,
    borderColor: '#4fc3f7',
    borderStyle: 'dashed',
    borderRadius: 4,
  },
  deleteBtn: {
    position: 'absolute',
    top: -12,
    right: -12,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    zIndex: 20,
  },
  resizeHandle: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 8,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
});
