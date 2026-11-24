// Fixed projections follow Exact’s REST reference and the retained BoostU catalogue.
import type { CatalogResource } from "./shape.js";

export const relations = {
  accounts: { resource: "crm/Accounts", label: "relations: customers, suppliers, prospects and leads",
    fields: {
      ID: "guid", Code: "text", Name: "text", Status: "text", Website: "text", VATNumber: "text", ChamberOfCommerce:
      "text", City: "text", Postcode: "text", AddressLine1: "text", Country: "text", IsSales: "boolean", IsPurchase:
      "boolean", IsSupplier: "boolean", Created: "date", Modified: "date" },
    filters: [
      "ID", "Code", "Name", "Status", "VATNumber", "ChamberOfCommerce", "City", "Postcode", "AddressLine1",
      "Country", "IsSales", "IsSupplier", "Created", "Modified" ],
    key: "ID" },
  contacts: { resource: "crm/Contacts", label: "contact persons at relations",
    fields: {
      ID: "guid", Account: "guid", AccountName: "text", FirstName: "text", LastName: "text", FullName: "text",
      JobTitleDescription: "text", IsMainContact: "boolean", Created: "date", Modified: "date" },
    filters: [
      "ID", "Account", "AccountName", "FirstName", "LastName", "FullName", "JobTitleDescription", "IsMainContact",
      "Created", "Modified" ],
    key: "ID" },
  addresses: { resource: "crm/Addresses", label: "postal, visit and invoice addresses of relations",
    fields: {
      ID: "guid", Account: "guid", AccountName: "text", Type: "int", AddressLine1: "text", AddressLine2: "text",
      Postcode: "text", City: "text", State: "text", Country: "text", Mailbox: "text", Main: "boolean", Modified:
      "date" },
    filters: [
      "ID", "Account", "AccountName", "Type", "AddressLine1", "AddressLine2", "Postcode", "City", "State",
      "Country", "Mailbox", "Main", "Modified" ],
    key: "ID" },
  bank_accounts: { resource: "crm/BankAccounts", label: "bank accounts (IBAN) belonging to relations",
    fields: {
      ID: "guid", Account: "guid", AccountName: "text", BankAccountHolderName: "text", BICCode: "text", Main:
      "boolean", Type: "text", Modified: "date", BankAccount: "masked" },
    filters: [
      "ID", "Account", "AccountName", "BankAccountHolderName", "BICCode", "Main", "Type", "Modified" ],
    key: "ID" },
  account_classifications: { resource: "crm/AccountClassifications", label: "classification values used to segment relations",
    fields: {
      ID: "guid", Code: "text", Description: "text", AccountClassificationName: "guid", Modified: "date" },
    filters: [
      "ID", "Code", "Description", "AccountClassificationName", "Modified" ],
    key: "ID" },
} satisfies Record<string, CatalogResource>;
