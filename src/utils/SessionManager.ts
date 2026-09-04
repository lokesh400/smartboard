/**
 * SessionManager.ts
 * Handles saving sessions to device storage and exporting slides as PDF.
 */
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as MediaLibrary from 'expo-media-library';
import { Alert } from 'react-native';
import { SlideData } from '../app/index';

const SESSION_DIR = FileSystem.documentDirectory + 'smartboard_sessions/';
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
export async function exportToPdf(slides: SlideData[]): Promise<void> {
  try {
    const slideHtmlPages: string[] = [];

    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      const bgColor = slide.backgroundColor || '#000000';

      const svgPaths = slide.paths
        .map((p) => {
          if (p.isEraser) return ''; // Skip eraser strokes for PDF
          return `<path d="${p.svgPath}" stroke="${p.color}" stroke-width="${p.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" fill="none" />`;
        })
        .join('\n');

      const bgEl = slide.backgroundUri
        ? `<image href="${slide.backgroundUri}" x="0" y="0" width="1280" height="720" preserveAspectRatio="none" />`
        : `<rect width="1280" height="720" fill="${bgColor}" />`;

      const svgContent = `
        <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
             width="1280" height="720" viewBox="0 0 1280 720">
          ${bgEl}
          ${svgPaths}
        </svg>`;

      slideHtmlPages.push(`
        <div class="slide">
          <div class="slide-number">Slide ${i + 1} of ${slides.length}</div>
          ${svgContent}
        </div>`);
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { background: #111; font-family: sans-serif; }
          .slide { width: 100%; page-break-after: always; position: relative; display: block; }
          .slide-number { position: absolute; top: 8px; left: 12px; font-size: 11px; color: #888; z-index: 10; }
          svg { display: block; width: 100%; height: auto; }
        </style>
      </head>
      <body>${slideHtmlPages.join('\n')}</body>
      </html>`;

    // Generate PDF file
    const { uri: pdfUri } = await Print.printToFileAsync({ html });

    // Request permission to save to device storage
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission needed',
        'Please allow storage access to save the PDF, then try again.',
      );
      return;
    }

    // Save directly to device Downloads (no dialog, no copy needed —
    // MediaLibrary has its own native file access that works in Expo Go)
    const asset = await MediaLibrary.createAssetAsync(pdfUri);

    // Move into a named album so it's easy to find
    const albumName = 'SmartBoard';
    const album = await MediaLibrary.getAlbumAsync(albumName);
    if (album) {
      await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
    } else {
      await MediaLibrary.createAlbumAsync(albumName, asset, false);
    }

    Alert.alert(
      '✅ PDF Downloaded!',
      'Your slides have been saved to the SmartBoard album in your device gallery/files.',
    );
  } catch (e: any) {
    Alert.alert('Export Failed', e.message ?? String(e));
  }
}
