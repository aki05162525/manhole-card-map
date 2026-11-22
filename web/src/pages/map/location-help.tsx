// Steps to allow location again, for the browser in use only.
function steps() {
  const ua = navigator.userAgent;
  const reload = "ページを再読み込みし、もう一度「現在地」ボタンを押す";
  if (
    /iPhone|iPad|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  ) {
    return /CriOS/.test(ua)
      ? [
          "「設定」→「プライバシーとセキュリティ」→「位置情報サービス」をオンにする",
          "「設定」→「Chrome」→「位置情報」を「使用中のみ許可」にする",
          reload,
        ]
      : [
          "「設定」→「プライバシーとセキュリティ」→「位置情報サービス」をオンにする",
          "同じ画面の「Safari Webサイト」を「次回確認」または「使用中のみ許可」にする",
          "Safariのアドレス欄左のボタン→「Webサイトの設定」→「位置情報」を「確認」または「許可」にする",
          reload,
        ];
  }
  if (/Android/.test(ua))
    return [
      "端末の位置情報をオンにする（画面上端から下へスワイプ→「位置情報」）",
      "アドレス欄左のアイコン→「権限」または「サイトの設定」から位置情報を許可する",
      reload,
    ];
  return ["アドレス欄左のアイコンから、このサイトの位置情報を許可する", reload];
}

export function LocationHelp() {
  return (
    <details className="location-help">
      <summary>許可する方法</summary>
      <ol>
        {steps().map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </details>
  );
}
