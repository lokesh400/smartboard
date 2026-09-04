import React, { useRef } from 'react';
import { View, PanResponder, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';

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
  isInteractive: boolean; // only draggable when pan tool is active
}

const MIN_SIZE = 60;

const DraggableImage: React.FC<{
  img: ImageOverlay;
  onMove: (id: string, x: number, y: number) => void;
  onResize: (id: string, w: number, h: number) => void;
  onDelete: (id: string) => void;
  isInteractive: boolean;
}> = ({ img, onMove, onResize, onDelete, isInteractive }) => {
  const lastPos = useRef({ x: img.x, y: img.y });
  const lastSize = useRef({ w: img.width, h: img.height });

  const dragPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => isInteractive,
      onMoveShouldSetPanResponder: () => isInteractive,
      onPanResponderGrant: () => {
        lastPos.current = { x: img.x, y: img.y };
      },
      onPanResponderMove: (_, gs) => {
        onMove(img.id, lastPos.current.x + gs.dx, lastPos.current.y + gs.dy);
      },
    })
  ).current;

  const resizePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => isInteractive,
      onMoveShouldSetPanResponder: () => isInteractive,
      onPanResponderGrant: () => {
        lastSize.current = { w: img.width, h: img.height };
      },
      onPanResponderMove: (_, gs) => {
        const newW = Math.max(MIN_SIZE, lastSize.current.w + gs.dx);
        const newH = Math.max(MIN_SIZE, lastSize.current.h + gs.dy);
        onResize(img.id, newW, newH);
      },
    })
  ).current;

  return (
    <View
      style={[styles.imageWrapper, { left: img.x, top: img.y, width: img.width, height: img.height }]}
      {...dragPan.panHandlers}
    >
      <Image
        source={{ uri: img.uri }}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        cachePolicy="memory-disk"
      />

      {/* Delete button — top-right */}
      {isInteractive && (
        <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(img.id)}>
          <MaterialCommunityIcons name="close-circle" size={22} color="#FF453A" />
        </TouchableOpacity>
      )}

      {/* Resize handle — bottom-right */}
      {isInteractive && (
        <View style={styles.resizeHandle} {...resizePan.panHandlers}>
          <MaterialCommunityIcons name="resize-bottom-right" size={16} color="#fff" />
        </View>
      )}

      {/* Border to show selected state */}
      {isInteractive && <View style={styles.border} pointerEvents="none" />}
    </View>
  );
};

export const ImageOverlayLayer: React.FC<Props> = ({ images, onUpdate, isInteractive }) => {
  const handleMove = (id: string, x: number, y: number) => {
    onUpdate(images.map(img => img.id === id ? { ...img, x, y } : img));
  };

  const handleResize = (id: string, w: number, h: number) => {
    onUpdate(images.map(img => img.id === id ? { ...img, width: w, height: h } : img));
  };

  const handleDelete = (id: string) => {
    onUpdate(images.filter(img => img.id !== id));
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {images.map(img => (
        <DraggableImage
          key={img.id}
          img={img}
          onMove={handleMove}
          onResize={handleResize}
          onDelete={handleDelete}
          isInteractive={isInteractive}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  imageWrapper: {
    position: 'absolute',
  },
  deleteBtn: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: '#1a1a1a',
    borderRadius: 11,
    zIndex: 10,
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
  border: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1.5,
    borderColor: '#4fc3f7',
    borderStyle: 'dashed',
    borderRadius: 4,
  },
});
