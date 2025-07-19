import { ReactNode, HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = "",
  ...props
}) => (
  <div className={`bg-white rounded-2xl shadow-lg p-6 ${className}`} {...props}>
    {children}
  </div>
);
