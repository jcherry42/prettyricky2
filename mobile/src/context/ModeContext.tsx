/**
 * ModeContext — sales vs service advisor mode.
 *
 * Sourced from AppSettings.serviceMode. When ON, the app swaps all UX-facing
 * labels + emergency-inquiry presets to service-department terminology
 * (RO / Repair Order, Service Bay, Comeback, etc.). Zero-regression:
 * when OFF (default), every label is identical to the sales build.
 *
 * The `useLingo()` hook returns the exact string a component should show,
 * so no component needs to know about the mode itself — they just consume
 * `lingo.customerAdd`, `lingo.vehicleQueue`, etc.
 */

import React, { createContext, useContext, useMemo } from 'react';
import { useAppSettings } from './AppSettingsContext';

export type AppMode = 'sales' | 'service';

export interface Lingo {
  // Global brand tagline shown near the SUPERCHARG'D wordmark
  tagline: string;
  // Home screen header
  homeGreeting: string;
  homeSubline: string;
  // Customer terminology
  customerSingular: string;   // "Customer" | "Guest"
  customerPlural: string;     // "Customers" | "Guests"
  addCustomerCta: string;     // "Add Customer" | "New RO"
  // Vehicle / inventory terminology
  vehicleSingular: string;    // "Vehicle" | "RO Vehicle"
  vehiclePlural: string;      // "Vehicles" | "RO Queue"
  intakeTitle: string;        // "Intake" | "Service Intake"
  vinScanTitle: string;       // "Scan VIN" | "Scan RO VIN"
  dlScanTitle: string;        // "Scan License" | "Scan DL for RO"
  // Categories (Home tabs / VinScan tabs)
  categoryDealer: string;     // "Dealer" | "Shop"
  categoryTradeIn: string;    // "Trade-In" | "Customer Pay"
  categoryOther: string;      // "Other" | "Warranty"
  // Emergency inquiry entry point
  towerTalkTitle: string;     // "Tower Talk" | "Service Board"
  towerTalkSubtitle: string;  // "Answer inquiries fast" | "Service advisor console"
  // Role labels
  repTitle: string;           // "Sales Rep" | "Service Advisor"
  managerTitle: string;       // "Sales Manager" | "Service Manager"
  // Dashboard / stats
  dashboardTitle: string;
  // Print center actions
  printQuoteCta: string;      // "Print Quote" | "Print RO / Estimate"
  // Diagnostic / connection labels stay identical
  // Command Center service-mode switch copy
  modeSwitchTitle: string;
  modeSwitchDescription: string;
  // Intelligence Insight panel — Apex Intelligence Framework
  insightPanelTitle: string;      // "Deal Intelligence" | "Service Intelligence"
  insightNextAction: string;      // "Next Best Move" | "Next Advisor Move"
  insightRiskFlags: string;       // "Deal Risk" | "Service Risk"
  insightMissingInfo: string;     // "Info to Get" | "Info to Confirm"
  insightSentiment: string;       // "Buyer Mood" | "Guest Mood"
  insightObjection: string;       // "Objection Spotted" | "Concern Spotted"
  insightStrategyLabel: string;   // "Play" | "Play"
  // Role-based dashboards (Command Center)
  kpiTodayLeads: string;       // "Today's Leads" | "Today's ROs"
  kpiActiveDeals: string;      // "Active Deals" | "Open ROs"
  kpiClosedThisMonth: string;  // "Closed This Month" | "Cars Closed"
  kpiAvgResponseTime: string;  // "Avg Reply Time" | "Avg Reply Time"
  kpiFollowUps: string;        // "Follow-Ups Due" | "Comebacks Due"
  kpiOpenObjections: string;   // "Open Objections" | "Open Concerns"
  kpiHotEscalations: string;   // "Hot Leads Waiting" | "Escalations Open"
}

