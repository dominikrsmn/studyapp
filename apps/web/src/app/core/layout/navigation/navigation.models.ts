interface NavigationItemBase {
  readonly label: string;
  readonly icon: string;
  readonly muted?: boolean;
}

interface NavigationRouteItem extends NavigationItemBase {
  readonly type: 'route';
  readonly route: string | readonly string[];
}

interface NavigationActionItem extends NavigationItemBase {
  readonly type: 'action';
  readonly action: () => void;
}

interface NavigationPopoverItem extends NavigationItemBase {
  readonly type: 'popover';
  readonly items: NavigationItem[];
}

export type NavigationItem =
  NavigationRouteItem | NavigationActionItem | NavigationPopoverItem;
