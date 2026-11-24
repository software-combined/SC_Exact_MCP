// Fixed projections follow Exact’s REST reference and the retained BoostU catalogue.
import type { CatalogResource } from "./shape.js";

export const vat = {
  vat_codes: { resource: "vat/VATCodes", label: "VAT codes and the rate, type and ledger accounts behind them",
    fields: {
      ID: "guid", Code: "text", Description: "text", Percentage: "number", Type: "text", VATTransactionType: "text",
      VatDocType: "text", EUSalesListing: "text", GLToPay: "guid", GLToPayCode: "text", GLToClaim: "guid",
      GLToClaimCode: "text", IsBlocked: "boolean", Charged: "boolean", TaxReturnType: "int", Country: "text",
      Modified: "date" },
    filters: [
      "ID", "Code", "Description", "Percentage", "Type", "VATTransactionType", "VatDocType", "EUSalesListing",
      "GLToPay", "GLToPayCode", "GLToClaim", "GLToClaimCode", "IsBlocked", "Charged", "TaxReturnType", "Country",
      "Modified" ],
    key: "ID" },
  vat_percentages: { resource: "vat/VatPercentages", label: "the rate history of each VAT code",
    fields: {
      ID: "guid", VATCodeID: "guid", Percentage: "number", Type: "int", StartDate: "date", EndDate: "date",
      LineNumber: "int", Modified: "date" },
    filters: [
      "ID", "VATCodeID", "Percentage", "Type", "StartDate", "EndDate", "LineNumber", "Modified" ],
    key: "ID" },
  deductibility_percentages: { resource: "financial/DeductibilityPercentages", label: "deductibility percentages for partly deductible costs, such as cars and catering",
    fields: {
      ID: "guid", GLAccount: "guid", LineNumber: "int", ExpenseNonDeductiblePercentage: "number",
      VATNonDeductiblePercentage: "number", PrivateUsePercentage: "number", StartDate: "date", EndDate: "date",
      Modified: "date" },
    filters: [
      "ID", "GLAccount", "LineNumber", "ExpenseNonDeductiblePercentage", "VATNonDeductiblePercentage",
      "PrivateUsePercentage", "StartDate", "EndDate", "Modified" ],
    key: "ID" },
} satisfies Record<string, CatalogResource>;
