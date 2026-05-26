import {
  AppWindow,
  BadgeCheck,
  Binary,
  Check,
  CircleDashed,
  LayoutGrid,
  LaptopMinimal,
  Clock3,
  Globe2,
  IdCard,
  Network,
  Router,
  SearchCheck,
  Shield,
  TriangleAlert,
  UserRound,
  Wifi,
  X
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";

type IconProps = {
  className?: string;
  strokeWidth?: number;
};

const icons: Record<string, ComponentType<IconProps>> = {
  "app-window": LayoutGrid,
  "badge-check": BadgeCheck,
  binary: Binary,
  globe: Globe2,
  "id-card": UserRound,
  monitor: LaptopMinimal,
  network: Network,
  router: Router,
  "search-check": SearchCheck,
  shield: Shield,
  wifi: Wifi
};

function WindowsGlyph({ className }: { className?: string }) {
  return (
    <span className={className}>
      <svg viewBox="0 0 24 24" fill="none" className="h-full w-full">
        <path d="M3 4.8L10.2 3.4V10H3V4.8Z" fill="currentColor" />
        <path d="M11.7 3.12L21 1.8V10H11.7V3.12Z" fill="currentColor" />
        <path d="M3 11.6H10.2V18.2L3 17.2V11.6Z" fill="currentColor" />
        <path d="M11.7 11.6H21V20.2L11.7 18.88V11.6Z" fill="currentColor" />
      </svg>
    </span>
  );
}

function AppsGlyph({ className }: { className?: string }) {
  return (
    <span className={className}>
      <svg viewBox="0 0 24 24" fill="none" className="h-full w-full">
        {[4.5, 12.5].flatMap((x) =>
          [4.5, 12.5].map((y) => (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width="7"
              height="7"
              rx="1.6"
              stroke="currentColor"
              strokeWidth="1.7"
            />
          ))
        )}
      </svg>
    </span>
  );
}

export function TimelineIcon({
  name,
  className,
  strokeWidth = 1.8
}: IconProps & { name: string }) {
  let content: ReactNode;

  if (name === "binary") {
    content = <span className={className}>IP</span>;
  } else if (name === "search-check") {
    content = <span className={className}>DNS</span>;
  } else if (name === "badge-check") {
    content = <WindowsGlyph className={className} />;
  } else if (name === "app-window") {
    content = <AppsGlyph className={className} />;
  } else {
    const Icon = icons[name] ?? Shield;
    content = <Icon className={className} strokeWidth={strokeWidth} />;
  }

  return content;
}

export function StatusGlyph({
  status,
  className
}: {
  status: string;
  className?: string;
}) {
  if (status === "ok") return <Check className={className} strokeWidth={2.4} />;
  if (status === "failed") return <X className={className} strokeWidth={2.4} />;
  if (status === "warning") {
    return <TriangleAlert className={className} strokeWidth={2.2} />;
  }
  if (status === "running") return <Clock3 className={className} strokeWidth={2} />;
  return <CircleDashed className={className} strokeWidth={2} />;
}
