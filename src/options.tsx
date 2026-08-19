import React from 'react';
import { createRoot } from 'react-dom/client';
import { Options } from './lib/Options';

const container = document.getElementById('root')!;
createRoot(container).render(
  <React.StrictMode>
    <Options />
  </React.StrictMode>,
);
