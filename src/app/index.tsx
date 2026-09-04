import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useState } from 'react';
import { Modal, PanResponder, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ImageOverlay, ImageOverlayLayer } from '../components/ImageOverlayLayer';
import { PdfRenderer } from '../components/PdfRenderer';
import { SlideSidebar } from '../components/SlideSidebar';
import { Toolbar } from '../components/Toolbar';
import { DrawingTool, PathData, WhiteboardCanvas } from '../components/WhiteboardCanvas';
import { exportToPdf, loadSession, saveSession } from '../utils/SessionManager';

export interface SlideData {
  id: string;
  paths: PathData[];
  backgroundUri?: string;
  backgroundColor?: string;
  images?: ImageOverlay[];  // floating draggable images
}

const DEFAULT_BG = '#000000';
const DEFAULT_PEN = '#ffffff';

const BG_PRESETS = [
  '#000000', '#1a1a2e', '#1e3d2f', '#2a2a2a',
  '#ffffff', '#fffde7', '#e3f2fd', '#fce4ec',
];

export default function HomeScreen() {
  const [tool, setTool] = useState<DrawingTool>('pen');
  const [penColor, setPenColor] = useState<string>(DEFAULT_PEN);
  const [penWidth, setPenWidth] = useState<number>(5);
  const [defaultBg, setDefaultBg] = useState<string>(DEFAULT_BG);
  const [slides, setSlides] = useState<SlideData[]>([
    { id: Date.now().toString(), paths: [], backgroundColor: DEFAULT_BG },
  ]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);

  // PDF Renderer State
  const [pdfUri, setPdfUri] = useState<string | null>(null);

  // Background Color Picker Modal
  const [bgPickerVisible, setBgPickerVisible] = useState(false);
  const [pickedBgColor, setPickedBgColor] = useState<string>(DEFAULT_BG);

  // Background Apply-Scope Modal (shown after color is chosen)
  const [bgScopeVisible, setBgScopeVisible] = useState(false);
  const [pendingBgConfig, setPendingBgConfig] = useState<{ type: 'color' | 'image'; value: string } | null>(null);

  const activeSlide = slides[currentSlideIndex];

  const updateActiveSlide = (updater: (slide: SlideData) => SlideData) => {
    setSlides(prev => prev.map((s, i) => (i === currentSlideIndex ? updater(s) : s)));
  };

  // --- Hue slider for BG color picker ---
  const HUE_WIDTH_BG = 240;
  const bgHueRef = useRef(0);
  const computeBgHue = (x: number): string => {
    const clamped = Math.max(0, Math.min(x, HUE_WIDTH_BG));
    bgHueRef.current = clamped;
    const h = (clamped / HUE_WIDTH_BG) * 360;
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = 0.5 - 0.5 * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  };
  const bgHuePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => setPickedBgColor(computeBgHue(e.nativeEvent.locationX)),
      onPanResponderMove: (e) => setPickedBgColor(computeBgHue(e.nativeEvent.locationX)),
    })
  ).current;

  // Step 1: open color picker
  const handleSelectBgColor = () => {
    setPickedBgColor(activeSlide.backgroundColor || defaultBg);
    setBgPickerVisible(true);
  };

  // Step 2: color chosen → show scope modal
  const confirmBgColor = () => {
    setBgPickerVisible(false);
    setPendingBgConfig({ type: 'color', value: pickedBgColor });
    setBgScopeVisible(true);
  };

  // Step 3: apply to current or all
  const applyBackground = (applyToAll: boolean) => {
    if (!pendingBgConfig) return;
    const newBg = pendingBgConfig.type === 'color' ? pendingBgConfig.value : undefined;
    const newUri = pendingBgConfig.type === 'image' ? pendingBgConfig.value : undefined;

    setSlides(prev =>
      prev.map((slide, i) => {
        if (applyToAll || i === currentSlideIndex) {
          return {
            ...slide,
            backgroundColor: newBg,
            backgroundUri: newUri,
          };
        }
        return slide;
      })
    );

    // Keep defaultBg in sync when applying color
    if (pendingBgConfig.type === 'color') {
      setDefaultBg(pendingBgConfig.value);
    }

    setBgScopeVisible(false);
    setPendingBgConfig(null);
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

  // Set image as BACKGROUND (scope modal)
  const handleImportImageBg = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
      if (!result.canceled) {
        setPendingBgConfig({ type: 'image', value: result.assets[0].uri });
        setBgScopeVisible(true);
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

  const handleClear = () => updateActiveSlide(s => ({ ...s, paths: [] }));

  const handleSave = () => saveSession(slides);

  const handleLoad = async () => {
    const loaded = await loadSession();
    if (loaded) {
      setSlides(loaded);
      setCurrentSlideIndex(0);
    }
  };

  const handleExportPdf = () => exportToPdf(slides);

  // New slide inherits current defaultBg
  const handleAddSlide = () => {
    setSlides(prev => [...prev, { id: Date.now().toString(), paths: [], backgroundColor: defaultBg }]);
    setCurrentSlideIndex(slides.length);
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
          onSelectSlide={setCurrentSlideIndex}
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
          onPathsChange={newPaths => updateActiveSlide(s => ({ ...s, paths: newPaths }))}
          backgroundUri={activeSlide.backgroundUri}
          penColor={penColor}
          penWidth={penWidth}
          onSwipeLeft={() => setCurrentSlideIndex(i => Math.min(slides.length - 1, i + 1))}
          onSwipeRight={() => setCurrentSlideIndex(i => Math.max(0, i - 1))}
        />

        {/* Floating Image Overlays */}
        <ImageOverlayLayer
          images={activeSlide.images || []}
          onUpdate={imgs => updateActiveSlide(s => ({ ...s, images: imgs }))}
          isInteractive={tool === 'pan'}
        />
        <View style={styles.pageIndicatorContainer}>
          <TouchableOpacity
            style={styles.arrowButton}
            onPress={() => setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1))}
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
            onPress={() => setCurrentSlideIndex(Math.min(slides.length - 1, currentSlideIndex + 1))}
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
        />
      </View>

      {/* ─── Step 1: Background Color Picker ─── */}
      <Modal transparent visible={bgPickerVisible} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Choose Background Color</Text>

            {/* Live preview */}
            <View style={[styles.bgPreview, { backgroundColor: pickedBgColor }]} />

            {/* Presets */}
            <Text style={styles.modalLabel}>Presets</Text>
            <View style={styles.colorGrid}>
              {BG_PRESETS.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.bgSwatch,
                    { backgroundColor: c },
                    pickedBgColor === c && styles.bgSwatchActive,
                    c === '#ffffff' && { borderWidth: 1, borderColor: '#ccc' },
                  ]}
                  onPress={() => setPickedBgColor(c)}
                />
              ))}
            </View>

            {/* Custom hue slider */}
            <Text style={styles.modalLabel}>Custom (drag)</Text>
            <View style={styles.hueBar} {...bgHuePanResponder.panHandlers}>
              <LinearGradient
                colors={['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ff0000']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
            </View>

            <View style={styles.modalRow}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setBgPickerVisible(false)}>
                <Text style={styles.modalBtnTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnPrimary} onPress={confirmBgColor}>
                <Text style={styles.modalBtnTextPrimary}>Next →</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Step 2: Apply Scope ─── */}
      <Modal transparent visible={bgScopeVisible} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Apply Background</Text>
            <Text style={styles.modalSubtitle}>Where would you like to apply this?</Text>

            {pendingBgConfig?.type === 'color' && (
              <View style={[styles.bgPreview, { backgroundColor: pendingBgConfig.value, marginBottom: 16 }]} />
            )}

            <TouchableOpacity style={styles.modalBtnPrimary} onPress={() => applyBackground(false)}>
              <Text style={styles.modalBtnTextPrimary}>Current Slide Only</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.modalBtnSecondary, { marginTop: 10 }]} onPress={() => applyBackground(true)}>
              <Text style={styles.modalBtnTextSecondary}>Apply to ALL Slides</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalBtnCancel} onPress={() => { setBgScopeVisible(false); setPendingBgConfig(null); }}>
              <Text style={styles.modalBtnTextCancel}>Cancel</Text>
            </TouchableOpacity>
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

  hueBar: {
    width: '100%',
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 20,
  },

  modalRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
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
