import { Link, useLocation } from "react-router-dom";
import { Wrench, Briefcase, BookOpen, User, MessageSquare } from "lucide-react";

const items = [
  { to: "/offer/new", label: "Make", Icon: Wrench },
  { to: "/take", label: "Take", Icon: Briefcase },
  { to: "/chat", label: "Chat", Icon: MessageSquare },
  { to: "/learn", label: "Learn", Icon: BookOpen },
  { to: "/profile", label: "Profile", Icon: User },
] as const;

export default function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 h-[100px] border-t border-white/10 bg-[hsl(217,33%,9%)]/70 supports-[backdrop-filter]:bg-[hsl(217,33%,9%)]/50 supports-[backdrop-filter]:backdrop-blur-md backdrop-saturate-150"
      role="navigation"
      aria-label="Bottom Navigation"
    >
      <div className="mx-auto flex h-full w-full max-w-5xl items-center justify-around px-4">
        {items.map((i) => {
          const active = pathname === i.to;
          const Icon = i.Icon;
          return (
            <Link
              key={i.to}
              to={i.to}
              className={
                "flex flex-col items-center gap-1 text-sm font-medium transition-colors " +
                (active ? "text-white" : "text-white/70 hover:text-white")
              }
            >
              <Icon className="h-6 w-6" />
              <span>{i.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
