import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { UIPrototype } from './ui/UIPrototype';
import './ui/styles.css';

const prototype = new URLSearchParams(window.location.search).get('prototype') === 'ui';

createRoot(document.getElementById('root')!).render(prototype ? <UIPrototype /> : <StrictMode><App /></StrictMode>);
