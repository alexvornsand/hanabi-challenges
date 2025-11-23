type Props = {
  name: string;
  color: string;
  textColor: string;
  className?: string;
};

export function UserPill({ name, color, textColor, className = '' }: Props) {
  const bg = color || '#777777';
  const fg = textColor || '#ffffff';
  return (
    <span
      className={`user-pill inline-flex items-center text-sm font-medium ${className}`}
      style={{ backgroundColor: bg, color: fg }}
    >
      {name}
    </span>
  );
}
