import {
  BoardTransforms,
  getSelectedElements,
  PlaitBoard,
  PlaitPointerType,
  RectangleClient,
  toHostPointFromViewBoxPoint,
  toScreenPointFromHostPoint,
} from '@plait/core';
import { isHotkey } from 'is-hotkey';
import { addImage, saveAsImage } from '../utils/image';
import { saveAsJSON } from '../data/json';
import { DrawnixState } from '../hooks/use-drawnix';
import { BoardCreationMode, setCreationMode } from '@plait/common';
import { MindPointerType } from '@plait/mind';
import { FreehandShape, Freehand } from './freehand/type';
import { ArrowLineShape, BasicShapes, PlaitDrawElement } from '@plait/draw';
import { separateSelectedElements } from '../utils/render-elements-to-image';

export const buildDrawnixHotkeyPlugin = (
  updateAppState: (appState: Partial<DrawnixState>) => void
) => {
  const withDrawnixHotkey = (board: PlaitBoard) => {
    const { globalKeyDown, keyDown } = board;
    board.globalKeyDown = (event: KeyboardEvent) => {
      const isTypingNormal =
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement;

      // Tab键：图生图功能 - 放在条件判断之外
      if (event.key === 'Tab' && !isTypingNormal) {
        console.log('🔍 Tab键被按下，开始检测选中元素');
        // 检查是否已经有图生图对话框打开
        const currentState = (board as any).appState;
        if (currentState?.imageToImageDialog?.isOpen) {
          // 如果对话框已经打开，关闭它
          updateAppState({
            imageToImageDialog: null
          });
          event.preventDefault();
          return;
        }

        const selectedElements = getSelectedElements(board);
        console.log('🔍 当前选中元素数量:', selectedElements.length);
        console.log('🔍 选中元素详情:', selectedElements.map(el => ({
          id: el.id,
          type: (el as any).type,
          isFreehand: Freehand.isFreehand(el),
          isDrawElement: PlaitDrawElement.isDrawElement(el),
          isImage: PlaitDrawElement.isImage(el)
        })));

        // 分离选中的元素：图片和可渲染元素
        const { imageElements, renderableElements } = separateSelectedElements(selectedElements);

        console.log('🔍 Tab键检测到选中元素:', {
          total: selectedElements.length,
          images: imageElements.length,
          renderable: renderableElements.length,
          renderableTypes: renderableElements.map(el => (el as any).type || 'unknown')
        });

        // 如果有图片或可渲染元素，打开图生图对话框
        if (imageElements.length > 0 || renderableElements.length > 0) {
          // 计算对话框位置（选中元素的下方20px）
          const referenceElement = imageElements[0] || renderableElements[0];
          if (!referenceElement.points) {
            console.warn('⚠️ 参考元素没有points属性，使用默认位置');
            return;
          }
          const rect = RectangleClient.getRectangleByPoints(referenceElement.points);

          // 将画布坐标转换为屏幕坐标
          const screenStart = toScreenPointFromHostPoint(
            board,
            toHostPointFromViewBoxPoint(board, [rect.x, rect.y + rect.height])
          );

          const position = {
            x: screenStart[0], // 与元素左对齐
            y: screenStart[1] + 20 // 下方20px
          };

          updateAppState({
            imageToImageDialog: {
              isOpen: true,
              selectedImages: imageElements, // 图片元素
              selectedRenderableElements: renderableElements, // 可渲染元素
              position,
              mode: 'append'
            }
          });

          event.preventDefault();
          return;
        } else {
          // 如果没有选中任何相关元素，让Tab键执行默认行为
          return;
        }
      }

      if (
        !isTypingNormal &&
        (PlaitBoard.getMovingPointInBoard(board) ||
          PlaitBoard.isMovingPointInBoard(board)) &&
        !PlaitBoard.hasBeenTextEditing(board)
      ) {
        if (isHotkey(['mod+shift+e'], { byKey: true })(event)) {
          saveAsImage(board, true);
          event.preventDefault();
          return;
        }
        if (isHotkey(['mod+s'], { byKey: true })(event)) {
          saveAsJSON(board);
          event.preventDefault();
          return;
        }
        if (
          isHotkey(['mod+backspace'])(event) ||
          isHotkey(['mod+delete'])(event)
        ) {
          updateAppState({
            openCleanConfirm: true,
          });
          event.preventDefault();
          return;
        }
        if (isHotkey(['mod+u'])(event)) {
          addImage(board);
        }


        if (!event.altKey && !event.metaKey && !event.ctrlKey) {
          if (event.key === 'h') {
            BoardTransforms.updatePointerType(board, PlaitPointerType.hand);
            updateAppState({ pointer: PlaitPointerType.hand });
          }
          if (event.key === 'v') {
            BoardTransforms.updatePointerType(
              board,
              PlaitPointerType.selection
            );
            updateAppState({ pointer: PlaitPointerType.selection });
          }
          if (event.key === 'm') {
            setCreationMode(board, BoardCreationMode.dnd);
            BoardTransforms.updatePointerType(board, MindPointerType.mind);
            updateAppState({ pointer: MindPointerType.mind });
          }
          if (event.key === 'e') {
            setCreationMode(board, BoardCreationMode.drawing);
            BoardTransforms.updatePointerType(board, FreehandShape.eraser);
            updateAppState({ pointer: FreehandShape.eraser });
          }
          if (event.key === 'p') {
            setCreationMode(board, BoardCreationMode.drawing);
            BoardTransforms.updatePointerType(board, FreehandShape.feltTipPen);
            updateAppState({ pointer: FreehandShape.feltTipPen });
          }
          if (event.key === 'a' && !isHotkey(['mod+a'])(event)) {
            // will trigger editing text
            if (getSelectedElements(board).length === 0) {
              setCreationMode(board, BoardCreationMode.drawing);
              BoardTransforms.updatePointerType(board, ArrowLineShape.straight);
              updateAppState({ pointer: ArrowLineShape.straight });
            }
          }
          if (event.key === 'r' || event.key === 'o' || event.key === 't') {
            const keyToPointer = {
              r: BasicShapes.rectangle,
              o: BasicShapes.ellipse,
              t: BasicShapes.text,
            };
            if (keyToPointer[event.key] === BasicShapes.text) {
              setCreationMode(board, BoardCreationMode.dnd);
            } else {
              setCreationMode(board, BoardCreationMode.drawing);
            }
            BoardTransforms.updatePointerType(board, keyToPointer[event.key]);
            updateAppState({ pointer: keyToPointer[event.key] });
          }
          event.preventDefault();
          return;
        }
      }
      globalKeyDown(event);
    };

    board.keyDown = (event: KeyboardEvent) => {
      if (isHotkey(['mod+z'], { byKey: true })(event)) {
        board.undo();
        event.preventDefault();
        return;
      }

      if (isHotkey(['mod+shift+z'], { byKey: true })(event)) {
        board.redo();
        event.preventDefault();
        return;
      }

      keyDown(event);
    };

    return board;
  };
  return withDrawnixHotkey;
};
