// Fixed projections follow Exact’s REST reference and the retained BoostU catalogue.
import type { CatalogResource } from "./shape.js";

export const banking = {
  bank_entries: { resource: "financialtransaction/BankEntries", label: "bank statements booked into a bank journal",
    fields: {
      EntryID: "guid", EntryNumber: "int", JournalCode: "text", JournalDescription: "text", FinancialYear: "int",
      FinancialPeriod: "int", Status: "int", StatusDescription: "text", Currency: "text", Created: "date", Modified:
      "date", OpeningBalanceFC: "number", ClosingBalanceFC: "number" },
    filters: [
      "EntryID", "EntryNumber", "JournalCode", "JournalDescription", "FinancialYear", "FinancialPeriod", "Status",
      "StatusDescription", "Currency", "Created", "Modified", "OpeningBalanceFC", "ClosingBalanceFC" ],
    key: "EntryID" },
  bank_entry_lines: { resource: "financialtransaction/BankEntryLines", label: "individual lines on a bank statement",
    fields: {
      ID: "guid", EntryID: "guid", LineNumber: "int", Date: "date", Description: "text", AmountDC: "number",
      AmountFC: "number", Account: "guid", AccountName: "text", GLAccount: "guid", GLAccountCode: "text",
      GLAccountDescription: "text", OffsetID: "guid", DocumentNumber: "int", OurRef: "int", Project: "guid",
      Modified: "date" },
    filters: [
      "ID", "EntryID", "LineNumber", "Date", "Description", "AmountDC", "AmountFC", "Account", "AccountName",
      "GLAccount", "GLAccountCode", "GLAccountDescription", "OffsetID", "DocumentNumber", "OurRef", "Project",
      "Modified" ],
    key: "ID" },
  cash_entries: { resource: "financialtransaction/CashEntries", label: "cash book entries",
    fields: {
      EntryID: "guid", EntryNumber: "int", JournalCode: "text", JournalDescription: "text", FinancialYear: "int",
      FinancialPeriod: "int", Status: "int", Currency: "text", Modified: "date" },
    filters: [
      "EntryID", "EntryNumber", "JournalCode", "JournalDescription", "FinancialYear", "FinancialPeriod", "Status",
      "Currency", "Modified" ],
    key: "EntryID" },
  cash_entry_lines: { resource: "financialtransaction/CashEntryLines", label: "individual cash book lines",
    fields: {
      ID: "guid", EntryID: "guid", LineNumber: "int", Date: "date", Description: "text", AmountDC: "number",
      Account: "guid", AccountName: "text", GLAccount: "guid", GLAccountCode: "text", Project: "guid", Modified:
      "date" },
    filters: [
      "ID", "EntryID", "LineNumber", "Date", "Description", "AmountDC", "Account", "AccountName", "GLAccount",
      "GLAccountCode", "Project", "Modified" ],
    key: "ID" },
  banks: { resource: "cashflow/Banks", label: "the banks known to the administration",
    fields: {
      ID: "guid", BankName: "text", Description: "text", BICCode: "text", Country: "text", Format: "text", Status:
      "text", Modified: "date" },
    filters: [
      "ID", "BankName", "Description", "BICCode", "Country", "Format", "Status", "Modified" ],
    key: "ID" },
  payment_conditions: { resource: "cashflow/PaymentConditions", label: "payment terms (due days, discounts, direct debit)",
    fields: {
      ID: "guid", Code: "text", Description: "text", PaymentDays: "int", PaymentEndOfMonths: "int",
      DiscountPercentage: "number", DiscountPaymentDays: "int", PaymentMethod: "text", Percentage: "number",
      Modified: "date" },
    filters: [
      "ID", "Code", "Description", "PaymentDays", "PaymentEndOfMonths", "DiscountPercentage", "DiscountPaymentDays",
      "PaymentMethod", "Percentage", "Modified" ],
    key: "ID" },
  payments: { resource: "cashflow/Payments", label: "outgoing payments and their status",
    fields: {
      ID: "guid", AccountCode: "text", AccountName: "text", InvoiceNumber: "int", Description: "text", AmountDC:
      "number", TransactionAmountDC: "number", Currency: "text", InvoiceDate: "date", DueDate: "date", Status:
      "int", PaymentMethod: "text", PaymentCondition: "text", PaymentReference: "text", YourRef: "text",
      EntryNumber: "int", Modified: "date" },
    filters: [
      "ID", "AccountCode", "AccountName", "InvoiceNumber", "Description", "AmountDC", "TransactionAmountDC",
      "Currency", "InvoiceDate", "DueDate", "Status", "PaymentMethod", "PaymentCondition", "PaymentReference",
      "YourRef", "EntryNumber", "Modified" ],
    key: "ID" },
  cashflow_receivables: { resource: "cashflow/Receivables", label: "incoming payments expected from customers",
    fields: {
      ID: "guid", AccountCode: "text", AccountName: "text", InvoiceNumber: "int", Description: "text", AmountDC:
      "number", TransactionAmountDC: "number", Currency: "text", InvoiceDate: "date", DueDate: "date", Status:
      "int", IsFullyPaid: "boolean", LastPaymentDate: "date", PaymentMethod: "text", PaymentCondition: "text",
      YourRef: "text", EntryNumber: "int", Modified: "date" },
    filters: [
      "ID", "AccountCode", "AccountName", "InvoiceNumber", "Description", "AmountDC", "TransactionAmountDC",
      "Currency", "InvoiceDate", "DueDate", "Status", "IsFullyPaid", "LastPaymentDate", "PaymentMethod",
      "PaymentCondition", "YourRef", "EntryNumber", "Modified" ],
    key: "ID" },
  direct_debit_mandates: { resource: "cashflow/DirectDebitMandates", label: "SEPA direct debit mandates given by customers",
    fields: {
      ID: "guid", Reference: "text", Account: "guid", SignatureDate: "date", Type: "int", PaymentType: "int",
      FirstSend: "int", Main: "int", Description: "text", Modified: "date", BankAccount: "guid" },
    filters: [
      "ID", "Reference", "Account", "SignatureDate", "Type", "PaymentType", "FirstSend", "Main", "Description",
      "Modified", "BankAccount" ],
    key: "ID" },
} satisfies Record<string, CatalogResource>;
