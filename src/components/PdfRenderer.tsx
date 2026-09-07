import React, { useRef, useState } from 'react';
import { StyleSheet, View, Text, Modal } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

import { PDF_JS_BASE64 } from '../assets/pdf/pdf.min';
import { PDF_WORKER_BASE64 } from '../assets/pdf/pdf.worker.min';

interface PdfRendererProps {
  pdfUri: string;
  onPagesRendered: (imageUris: string[]) => void;
}

export const PdfRenderer: React.FC<PdfRendererProps> = ({ pdfUri, onPagesRendered }) => {
  const webviewRef = useRef<WebView>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [base64Pdf, setBase64Pdf] = useState<string | null>(null);
  const [isWebViewReady, setIsWebViewReady] = useState(false);

  React.useEffect(() => {
    if (isWebViewReady && base64Pdf) {
      webviewRef.current?.injectJavaScript(`
        window.dispatchEvent(new MessageEvent('message', {
          data: JSON.stringify({ type: 'LOAD_PDF', base64: "${base64Pdf}" })
        }));
        true;
      `);
    }
  }, [isWebViewReady, base64Pdf]);

  React.useEffect(() => {
    (async () => {
      try {
        const response = await fetch(pdfUri);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          if (reader.result) {
            const b64 = (reader.result as string).split(',')[1];
            setBase64Pdf(b64);
          }
        };
        reader.onerror = () => {
          setError('Failed to read PDF file (FileReader error)');
        };
        reader.readAsDataURL(blob);
      } catch (err) {
        console.error('Failed to fetch PDF file locally', err);
        setError('Failed to read PDF file locally');
      }
    })();
  }, [pdfUri]);

  const htmlContent = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <script src="data:text/javascript;base64,${PDF_JS_BASE64}"></script>
    <style>
      body { margin: 0; padding: 0; background-color: #f0f0f0; display: flex; flex-direction: column; align-items: center; }
      canvas { margin-bottom: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.2); }
    </style>
  </head>
  <body>
    <div id="container"></div>
    <script>
      try {
        if (typeof pdfjsLib === 'undefined') {
          throw new Error('PDF Engine failed to load from internal bundle.');
        }

        pdfjsLib.GlobalWorkerOptions.workerSrc = 'data:text/javascript;base64,${PDF_WORKER_BASE64}';
        
        // We wait for React Native to send us the Base64 string
        window.addEventListener("message", async function(event) {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'LOAD_PDF') {
              const base64 = data.base64;
              const binaryString = atob(base64);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }

              const loadingTask = pdfjsLib.getDocument({ data: bytes });
              const pdf = await loadingTask.promise;
              const totalPages = pdf.numPages;
              const images = [];

              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'PROGRESS', current: 0, total: totalPages }));

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
                
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'PROGRESS', current: pageNum, total: totalPages }));
              }
              
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SUCCESS', images }));
            }
          } catch (error) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ERROR', message: error.toString() }));
          }
        });
        
        // Tell RN we are ready to receive data
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'READY' }));
      } catch (err) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ERROR', message: err.toString() }));
      }
    </script>
  </body>
  </html>
  `;

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'READY') {
        setIsWebViewReady(true);
      } else if (data.type === 'SUCCESS') {
        onPagesRendered(data.images);
      } else if (data.type === 'ERROR') {
        console.error('PDF Render Error:', data.message);
        setError(data.message);
      } else if (data.type === 'PROGRESS') {
        setProgress({ current: data.current, total: data.total });
      } else if (data.type === 'LOG') {
        console.log('PDF.js:', data.message);
      }
    } catch (e) {
      console.error('Failed to parse message from WebView', e);
    }
  };

  return (
    <>
      <View style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', opacity: 0 }}>
        <WebView
          ref={webviewRef}
          originWhitelist={['*']}
          source={{ html: htmlContent, baseUrl: 'file:///' }}
          allowFileAccess={true}
          allowFileAccessFromFileURLs={true}
          allowUniversalAccessFromFileURLs={true}
          onMessage={handleMessage}
        />
      </View>
      <Modal transparent visible={true} animationType="fade">
        <View style={[StyleSheet.absoluteFill, { zIndex: 9999, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={{ backgroundColor: '#fff', padding: 30, borderRadius: 16, alignItems: 'center', elevation: 10 }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 10 }}>Importing PDF...</Text>
            <Text style={{ fontSize: 16, color: '#666' }}>
              {progress.total > 0 ? `Rendering page ${progress.current} of ${progress.total}` : 'Loading document...'}
            </Text>
          </View>
          {error && <Text style={{ color: 'red', position: 'absolute', top: 50, left: 20 }}>Error loading PDF: {error}</Text>}
        </View>
      </Modal>
    </>
  );
};
