import React, { useState } from 'react';
import { StyleSheet, View, TouchableOpacity, Text, Modal } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DrawingTool } from './WhiteboardCanvas';

interface ToolbarProps {
  tool: DrawingTool;
  setTool: (tool: DrawingTool) => void;
  onClear: () => void;
  onImportPdf: () => void;
  onImportImage: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  tool,
  setTool,
  onClear,
  onImportPdf,
  onImportImage,
}) => {
  const [menuVisible, setMenuVisible] = useState(false);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, tool === 'pen' && styles.activeButton]}
        onPress={() => setTool('pen')}
      >
        <MaterialCommunityIcons name="pen" size={24} color={tool === 'pen' ? '#fff' : '#333'} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.button, tool === 'eraser' && styles.activeButton]}
        onPress={() => setTool('eraser')}
      >
        <MaterialCommunityIcons name="eraser" size={24} color={tool === 'eraser' ? '#fff' : '#333'} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.button, tool === 'pan' && styles.activeButton]}
        onPress={() => setTool('pan')}
      >
        <MaterialCommunityIcons name="hand-back-right" size={24} color={tool === 'pan' ? '#fff' : '#333'} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.button} onPress={onClear}>
        <MaterialCommunityIcons name="delete-outline" size={24} color="#FF3B30" />
      </TouchableOpacity>
      
      {/* Plus Menu */}
      <View style={{ position: 'relative' }}>
        <TouchableOpacity style={[styles.button, styles.importButton]} onPress={() => setMenuVisible(!menuVisible)}>
          <MaterialCommunityIcons name="plus" size={28} color="#fff" />
        </TouchableOpacity>
        
        {menuVisible && (
          <View style={styles.popover}>
            <TouchableOpacity 
              style={styles.popoverItem} 
              onPress={() => { setMenuVisible(false); onImportImage(); }}
            >
              <MaterialCommunityIcons name="image" size={20} color="#333" />
              <Text style={styles.popoverText}>Image</Text>
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity 
              style={styles.popoverItem} 
              onPress={() => { setMenuVisible(false); onImportPdf(); }}
            >
              <MaterialCommunityIcons name="file-pdf-box" size={20} color="#333" />
              <Text style={styles.popoverText}>PDF</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    height: 70,
    paddingHorizontal: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 35,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  button: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f0f0',
  },
  activeButton: {
    backgroundColor: '#007AFF',
  },
  importButton: {
    backgroundColor: '#34C759',
  },
  popover: {
    position: 'absolute',
    bottom: 70, // Above the plus button
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 5,
    width: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  popoverItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  popoverText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginHorizontal: 10,
  }
});
