import {
  AppWindow,
  BadgeCheck,
  Binary,
  Check,
  CircleDashed,
  Clock3,
  Globe2,
  IdCard,
  Monitor,
  Network,
  Router,
  SearchCheck,
  Shield,
  TriangleAlert,
  Wifi,
  X
} from "lucide-react";
import type { ComponentType } from "react";

type IconProps = {
  className?: string;
  strokeWidth?: number;
};

const icons: Record<string, ComponentType<IconProps>> = {
  "app-window": AppWindow,
  "badge-check": BadgeCheck,
  binary: Binary,
  globe: Globe2,
  "id-card": IdCard,
  monitor: Monitor,
  network: Network,
  router: Router,
  "search-check": SearchCheck,
  shield: Shield,
  wifi: Wifi
};

export function TimelineIcon({
  name,
  className,
  strokeWidth = 1.8
}: IconProps & { name: string }) {
  const Icon = icons[name] ?? Shield;
  return <Icon className={className} strokeWidth={strokeWidth} />;
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
