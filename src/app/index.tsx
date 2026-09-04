import React, { useState } from 'react';
import { StyleSheet, View, Image, TouchableOpacity, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { WhiteboardCanvas, DrawingTool, PathData, Point } from '../components/WhiteboardCanvas';
import { Toolbar } from '../components/Toolbar';
import { SlideSidebar } from '../components/SlideSidebar';
import { PdfRenderer } from '../components/PdfRenderer';

interface SlideData {
  id: string;
  backgroundUri?: string;
  paths: PathData[];
}

export default function HomeScreen() {
  const [tool, setTool] = useState<DrawingTool>('pen');
  const [slides, setSlides] = useState<SlideData[]>([{ id: Date.now().toString(), paths: [] }]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  
  // PDF Renderer State
  const [pdfUri, setPdfUri] = useState<string | null>(null);

  const activeSlide = slides[currentSlideIndex];

  const updateActiveSlide = (updater: (slide: SlideData) => SlideData) => {
    setSlides(prev => prev.map((s, i) => i === currentSlideIndex ? updater(s) : s));
  };

  const handleClear = () => {
    updateActiveSlide(s => ({ ...s, paths: [] }));
  };

  const handleImportPdf = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
      });
      if (!result.canceled) {
        setPdfUri(result.assets[0].uri);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleImportImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
      });
      if (!result.canceled) {
        updateActiveSlide(s => ({ ...s, backgroundUri: result.assets[0].uri }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePdfPagesRendered = (imageUris: string[]) => {
    if (imageUris.length === 0) return;
    
    // Replace current slide with first page, add rest as new slides
    const newSlides = [...slides];
    newSlides[currentSlideIndex] = { ...newSlides[currentSlideIndex], backgroundUri: imageUris[0] };
    
    for (let i = 1; i < imageUris.length; i++) {
      newSlides.push({ id: Date.now().toString() + i, paths: [], backgroundUri: imageUris[i] });
    }
    
    setSlides(newSlides);
    setPdfUri(null); // Cleanup
  };

  // Slide Manager Actions
  const handleAddSlide = () => {
    setSlides(prev => [...prev, { id: Date.now().toString(), paths: [] }]);
    setCurrentSlideIndex(slides.length);
  };

  const handleMoveSlideUp = (index: number) => {
    if (index === 0) return;
    setSlides(prev => {
      const newSlides = [...prev];
      const temp = newSlides[index - 1];
      newSlides[index - 1] = newSlides[index];
      newSlides[index] = temp;
      return newSlides;
    });
    if (currentSlideIndex === index) setCurrentSlideIndex(index - 1);
    else if (currentSlideIndex === index - 1) setCurrentSlideIndex(index);
  };

  const handleMoveSlideDown = (index: number) => {
    if (index === slides.length - 1) return;
    setSlides(prev => {
      const newSlides = [...prev];
      const temp = newSlides[index + 1];
      newSlides[index + 1] = newSlides[index];
      newSlides[index] = temp;
      return newSlides;
    });
    if (currentSlideIndex === index) setCurrentSlideIndex(index + 1);
    else if (currentSlideIndex === index + 1) setCurrentSlideIndex(index);
  };

  const handleDeleteSlide = (index: number) => {
    if (slides.length <= 1) return;
    setSlides(prev => prev.filter((_, i) => i !== index));
    if (currentSlideIndex >= slides.length - 1) {
      setCurrentSlideIndex(slides.length - 2);
    }
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      {/* Hidden Webview for PDF Processing */}
      {pdfUri && (
        <PdfRenderer pdfUri={pdfUri} onPagesRendered={handlePdfPagesRendered} />
      )}

      {/* Main Drawing Area */}
      <View style={styles.boardArea}>
        <WhiteboardCanvas 
          tool={tool} 
          paths={activeSlide.paths}
          onPathsChange={(newPaths) => updateActiveSlide(s => ({ ...s, paths: newPaths }))}
          backgroundUri={activeSlide.backgroundUri}
        />
        
        {/* Page Indicator Bottom Left */}
        <View style={styles.pageIndicatorContainer}>
          <TouchableOpacity 
            style={styles.arrowButton} 
            onPress={() => setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1))}
            disabled={currentSlideIndex === 0}
          >
            <MaterialCommunityIcons 
              name="chevron-left" 
              size={28} 
              color={currentSlideIndex === 0 ? "#ccc" : "#333"} 
            />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setIsSidebarVisible(!isSidebarVisible)}>
            <Text style={styles.pageIndicatorText}>
              {currentSlideIndex + 1} / {slides.length}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.arrowButton} 
            onPress={() => setCurrentSlideIndex(Math.min(slides.length - 1, currentSlideIndex + 1))}
            disabled={currentSlideIndex === slides.length - 1}
          >
            <MaterialCommunityIcons 
              name="chevron-right" 
              size={28} 
              color={currentSlideIndex === slides.length - 1 ? "#ccc" : "#333"} 
            />
          </TouchableOpacity>
        </View>

        <Toolbar
          tool={tool}
          setTool={setTool}
          onClear={handleClear}
          onImportPdf={handleImportPdf}
          onImportImage={handleImportImage}
        />
      </View>

      {/* Slide Sidebar Toggle */}
      {isSidebarVisible && (
        <SlideSidebar
          slides={slides}
          currentSlideIndex={currentSlideIndex}
          onSelectSlide={setCurrentSlideIndex}
          onAddSlide={handleAddSlide}
          onMoveSlideUp={handleMoveSlideUp}
          onMoveSlideDown={handleMoveSlideDown}
          onDeleteSlide={handleDeleteSlide}
        />
      )}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    flexDirection: 'row',
  },
  boardArea: {
    flex: 1,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  pageIndicatorContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 25,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  arrowButton: {
    padding: 4,
  },
  pageIndicatorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  }
});
