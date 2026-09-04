import React, { useRef, useState } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';

interface PdfRendererProps {
  pdfUri: string;
  onPagesRendered: (imageUris: string[]) => void;
}

const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js"></script>
  <style>
    body { margin: 0; padding: 0; background-color: #f0f0f0; display: flex; flex-direction: column; align-items: center; }
    canvas { margin-bottom: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.2); }
  </style>
</head>
<body>
  <div id="container"></div>
  <script>
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
    
    async function renderPdf(base64Data) {
      try {
        const loadingTask = pdfjsLib.getDocument({ data: atob(base64Data) });
        const pdf = await loadingTask.promise;
        const totalPages = pdf.numPages;
        const images = [];

        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 1.5 });
          
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          
          document.getElementById('container').appendChild(canvas);
          
          await page.render({ canvasContext: context, viewport: viewport }).promise;
          images.push(canvas.toDataURL('image/jpeg', 0.8));
        }
        
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SUCCESS', images }));
      } catch (error) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ERROR', message: error.toString() }));
      }
    }

    // Wait for the React Native side to inject the base64 data
    window.addEventListener('message', function(event) {
      const data = JSON.parse(event.data);
      if (data.type === 'LOAD_PDF') {
        renderPdf(data.base64);
      }
    });
  </script>
</body>
</html>
`;

export const PdfRenderer: React.FC<PdfRendererProps> = ({ pdfUri, onPagesRendered }) => {
  const webviewRef = useRef<WebView>(null);
  const [error, setError] = useState<string | null>(null);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'SUCCESS') {
        onPagesRendered(data.images);
      } else if (data.type === 'ERROR') {
        console.error('PDF Render Error:', data.message);
        setError(data.message);
      }
    } catch (e) {
      console.error('Failed to parse message from WebView', e);
    }
  };

  const injectPdfData = async () => {
    try {
      if (!pdfUri) return;
      const base64 = await FileSystem.readAsStringAsync(pdfUri, { encoding: FileSystem.EncodingType.Base64 });
      webviewRef.current?.postMessage(JSON.stringify({ type: 'LOAD_PDF', base64 }));
    } catch (e: any) {
      setError(e.toString());
      console.error(e);
    }
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      <WebView
        ref={webviewRef}
        originWhitelist={['*']}
        source={{ html: htmlContent }}
        onMessage={handleMessage}
        onLoadEnd={injectPdfData}
        style={{ flex: 1, opacity: 0 }} // Hidden webview just for processing
      />
      {error && <Text style={{ color: 'red', position: 'absolute', top: 50, left: 20 }}>Error loading PDF: {error}</Text>}
    </View>
  );
};
