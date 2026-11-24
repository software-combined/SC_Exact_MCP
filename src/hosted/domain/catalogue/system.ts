// Fixed projections follow Exact’s REST reference and the retained BoostU catalogue.
import type { CatalogResource } from "./shape.js";

export const system = {
  divisions: { resource: "system/Divisions", label: "the divisions (administrations) this login can open",
    fields: {
      Code: "int", Description: "text", Country: "text", Currency: "text", Hid: "long", IsMainDivision: "boolean",
      Current: "boolean", BlockingStatus: "int", Modified: "date" },
    filters: [
      "Code", "Description", "Country", "Currency", "IsMainDivision", "Current", "BlockingStatus", "Modified" ],
    key: "Code" },
  all_divisions: { resource: "system/AllDivisions", label: "every division in the customer account, including ones without access",
    fields: {
      Code: "int", Description: "text", Country: "text", Currency: "text", Hid: "long", IsMainDivision: "boolean",
      Modified: "date" },
    filters: [
      "Code", "Description", "Country", "Currency", "IsMainDivision", "Modified" ],
    key: "Code" },
  available_features: { resource: "system/AvailableFeatures", label: "the features the current licence includes",
    fields: {
      ID: "int", Description: "text" },
    filters: [
      "ID", "Description" ],
    key: null },
  user_roles: { resource: "users/UserRoles", label: "user roles and their permissions",
    fields: {
      ID: "guid", UserID: "guid", Role: "int", RoleLevel: "int", Description: "text", StartDate: "date", EndDate:
      "date", Modified: "date" },
    filters: [
      "ID", "UserID", "Role", "RoleLevel", "Description", "StartDate", "EndDate", "Modified" ],
    key: "ID" },
  accountant_info: { resource: "system/AccountantInfo", label: "the accountancy firm linked to this administration",
    fields: {
      ID: "guid", Name: "text", City: "text", IsAccountant: "boolean", Website: "text" },
    filters: [
      "ID", "Name", "City", "IsAccountant", "Website" ],
    key: null },
} satisfies Record<string, CatalogResource>;
