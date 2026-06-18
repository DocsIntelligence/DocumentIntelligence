import { cn } from '@org/utils';
import { Avatar, AvatarFallback, AvatarImage } from './avatar';

export interface UserAvatarProps {
  src?: string | null;
  name?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClass = {
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-14 text-base',
};

const getInitials = (name?: string | null): string => {
  if (!name) return '?';
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
};

export const UserAvatar = ({
  src,
  name,
  size = 'md',
  className,
}: UserAvatarProps) => (
  <Avatar className={cn(sizeClass[size], className)}>
    {src && <AvatarImage src={src} alt={name ?? 'Avatar'} />}
    <AvatarFallback className="bg-primary/50 text-primary font-medium">
      {getInitials(name)}
    </AvatarFallback>
  </Avatar>
);
