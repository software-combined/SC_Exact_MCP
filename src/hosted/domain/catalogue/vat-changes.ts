// Only operations and inputs declared in Exact's reference are included.
import type { CatalogMutation } from "./shape.js";

export const vatChanges = {
  exact_vat_codes_create: { entity: "vat_codes", method: "POST",
    fields: {
      ID: "guid", Account: "guid", CalculationBasis: "int", Charged: "boolean", Code: "text", Description: "text",
      EUSalesListing: "text", ExcludeVATListing: "int", GLDiscountPurchase: "guid", GLDiscountSales: "guid",
      GLToClaim: "guid", GLToPay: "guid", IntraStat: "boolean", IntrastatType: "text", IsBlocked: "boolean",
      LegalText: "text", OssCountry: "text", TaxReturnType: "int", Type: "text", VatDocType: "text", VatMargin:
      "int", VATPartialRatio: "int", VATTransactionType: "text" },
    required: ["Code", "Description"],
  },
  exact_vat_codes_update: { entity: "vat_codes", method: "PUT",
    fields: {
      Account: "guid", CalculationBasis: "int", Charged: "boolean", Code: "text", Description: "text",
      EUSalesListing: "text", ExcludeVATListing: "int", GLDiscountPurchase: "guid", GLDiscountSales: "guid",
      GLToClaim: "guid", GLToPay: "guid", IntraStat: "boolean", IntrastatType: "text", IsBlocked: "boolean",
      LegalText: "text", OssCountry: "text", TaxReturnType: "int", Type: "text", VatDocType: "text", VatMargin:
      "int", VATPartialRatio: "int", VATTransactionType: "text" },
    required: [],
  },
} satisfies Record<string, CatalogMutation>;
