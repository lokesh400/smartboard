import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PathData } from './WhiteboardCanvas';

interface SlideData {
  id: string;
  backgroundUri?: string;
  backgroundColor?: string;
  paths: PathData[];
}

interface SlideSidebarProps {
  slides: SlideData[];
  currentSlideIndex: number;
  onSelectSlide: (index: number) => void;
  onAddSlide: () => void;
  onMoveSlideUp: (index: number) => void;
  onMoveSlideDown: (index: number) => void;
  onDeleteSlide: (index: number) => void;
}

// Thumbnail dimensions — matches a 16:9 slide at small scale
const THUMB_W = 160;
const THUMB_H = 90;
// The whiteboard canvas is rendered at arbitrary screen size; we assume ~1280×720 logical space
const SCALE_X = THUMB_W / 1280;
const SCALE_Y = THUMB_H / 720;

const SlideThumb: React.FC<{ slide: SlideData }> = ({ slide }) => {
  const bgColor = slide.backgroundColor || '#000000';

  return (
    <View style={[styles.thumbnailContainer, { backgroundColor: bgColor }]}>
      {/* Background image */}
      {slide.backgroundUri && (
        <Image
          source={{ uri: slide.backgroundUri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory"
        />
      )}

      {/* Mini Skia canvas drawing the paths at thumbnail scale */}
      {slide.paths.length > 0 && (
        <Canvas style={StyleSheet.absoluteFill}>
          {slide.paths.map((p, i) => {
            const original = Skia.Path.MakeFromSVGString(p.svgPath);
            if (!original) return null;

            // Scale the path to thumbnail size
            const matrix = Skia.Matrix();
            matrix.scale(SCALE_X, SCALE_Y);
            const scaled = original.copy();
            scaled.transform(matrix);

            return (
              <Path
                key={i}
                path={scaled}
                color={p.isEraser ? bgColor : p.color}
                style="stroke"
                strokeWidth={Math.max(1, p.strokeWidth * Math.min(SCALE_X, SCALE_Y))}
                strokeCap="round"
                strokeJoin="round"
              />
            );
          })}
        </Canvas>
      )}

      {/* Blank placeholder icon when no content at all */}
      {!slide.backgroundUri && slide.paths.length === 0 && (
        <MaterialCommunityIcons name="monitor-shimmer" size={22} color="#333" />
      )}
    </View>
  );
};

export const SlideSidebar: React.FC<SlideSidebarProps> = ({
  slides, currentSlideIndex, onSelectSlide, onAddSlide,
  onMoveSlideUp, onMoveSlideDown, onDeleteSlide,
}) => {
  const [expandedIndex, setExpandedIndex] = React.useState<number | null>(null);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Slides</Text>
      <Text style={styles.hint}>Long-press to reorder</Text>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {slides.map((slide, index) => {
          const isActive = index === currentSlideIndex;
          const isExpanded = expandedIndex === index;

          return (
            <TouchableOpacity
              key={slide.id}
              style={[styles.slideCard, isActive && styles.activeSlideCard]}
              onPress={() => { onSelectSlide(index); setExpandedIndex(null); }}
              onLongPress={() => setExpandedIndex(isExpanded ? null : index)}
              delayLongPress={600}
              activeOpacity={0.85}
            >
              {/* Thumbnail */}
              <SlideThumb slide={slide} />

              {/* Slide number badge */}
              <View style={styles.pageBadge}>
                <Text style={styles.pageBadgeText}>{index + 1}</Text>
              </View>

              {/* Reorder panel shown on long press */}
              {isExpanded && (
                <View style={styles.reorderPanel}>
                  <TouchableOpacity
                    style={[styles.reorderBtn, index === 0 && styles.disabledBtn]}
                    onPress={() => { onMoveSlideUp(index); setExpandedIndex(Math.max(0, index - 1)); }}
                    disabled={index === 0}
                  >
                    <MaterialCommunityIcons name="arrow-up" size={16} color={index === 0 ? '#444' : '#fff'} />
                    <Text style={[styles.reorderText, index === 0 && styles.disabledText]}>Up</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.reorderBtn, index === slides.length - 1 && styles.disabledBtn]}
                    onPress={() => { onMoveSlideDown(index); setExpandedIndex(Math.min(slides.length - 1, index + 1)); }}
                    disabled={index === slides.length - 1}
                  >
                    <MaterialCommunityIcons name="arrow-down" size={16} color={index === slides.length - 1 ? '#444' : '#fff'} />
                    <Text style={[styles.reorderText, index === slides.length - 1 && styles.disabledText]}>Down</Text>
                  </TouchableOpacity>

                  {slides.length > 1 && (
                    <TouchableOpacity
                      style={styles.reorderBtn}
                      onPress={() => { onDeleteSlide(index); setExpandedIndex(null); }}
                    >
                      <MaterialCommunityIcons name="delete" size={16} color="#FF453A" />
                      <Text style={[styles.reorderText, { color: '#FF453A' }]}>Del</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <TouchableOpacity style={styles.addButton} onPress={onAddSlide}>
        <MaterialCommunityIcons name="plus" size={18} color="#fff" />
        <Text style={styles.addButtonText}>New Slide</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 200,
    backgroundColor: '#0d0d0d',
    borderRightWidth: 1,
    borderRightColor: '#1f1f1f',
    height: '100%',
    paddingTop: 18,
    paddingBottom: 10,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  header: {
    fontSize: 15,
    fontWeight: 'bold',
    paddingHorizontal: 12,
    color: '#fff',
    marginBottom: 2,
  },
  hint: {
    fontSize: 9,
    color: '#444',
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: 10,
    paddingBottom: 16,
    gap: 8,
  },
  slideCard: {
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
    position: 'relative',
  },
  activeSlideCard: {
    borderColor: '#007AFF',
  },
  thumbnailContainer: {
    width: THUMB_W,
    height: THUMB_H,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pageBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
  },
  pageBadgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 10,
  },
  reorderPanel: {
    backgroundColor: '#1c1c1c',
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 5,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  reorderBtn: {
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    gap: 2,
  },
  disabledBtn: { opacity: 0.25 },
  reorderText: { fontSize: 9, color: '#ccc', fontWeight: '600' },
  disabledText: { color: '#444' },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    padding: 10,
    marginHorizontal: 10,
    borderRadius: 8,
    gap: 6,
    marginTop: 6,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
});
