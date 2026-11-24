// Only operations and inputs declared in Exact's reference are included.
import type { CatalogMutation } from "./shape.js";

export const financialChanges = {
  exact_gl_accounts_create: { entity: "gl_accounts", method: "POST",
    fields: {
      ID: "guid", AllowCostsInSales: "int", AssimilatedVATBox: "int", BalanceSide: "text", BalanceType: "text",
      BelcotaxType: "int", Code: "text", Compress: "boolean", Costcenter: "text", Costunit: "text", Description:
      "text", ExcludeVATListing: "int", ExpenseNonDeductiblePercentage: "number", IsBlocked: "boolean", Matching:
      "boolean", PrivateGLAccount: "guid", PrivatePercentage: "number", ReportingCode: "text", RevalueCurrency:
      "boolean", SearchCode: "text", Type: "int", UseCostcenter: "int", UseCostunit: "int", VATCode: "text",
      VATGLAccountType: "text", VATNonDeductibleGLAccount: "guid", VATNonDeductiblePercentage: "number", VATSystem:
      "text", YearEndCostGLAccount: "guid", YearEndReflectionGLAccount: "guid" },
    required: ["Code", "Description"],
  },
  exact_gl_accounts_update: { entity: "gl_accounts", method: "PUT",
    fields: {
      AllowCostsInSales: "int", AssimilatedVATBox: "int", BalanceSide: "text", BalanceType: "text", BelcotaxType:
      "int", Code: "text", Compress: "boolean", Costcenter: "text", Costunit: "text", Description: "text",
      ExcludeVATListing: "int", ExpenseNonDeductiblePercentage: "number", IsBlocked: "boolean", Matching: "boolean",
      PrivateGLAccount: "guid", PrivatePercentage: "number", ReportingCode: "text", RevalueCurrency: "boolean",
      SearchCode: "text", Type: "int", UseCostcenter: "int", UseCostunit: "int", VATCode: "text", VATGLAccountType:
      "text", VATNonDeductibleGLAccount: "guid", VATNonDeductiblePercentage: "number", VATSystem: "text",
      YearEndCostGLAccount: "guid", YearEndReflectionGLAccount: "guid" },
    required: [],
  },
  exact_journals_create: { entity: "journals", method: "POST",
    fields: {
      ID: "guid", AllowVariableCurrency: "boolean", AllowVariableExchangeRate: "boolean", AllowVAT: "boolean",
      AutoSave: "boolean", Bank: "guid", BankAccountID: "guid", BankAccountIncludingMask: "text", Code: "text",
      Currency: "text", Description: "text", GLAccount: "guid", IsBlocked: "boolean", PaymentInTransitAccount:
      "guid", PaymentServiceAccountIdentifier: "text", PaymentServiceProvider: "int", Type: "int" },
    required: [],
  },
  exact_journals_update: { entity: "journals", method: "PUT",
    fields: {
      AllowVariableCurrency: "boolean", AllowVariableExchangeRate: "boolean", AllowVAT: "boolean", AutoSave:
      "boolean", Bank: "guid", BankAccountID: "guid", BankAccountIncludingMask: "text", Code: "text", Currency:
      "text", Description: "text", GLAccount: "guid", IsBlocked: "boolean", PaymentInTransitAccount: "guid",
      PaymentServiceAccountIdentifier: "text", PaymentServiceProvider: "int", Type: "int" },
    required: [],
  },
  exact_general_journal_entries_create: { entity: "general_journal_entries", method: "POST",
    fields: {
      EntryID: "guid", Currency: "text", EntryNumber: "int", ExchangeRate: "number", FinancialPeriod: "int",
      FinancialYear: "int", JournalCode: "text", Reversal: "boolean" },
    required: ["GeneralJournalEntryLines", "JournalCode"],
    children: {
      GeneralJournalEntryLines: { fields: {
        ID: "guid", Account: "guid", AmountFC: "number", AmountVATFC: "number", Asset: "guid", CostCenter: "text",
        CostUnit: "text", Date: "date", Description: "text", Document: "guid", GLAccount: "guid", Notes: "text",
        OffsetID: "guid", OurRef: "int", Project: "guid", Quantity: "number", VATCode: "text", VATPercentage:
        "number" }, required: ["GLAccount"] },
    },
  },
  exact_general_journal_entry_lines_create: { entity: "general_journal_entry_lines", method: "POST",
    fields: {
      ID: "guid", Account: "guid", AmountFC: "number", AmountVATFC: "number", Asset: "guid", CostCenter: "text",
      CostUnit: "text", Date: "date", Description: "text", Document: "guid", EntryID: "guid", GLAccount: "guid",
      Notes: "text", OffsetID: "guid", OurRef: "int", Project: "guid", Quantity: "number", VATCode: "text",
      VATPercentage: "number" },
    required: ["EntryID", "GLAccount"],
  },
} satisfies Record<string, CatalogMutation>;
