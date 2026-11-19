// Install before navigation so startup marks include the first data request.
export function enableMapDiagnostics(context) {
  return context.addInitScript(() => {
    window.enableMapDiagnostics = true;
  });
}
