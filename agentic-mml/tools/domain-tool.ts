export type Domain =
  | "oem"
  | "dealer"
  | "finance"
  | "insurance"
  | "commerce"
  | "maintenance"
  | "resale";

export interface DomainTool {
  domain: Domain;
}
