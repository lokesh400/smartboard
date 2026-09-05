import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useRef, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ImageOverlay } from '../components/ImageOverlayLayer';
import { PdfRenderer } from '../components/PdfRenderer';
import { SlideSidebar } from '../components/SlideSidebar';
import { Toolbar } from '../components/Toolbar';
import { DrawingTool, WhiteboardCanvas } from '../components/WhiteboardCanvas';
import { exportToPdf, loadSession, saveSession } from '../utils/SessionManager';

import type { SlideData } from '../types/SlideData';

const DEFAULT_BG = '#000000';
const DEFAULT_PEN = '#ffffff';

const BG_PRESETS = [
  '#000000', // Pure Black
  '#1a1a2e', // Deep Navy
  '#1e3d2f', // Dark Emerald
  '#2d3142', // Independence Blue
  '#4a4e69', // Muted Violet
  '#2b2b2b', // Charcoal
  '#f8f9fa', // Off White
  '#ffffff', // Pure White
];

export default function HomeScreen() {
  const [tool, setTool] = useState<DrawingTool>('pen');
  const [penColor, setPenColor] = useState<string>(DEFAULT_PEN);
  const [penWidth, setPenWidth] = useState<number>(5);
  const [defaultBg, setDefaultBg] = useState<string>(DEFAULT_BG);
  const [history, setHistory] = useState<{ past: SlideData[][]; present: SlideData[]; future: SlideData[][] }>({
    past: [],
    present: [{ id: Date.now().toString(), paths: [], backgroundColor: DEFAULT_BG }],
    future: [],
  });
  const slides = history.present;
  const [clearStrokeTick, setClearStrokeTick] = useState(0);

  const setSlides = (updater: SlideData[] | ((prev: SlideData[]) => SlideData[])) => {
    setHistory(prev => {
      const nextPresent = typeof updater === 'function' ? updater(prev.present) : updater;
      // Do not push to history if state didn't change
      if (nextPresent === prev.present) return prev;
      return {
        past: [...prev.past, prev.present],
        present: nextPresent,
        future: [],
      };
    });
  };
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);

  // PDF Renderer State
  const [pdfUri, setPdfUri] = useState<string | null>(null);

  // Background Color Picker Modal
  const [bgPickerVisible, setBgPickerVisible] = useState(false);
  const [pickedBgColor, setPickedBgColor] = useState<string>(DEFAULT_BG);

  const activeSlide = slides[currentSlideIndex];

  const updateActiveSlide = (updater: (slide: SlideData) => SlideData) => {
    setSlides(prev => prev.map((s, i) => (i === currentSlideIndex ? updater(s) : s)));
  };

  // Step 1: open color picker
  const handleSelectBgColor = () => {
    setPickedBgColor(activeSlide.backgroundColor || defaultBg);
    setBgPickerVisible(true);
  };

  // Step 2: apply directly from the single modal
  const applyBackground = (applyToAll: boolean) => {
    setSlides(prev =>
      prev.map((slide, i) => {
        if (applyToAll || i === currentSlideIndex) {
          return {
            ...slide,
            backgroundColor: pickedBgColor,
            backgroundUri: undefined, // remove image if setting color
          };
        }
        return slide;
      })
    );

    setDefaultBg(pickedBgColor);
    setBgPickerVisible(false);
  };

  // Insert image as floating element on canvas
  const handleInsertImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
      if (!result.canceled) {
        const asset = result.assets[0];
        const newImg: ImageOverlay = {
          id: Date.now().toString(),
          uri: asset.uri,
          x: 80,
          y: 80,
          width: 300,
          height: 200,
        };
        updateActiveSlide(s => ({ ...s, images: [...(s.images || []), newImg] }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Set image as BACKGROUND (applies to current slide immediately)
  const handleImportImageBg = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
      if (!result.canceled) {
        setSlides(prev => prev.map((slide, i) => 
          i === currentSlideIndex 
            ? { ...slide, backgroundUri: result.assets[0].uri, backgroundColor: undefined } 
            : slide
        ));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleImportPdf = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
      if (!result.canceled) {
        setPdfUri(result.assets[0].uri);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePdfPagesRendered = (imageUris: string[]) => {
    if (imageUris.length === 0) return;
    const newSlides = [...slides];
    newSlides[currentSlideIndex] = { ...newSlides[currentSlideIndex], backgroundUri: imageUris[0] };
    for (let i = 1; i < imageUris.length; i++) {
      newSlides.push({ id: Date.now().toString() + i, paths: [], backgroundUri: imageUris[i] });
    }
    setSlides(newSlides);
    setPdfUri(null);
  };

  const handleClear = () => {
    updateActiveSlide(s => ({ ...s, paths: [] }));
    setClearStrokeTick(t => t + 1);
  };

  const handleUndo = () => {
    setHistory(prev => {
      if (prev.past.length === 0) return prev;
      setClearStrokeTick(t => t + 1);
      const newPast = [...prev.past];
      const previous = newPast.pop()!;
      return {
        past: newPast,
        present: previous,
        future: [...prev.future, prev.present],
      };
    });
  };

  const handleRedo = () => {
    setHistory(prev => {
      if (prev.future.length === 0) return prev;
      setClearStrokeTick(t => t + 1);
      const newFuture = [...prev.future];
      const next = newFuture.pop()!;
      return {
        past: [...prev.past, prev.present],
        present: next,
        future: newFuture,
      };
    });
  };

  const handleSave = () => saveSession(slides);

  const handleLoad = async () => {
    const loaded = await loadSession();
    if (loaded) {
      setSlides(loaded);
      setCurrentSlideIndex(0);
    }
  };

  const handleExportPdf = () => exportToPdf(slides);

  // New slide inherits current defaultBg and is inserted immediately after the current slide
  const handleAddSlide = () => {
    setSlides(prev => {
      const newSlide = { id: Date.now().toString(), paths: [], backgroundColor: defaultBg };
      const nextIndex = currentSlideIndex + 1;
      const ns = [...prev];
      ns.splice(nextIndex, 0, newSlide);
      return ns;
    });
    setCurrentSlideIndex(currentSlideIndex + 1);
  };

  const handleMoveSlideUp = (index: number) => {
    if (index === 0) return;
    setSlides(prev => {
      const ns = [...prev];
      [ns[index - 1], ns[index]] = [ns[index], ns[index - 1]];
      return ns;
    });
    if (currentSlideIndex === index) setCurrentSlideIndex(index - 1);
    else if (currentSlideIndex === index - 1) setCurrentSlideIndex(index);
  };

  const handleMoveSlideDown = (index: number) => {
    if (index === slides.length - 1) return;
    setSlides(prev => {
      const ns = [...prev];
      [ns[index + 1], ns[index]] = [ns[index], ns[index + 1]];
      return ns;
    });
    if (currentSlideIndex === index) setCurrentSlideIndex(index + 1);
    else if (currentSlideIndex === index + 1) setCurrentSlideIndex(index);
  };

  const handleDeleteSlide = (index: number) => {
    if (slides.length <= 1) return;
    setSlides(prev => prev.filter((_, i) => i !== index));
    if (currentSlideIndex >= slides.length - 1) setCurrentSlideIndex(slides.length - 2);
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      {pdfUri && <PdfRenderer pdfUri={pdfUri} onPagesRendered={handlePdfPagesRendered} />}

      {/* Sidebar on the LEFT */}
      {isSidebarVisible && (
        <SlideSidebar
          slides={slides}
          currentSlideIndex={currentSlideIndex}
          onSelectSlide={(i) => {
            setCurrentSlideIndex(i);
            setClearStrokeTick(t => t + 1);
          }}
          onAddSlide={handleAddSlide}
          onMoveSlideUp={handleMoveSlideUp}
          onMoveSlideDown={handleMoveSlideDown}
          onDeleteSlide={handleDeleteSlide}
        />
      )}

      <View style={[styles.boardArea, { backgroundColor: activeSlide.backgroundColor || DEFAULT_BG }]}>
        <WhiteboardCanvas
          tool={tool}
          paths={activeSlide.paths}
          onPathsChange={newPaths => updateActiveSlide(s => ({ 
            ...s, 
            paths: newPaths,
          }))}
          images={activeSlide.images || []}
          onImagesChange={imgs => updateActiveSlide(s => ({ ...s, images: imgs }))}
          backgroundUri={activeSlide.backgroundUri}
          penColor={penColor}
          penWidth={penWidth}
          clearStrokeTick={clearStrokeTick}
          onSwipeLeft={() => setCurrentSlideIndex(i => Math.min(slides.length - 1, i + 1))}
          onSwipeRight={() => setCurrentSlideIndex(i => Math.max(0, i - 1))}
        />
        <View style={styles.pageIndicatorContainer}>
          <TouchableOpacity
            style={styles.arrowButton}
            onPress={() => {
              setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1));
              setClearStrokeTick(t => t + 1);
            }}
            disabled={currentSlideIndex === 0}
          >
            <MaterialCommunityIcons
              name="chevron-left"
              size={24}
              color={currentSlideIndex === 0 ? '#555' : '#fff'}
            />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setIsSidebarVisible(!isSidebarVisible)}>
            <Text style={styles.pageIndicatorText}>
              {currentSlideIndex + 1} / {slides.length}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.arrowButton}
            onPress={() => {
              setCurrentSlideIndex(Math.min(slides.length - 1, currentSlideIndex + 1));
              setClearStrokeTick(t => t + 1);
            }}
            disabled={currentSlideIndex === slides.length - 1}
          >
            <MaterialCommunityIcons
              name="chevron-right"
              size={24}
              color={currentSlideIndex === slides.length - 1 ? '#555' : '#fff'}
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.arrowButton} onPress={handleAddSlide}>
            <MaterialCommunityIcons name="plus-circle" size={22} color="#4fc3f7" />
          </TouchableOpacity>
        </View>

        <Toolbar
          tool={tool}
          setTool={setTool}
          onClear={handleClear}
          onImportPdf={handleImportPdf}
          onImportImage={handleInsertImage}
          onImportImageBg={handleImportImageBg}
          penColor={penColor}
          setPenColor={setPenColor}
          penWidth={penWidth}
          setPenWidth={setPenWidth}
          onSelectBgColor={handleSelectBgColor}
          onSave={handleSave}
          onLoad={handleLoad}
          onExportPdf={handleExportPdf}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={history.past.length > 0}
          canRedo={history.future.length > 0}
        />
      </View>

      {/* ─── Background Color Modal ─── */}
      <Modal transparent visible={bgPickerVisible} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Background Style</Text>
            
            {/* Live preview */}
            <View style={[styles.bgPreview, { backgroundColor: pickedBgColor }]} />

            {/* Presets */}
            <Text style={styles.modalLabel}>Curated Palettes</Text>
            <View style={styles.colorGrid}>
              {BG_PRESETS.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.bgSwatch,
                    { backgroundColor: c },
                    pickedBgColor === c && styles.bgSwatchActive,
                    (c === '#ffffff' || c === '#f8f9fa') && { borderWidth: 1, borderColor: '#e0e0e0' },
                  ]}
                  onPress={() => setPickedBgColor(c)}
                />
              ))}
            </View>

            <View style={styles.modalActionStack}>
              <TouchableOpacity style={styles.modalBtnPrimary} onPress={() => applyBackground(false)}>
                <Text style={styles.modalBtnTextPrimary}>Apply to Current Slide</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnSecondary} onPress={() => applyBackground(true)}>
                <Text style={styles.modalBtnTextSecondary}>Apply to All Slides</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setBgPickerVisible(false)}>
                <Text style={styles.modalBtnTextCancel}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row' },
  boardArea: { flex: 1, position: 'relative' },

  pageIndicatorContainer: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  arrowButton: { padding: 2 },
  pageIndicatorText: { fontSize: 15, fontWeight: 'bold', color: '#fff' },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: 320,
    backgroundColor: '#1e1e1e',
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginBottom: 12 },
  modalSubtitle: { fontSize: 13, color: '#aaa', textAlign: 'center', marginBottom: 16 },
  modalLabel: { alignSelf: 'flex-start', fontSize: 12, fontWeight: '600', color: '#888', marginBottom: 8, marginTop: 4 },

  bgPreview: {
    width: '100%',
    height: 48,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#444',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
    justifyContent: 'center',
  },
  bgSwatch: { width: 32, height: 32, borderRadius: 16 },
  bgSwatchActive: { borderWidth: 3, borderColor: '#4fc3f7' },

  modalActionStack: { width: '100%', marginTop: 8, alignItems: 'center' },
  modalBtnPrimary: {
    backgroundColor: '#007AFF',
    width: '100%',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  modalBtnTextPrimary: { color: '#fff', fontWeight: '700', fontSize: 15 },
  modalBtnSecondary: {
    backgroundColor: '#333',
    width: '100%',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  modalBtnTextSecondary: { color: '#eee', fontWeight: '600', fontSize: 15 },
  modalBtnCancel: { padding: 10, marginTop: 4 },
  modalBtnTextCancel: { color: '#FF3B30', fontWeight: '600', fontSize: 15 },
});
