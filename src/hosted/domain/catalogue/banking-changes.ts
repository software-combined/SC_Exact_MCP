// Only operations and inputs declared in Exact's reference are included.
import type { CatalogMutation } from "./shape.js";

export const bankingChanges = {
  exact_bank_entries_create: { entity: "bank_entries", method: "POST",
    fields: {
      EntryID: "guid", BankStatementDocument: "guid", ClosingBalanceFC: "number", Currency: "text", EntryNumber:
      "int", FinancialPeriod: "int", FinancialYear: "int", JournalCode: "text", OpeningBalanceFC: "number" },
    required: ["BankEntryLines", "JournalCode"],
    children: {
      BankEntryLines: { fields: {
        Account: "guid", AmountFC: "number", AmountVATFC: "number", Asset: "guid", CostCenter: "text", CostUnit:
        "text", Date: "date", Description: "text", Document: "guid", ExchangeRate: "number", GLAccount: "guid",
        Notes: "text", OurRef: "int", Project: "guid", Quantity: "number", VATCode: "text", VATPercentage: "number",
        VATType: "text" }, required: ["AmountFC", "GLAccount"] },
    },
  },
  exact_bank_entry_lines_create: { entity: "bank_entry_lines", method: "POST",
    fields: {
      Account: "guid", AmountFC: "number", AmountVATFC: "number", Asset: "guid", CostCenter: "text", CostUnit:
      "text", Date: "date", Description: "text", Document: "guid", EntryID: "guid", ExchangeRate: "number",
      GLAccount: "guid", Notes: "text", OurRef: "int", Project: "guid", Quantity: "number", VATCode: "text",
      VATPercentage: "number", VATType: "text" },
    required: ["AmountFC", "EntryID", "GLAccount"],
  },
  exact_cash_entries_create: { entity: "cash_entries", method: "POST",
    fields: {
      EntryID: "guid", ClosingBalanceFC: "number", Currency: "text", EntryNumber: "int", FinancialPeriod: "int",
      FinancialYear: "int", JournalCode: "text", OpeningBalanceFC: "number" },
    required: ["CashEntryLines", "JournalCode"],
    children: {
      CashEntryLines: { fields: {
        Account: "guid", AmountFC: "number", AmountVATFC: "number", Asset: "guid", CostCenter: "text", CostUnit:
        "text", Date: "date", Description: "text", Document: "guid", ExchangeRate: "number", GLAccount: "guid",
        Notes: "text", OurRef: "int", Project: "guid", Quantity: "number", VATCode: "text", VATPercentage: "number",
        VATType: "text" }, required: ["AmountFC", "GLAccount"] },
    },
  },
  exact_cash_entry_lines_create: { entity: "cash_entry_lines", method: "POST",
    fields: {
      Account: "guid", AmountFC: "number", AmountVATFC: "number", Asset: "guid", CostCenter: "text", CostUnit:
      "text", Date: "date", Description: "text", Document: "guid", EntryID: "guid", ExchangeRate: "number",
      GLAccount: "guid", Notes: "text", OurRef: "int", Project: "guid", Quantity: "number", VATCode: "text",
      VATPercentage: "number", VATType: "text" },
    required: ["AmountFC", "EntryID", "GLAccount"],
  },
  exact_payments_update: { entity: "payments", method: "PUT",
    fields: {
      AccountBankAccountID: "guid", Description: "text", PaymentMethod: "text", PaymentReference: "text" },
    required: [],
  },
  exact_direct_debit_mandates_create: { entity: "direct_debit_mandates", method: "POST",
    fields: {
      ID: "guid", Account: "guid", Attachment: "binary", AttachmentFileName: "text", BankAccount: "guid",
      CancellationDate: "date", Description: "text", FirstSend: "int", Main: "int", PaymentType: "int", Reference:
      "text", SignatureDate: "date", Type: "int" },
    required: ["Account", "BankAccount"],
  },
  exact_direct_debit_mandates_update: { entity: "direct_debit_mandates", method: "PUT",
    fields: {
      Account: "guid", Attachment: "binary", AttachmentFileName: "text", BankAccount: "guid", CancellationDate:
      "date", Description: "text", FirstSend: "int", Main: "int", PaymentType: "int", Reference: "text",
      SignatureDate: "date", Type: "int" },
    required: [],
  },
} satisfies Record<string, CatalogMutation>;
