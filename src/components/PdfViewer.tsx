import React, { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Maximize, FileText, Download } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface PdfViewerProps {
  url: string;
}

export function PdfViewer({ url }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };
    
    updateWidth();
    window.addEventListener('resize', updateWidth);
    
    // Check periodically for a short while in case of modal animation
    const timeoutIds = [100, 500, 1000].map(ms => setTimeout(updateWidth, ms));
    
    return () => {
      window.removeEventListener('resize', updateWidth);
      timeoutIds.forEach(clearTimeout);
    };
  }, []);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setPageNumber(1);
    
    // Fit to width by default if container is available
    if (containerRef.current) {
      setContainerWidth(containerRef.current.clientWidth);
    }
  }

  const zoomIn = () => setScale(prev => Math.min(prev + 0.2, 3.0));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.5));
  const fitToWidth = () => setScale(1.0); // handled dynamically by width prop if scale 1 might be treated as fit
  
  const goToPrev = () => setPageNumber(prev => Math.max(prev - 1, 1));
  const goToNext = () => setPageNumber(prev => Math.min(prev + 1, numPages || 1));

  // Determine what width to pass to Page. We want to be responsive.
  const pageWidth = containerWidth ? containerWidth * scale - 32 : undefined;

  return (
    <div className="flex flex-col h-full bg-slate-200">
      <div className="bg-slate-800 p-2 border-b border-slate-700 flex flex-wrap items-center justify-between gap-2 z-10 sticky top-0 shrink-0">
        <div className="flex items-center space-x-1 sm:space-x-2">
          <button onClick={zoomOut} className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-200 transition-colors" title="Alejar">
            <ZoomOut size={18} />
          </button>
          <span className="text-slate-300 text-sm font-medium w-12 text-center">{Math.round(scale * 100)}%</span>
          <button onClick={zoomIn} className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-200 transition-colors" title="Acercar">
            <ZoomIn size={18} />
          </button>
          <button onClick={fitToWidth} className="ml-2 p-1.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-200 transition-colors flex items-center space-x-1" title="Ajustar al ancho">
            <Maximize size={18} />
            <span className="hidden sm:inline text-xs font-medium">Ajustar ancho</span>
          </button>
        </div>
        
        {numPages > 0 && (
          <div className="flex items-center space-x-2">
            <button onClick={goToPrev} disabled={pageNumber <= 1} className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" title="Página anterior">
              <ChevronLeft size={18} />
            </button>
            <span className="text-slate-300 text-sm font-medium w-16 text-center">
              {pageNumber} / {numPages}
            </span>
            <button onClick={goToNext} disabled={pageNumber >= numPages} className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" title="Página siguiente">
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto bg-slate-400 p-2 sm:p-4 pb-20 relative flex flex-col items-center" ref={containerRef}>
        {url ? (
          <Document
            file={url}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={
              <div className="flex items-center justify-center p-10 h-64 w-full">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-slate-700 font-medium tracking-wide">Cargando documento...</span>
              </div>
            }
            error={
              <div className="bg-red-50 text-red-600 p-4 rounded-md shadow flex flex-col items-center text-center max-w-sm mt-10">
                <FileText className="w-12 h-12 mb-2 opacity-50" />
                <h4 className="font-semibold mb-1">Error al cargar el PDF</h4>
                <p className="text-sm">El archivo podría estar dañado o la ruta no es accesible.</p>
              </div>
            }
            className="flex flex-col items-center"
          >
            {/* Render all pages for scrolling vertically or just the active one? The prompt says "Permita desplazamiento vertical entre páginas cuando el documento tenga varias hojas". 
                If we render all pages, scrolling is native. Let's do that! */}
            {Array.from(new Array(numPages), (el, index) => (
              <div key={`page_${index + 1}`} className="mb-4 shadow-lg" id={`pdf-page-${index + 1}`}>
                <Page
                  pageNumber={index + 1}
                  width={pageWidth}
                  scale={scale}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  className="bg-white rounded"
                  loading={
                    <div className="flex items-center justify-center p-10 h-[800px] w-full bg-white bg-opacity-50">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    </div>
                  }
                />
              </div>
            ))}
          </Document>
        ) : (
          <div className="text-slate-600 text-center mt-20">URL de documento inválida o vacía.</div>
        )}
      </div>
    </div>
  );
}
