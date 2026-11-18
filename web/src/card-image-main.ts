// The script of a generated card page that shows the card's image
// (`src/pages/card/static-pages.tsx`). The image and its credit are the page's own
// HTML; this only takes the image and its frame away when it cannot be shown,
// and the page then reads as that of a card without one. Nothing of the
// accounts is here: the record has its own script (`card-record-main.tsx`).
for (const image of document.querySelectorAll<HTMLImageElement>(
  ".card-figure img",
)) {
  const remove = () => image.closest("figure")?.remove();
  // It may have failed before this module ran.
  if (image.complete && !image.naturalWidth) remove();
  else image.addEventListener("error", remove);
}
export {};
