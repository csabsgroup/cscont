import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useUserProfile } from '@/hooks/useUserProfiles';

const AVATAR_COLORS = [
  '#e42320', '#2563eb', '#16a34a', '#9333ea',
  '#ea580c', '#0891b2', '#4f46e5', '#c026d3',
];

function getAvatarColor(name: string): string {
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

const sizeMap = {
  xs: 'h-5 w-5 text-[8px]',
  sm: 'h-7 w-7 text-[10px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-11 w-11 text-sm',
};

interface UserAvatarProps {
  userId?: string;
  name?: string;
  avatarUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showName?: boolean;
  subtitle?: string;
}

export function UserAvatar({
  userId,
  name: nameProp,
  avatarUrl: avatarUrlProp,
  size = 'sm',
  showName = false,
  subtitle,
}: UserAvatarProps) {
  // If only userId provided, fetch profile
  const { name: fetchedName, avatarUrl: fetchedAvatar } = useUserProfile(
    !nameProp && userId ? userId : undefined
  );

  const displayName = nameProp || fetchedName || 'Usuário';
  const displayAvatar = avatarUrlProp !== undefined ? avatarUrlProp : fetchedAvatar;
  const initials = getInitials(displayName);
  const bgColor = getAvatarColor(displayName);

  const avatarElement = (
    <Avatar className={sizeMap[size]}>
      <AvatarImage src={displayAvatar || undefined} />
      <AvatarFallback
        className="font-semibold text-white"
        style={{ backgroundColor: bgColor }}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );

  if (showName) {
    return (
      <div className="flex items-center gap-2">
        {avatarElement}
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium truncate">{displayName}</span>
          {subtitle && (
            <span className="text-xs text-muted-foreground">{subtitle}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex cursor-default">{avatarElement}</span>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-medium">{displayName}</p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </TooltipContent>
    </Tooltip>
  );
}