const SALES_LINGO: Lingo = {
  tagline: "SALES",
  homeGreeting: "Ready to close.",
  homeSubline: "Every lead. Every conversation. Every deal.",
  customerSingular: "Customer",
  customerPlural: "Customers",
  addCustomerCta: "Add Customer",
  vehicleSingular: "Vehicle",
  vehiclePlural: "Vehicles",
  intakeTitle: "Intake",
  vinScanTitle: "Scan VIN",
  dlScanTitle: "Scan License",
  categoryDealer: "Dealer",
  categoryTradeIn: "Trade-In",
  categoryOther: "Other",
  towerTalkTitle: "Tower Talk",
  towerTalkSubtitle: "Instant AI-crafted responses to every buyer inquiry.",
  repTitle: "Sales Rep",
  managerTitle: "Sales Manager",
  dashboardTitle: "Sales Dashboard",
  printQuoteCta: "Print Quote",
  modeSwitchTitle: "Service Mode",
  modeSwitchDescription: "Retail Sales workflow. Toggle ON to switch to Service Advisor mode.",
  insightPanelTitle: "Deal Intelligence",
  insightNextAction: "Next Best Move",
  insightRiskFlags: "Deal Risk",
  insightMissingInfo: "Info to Get",
  insightSentiment: "Buyer Mood",
  insightObjection: "Objection Spotted",
  insightStrategyLabel: "Play",
  kpiTodayLeads: "Today's Leads",
  kpiActiveDeals: "Active Deals",
  kpiClosedThisMonth: "Closed This Month",
  kpiAvgResponseTime: "Avg Reply Time",
  kpiFollowUps: "Follow-Ups Due",
  kpiOpenObjections: "Open Objections",
  kpiHotEscalations: "Hot Leads Waiting",
};

const SERVICE_LINGO: Lingo = {
  tagline: "SERVICE",
  homeGreeting: "Bays are open.",
  homeSubline: "Every RO. Every comeback. Every waiter.",
  customerSingular: "Guest",
  customerPlural: "Guests",
  addCustomerCta: "Write RO",
  vehicleSingular: "RO Vehicle",
  vehiclePlural: "RO Queue",
  intakeTitle: "Service Intake",
  vinScanTitle: "Scan RO VIN",
  dlScanTitle: "Scan DL for RO",
  categoryDealer: "Shop",
  categoryTradeIn: "Customer Pay",
  categoryOther: "Warranty",
  towerTalkTitle: "Service Board",
  towerTalkSubtitle: "Instant AI-crafted responses for every service situation.",
  repTitle: "Service Advisor",
  managerTitle: "Service Manager",
  dashboardTitle: "Service Dashboard",
  printQuoteCta: "Print Estimate",
  modeSwitchTitle: "Service Mode",
  modeSwitchDescription: "Service Advisor workflow. Toggle OFF to return to Retail Sales mode.",
  insightPanelTitle: "Service Intelligence",
  insightNextAction: "Next Advisor Move",
  insightRiskFlags: "Service Risk",
  insightMissingInfo: "Info to Confirm",
  insightSentiment: "Guest Mood",
  insightObjection: "Concern Spotted",
  insightStrategyLabel: "Play",
  kpiTodayLeads: "Today's ROs",
  kpiActiveDeals: "Open ROs",
  kpiClosedThisMonth: "Cars Closed",
  kpiAvgResponseTime: "Avg Reply Time",
  kpiFollowUps: "Comebacks Due",
  kpiOpenObjections: "Open Concerns",
  kpiHotEscalations: "Escalations Open",
};

interface ModeContextValue {
  mode: AppMode;
  isService: boolean;
  lingo: Lingo;
}

const ModeContext = createContext<ModeContextValue>({
  mode: 'sales',
  isService: false,
  lingo: SALES_LINGO,
});

export function ModeProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useAppSettings();
  const isService = Boolean(settings.serviceMode);

  const value = useMemo<ModeContextValue>(() => ({
    mode: isService ? 'service' : 'sales',
    isService,
    lingo: isService ? SERVICE_LINGO : SALES_LINGO,
  }), [isService]);

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}

export function useMode() {
  return useContext(ModeContext);
}

export function useLingo(): Lingo {
  return useContext(ModeContext).lingo;
}
