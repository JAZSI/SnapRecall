/// <reference types="vite/client" />
import type { SnapApi } from '@shared/api';

declare global {
  interface Window {
    snap: SnapApi;
  }
}

export {};
