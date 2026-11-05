// Leaflet 1.9.4 has no public Canvas-draw completion event. Wrap its pinned
// renderer hook once; restore it after the first draw (including failure).
export function firstCanvasDraw(renderer: { _redraw(): void }): Promise<void> {
  const draw = renderer._redraw;
  return new Promise((resolve, reject) => {
    renderer._redraw = function () {
      renderer._redraw = draw;
      try {
        draw.call(this);
        resolve();
      } catch (error) {
        reject(error);
      }
    };
  });
}
