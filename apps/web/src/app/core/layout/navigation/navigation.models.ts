interface NavigationItemBase {
  readonly label: string;
  readonly icon?: string;
  readonly muted?: boolean;

  readonly trailingItem?: NavigationTrailingItem;
}

interface NavigationTrailingItem {
  readonly icon: string;
  readonly item: NavigationItem;
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
  readonly items: readonly NavigationItem[];
}

export type NavigationItem =
  NavigationRouteItem | NavigationActionItem | NavigationPopoverItem;
