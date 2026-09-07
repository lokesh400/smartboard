/**
 * SessionManager.ts
 * Handles saving/loading sessions and exporting slides as PDF.
 * NOTE: expo-media-library requires a custom dev build, so PDF export
 * uses expo-print's native print dialog (user can tap "Save as PDF" there).
 */
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { PDFDocument, rgb } from 'pdf-lib';
import { Alert } from 'react-native';
import type { SlideData } from '../types/SlideData';

const SESSION_DIR = (FileSystem.documentDirectory ?? '') + 'smartboard_sessions/';
const SESSION_FILE = SESSION_DIR + 'session.json';

// ─── Save ────────────────────────────────────────────────────────────────────
export async function saveSession(slides: SlideData[]): Promise<void> {
  try {
    const dirInfo = await FileSystem.getInfoAsync(SESSION_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(SESSION_DIR, { intermediates: true });
    }
    const json = JSON.stringify({ version: 1, savedAt: Date.now(), slides });
    await FileSystem.writeAsStringAsync(SESSION_FILE, json);
    Alert.alert('✅ Saved', 'Your session has been saved to device storage.');
  } catch (e: any) {
    Alert.alert('Save Failed', e.message);
  }
}

// ─── Load ────────────────────────────────────────────────────────────────────
export async function loadSession(): Promise<SlideData[] | null> {
  try {
    const info = await FileSystem.getInfoAsync(SESSION_FILE);
    if (!info.exists) {
      Alert.alert('No saved session', 'No previous session was found on this device.');
      return null;
    }
    const json = await FileSystem.readAsStringAsync(SESSION_FILE);
    const parsed = JSON.parse(json);
    if (!parsed.slides || !Array.isArray(parsed.slides)) throw new Error('Invalid session file.');
    Alert.alert('✅ Loaded', `Restored ${parsed.slides.length} slide(s) from your last session.`);
    return parsed.slides as SlideData[];
  } catch (e: any) {
    Alert.alert('Load Failed', e.message);
    return null;
  }
}

// ─── Export to PDF ───────────────────────────────────────────────────────────
// Uses expo-print's native print dialog. Tap "Save as PDF" or "Download" in the dialog.
// NOTE: Direct file-system PDF saving requires a custom dev build (not Expo Go).
export async function exportToPdf(slides: SlideData[]): Promise<void> {
  try {
    const pdfDoc = await PDFDocument.create();

    const hexToRgb = (hex: string) => {
      const cleanHex = hex.replace('#', '');
      const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
      const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
      const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
      return rgb(r, g, b);
    };

    for (const slide of slides) {
      const page = pdfDoc.addPage([1280, 720]);
      
      // Draw background color
      const bgColorHex = slide.backgroundColor || '#000000';
      page.drawRectangle({ x: 0, y: 0, width: 1280, height: 720, color: hexToRgb(bgColorHex) });

      // Draw background image
      if (slide.backgroundUri) {
        try {
          // If it's a content URI, we can't directly base64 it reliably. We fetch it.
          const response = await fetch(slide.backgroundUri);
          const blob = await response.blob();
          const reader = new FileReader();
          const base64 = await new Promise<string>((resolve, reject) => {
            reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          const img = slide.backgroundUri.toLowerCase().endsWith('.png') 
            ? await pdfDoc.embedPng(base64) 
            : await pdfDoc.embedJpg(base64);
          page.drawImage(img, { x: 0, y: 0, width: 1280, height: 720 });
        } catch (e) {
          console.warn('Failed to embed background image', e);
        }
      }

      // Draw floating images
      if (slide.images) {
        for (const imgOver of slide.images) {
          try {
            const response = await fetch(imgOver.uri);
            const blob = await response.blob();
            const reader = new FileReader();
            const base64 = await new Promise<string>((resolve, reject) => {
              reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });

            const img = imgOver.uri.toLowerCase().endsWith('.png') 
              ? await pdfDoc.embedPng(base64) 
              : await pdfDoc.embedJpg(base64);
            
            // pdf-lib's origin is bottom-left, so we must invert Y to match RN's top-left system
            const y = 720 - imgOver.y - imgOver.height;
            page.drawImage(img, { x: imgOver.x, y: y, width: imgOver.width, height: imgOver.height });
          } catch (e) {
            console.warn('Failed to embed overlay image', e);
          }
        }
      }

      // Draw SVG paths
      const paths = (slide.paths ?? []).filter(p => !p.isEraser);
      for (const p of paths) {
        try {
          page.drawSvgPath(p.svgPath, {
            x: 0,
            y: 720, // pdf-lib handles SVG path inversion natively if anchored at the top
            borderColor: hexToRgb(p.color),
            borderWidth: p.strokeWidth,
          });
        } catch (e) {
          console.warn('Failed to draw path', e);
        }
      }
    }

    // Save and Share
    const pdfBase64 = await pdfDoc.saveAsBase64();
    const uri = FileSystem.cacheDirectory + 'ExportedPresentation.pdf';
    await FileSystem.writeAsStringAsync(uri, pdfBase64, { encoding: FileSystem.EncodingType.Base64 });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { 
        mimeType: 'application/pdf',
        dialogTitle: 'Export Whiteboard Presentation',
        UTI: 'com.adobe.pdf'
      });
    } else {
      Alert.alert('Sharing Unavailable', 'Cannot export on this device.');
    }

  } catch (e: any) {
    Alert.alert('Export Failed', e.message ?? String(e));
  }
}