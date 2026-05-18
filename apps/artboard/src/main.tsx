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
