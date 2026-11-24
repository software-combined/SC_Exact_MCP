import { z } from "zod";
import { companySchema, customerSchema, invoiceSchema, itemSchema, receivableSchema, statusLabel, type Operation } from "../domain/contracts.js";
import { ServiceError } from "../domain/identity.js";
import { financeRows, paymentStatuses } from "../domain/finance-contracts.js";

function sourceDate(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string") throw new Error("Invalid date");
  const match = /^\/Date\((-?\d+)(?:[+-]\d{4})?\)\/$/.exec(value);
  if (match) {
    const date = new Date(Number(match[1]));
    if (!Number.isFinite(date.getTime())) throw new Error("Invalid date");
    return date.toISOString().slice(0, 10);
  }
  if (z.iso.date().safeParse(value).success) return value;
  if (z.iso.datetime({ local: true }).safeParse(value).success) return value.slice(0, 10);
  throw new Error("Invalid date");
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid record");
  return value as Record<string, unknown>;
}

const wholeIdentifier = z.union([z.number().int().safe().nonnegative(), z.string().regex(/^\d+$/)]);
const sourceIdentifier = (value: unknown) => String(wholeIdentifier.parse(value));

export function bankLastFour(value: unknown) {
  if (value == null) return null;
  const number = z.string().max(100).parse(value).replace(/[\s-]/g, "").toUpperCase();
  return /^[A-Z0-9]{5,}$/.test(number) ? number.slice(-4) : null;
}

const paymentLabel = (value: unknown) =>
  (Object.keys(paymentStatuses) as (keyof typeof paymentStatuses)[]).find((label) => paymentStatuses[label] === value) ?? "other";

export function company(value: unknown) {
  try {
    const r = record(value);
    return companySchema.parse({ division: r.Code, name: r.Description, currency: r.Currency });
  } catch { throw new ServiceError("unavailable", "Exact returned invalid company data."); }
}

