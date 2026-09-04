import type { ImageOverlay } from '../components/ImageOverlayLayer';
import type { PathData } from '../components/WhiteboardCanvas';

export interface SlideData {
    id: string;
    paths: PathData[];
    backgroundUri?: string;
    backgroundColor?: string;
    images?: ImageOverlay[];
}