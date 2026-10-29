import { Island } from "./components/Island";
import { SettingsApp } from "./settings/SettingsApp";

function isSettingsWindow() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("window") === "settings") return true;
  // packaged: index.html?window=settings may land in hash-less path
  return window.location.href.includes("window=settings");
}

export default function App() {
  if (isSettingsWindow()) {
    return <SettingsApp />;
  }
  return (
    <main className="h-full w-full bg-transparent">
      <Island />
    </main>
  );
}
