const graphicalUrl = process.env.NEXT_PUBLIC_GRAPHICAL_URL || "/graphical/index.html";

export default function GraphicalPage() {
  return (
    <div className="h-[calc(100vh-3.5rem)]">
      <div className="flex h-full flex-col">
        <div className="border-b px-4 py-2 text-xs text-muted-foreground">
          若页面空白，请先执行：`npm run graphical:prepare`，或设置 `NEXT_PUBLIC_GRAPHICAL_URL` 指向运行中的 scratch-gui。
        </div>
        <div className="flex-1">
          <iframe
            title="Scratch GUI"
            src={graphicalUrl}
            className="h-full w-full border-0"
          />
        </div>
      </div>
    </div>
  );
}
