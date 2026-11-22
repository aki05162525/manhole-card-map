export function SourceNotes({
  showLegend = true,
  variant = "map",
}: {
  showLegend?: boolean;
  variant?: "map" | "catalog";
}) {
  return (
    <div className="source-content">
      <p>
        {variant === "catalog"
          ? "非公式の個人サイトです。「配布中」でも在庫は保証されません。訪問前に公式情報をご確認ください。"
          : "非公式の個人サイトです。在庫状況は未確認のため、訪問前に公式情報をご確認ください。"}
      </p>
      {showLegend && (
        <p className="legend">
          <span>● 蓋</span>
          <span>■ 配布場所</span>
          <span className="active">● 配布中</span>
          <span className="upcoming">● 配布予定</span>
          <span className="suspended">● 一時中止</span>
          <span className="ended">● 終了</span>
          <span className="unknown">● 未確認</span>
        </p>
      )}
    </div>
  );
}
