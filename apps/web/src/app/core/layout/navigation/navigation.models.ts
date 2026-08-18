interface NavigationItemBase {
  readonly label: string;
  readonly icon: string;
  readonly muted?: boolean;
  readonly active?: boolean;
}

interface NavigationRouteItem extends NavigationItemBase {
  readonly type: 'route';
  readonly route: string | readonly string[];
}

interface NavigationActionItem extends NavigationItemBase {
  readonly type: 'action';
  readonly action: () => void;
}

export type NavigationItem = NavigationRouteItem | NavigationActionItem;
