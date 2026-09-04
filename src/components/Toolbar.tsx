import React, { useState, useRef } from 'react';
import { StyleSheet, View, TouchableOpacity, Text, Modal, PanResponder } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DrawingTool } from './WhiteboardCanvas';
import Slider from '@react-native-community/slider';
import { LinearGradient } from 'expo-linear-gradient';

interface ToolbarProps {
  tool: DrawingTool;
  setTool: (tool: DrawingTool) => void;
  onClear: () => void;
  onImportPdf: () => void;
  onImportImage: () => void;      // insert as floating element
  onImportImageBg: () => void;    // set as background
  penColor: string;
  setPenColor: (color: string) => void;
  penWidth: number;
  setPenWidth: (width: number) => void;
  onSelectBgColor: () => void;
  onSave: () => void;
  onLoad: () => void;
  onExportPdf: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  tool, setTool, onClear, onImportPdf, onImportImage, onImportImageBg,
  penColor, setPenColor, penWidth, setPenWidth,
  onSelectBgColor, onSave, onLoad, onExportPdf,
}) => {
  const [menuVisible, setMenuVisible] = useState(false);   // + import menu
  const [moreVisible, setMoreVisible] = useState(false);   // ⋮ more menu
  const [penMenuVisible, setPenMenuVisible] = useState(false);

  const colors = ['#ffffff', '#000000', '#FF3B30', '#007AFF', '#34C759', '#FF9500', '#AF52DE', '#FF2D55'];

  // ─── Custom Hue Slider ───────────────────────────────────────────────────
  const HUE_WIDTH = 160;
  const hueRef = useRef(0);

  const computeHue = (x: number): string => {
    const clamped = Math.max(0, Math.min(x, HUE_WIDTH));
    hueRef.current = clamped;
    const h = (clamped / HUE_WIDTH) * 360;
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = 0.5 - 0.5 * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  };

  const huePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => setPenColor(computeHue(e.nativeEvent.locationX)),
      onPanResponderMove: (e) => setPenColor(computeHue(e.nativeEvent.locationX)),
    })
  ).current;

  return (
    <View style={styles.container}>
      {/* Pen — tap to select, long-press 1s to open settings */}
      <TouchableOpacity
        style={[styles.button, tool === 'pen' && styles.activeButton]}
        onPress={() => setTool('pen')}
        onLongPress={() => { setTool('pen'); setPenMenuVisible(true); }}
        delayLongPress={1000}
      >
        <MaterialCommunityIcons name="pen" size={20} color={tool === 'pen' ? '#4fc3f7' : '#fff'} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, tool === 'eraser' && styles.activeButton]}
        onPress={() => { setTool('eraser'); }}
      >
        <MaterialCommunityIcons name="eraser" size={20} color={tool === 'eraser' ? '#4fc3f7' : '#fff'} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, tool === 'pan' && styles.activeButton]}
        onPress={() => setTool('pan')}
      >
        <MaterialCommunityIcons name="hand-back-right" size={20} color={tool === 'pan' ? '#4fc3f7' : '#fff'} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={onClear}>
        <MaterialCommunityIcons name="delete-outline" size={20} color="#FF453A" />
      </TouchableOpacity>

      {/* ─── + Import Menu ─── */}
      <View style={{ position: 'relative' }}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => { setMenuVisible(!menuVisible); setMoreVisible(false); }}
        >
          <MaterialCommunityIcons name="plus" size={22} color="#34C759" />
        </TouchableOpacity>

        {menuVisible && (
          <>
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setMenuVisible(false)} />
            <View style={styles.popover}>
              <TouchableOpacity style={styles.popoverItem} onPress={() => { setMenuVisible(false); onImportImage(); }}>
                <MaterialCommunityIcons name="image-plus" size={18} color="#eee" />
                <Text style={styles.popoverText}>Insert Image</Text>
              </TouchableOpacity>
              <View style={styles.divider} />
              <TouchableOpacity style={styles.popoverItem} onPress={() => { setMenuVisible(false); onImportImageBg(); }}>
                <MaterialCommunityIcons name="image-frame" size={18} color="#eee" />
                <Text style={styles.popoverText}>Image as BG</Text>
              </TouchableOpacity>
              <View style={styles.divider} />
              <TouchableOpacity style={styles.popoverItem} onPress={() => { setMenuVisible(false); onImportPdf(); }}>
                <MaterialCommunityIcons name="file-pdf-box" size={18} color="#eee" />
                <Text style={styles.popoverText}>Import PDF</Text>
              </TouchableOpacity>
              <View style={styles.divider} />
              <TouchableOpacity style={styles.popoverItem} onPress={() => { setMenuVisible(false); onSelectBgColor(); }}>
                <MaterialCommunityIcons name="format-color-fill" size={18} color="#eee" />
                <Text style={styles.popoverText}>BG Color</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* ─── ⋮ More Menu (Save / Load / Export) ─── */}
      <View style={{ position: 'relative' }}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => { setMoreVisible(!moreVisible); setMenuVisible(false); }}
        >
          <MaterialCommunityIcons name="dots-vertical" size={22} color="#aaa" />
        </TouchableOpacity>

        {moreVisible && (
          <>
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setMoreVisible(false)} />
            <View style={[styles.popover, { width: 160 }]}>
              <TouchableOpacity style={styles.popoverItem} onPress={() => { setMoreVisible(false); onSave(); }}>
                <MaterialCommunityIcons name="content-save-outline" size={18} color="#4fc3f7" />
                <Text style={styles.popoverText}>Save Session</Text>
              </TouchableOpacity>
              <View style={styles.divider} />
              <TouchableOpacity style={styles.popoverItem} onPress={() => { setMoreVisible(false); onLoad(); }}>
                <MaterialCommunityIcons name="folder-open-outline" size={18} color="#4fc3f7" />
                <Text style={styles.popoverText}>Load Session</Text>
              </TouchableOpacity>
              <View style={styles.divider} />
              <TouchableOpacity style={styles.popoverItem} onPress={() => { setMoreVisible(false); onExportPdf(); }}>
                <MaterialCommunityIcons name="export-variant" size={18} color="#81c784" />
                <Text style={styles.popoverText}>Export PDF</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* ─── Pen Settings Modal ─── */}
      <Modal
        visible={penMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPenMenuVisible(false)}
      >
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setPenMenuVisible(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={styles.penPanel}>
              <Text style={styles.panelTitle}>Pen Settings</Text>

              <View style={styles.colorPreviewRow}>
                <View style={[styles.colorPreviewSwatch, { backgroundColor: penColor }]} />
                <Text style={styles.label}>Current Color</Text>
              </View>

              <View style={styles.dividerDark} />
              <Text style={styles.label}>Thickness: {penWidth}px</Text>
              <Slider
                style={{ width: '100%', height: 44 }}
                minimumValue={1}
                maximumValue={30}
                step={1}
                value={penWidth}
                onValueChange={setPenWidth}
                minimumTrackTintColor="#007AFF"
                maximumTrackTintColor="#555"
                thumbTintColor="#007AFF"
              />

              <View style={styles.dividerDark} />
              <Text style={styles.label}>Standard Colors</Text>
              <View style={styles.colorRow}>
                {colors.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.colorOption,
                      { backgroundColor: c },
                      penColor === c && styles.activeBorder,
                      c === '#ffffff' && styles.lightColorBorder,
                    ]}
                    onPress={() => setPenColor(c)}
                  />
                ))}
              </View>

              <View style={styles.dividerDark} />
              <Text style={styles.label}>Custom Color (drag)</Text>
              <View style={styles.hueContainer} {...huePanResponder.panHandlers}>
                <LinearGradient
                  colors={['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ff0000']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />
              </View>

              <TouchableOpacity style={styles.doneButton} onPress={() => setPenMenuVisible(false)}>
                <Text style={styles.doneText}>Done</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    height: 50,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    elevation: 8,
  },
  button: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  activeButton: {
    backgroundColor: 'rgba(0, 122, 255, 0.3)',
  },
  popover: {
    position: 'absolute',
    bottom: 58,
    right: 0,
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    padding: 4,
    width: 140,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    zIndex: 999,
  },
  popoverItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 8,
  },
  popoverText: {
    fontSize: 13,
    color: '#eee',
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#333',
    marginVertical: 1,
  },
  dividerDark: {
    height: 1,
    backgroundColor: '#3a3a3a',
    marginVertical: 10,
  },
  // Pen panel modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  penPanel: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 20,
    width: 300,
    elevation: 15,
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
  },
  colorPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  colorPreviewSwatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#555',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#aaa',
    marginBottom: 4,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 6,
    marginBottom: 4,
  },
  colorOption: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  lightColorBorder: { borderWidth: 1, borderColor: '#555' },
  activeBorder: { borderWidth: 3, borderColor: '#007AFF' },
  hueContainer: {
    width: '100%',
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 6,
    marginBottom: 4,
  },
  doneButton: {
    marginTop: 16,
    backgroundColor: '#007AFF',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  doneText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