export function normalize(operation: Operation, value: unknown) {
  try {
    const r = record(value);
    switch (operation) {
      case "company_discovery": return company(r);
      case "customer_search": return customerSchema.parse({ id: r.ID, code: r.Code, name: r.Name });
      case "invoice_lookup": return invoiceSchema.parse({ id: r.InvoiceID, invoiceNumber: r.InvoiceNumber,
        customer: r.InvoiceToName, invoiceDate: sourceDate(r.InvoiceDate), dueDate: sourceDate(r.DueDate),
        currency: r.Currency, amount: r.AmountFC, status: r.Status,
        statusLabel: typeof r.Status === "number" ? statusLabel(r.Status) : undefined });
      case "item_search": return itemSchema.parse({ id: r.ID, code: r.Code, description: r.Description,
        standardSalesPrice: r.StandardSalesPrice ?? null });
      case "receivables": {
        return receivableSchema.parse({ id: sourceIdentifier(r.HID), customerId: r.AccountId, customerCode: r.AccountCode,
          customer: r.AccountName, invoiceNumber: r.InvoiceNumber, invoiceDate: sourceDate(r.InvoiceDate),
          dueDate: sourceDate(r.DueDate), currency: r.CurrencyCode, openAmount: r.Amount });
      }
      case "transaction_lines": return financeRows.transaction_lines.parse({
        id: r.ID, entryId: r.EntryID, entryNumber: r.EntryNumber, lineNumber: r.LineNumber, date: sourceDate(r.Date),
        year: r.FinancialYear, period: r.FinancialPeriod, journalCode: r.JournalCode ?? null, glAccountCode: r.GLAccountCode ?? null,
        glAccount: r.GLAccountDescription ?? null, description: r.Description ?? null, accountId: r.Account ?? null,
        account: r.AccountName ?? null, invoiceNumber: r.InvoiceNumber ?? null, type: r.Type, status: r.Status,
        amountCompanyCurrency: r.AmountDC, amountTransactionCurrency: r.AmountFC, transactionCurrency: r.Currency,
        costCentre: r.CostCenter ?? null, costUnit: r.CostUnit ?? null,
      });
      case "supplier_search": return financeRows.supplier_search.parse({
        id: r.ID, code: r.Code, name: r.Name, blocked: r.Blocked ?? null, paymentTerms: r.PaymentConditionPurchaseDescription ?? null,
      });
      case "supplier_bank_info": return financeRows.supplier_bank_info.parse({
        id: r.ID, supplierId: r.Account, supplier: r.AccountName ?? null, accountHolder: r.BankAccountHolderName ?? null,
        accountLastFour: bankLastFour(r.BankAccount), bic: r.BICCode ?? null, main: r.Main ?? null, blocked: r.Blocked ?? null,
      });
      case "assets": return financeRows.assets.parse({
        id: r.ID, code: r.Code, description: r.Description ?? null, groupCode: r.AssetGroupCode ?? null,
        depreciationMethod: r.PrimaryMethodDescription ?? null, investmentDate: sourceDate(r.InvestmentDate ?? null),
        depreciationStartDate: sourceDate(r.StartDate ?? null), endDate: sourceDate(r.EndDate ?? null), status: r.Status,
        investmentCompanyCurrency: r.InvestmentAmountDC ?? null, investmentAmount: r.InvestmentAmountFC ?? null,
        investmentCurrency: r.InvestmentCurrency === "" ? null : r.InvestmentCurrency ?? null, residualValue: r.ResidualValue ?? null,
      });
      case "open_payables": return financeRows.open_payables.parse({
        id: sourceIdentifier(r.HID), supplierId: r.AccountId, supplierCode: r.AccountCode ?? null, supplier: r.AccountName ?? null,
        invoiceEntryNumber: r.InvoiceNumber ?? null, supplierReference: r.YourRef ?? null, invoiceDate: sourceDate(r.InvoiceDate ?? null),
        dueDate: sourceDate(r.DueDate ?? null), currency: r.CurrencyCode, openAmount: r.Amount,
        amountInTransit: r.AmountInTransit ?? null, approvalStatus: r.ApprovalStatus ?? null,
      });
      case "payment_status": return financeRows.payment_status.parse({
        id: r.ID, supplierId: r.Account ?? null, supplierCode: r.AccountCode ?? null, supplier: r.AccountName ?? null,
        invoiceNumber: r.InvoiceNumber ?? null, purchaseLineId: r.TransactionID ?? null, amountCompanyCurrency: r.AmountDC,
        amount: r.AmountFC, currency: r.Currency, dueDate: sourceDate(r.DueDate ?? null),
        proposedDate: sourceDate(r.PaymentDateProposal ?? null), processingDate: sourceDate(r.EntryDate ?? null),
        batchNumber: r.PaymentBatchNumber ?? null, status: r.Status, statusLabel: paymentLabel(r.Status),
        paymentMethod: r.PaymentMethod ?? null, reference: r.PaymentReference ?? null, supplierBankAccountId: r.AccountBankAccountID ?? null,
      });
      case "bank_entries": return financeRows.bank_entries.parse({
        entryId: r.EntryID, entryNumber: r.EntryNumber, year: r.FinancialYear, period: r.FinancialPeriod, journalCode: r.JournalCode,
        journal: r.JournalDescription ?? null, currency: r.Currency, openingBalance: r.OpeningBalanceFC,
        closingBalance: r.ClosingBalanceFC, status: r.Status,
      });
      case "purchase_entries": return financeRows.purchase_entries.parse({
        entryId: r.EntryID, entryNumber: r.EntryNumber, invoiceNumber: r.InvoiceNumber ?? null, description: r.Description ?? null,
        supplierId: r.Supplier ?? null, supplier: r.SupplierName ?? null, supplierReference: r.YourRef ?? null,
        journalCode: r.Journal ?? null, invoiceDate: sourceDate(r.EntryDate ?? null), dueDate: sourceDate(r.DueDate ?? null),
        currency: r.Currency, amount: r.AmountFC, amountCompanyCurrency: r.AmountDC, vatAmount: r.VATAmountFC ?? null,
        status: r.Status, type: r.Type,
      });
      case "invoice_lines": return financeRows.invoice_lines.parse({
        id: r.ID, invoiceId: r.InvoiceID ?? r.EntryID, lineNumber: r.LineNumber, description: r.Description ?? null,
        quantity: r.Quantity ?? null, itemCode: r.ItemCode ?? null, glAccountCode: r.GLAccountCode ?? null,
        invoiceCurrency: r.InvoiceCurrency, amount: r.AmountFC, amountCompanyCurrency: r.AmountDC, vatAmount: r.VATAmountFC ?? null,
      });
      case "reporting_balances": return financeRows.reporting_balances.parse({
        id: sourceIdentifier(r.ID), year: r.ReportingYear, period: r.ReportingPeriod, glAccountCode: r.GLAccountCode,
        glAccount: r.GLAccountDescription ?? null, balanceType: r.BalanceType ?? null, costCentre: r.CostCenterCode ?? null,
        costUnit: r.CostUnitCode ?? null, type: r.Type, status: r.Status, amount: r.Amount, debit: r.AmountDebit,
        credit: r.AmountCredit, lineCount: r.Count,
      });
      case "journal_status": return financeRows.journal_status.parse({
        year: r.Year, period: r.Period, journalCode: r.Journal, journal: r.JournalDescription ?? null,
        journalType: r.JournalType, status: r.Status, statusLabel: r.StatusDescription ?? null,
      });
      case "gl_accounts": return financeRows.gl_accounts.parse({
        id: r.ID, code: r.Code, description: r.Description ?? null, type: r.Type, typeLabel: r.TypeDescription ?? null,
        balanceType: r.BalanceType ?? null, blocked: r.IsBlocked ?? null,
      });
    }
  } catch { throw new ServiceError("unavailable", "Exact returned invalid source fields. No complete financial result was established."); }
}
