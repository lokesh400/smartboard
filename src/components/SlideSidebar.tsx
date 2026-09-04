import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Image } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PathData } from './WhiteboardCanvas';

interface SlideData {
  id: string;
  backgroundUri?: string;
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

export const SlideSidebar: React.FC<SlideSidebarProps> = ({
  slides,
  currentSlideIndex,
  onSelectSlide,
  onAddSlide,
  onMoveSlideUp,
  onMoveSlideDown,
  onDeleteSlide,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Slides</Text>
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {slides.map((slide, index) => {
          const isActive = index === currentSlideIndex;
          return (
            <TouchableOpacity
              key={slide.id}
              style={[styles.slideCard, isActive && styles.activeSlideCard]}
              onPress={() => onSelectSlide(index)}
            >
              <View style={styles.thumbnailContainer}>
                {slide.backgroundUri ? (
                  <Image source={{ uri: slide.backgroundUri }} style={styles.thumbnailImage} resizeMode="cover" />
                ) : (
                  <MaterialCommunityIcons name="monitor-shimmer" size={32} color="#ddd" />
                )}
                <View style={styles.pageBadge}>
                  <Text style={styles.pageBadgeText}>{index + 1}</Text>
                </View>
              </View>
              
              <View style={styles.actions}>
                <TouchableOpacity onPress={() => onMoveSlideUp(index)} disabled={index === 0}>
                  <MaterialCommunityIcons name="chevron-up" size={24} color={index === 0 ? '#ccc' : '#666'} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => onMoveSlideDown(index)} disabled={index === slides.length - 1}>
                  <MaterialCommunityIcons name="chevron-down" size={24} color={index === slides.length - 1 ? '#ccc' : '#666'} />
                </TouchableOpacity>
                {slides.length > 1 && (
                  <TouchableOpacity onPress={() => onDeleteSlide(index)}>
                    <MaterialCommunityIcons name="delete" size={20} color="#FF3B30" />
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <TouchableOpacity style={styles.addButton} onPress={onAddSlide}>
        <MaterialCommunityIcons name="plus" size={24} color="#fff" />
        <Text style={styles.addButtonText}>New Slide</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 250,
    backgroundColor: '#f8f9fa',
    borderLeftWidth: 1,
    borderLeftColor: '#e0e0e0',
    height: '100%',
    paddingVertical: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  header: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    paddingHorizontal: 20,
    color: '#333',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 15,
    paddingBottom: 20,
    gap: 15,
  },
  slideCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  activeSlideCard: {
    borderColor: '#007AFF',
  },
  thumbnailContainer: {
    height: 120,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  pageBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pageBadgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    padding: 15,
    marginHorizontal: 15,
    borderRadius: 8,
    gap: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
