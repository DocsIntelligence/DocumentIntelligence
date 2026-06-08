// Self-hosted document fonts — bundled so the Puppeteer PDF render paints
// Hindi + Latin with the exact faces the in-app preview measures against. Keep
// weights in sync with apps/app/src/main.tsx and DOC_FONT_SPECS in
// @org/document-templates' use-fonts-ready.
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/noto-sans-devanagari/400.css';
import '@fontsource/noto-sans-devanagari/500.css';
import '@fontsource/noto-sans-devanagari/600.css';
import '@fontsource/noto-sans-devanagari/700.css';
import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { LivePreview } from './app/LivePreview';
import { RenderRoute } from './app/RenderRoute';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement,
);

root.render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LivePreview />} />
        <Route path="/render/:componentKey" element={<RenderRoute />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
