import type { ComponentType } from "react";

export type Role = "admin" | "teacher" | "student" | "parent";

export type NavItem = {
  label: string;
  href: string; // relative to school root, e.g. "/attendance"
  roles: Role[];
};

export type ModuleManifest = {
  key: string;
  name: string;
  description: string;
  /** lucide icon name resolved in the sidebar */
  icon: string;
  nav: NavItem[];
  permissions: string[]; // e.g. "attendance.mark"
  dependsOn: string[]; // module keys required before this can be enabled
  /** widgets slotted into role dashboards when enabled */
  dashboardWidgets?: { role: Role; component: ComponentType<{ schoolId: string }> }[];
};
