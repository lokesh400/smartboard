import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import { Alert } from 'react-native';

import type { SlideData } from '../types/SlideData';

// ─── Storage Paths ───────────────────────────────────────────────

const SESSION_DIR =
  FileSystem.documentDirectory + 'smartboard_sessions/';

const SESSION_FILE =
  SESSION_DIR + 'session.json';

// ─── Create Session Directory ────────────────────────────────────

async function ensureSessionDirectory(): Promise<void> {
  const dirInfo = await FileSystem.getInfoAsync(SESSION_DIR);

  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(SESSION_DIR, {
      intermediates: true,
    });
  }
}

// ─── Save Session ────────────────────────────────────────────────

export async function saveSession(
  slides: SlideData[]
): Promise<void> {
  try {
    await ensureSessionDirectory();

    const json = JSON.stringify(
      {
        version: 1,
        savedAt: Date.now(),
        slides,
      },
      null,
      2
    );

    await FileSystem.writeAsStringAsync(
      SESSION_FILE,
      json
    );

    Alert.alert(
      'Saved',
      'Your SmartBoard session has been saved successfully.'
    );

  } catch (error: any) {
    console.error('Save session error:', error);

    Alert.alert(
      'Save Failed',
      error?.message || 'Unable to save the session.'
    );
  }
}

// ─── Load Session ────────────────────────────────────────────────

export async function loadSession(): Promise<SlideData[] | null> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(
      SESSION_FILE
    );

    if (!fileInfo.exists) {
      Alert.alert(
        'No Saved Session',
        'No previous SmartBoard session was found.'
      );

      return null;
    }

    const json = await FileSystem.readAsStringAsync(
      SESSION_FILE
    );

    const parsed = JSON.parse(json);

    if (!parsed.slides || !Array.isArray(parsed.slides)) {
      throw new Error('Invalid session file.');
    }

    Alert.alert(
      'Loaded',
      `Restored ${parsed.slides.length} slide(s).`
    );

    return parsed.slides as SlideData[];

  } catch (error: any) {
    console.error('Load session error:', error);

    Alert.alert(
      'Load Failed',
      error?.message || 'Unable to load the session.'
    );

    return null;
  }
}

// ─── Export to PDF ───────────────────────────────────────────────

export async function exportToPdf(
  slides: SlideData[]
): Promise<void> {
  try {
    const slideHtmlPages: string[] = [];

    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];

      const bgColor =
        slide.backgroundColor || '#000000';

      // Convert drawing paths to SVG
      const svgPaths = slide.paths
        .map((path) => {
          // Skip eraser paths
          if (path.isEraser) return '';

          return `
            <path
              d="${path.svgPath}"
              stroke="${path.color}"
              stroke-width="${path.strokeWidth}"
              stroke-linecap="round"
              stroke-linejoin="round"
              fill="none"
            />
          `;
        })
        .join('\n');

      // Background
      const background = slide.backgroundUri
        ? `
          <image
            href="${slide.backgroundUri}"
            x="0"
            y="0"
            width="1280"
            height="720"
            preserveAspectRatio="none"
          />
        `
        : `
          <rect
            width="1280"
            height="720"
            fill="${bgColor}"
          />
        `;

      // Complete SVG for one slide
      const svgContent = `
        <svg
          xmlns="http://www.w3.org/2000/svg"
          xmlns:xlink="http://www.w3.org/1999/xlink"
          width="1280"
          height="720"
          viewBox="0 0 1280 720"
        >
          ${background}

          ${svgPaths}
        </svg>
      `;

      // Add slide to PDF
      slideHtmlPages.push(`
        <div class="slide">
          <div class="slide-number">
            Slide ${i + 1} of ${slides.length}
          </div>

          ${svgContent}
        </div>
      `);
    }

    // ─── Complete PDF HTML ─────────────────────────────────────

    const html = `
      <!DOCTYPE html>

      <html>
        <head>
          <meta charset="UTF-8" />

          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }

            @page {
              size: landscape;
              margin: 0;
            }

            body {
              background: #111;
              font-family: Arial, sans-serif;
            }

            .slide {
              width: 100%;
              height: 100vh;
              position: relative;
              page-break-after: always;
              break-after: page;
              overflow: hidden;
            }

            .slide:last-child {
              page-break-after: auto;
              break-after: auto;
            }

            .slide-number {
              position: absolute;
              top: 8px;
              left: 12px;
              color: #888;
              font-size: 11px;
              z-index: 10;
            }

            svg {
              display: block;
              width: 100%;
              height: auto;
            }
          </style>
        </head>

        <body>
          ${slideHtmlPages.join('\n')}
        </body>
      </html>
    `;

    // ─── Generate PDF ──────────────────────────────────────────

    const { uri: pdfUri } =
      await Print.printToFileAsync({
        html,
      });

    console.log('Generated PDF:', pdfUri);

    // ─── Read PDF as Base64 ────────────────────────────────────

    const base64 =
      await FileSystem.readAsStringAsync(pdfUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

    // ─── Ask User Where to Save ────────────────────────────────

    const permissions =
      await FileSystem.StorageAccessFramework
        .requestDirectoryPermissionsAsync();

    if (!permissions.granted) {
      Alert.alert(
        'Save Cancelled',
        'No folder was selected.'
      );

      return;
    }

    // ─── Create File Name ──────────────────────────────────────

    const fileName =
      `SmartBoard_${Date.now()}.pdf`;

    // ─── Create PDF File ───────────────────────────────────────

    const destinationUri =
      await FileSystem.StorageAccessFramework
        .createFileAsync(
          permissions.directoryUri,
          fileName,
          'application/pdf'
        );

    // ─── Write PDF Data ────────────────────────────────────────

    await FileSystem.writeAsStringAsync(
      destinationUri,
      base64,
      {
        encoding: FileSystem.EncodingType.Base64,
      }
    );

    console.log('PDF saved successfully:', destinationUri);

    Alert.alert(
      'PDF Saved!',
      `Your SmartBoard PDF has been saved successfully.\n\nFile: ${fileName}`
    );

  } catch (error: any) {
    console.error('PDF export error:', error);

    Alert.alert(
      'Export Failed',
      error?.message || String(error)
    );
  }
}