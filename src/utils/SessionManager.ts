/**
 * SessionManager.ts
 * Handles saving/loading sessions and exporting slides as PDF.
 * NOTE: expo-media-library requires a custom dev build, so PDF export
 * uses expo-print's native print dialog (user can tap "Save as PDF" there).
 */
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
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
    const slideHtmlPages: string[] = [];

    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      const bgColor = slide.backgroundColor || '#000000';

      const svgPaths = (slide.paths ?? [])
        .filter(p => !p.isEraser)
        .map(p => `<path d="${p.svgPath}" stroke="${p.color}" stroke-width="${p.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" fill="none" />`)
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
          <span class="slide-num">Slide ${i + 1} / ${slides.length}</span>
          ${svgContent}
        </div>`);
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8"/>
        <style>
          @page { size: 16in 9in; margin: 0; }
          * { margin:0; padding:0; box-sizing:border-box; }
          body { background:#111; font-family:sans-serif; width: 16in; height: 9in; }
          .slide { width: 16in; height: 9in; page-break-after:always; position:relative; overflow: hidden; }
          .slide-num { position:absolute; top:10px; left:10px; font-size:14px; color:#888; }
          svg { display:block; width:100%; height:100%; }
        </style>
      </head>
      <body>${slideHtmlPages.join('\n')}</body>
      </html>`;

    // Generate the PDF file with exact 16:9 dimensions (1280x720) to avoid A4/Letter letterboxing
    const { uri } = await Print.printToFileAsync({ 
      html,
      width: 1280,
      height: 720
    });

    // Open the native share sheet so the user can "Save to Files" or send it
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