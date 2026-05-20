import type { ReactNode } from "react";
import clsx from "clsx";

interface CardProps {
  children: ReactNode;
  className?: string;
}

function Card({ children, className }: CardProps) {
  return (
    <div className={clsx("premium-card glass-panel", className)}>
      {children}
    </div>
  );
}

export default Card;
