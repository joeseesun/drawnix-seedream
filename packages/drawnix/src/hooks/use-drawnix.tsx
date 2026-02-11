/**
 * A React context for sharing the board object, in a way that re-renders the
 * context whenever changes occur.
 */
import { PlaitBoard, PlaitPointerType, PlaitElement } from '@plait/core';
import { createContext, useContext } from 'react';
import { MindPointerType } from '@plait/mind';
import { DrawPointerType } from '@plait/draw';
import { FreehandShape } from '../plugins/freehand/type';
import { Editor } from 'slate';
import { LinkElement } from '@plait/common';

export enum DialogType {
  mermaidToDrawnix = 'mermaidToDrawnix',
  markdownToDrawnix = 'markdownToDrawnix',
}

export type DrawnixPointerType =
  | PlaitPointerType
  | MindPointerType
  | DrawPointerType
  | FreehandShape;

export interface DrawnixBoard extends PlaitBoard {
  appState: DrawnixState;
}

export type LinkState = {
  targetDom: HTMLElement;
  editor: Editor;
  targetElement: LinkElement;
  isEditing: boolean;
  isHovering: boolean;
  isHoveringOrigin: boolean;
};

export type ImageToImageDialogState = {
  isOpen: boolean;
  selectedImages: PlaitElement[];
  selectedRenderableElements?: PlaitElement[]; // 新增：选中的可渲染元素（画笔、文本等）
  position: { x: number; y: number };
  mode?: 'append' | 'replace';
};

export type VideoFromImageDialogState = {
  isOpen: boolean;
  targetImage: PlaitElement;
  position: { x: number; y: number };
};

export type DrawnixState = {
  pointer: DrawnixPointerType;
  isMobile: boolean;
  isPencilMode: boolean;
  openDialogType: DialogType | null;
  openCleanConfirm: boolean;
  openSettings: boolean;
  linkState?: LinkState | null;
  imageToImageDialog?: ImageToImageDialogState | null;
  videoFromImageDialog?: VideoFromImageDialogState | null;
};

export const DrawnixContext = createContext<{
  appState: DrawnixState;
  setAppState: (appState: DrawnixState | ((prevState: DrawnixState) => DrawnixState)) => void;
} | null>(null);

export const useDrawnix = (): {
  appState: DrawnixState;
  setAppState: (appState: DrawnixState | ((prevState: DrawnixState) => DrawnixState)) => void;
} => {
  const context = useContext(DrawnixContext);

  if (!context) {
    throw new Error(
      `The \`useDrawnix\` hook must be used inside the <Drawnix> component's context.`
    );
  }

  return context;
};

export const useSetPointer = () => {
  const { appState, setAppState } = useDrawnix();
  return (pointer: DrawnixPointerType) => {
    setAppState({ ...appState, pointer });
  };
};
